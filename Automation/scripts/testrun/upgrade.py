"""Workbook update (a new version of the input workbook, for example V1 -> V2).

diff     compares the new input workbook with the previous version's output workbook and the story specs, and says per
         testcase ID what implement-testcases must do (Keep, Change, Add, Delete, or Check with the user).
prepare  creates the new version's canonical output workbook from its input workbook and carries over the results of
         the rows that did not change, so a First run executes only what is new or changed. Also rebuilds an existing
         output workbook in place when its input workbook was replaced under the same name.

The Test Case Type column decides what changed when the workbook has it (new, modified, existing, deleted; blank is
existing, invalidated is deleted). Without it, rows are compared field by field (title, pre-condition, steps, test
data, expected result, Automation Candidate) with the previous version.
"""
from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl

from common import (OUTPUT_DIR, Row, UserError, changed_fields, check_case_types, check_duplicates, has_case_type_column,
                    method_map, norm, read_handoff, read_rows, resolve_previous, resolve_workbooks, story_sheets)

RESULT_KEYS = ("actual", "status", "auto_status", "remark")


def _load(path: Path):
    wb = openpyxl.load_workbook(path)
    rows = read_rows(wb)
    check_duplicates(rows)
    check_case_types(rows)
    return wb, rows


# -------------------------------------------------------------------- diff ---

@dataclass
class Line:
    test_id: str
    story: str
    case_type: str     # column value, or "-" when the workbook has no Test Case Type column
    versus: str        # same | changed: <fields> | not in previous | - (no previous)
    method: str        # where the it() is (spec file:line), or "-"
    handoff: str       # Implemented | Blocked | -
    plan: str          # Keep | Change | Add | Delete | Check: <question> | Blocked | Nothing


@dataclass
class DiffReport:
    workbook: str
    previous: str
    has_type_column: bool
    lines: list[Line] = field(default_factory=list)


def diff(workbook_name: str | None, previous_name: str | None, stories: list[str] | None) -> DiffReport:
    src, _ = resolve_workbooks(workbook_name)
    wb, rows = _load(src)
    typed = has_case_type_column(wb)
    prev_rows: dict[str, Row] = {}
    prev_path = None
    if previous_name:
        prev_path = resolve_previous(previous_name)
        prev_rows = {r.test_id: r for r in _load(prev_path)[1]}
    mmap, _ = method_map()
    wanted = {s.upper().replace("-", "") for s in stories} if stories else None
    rep = DiffReport(src.name, prev_path.name if prev_path else "-", typed)
    handoffs: dict[str, dict | None] = {}

    def handoff_state(story: str, tid: str) -> str:
        if story not in handoffs:
            handoffs[story] = read_handoff(story)
        e = (handoffs[story] or {}).get(tid)
        return e.state if e else "-"

    seen: set[str] = set()
    for row in rows:
        if wanted and row.story not in wanted:
            continue
        seen.add(row.test_id)
        ms = mmap.get(row.test_id, [])
        method = ", ".join(m.where for m in ms) or "-"
        state = handoff_state(row.story, row.test_id)
        old = prev_rows.get(row.test_id)
        if not prev_rows:
            versus = "-"
        elif not old:
            versus = "not in previous"
        else:
            fields = changed_fields(old, row)
            versus = "same" if not fields else "changed: " + ", ".join(fields)
        ctype = row.case_type if typed else "-"
        rep.lines.append(Line(row.test_id, row.story_label, ctype, versus, method, state,
                              _plan(row, typed, versus, bool(ms), len(ms), state, bool(prev_rows))))

    # Code and earlier rows the new workbook no longer has
    gone = {tid for tid in mmap if tid not in {r.test_id for r in rows}}
    gone |= {tid for tid in prev_rows if tid not in {r.test_id for r in rows}}
    for tid in sorted(gone):
        old = prev_rows.get(tid)
        story = old.story if old else _story_from_id(tid)
        if wanted and story not in wanted:
            continue
        ms = mmap.get(tid, [])
        plan = ("Check: not in the new workbook; delete the test?" if ms else "Nothing (row gone, no code)")
        label = old.story_label if old else (f"US-{story[2:]}" if story else "")
        rep.lines.append(Line(tid, label, "-", "not in new workbook",
                              ", ".join(m.where for m in ms) or "-", handoff_state(story, tid), plan))
    return rep


def _story_from_id(tid: str) -> str:
    import re
    m = re.search(r"US[-_]?(\d+)", tid, re.I)
    return f"US{m.group(1)}" if m else ""


