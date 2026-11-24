"""Write run results (results CSV) into the canonical Android workbook by exact testcase ID."""
from __future__ import annotations

import csv
import os
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl

import facts
from common import (STATUSES, Row, UserError, add_repair, check_duplicates, clean_id,
                    ensure_output, norm, read_handoff, read_rows, resolve_workbooks, story_sheets)

# The results CSV carries the sanitized WebdriverIO/Appium error message in Actual Result (there is no exception
# class column), so failures are classified by message text. Matched ignoring case.
# Element not found or a WebdriverIO wait timed out: a stale locator or a product change.
ELEMENT_ERRORS = ("wasn't found", "still not displayed", "still not existing", "still not enabled",
                  "still not clickable", "still displayed", "still existing", "no such element", "nosuchelement",
                  "stale element reference", "staleelementreference", "element not interactable",
                  "elementnotinteractable", "element click intercepted", "elementclickintercepted",
                  "waituntiltimeouterror", "waituntil condition timed out")
# No session, or the session was lost: nothing about the app was observed.
ENV_ERRORS = ("session not created", "sessionnotcreated", "failed to create session", "invalid session id",
              "nosuchsession", "a session is either terminated or not started", "econnrefused",
              "unable to connect to")
REVIEW_FLAG = "[NEEDS REVIEW: element not found or wait timed out - stale locator or a product change?]"
# The UiAutomator2 server froze or died, or no session could start: nothing about the app was observed.
HANG_MARKERS = ("Could not proxy command", "instrumentation process is not running",
                "Appium session creation failed", "UiAutomator2 Server cannot start")


@dataclass
class Record:
    test_id: str
    status: str
    actual: str
    remark: str
    evidence: str
    spec: str = ""
    title: str = ""


@dataclass
class Outcome:
    workbook: Path
    written: dict[str, tuple[str, str, str]] = field(default_factory=dict)  # id -> (status, actual, remark)
    flagged: list[str] = field(default_factory=list)
    repairs_added: list[str] = field(default_factory=list)
    counts: Counter = field(default_factory=Counter)
    by_story: dict[str, Counter] = field(default_factory=dict)
    messages: list[str] = field(default_factory=list)


def read_results(csv_path: Path, since: float | None = None) -> dict[str, Record]:
    if not csv_path.exists():
        raise UserError(f"Results file not found: {csv_path}")
    records: dict[str, Record] = {}
    with csv_path.open(encoding="utf-8-sig", newline="") as fh:
        for rec in csv.DictReader(fh):
            tid = clean_id(rec.get("Test Case ID"))
            if not tid:
                continue
            raw = rec.get("Execution Status") or rec.get("Status")  # header: Execution Status
            status = norm(raw).title() if norm(raw).lower() != "not executed" else "Not Executed"
            if status not in STATUSES:
                raise UserError(f"{tid}: unknown status '{raw}' in {csv_path.name}")
            # One row per finished attempt; the last row of an ID is its final attempt and wins.
            records[tid] = Record(tid, status, (rec.get("Actual Result") or "").strip(),
                                  (rec.get("Automation Remark") or "").strip(), facts.screenshot_of(tid, since),
                                  rec.get("Spec File") or "", rec.get("Test Title") or "")
    return records


def _error_kind(rec: Record) -> tuple[str, str]:
    """('env' | 'element' | '', the matched text) from the error message in Actual Result (and the remark)."""
    text = f"{rec.actual} {rec.remark}".lower()
    for kind, markers in (("env", ENV_ERRORS), ("element", ELEMENT_ERRORS)):
        hit = next((m for m in markers if m in text), "")
        if hit:
            return kind, hit
    return "", ""


