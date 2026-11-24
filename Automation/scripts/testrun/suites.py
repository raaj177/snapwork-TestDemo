"""Row selection per run type and JSON suite generation (replaces 'choosing what to run').

A suite is the shape of suites/templates/story-suite.template.json:
    {"story": "US003", "platform": "android", "spec": "src/tests/regression/<Workbook>/US-003. <Story title>.test.ts", "ids": ["TC_US003_001"]}
Story suites live in suites/<Workbook>/android/<Story>.json; run-type suites in suites/<Workbook>/android/<folder>/<Story>.json.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from common import (HANDOFF_DIR, PLATFORM, ROOT, TESTRUN_DIR, Row, SpecTest, UserError, handoff_path, method_map,
                    read_handoff, suite_root)

RUN_TYPES = ("first", "pass", "fail", "full")
FOLDER = {"first": "first", "pass": "passed", "fail": "failed", "full": "full"}
TITLE = {"first": "First Run", "pass": "Passed", "fail": "Failed", "full": "Full Run"}
STATUS_TYPES = ("pass", "fail")  # their folders mirror the workbook status and are refreshed after every run
# Suite folders of one workbook version. GENERATED_FOLDERS are written by the scripts (first/ ... full/) or the older
# execute-testcases CR flow (cr/): a workbook update always removes them. MANUAL_FOLDERS hold hand-made investigation
# suites (diagnostics/, reruns/): removed only when the user agreed (--include-manual), otherwise kept and listed.
GENERATED_FOLDERS = ("first", "passed", "failed", "full", "cr")
MANUAL_FOLDERS = ("diagnostics", "reruns")
STORY_FILE = re.compile(r"^(US\d+)(?:\.smoke)?\.json$", re.I)
SUITE_KEYS = ("story", "platform", "spec", "ids")


@dataclass
class Selection:
    run_type: str
    rows: list[Row] = field(default_factory=list)
    methods: dict[str, SpecTest] = field(default_factory=dict)
    left_out: list[tuple[str, str]] = field(default_factory=list)  # (id, reason)
    warnings: list[str] = field(default_factory=list)

    def ids(self) -> list[str]:
        return [r.test_id for r in self.rows]


def open_repairs(story: str) -> set[str]:
    path = handoff_path(story)
    if not path.exists():
        return set()
    out, section = set(), ""
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            section = line[3:].strip().lower()
        elif section.startswith("repairs needed") and line.startswith("|") and line.strip().endswith("Open |"):
            out.add(line.strip("| ").split("|")[0].strip())
    return out


def select(rows: list[Row], run_type: str, stories: list[str] | None = None,
           ids: list[str] | None = None) -> Selection:
    if run_type not in RUN_TYPES:
        raise UserError(f"Run type must be one of {RUN_TYPES}.")
    mmap, dup_warnings = method_map()
    sel = Selection(run_type, warnings=dup_warnings)
    handoffs: dict[str, dict | None] = {}
    repairs: dict[str, set[str]] = {}
    wanted = {s.upper().replace("-", "") for s in stories} if stories else None
    wanted_ids = {i.strip() for i in ids} if ids else None
    if wanted_ids:
        unknown = sorted(wanted_ids - {r.test_id for r in rows})
        if unknown:
            raise UserError(f"--ids not found in the workbook: {', '.join(unknown)}")

    for row in rows:
        if wanted and row.story not in wanted:
            continue
        if wanted_ids and row.test_id not in wanted_ids:
            continue
        if not row.candidate:
            continue  # Automation Candidate = No: out of scope, silently ignored
        if row.story not in handoffs:
            handoffs[row.story] = read_handoff(row.story)
            repairs[row.story] = open_repairs(row.story)
        handoff = handoffs[row.story]
        entry = handoff.get(row.test_id) if handoff else None
        status = row.status

        if run_type == "first":
            wanted_status = status == "Not Executed" or (status == "Blocked" and entry and entry.state == "Implemented")
        elif run_type == "pass":
            wanted_status = status == "Pass"
        elif run_type == "fail":
            # Skip rows are environment failures (session lost, UI server frozen): rerun them with the failures.
            wanted_status = status in ("Fail", "Skip")
        else:
            wanted_status = True
        if not wanted_status:
            continue

        if row.case_type == "deleted":
            sel.left_out.append((row.test_id, "deleted in the workbook (Test Case Type), never run"))
            continue
        if entry and entry.state == "Blocked":
            sel.left_out.append((row.test_id, "Blocked in the handoff (never run)"))
            continue
        ms = mmap.get(row.test_id, [])
        if not ms:
            if handoff is None:
                sel.left_out.append((row.test_id, "no handoff file and no it() titled with this ID: run implement-testcases first"))
            else:
                sel.left_out.append((row.test_id, "no it() titled with this ID (not implemented)"))
            continue
        if len(ms) > 1:
            sel.left_out.append((row.test_id, f"{len(ms)} it() tests carry this ID"))
            continue
        if row.test_id in repairs[row.story]:
            sel.left_out.append((row.test_id, "Open repair in the handoff"))
            continue
        sel.rows.append(row)
        sel.methods[row.test_id] = ms[0]
    return sel


def write_selection_file(sel: Selection, name: str = "selected-ids.txt") -> Path:
    TESTRUN_DIR.mkdir(parents=True, exist_ok=True)
    path = TESTRUN_DIR / name
    path.write_text("\n".join(sel.ids()) + ("\n" if sel.rows else ""), encoding="utf-8")
    return path


# ------------------------------------------------------------------ suites ---

def _suite_json(story: str, spec: str, ids: list[str]) -> str:
    return json.dumps({"story": story, "platform": PLATFORM, "spec": spec, "ids": ids}, indent=2) + "\n"


def _story_specs(story: str, rows: list, spec_of) -> dict[str, tuple[str, list[str]]]:
    """A story's suites: {file stem: (spec, ids)}. P0 cases live only in the story's smoke spec and P1/P2 cases only in
    its regression spec (implement-testcases-v2 p0-smoke.md section 2), so a story has at most one spec of each kind:
    <Story>.json for the regression spec and <Story>.smoke.json for the smoke spec."""
    out: dict[str, tuple[str, list[str]]] = {}
    for r in rows:
        spec = spec_of(r)
        stem = f"{story}.smoke" if spec.startswith("src/tests/smoke/") else story
        if stem in out and out[stem][0] != spec:
            raise UserError(f"{story}: its testcases are spread over more than one {'smoke' if stem.endswith('.smoke') else 'regression'} "
                            f"spec ({out[stem][0]}, {spec}); a story has at most one smoke spec (P0) and one regression spec (P1/P2). "
                            "Fix it with implement-testcases first.")
        out.setdefault(stem, (spec, []))[1].append(r.test_id)
    return out


@dataclass
class SuiteResult:
    folder: Path
    story_files: dict[str, Path]
    removed: list[Path]
    counts: dict[str, int]


def generate(sel: Selection, key: str, scope_stories: list[str] | None = None) -> SuiteResult:
    """Write one suite per story under suites/<Workbook>/android/<folder>/. Validates before returning."""
    folder = suite_root(key) / FOLDER[sel.run_type]
    folder.mkdir(parents=True, exist_ok=True)

    by_story: dict[str, list[Row]] = {}
    for r in sel.rows:
        by_story.setdefault(r.story, []).append(r)

    # Stale generated files: for a refresh of the whole workbook remove files of stories that no longer
    # have rows; for a story-scoped run only that story's file is touched. passed/ and failed/ are
    # status folders (refreshed after every run), so a story-scoped run keeps the other stories' files.
    suites = {story: _story_specs(story, rs, lambda r: sel.methods[r.test_id].spec) for story, rs in by_story.items()}
    wanted_stems = {stem.upper() for parts in suites.values() for stem in parts}
    removed: list[Path] = []
    in_scope = {s.upper().replace("-", "") for s in scope_stories} if scope_stories else None
    for f in folder.glob("*.json"):
        m = STORY_FILE.match(f.name)
        if not m:
            continue
        story = m.group(1).upper()
        if f.stem.upper() in wanted_stems:
            continue
        if sel.run_type in STATUS_TYPES and in_scope is not None and story not in in_scope:
            continue
        f.unlink()
        removed.append(f)

    story_files: dict[str, Path] = {}
    counts: dict[str, int] = {}
    for story, parts in suites.items():
        for stem, (spec, ids) in parts.items():
            path = folder / f"{stem}.json"
            path.write_text(_suite_json(story, spec, ids), encoding="utf-8")
            story_files[stem] = path
            counts[stem] = len(ids)
    result = SuiteResult(folder, story_files, removed, counts)
    validate(result.story_files.values(), len(sel.rows))
    return result


def validate(files, expected_ids: int) -> None:
    """Parse every suite, check its shape, that the spec exists and holds exactly one it() per ID, reconcile counts."""
    mmap, _ = method_map()
    included = 0
    for path in files:
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        except ValueError as exc:
            raise UserError(f"{path.name}: not valid JSON ({exc})") from exc
        if not isinstance(data, dict) or any(k not in data for k in SUITE_KEYS) or not isinstance(data["ids"], list):
            raise UserError(f"{path.name}: expected the keys {', '.join(SUITE_KEYS)} (suites/templates/story-suite.template.json)")
        if data["platform"] != PLATFORM:
            raise UserError(f"{path.name}: platform is '{data['platform']}', expected '{PLATFORM}'")
        if not (ROOT / data["spec"]).is_file():
            raise UserError(f"{path.name}: spec {data['spec']} not found")
        for tid in data["ids"]:
            tests = [t for t in mmap.get(tid, []) if t.spec == data["spec"]]
            if len(tests) != 1:
                raise UserError(f"{path.name}: {len(tests)} it() titled '{tid}:' in {data['spec']} (expected 1)")
            included += 1
    if included != expected_ids:
        raise UserError(f"Suite reconcile failed: {expected_ids} selected IDs but {included} IDs in the suites")


def write_run_list(files) -> Path:
    """The suite files of this run, one path per line (relative to the automation root): run-tests.ps1 reads them."""
    TESTRUN_DIR.mkdir(parents=True, exist_ok=True)
    path = TESTRUN_DIR / "suite-files.txt"
    path.write_text("".join(Path(f).relative_to(ROOT).as_posix() + "\n" for f in files), encoding="utf-8")
    return path


def clear(run_type: str, key: str) -> list[Path]:
    """Remove every generated suite file of a status folder (refresh found no row with that status)."""
    folder = suite_root(key) / FOLDER[run_type]
    if not folder.is_dir():
        return []
    removed = []
    for f in folder.glob("*.json"):
        if STORY_FILE.match(f.name):
            f.unlink()
            removed.append(f)
    return removed


# ------------------------------------------------------- workbook update reset ---

@dataclass
class ResetResult:
    folder: Path
    removed: list[Path] = field(default_factory=list)
    written: dict[str, int] = field(default_factory=dict)   # story suite file name -> ID count
    no_method: list[str] = field(default_factory=list)      # rows of automated stories with neither an it() nor a Blocked entry
    not_automated: list[str] = field(default_factory=list)  # stories with no it() and no handoff yet
    kept_manual: list[Path] = field(default_factory=list)   # hand-made suites left in place (no --include-manual)
    blocked: dict[str, list[str]] = field(default_factory=dict)  # story -> Blocked IDs (no it(), listed in the handoff)


def reset_for_update(rows: list[Row], key: str, previous_key: str | None = None, dry_run: bool = False,
                     include_manual: bool = False) -> ResetResult:
    """A new workbook version replaces the old version's suites: every generated suite (first/, passed/, failed/, full/,
    cr/) of the new workbook's folder and of the previous version's folder is removed, the previous version's story
    suites are removed, and every story suite suites/<Workbook>/android/<Story>.json is rewritten from the new workbook
    (IDs of rows that are Automation Candidate = Yes, not deleted and have an it(), in workbook order). Story suites of
    stories with no such it() are removed. The status folders fill again after the first run of the new version."""
    mmap, dup_warnings = method_map()
    if dup_warnings:
        raise UserError("Fix duplicated it() testcase IDs first: " + "; ".join(dup_warnings))
    base = suite_root(key)
    res = ResetResult(base)

    wanted: dict[str, list[Row]] = {}
    handoffs: dict[str, dict | None] = {}
    # A story counts as automated once it has an it() or an Android handoff file.
    automated = {r.story for r in rows if r.test_id in mmap}
    if HANDOFF_DIR.is_dir():
        automated |= {f.stem.upper() for f in HANDOFF_DIR.glob("US*.md") if not f.stem.lower().endswith("-ios")}
    for row in rows:
        if not row.story or not row.candidate or row.case_type == "deleted":
            continue
        if row.story not in automated:
            if row.story not in res.not_automated:
                res.not_automated.append(row.story)
            continue
        if row.story not in handoffs:
            handoffs[row.story] = read_handoff(row.story)
        entry = (handoffs[row.story] or {}).get(row.test_id)
        if row.test_id in mmap:
            wanted.setdefault(row.story, []).append(row)
        elif entry and entry.state == "Blocked":
            res.blocked.setdefault(row.story, []).append(row.test_id)
        else:
            res.no_method.append(row.test_id)

    def drop(f: Path) -> None:
        res.removed.append(f)
        if not dry_run:
            f.unlink()

    bases = [base]
    if previous_key and suite_root(previous_key) != base:
        bases.append(suite_root(previous_key))
    for folder_base in bases:
        # 1. generated suites of the old version (always), hand-made ones only with the user's agreement
        for name in GENERATED_FOLDERS:
            folder = folder_base / name
            if folder.is_dir():
                for f in sorted(folder.glob("*.json")):
                    drop(f)
        for name in MANUAL_FOLDERS:
            folder = folder_base / name
            if folder.is_dir():
                for f in sorted(folder.glob("*.json")):
                    if include_manual:
                        drop(f)
                    else:
                        res.kept_manual.append(f)

    # 2. story suites: the previous version's are removed; the new folder's are rewritten or removed
    suites = {story: _story_specs(story, rs, lambda r: mmap[r.test_id][0].spec) for story, rs in wanted.items()}
    keep = {f"{stem}.json".upper() for parts in suites.values() for stem in parts}
    for folder_base in bases:
        if folder_base.is_dir():
            for f in sorted(folder_base.glob("*.json")):
                if STORY_FILE.match(f.name) and (folder_base != base or f.name.upper() not in keep):
                    drop(f)
    for story, parts in suites.items():
        for stem, (spec, ids) in parts.items():
            path = base / f"{stem}.json"
            res.written[path.name] = len(ids)
            if not dry_run:
                base.mkdir(parents=True, exist_ok=True)
                path.write_text(_suite_json(story, spec, ids), encoding="utf-8")
    if not dry_run:
        validate([base / name for name in res.written], sum(res.written.values()))
    return res