def _plan(row: Row, typed: bool, versus: str, has_method: bool, n_methods: int, state: str, has_prev: bool) -> str:
    if n_methods > 1:
        return f"Check: {n_methods} it() tests carry this ID"
    if not row.candidate:
        return "Check: no longer an Automation Candidate; delete the test?" if has_method else "Nothing (not a candidate)"
    t = row.case_type
    if typed and t == "deleted":
        return "Delete" if has_method or state != "-" else "Nothing (deleted, no code)"
    if typed and t == "new":
        return "Change (new, but an it() already has this ID)" if has_method else "Add"
    if typed and t == "modified":
        if has_method:
            return "Change"
        return "Re-check Blocked (modified)" if state == "Blocked" else "Add (modified, but no it() has this ID)"
    # existing, or no Test Case Type column
    if versus.startswith("changed"):
        if typed:
            return "Check: marked existing but its text changed; treat as modified?"
        if not has_method and state == "Blocked":
            return "Re-check Blocked (text changed)"
        return "Change" if has_method else "Add"
    if has_method:
        return "Keep"
    if state == "Blocked":
        return "Blocked (re-check only if its text changed)"
    return "Add" if (not typed or not has_prev or versus == "not in previous") else "Add (existing, but no it())"


def format_report(rep: DiffReport) -> str:
    out = [f"Workbook: {rep.workbook} | previous: {rep.previous} | Test Case Type column: {'yes' if rep.has_type_column else 'no'}",
           "", "| Test Case ID | Story | Type | Text vs previous | Test | Handoff | Plan |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for l in rep.lines:
        out.append(f"| {l.test_id} | {l.story} | {l.case_type} | {l.versus} | {l.method} | {l.handoff} | {l.plan} |")
    counts: dict[str, int] = {}
    for l in rep.lines:
        key = l.plan.split(" (")[0].split(":")[0]
        counts[key] = counts.get(key, 0) + 1
    out += ["", "Plan counts: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items()))]
    checks = [l for l in rep.lines if l.plan.startswith("Check")]
    if checks:
        out.append(f"Needs the user's decision ({len(checks)}): " + ", ".join(l.test_id for l in checks))
    return "\n".join(out)


# ----------------------------------------------------------------- prepare ---

@dataclass
class PrepareOutcome:
    output: Path
    action: str = ""                      # created | rebuilt | exists | planned
    carried: list[str] = field(default_factory=list)
    reset: dict[str, list[str]] = field(default_factory=dict)   # reason -> ids that start Not Executed
    deleted: list[str] = field(default_factory=list)
    dropped: list[str] = field(default_factory=list)            # ids only in the previous workbook
    test_data_carried: int = 0
    messages: list[str] = field(default_factory=list)
    rows: list[Row] = field(default_factory=list)                # rows of the (planned) output workbook


def _definitions_differ(input_rows: list[Row], out_rows: list[Row]) -> list[str]:
    a = {r.test_id: r for r in input_rows}
    b = {r.test_id: r for r in out_rows}
    out = [f"{i} only in the input workbook" for i in a if i not in b]
    out += [f"{i} only in the output workbook" for i in b if i not in a]
    out += [f"{i} changed ({', '.join(changed_fields(b[i], a[i]))})" for i in a if i in b and changed_fields(b[i], a[i])]
    out += [f"{i} Test Case Type changed" for i in a if i in b and a[i].case_type != b[i].case_type]
    return out


def prepare(workbook_name: str | None, previous_name: str | None, dry_run: bool) -> PrepareOutcome:
    """Make sure the canonical output workbook of the chosen input workbook exists and matches it."""
    src, out = resolve_workbooks(workbook_name)
    in_wb, in_rows = _load(src)
    prev = resolve_previous(previous_name) if previous_name else None
    rebuild = prev is not None and out.exists() and prev == out.resolve()

    if out.exists() and not rebuild:
        res = PrepareOutcome(out, "exists")
        out_rows = _load(out)[1]
        drift = _definitions_differ(in_rows, out_rows)
        if drift:
            raise UserError(
                f"{src.name} no longer matches its output workbook {out.name} ({len(drift)} difference(s): "
                + "; ".join(drift[:6]) + ("..." if len(drift) > 6 else "")
                + f"). The input workbook was replaced under the same name. Rebuild the output workbook with "
                  f"-Previous \"{out.name}\" (results of unchanged rows are kept), after implement-testcases has "
                  "updated the code for the new version.")
        if prev:
            res.messages.append(f"{out.name} already exists; -Previous {prev.name} was not needed and was ignored.")
        res.rows = out_rows
        return res

    if not prev:
        res = PrepareOutcome(out, "planned" if dry_run else "created")
        if not dry_run:
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            import shutil
            shutil.copy2(src, out)
            res.messages.append(f"Created canonical workbook {out.name} from the input workbook {src.name}.")
        else:
            res.messages.append(f"Dry run: {out.name} would be created from {src.name}.")
        res.rows = in_rows
        return res

    return _build_from_previous(src, out, prev, in_wb, in_rows, rebuild, dry_run)


def _build_from_previous(src: Path, out: Path, prev: Path, wb, rows: list[Row], rebuild: bool, dry_run: bool) -> PrepareOutcome:
    from workbook import _fingerprint  # same structural check the result writer uses

    res = PrepareOutcome(out, "planned" if dry_run else ("rebuilt" if rebuild else "created"))
    typed = has_case_type_column(wb)
    prev_wb, prev_rows_list = _load(prev)
    prev_rows = {r.test_id: r for r in prev_rows_list}
    prev_sheets = {info.ws.title: info for info in story_sheets(prev_wb)}
    sheets = {info.ws.title: info for info in story_sheets(wb)}
    before = _fingerprint(wb)
    planned: dict[str, tuple] = {}

    for row in rows:
        old = prev_rows.get(row.test_id)
        if row.case_type == "deleted":
            res.deleted.append(row.test_id)
            continue
        if not row.candidate:
            continue  # the scripts only ever touch Automation Candidate = Yes rows
        if not old:
            res.reset.setdefault("not in the previous workbook" if not typed or row.case_type != "new" else "new", []).append(row.test_id)
            continue
        if typed and row.case_type in ("new", "modified"):
            res.reset.setdefault(row.case_type, []).append(row.test_id)
            continue
        fields = changed_fields(old, row)
        if fields:
            reason = "marked existing but text changed" if typed else "text changed"
            res.reset.setdefault(reason, []).append(f"{row.test_id} ({', '.join(fields)})")
            continue
        info, pinfo = sheets[row.sheet], prev_sheets[old.sheet]
        values = {}
        for key in RESULT_KEYS:
            if key in info.cols and key in pinfo.cols:
                values[key] = pinfo.ws.cell(old.row, pinfo.cols[key]).value
                info.ws.cell(row.row, info.cols[key]).value = values[key]
        planned[row.test_id] = values
        res.carried.append(row.test_id)

    res.dropped = sorted(i for i in prev_rows if i not in {r.test_id for r in rows})
    res.test_data_carried = _carry_test_data(wb, prev_wb)
    res.rows = read_rows(wb)

    if res.dropped:
        res.messages.append(f"{len(res.dropped)} ID(s) of {prev.name} are not in {src.name} and were dropped: "
                            + ", ".join(res.dropped[:12]) + ("..." if len(res.dropped) > 12 else ""))
    if dry_run:
        res.messages.append(f"Dry run: {out.name} was not written.")
        return res

    wb.calculation.fullCalcOnLoad = True
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    lock = out.parent / f"~${out.name}"
    if lock.exists():
        raise UserError(f"{out.name} looks open in Excel ({lock.name} exists). Close it and rerun.")
    fd, tmp_name = tempfile.mkstemp(suffix=".xlsx", prefix="tmp-testrun-", dir=str(out.parent))
    os.close(fd)
    tmp = Path(tmp_name)
    try:
        wb.save(tmp)
        _verify_build(tmp, before, planned, res)
        try:
            os.replace(tmp, out)
        except PermissionError as exc:
            raise UserError(f"Cannot write {out.name}: it is open or locked. Close Excel and rerun.") from exc
    finally:
        if tmp.exists():
            tmp.unlink()
    verb = "Rebuilt" if rebuild else "Created"
    res.messages.insert(0, f"{verb} {out.name} from {src.name}; results of {len(res.carried)} unchanged row(s) "
                           f"carried over from {prev.name}.")
    return res


def _carry_test_data(wb, prev_wb) -> int:
    """Copy the Status of every Test Data ID found in both workbooks (Test Data Requirements sheet)."""
    def table(book):
        for ws in book.worksheets:
            for r in range(1, 8):
                heads = {norm(c.value).lower(): c.column for c in ws[r] if norm(c.value)}
                if "test data id" in heads and "status" in heads:
                    return ws, r, heads["test data id"], heads["status"]
        return None

    new, old = table(wb), table(prev_wb)
    if not new or not old:
        return 0
    ows, orow, oid, ostat = old
    old_status = {norm(ows.cell(r, oid).value): ows.cell(r, ostat).value for r in range(orow + 1, ows.max_row + 1)
                  if norm(ows.cell(r, oid).value)}
    nws, nrow, nid, nstat = new
    n = 0
    for r in range(nrow + 1, nws.max_row + 1):
        key = norm(nws.cell(r, nid).value)
        if key and key in old_status:
            nws.cell(r, nstat).value = old_status[key]
            n += 1
    return n


def _verify_build(tmp: Path, before: dict, planned: dict[str, dict], res: PrepareOutcome) -> None:
    from workbook import _fingerprint

    wb = openpyxl.load_workbook(tmp)
    after = _fingerprint(wb)
    if after != before:
        diffs = [s for s in before["per"] if before["per"][s] != after["per"].get(s)]
        raise UserError(f"Verification failed, output workbook NOT written. Sheets/structure changed: {diffs or 'sheet list'}")
    rows = {r.test_id: r for r in read_rows(wb)}
    sheets = {info.ws.title: info for info in story_sheets(wb)}
    for tid, values in planned.items():
        row = rows.get(tid)
        if not row:
            raise UserError(f"Verification failed: {tid} missing from the new output workbook")
        info = sheets[row.sheet]
        for key, value in values.items():
            if norm(info.ws.cell(row.row, info.cols[key]).value) != norm(value):
                raise UserError(f"Verification failed for {tid}: carried {key} was not saved")
    for reason, ids in res.reset.items():
        for item in ids:
            tid = item.split(" ")[0]
            row = rows.get(tid)
            if row and row.status != "Not Executed" and reason != "not in the previous workbook":
                res.messages.append(f"WARNING: {tid} ({reason}) is '{row.status}' in the input workbook, not Not Executed.")