def compose(rec: Record, row: Row, ai: bool, ai_budget: list[int]) -> tuple[str, str, str, bool]:
    """Return (status, actual, remark, flagged). Pass is only ever what the device run recorded."""
    status, actual, remark = rec.status, rec.actual, rec.remark
    kind, exc = _error_kind(rec)
    flagged = False
    if status == "Fail":
        parts: list[str] = []
        hang = next((m for m in HANG_MARKERS if m in actual or m in remark), "")
        if kind == "env":
            status = "Skip"
            parts.append(f"Environment problem, not a product result ('{exc}'). Rerun after fixing device/Appium.")
        elif hang:
            status = "Skip"
            parts.append(f"Environment problem, not a product result: the UI automation server stopped answering "
                         f"('{hang}'). Rerun with -Type fail; if it repeats, review the test's waits and polling.")
        else:
            if kind == "element":
                flagged = True
                parts.append(REVIEW_FLAG)
            parts.append(remark or ("" if actual else "Assertion failed."))
        fact = facts.screen_facts(rec.test_id)
        if fact:
            parts.append(fact)
        if rec.evidence:
            parts.append(f"Evidence: {rec.evidence}")
        if ai and status == "Fail" and ai_budget[0] > 0:
            ai_budget[0] -= 1
            note = facts.ai_note(rec.test_id, row.expected, row.steps, actual, exc, fact, rec.evidence)
            if note:
                parts.append(f"AI note: {note}")
        remark = " ".join(p for p in parts if p)
    elif status in ("Skip", "Blocked") and rec.evidence:
        remark = (remark + " " if remark else "") + f"Evidence: {rec.evidence}"
    return status, actual, remark, flagged


def _fingerprint(wb) -> dict:
    out = {"sheets": wb.sheetnames, "per": {}}
    for ws in wb.worksheets:
        formulas = sum(1 for row in ws.iter_rows() for c in row if isinstance(c.value, str) and c.value.startswith("="))
        out["per"][ws.title] = (formulas, len(ws.merged_cells.ranges), len(ws.data_validations.dataValidation),
                                len(ws.conditional_formatting), ws.max_row, ws.max_column)
    return out


def update(csv_path: Path | None, workbook_name: str | None, expect_file: Path | None, partial_ok: bool,
           ai_notes: bool, ai_max: int, sync_blocked: bool, stories: list[str] | None,
           handoff_repairs: bool, dry_run: bool, output_override: Path | None) -> Outcome:
    src, out = resolve_workbooks(workbook_name)
    if output_override:
        out = output_override
    created = False if output_override else ensure_output(src, out)
    outcome = Outcome(out)
    if created:
        outcome.messages.append(f"Created canonical workbook {out.name} from the input workbook.")
    lock = out.parent / f"~${out.name}"
    if lock.exists() and not dry_run:
        raise UserError(f"{out.name} looks open in Excel ({lock.name} exists). Close it and rerun.")

    # Evidence files count only when saved during this run: the selection file is written just before the run starts.
    since = expect_file.stat().st_mtime if expect_file and expect_file.exists() else None
    records = read_results(csv_path, since) if csv_path else {}
    if expect_file:
        expected = [l.strip() for l in expect_file.read_text(encoding="utf-8").splitlines() if l.strip()]
        missing = [i for i in expected if i not in records]
        if missing and not partial_ok:
            raise UserError(f"Incomplete run: {len(missing)} selected IDs have no result ({', '.join(missing[:8])}"
                            f"{'...' if len(missing) > 8 else ''}). Nothing was written. Rerun the scope, or pass --partial-ok.")
        extra = [i for i in records if i not in expected]
        if extra:
            outcome.messages.append(f"Ignoring {len(extra)} result(s) that were not selected: {', '.join(extra[:8])}")
            for i in extra:
                records.pop(i)
        if missing:
            outcome.messages.append(f"Partial run accepted: {len(missing)} selected ID(s) had no result and were left unchanged.")

    wb = openpyxl.load_workbook(out)
    before = _fingerprint(wb)
    rows = read_rows(wb)
    check_duplicates(rows)
    by_id = {r.test_id: r for r in rows}
    unknown = [i for i in records if i not in by_id or not by_id[i].candidate]
    if unknown:
        raise UserError("Result IDs not found as Automation Candidate = Yes rows in the workbook: " + ", ".join(unknown))
    sheets = {info.ws.title: info for info in story_sheets(wb)}

    def put(row: Row, status: str, actual: str, remark: str):
        """Writes only Automation Status and Automation Remark; Status and Actual Result stay as they are.
        The remark carries the actual result (observed value or failure reason) followed by the run remark."""
        info = sheets[row.sheet]
        c = info.cols
        ws = info.ws
        status_key = "auto_status" if "auto_status" in c else "status"  # a sheet without Automation Status
        combined = " | ".join(p for p in (actual.strip(), remark.strip()) if p)
        for key, value in ((status_key, status), ("remark", combined)):
            if key in c:
                ws.cell(row.row, c[key]).value = value
        outcome.written[row.test_id] = (status, actual, remark)
        outcome.counts[status] += 1
        outcome.by_story.setdefault(row.story_label or row.sheet, Counter())[status] += 1

    ai_budget = [ai_max]
    for tid, rec in records.items():
        row = by_id[tid]
        status, actual, remark, flagged = compose(rec, row, ai_notes, ai_budget)
        put(row, status, actual, remark)
        if flagged:
            outcome.flagged.append(tid)
            if handoff_repairs and not dry_run and add_repair(row.story, tid, actual, "locator"):
                outcome.repairs_added.append(tid)

    if sync_blocked:
        scope = {r.story for r in (by_id[i] for i in records)} | {s.upper().replace("-", "") for s in (stories or [])}
        for story in sorted(s for s in scope if s):
            handoff = read_handoff(story)
            if not handoff:
                continue
            for tid, entry in handoff.items():
                row = by_id.get(tid)
                if entry.state != "Blocked" or not row or not row.candidate or tid in records:
                    continue
                if row.status in ("Not Executed",):
                    put(row, "Blocked", "Not run: the device cannot show the state this testcase needs.", entry.note)

    if dry_run:
        outcome.messages.append("Dry run: nothing was saved.")
        return outcome
    if not outcome.written:
        outcome.messages.append("Nothing to write.")
        return outcome

    wb.calculation.fullCalcOnLoad = True  # dashboard formulas recalculate when Excel opens the file
    fd, tmp_name = tempfile.mkstemp(suffix=".xlsx", prefix="tmp-testrun-", dir=str(out.parent))
    os.close(fd)
    tmp = Path(tmp_name)
    try:
        wb.save(tmp)
        _verify(tmp, before, outcome)
        try:
            os.replace(tmp, out)
        except PermissionError as exc:
            raise UserError(f"Cannot replace {out.name}: it is open or locked. Close Excel and rerun.") from exc
    finally:
        if tmp.exists():
            tmp.unlink()
    return outcome


def _verify(tmp: Path, before: dict, outcome: Outcome) -> None:
    wb = openpyxl.load_workbook(tmp)
    after = _fingerprint(wb)
    if after != before:
        diffs = [s for s in before["per"] if before["per"][s] != after["per"].get(s)]
        raise UserError(f"Verification failed, workbook NOT replaced. Sheets/structure changed: {diffs or 'sheet list'}")
    rows = {r.test_id: r for r in read_rows(wb)}
    sheets = {info.ws.title: info for info in story_sheets(wb)}
    for tid, (status, actual, remark) in outcome.written.items():
        row = rows.get(tid)
        if not row or row.status != status:
            raise UserError(f"Verification failed for {tid}: expected status {status}, found {row.status if row else 'missing'}")
        info = sheets[row.sheet]
        combined = " | ".join(p for p in (actual.strip(), remark.strip()) if p)
        if "remark" in info.cols and norm(info.ws.cell(row.row, info.cols["remark"]).value) != norm(combined):
            raise UserError(f"Verification failed for {tid}: Automation Remark was not saved")
