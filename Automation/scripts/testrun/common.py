"""Shared helpers: paths, workbook reading, testcase-ID -> it() mapping in the story specs, handoff parsing."""
from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]  # the framework root: .../Automation (Mobile) or .../Automation/Mobile (Mobile + Web)


def _testcase_root() -> Path:
    """The testcase/ folder: TESTCASE_DIR if set; the framework's own testcase/ (flat layout); otherwise the
    shared <AutomationDir>/testcase/ one level up (Mobile + Web layout, shared by both frameworks)."""
    override = os.environ.get("TESTCASE_DIR", "").strip()
    if override:
        path = Path(override)
        return path if path.is_absolute() else (ROOT / path).resolve()
    own = ROOT / "testcase"
    shared = ROOT.parent / "testcase"
    return shared if not own.is_dir() and shared.is_dir() else own


TESTCASE_ROOT = _testcase_root()
INPUT_DIR = TESTCASE_ROOT / "Testcases"
OUTPUT_DIR = TESTCASE_ROOT / "Output Testcases"
SUITES_DIR = ROOT / "suites"
HANDOFF_DIR = ROOT / "automation-handoff"
TESTS_DIR = ROOT / "src" / "tests"
RESULTS_DIR = ROOT / "test-results"            # generated run output (Git-ignored)
TESTRUN_DIR = RESULTS_DIR / "testrun"          # selected-ids.txt, suite-files.txt
ALLURE_DIR = ROOT / "allure-results"
SCREENSHOTS_DIR = ROOT / "screenshots"
PLATFORM = "android"                           # the scripts cover Android only

STATUSES = ("Pass", "Fail", "Skip", "Blocked", "Not Executed")
# Test Case Type column of an updated workbook. Blank means existing; "invalidated" (older name) means deleted.
CASE_TYPES = ("new", "modified", "existing", "deleted")
CASE_TYPE_ALIASES = {"": "existing", "invalidated": "deleted"}


def console_utf8() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


class UserError(Exception):
    """A problem the user must fix; printed without a traceback."""


# ---------------------------------------------------------------- workbook ---

@dataclass
class Row:
    sheet: str
    story: str          # "US003"
    story_label: str    # "US-003"
    row: int
    test_id: str
    status: str         # effective status (Automation Status if filled, else Status)
    candidate: bool
    ios: bool
    priority: str = ""
    expected: str = ""
    steps: str = ""
    description: str = ""
    test_data: str = ""
    precondition: str = ""
    case_type: str = "existing"   # normalised Test Case Type; "existing" when the column is missing or blank
    case_type_raw: str = ""       # the cell text, for error messages

    def definition(self) -> tuple:
        """What the testcase asks for. Two workbook versions of an ID with equal definitions are the same testcase."""
        return (self.description, self.precondition, self.steps, self.test_data, self.expected, self.candidate)


DEFINITION_FIELDS = ("title", "pre-condition", "steps", "test data", "expected result", "automation candidate")


def changed_fields(old: Row, new: Row) -> list[str]:
    return [name for name, a, b in zip(DEFINITION_FIELDS, old.definition(), new.definition()) if a != b]


@dataclass
class SheetInfo:
    ws: object
    header_row: int
    cols: dict[str, int] = field(default_factory=dict)
    story: str = ""
    story_label: str = ""


def norm(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def clean_id(value) -> str:
    return norm(value).replace("﻿", "")


def normalize_status(value) -> str:
    text = norm(value).lower()
    for status in STATUSES:
        if status.lower() == text:
            return status
    return "Not Executed" if not text else norm(value)


def normalize_case_type(value) -> str:
    text = norm(value).lower().replace(" ", "")
    return CASE_TYPE_ALIASES.get(text, text)


def check_case_types(rows: list[Row]) -> None:
    """Stop on a Test Case Type value the scripts do not know: never guess what it means."""
    bad = [f"{r.test_id} ('{r.case_type_raw}')" for r in rows if r.case_type not in CASE_TYPES]
    if bad:
        raise UserError("Unknown Test Case Type value(s): " + ", ".join(bad[:10])
                        + f". Allowed: {', '.join(CASE_TYPES)} (blank = existing, invalidated = deleted).")


def story_of(title: str) -> tuple[str, str]:
    m = re.match(r"\s*(US)[-_ ]?(\d+)", title, re.I)
    if not m:
        return "", ""
    return f"US{m.group(2)}", f"US-{m.group(2)}"


def _columns(ws, header_row: int) -> dict[str, int]:
    cols: dict[str, int] = {}
    for cell in ws[header_row]:
        text = norm(cell.value).lower()
        if not text:
            continue
        if text == "test case id":
            cols["id"] = cell.column
        elif text == "status":
            cols["status"] = cell.column
        elif text == "automation status":
            cols["auto_status"] = cell.column
        elif text == "actual result":
            cols["actual"] = cell.column
        elif text == "automation remark":
            cols["remark"] = cell.column
        elif text.startswith("automation candidate"):
            cols["candidate"] = cell.column
        elif text == "ios testcase":
            cols["ios"] = cell.column
        elif text == "expected result":
            cols["expected"] = cell.column
        elif text == "test steps":
            cols["steps"] = cell.column
        elif text.startswith("priority"):
            cols["priority"] = cell.column
        elif text == "test description":
            cols["description"] = cell.column
        elif text == "test data":
            cols["test_data"] = cell.column
        elif text.replace("-", "").replace(" ", "") == "precondition":
            cols["precondition"] = cell.column
        elif text == "test case type":
            cols["case_type"] = cell.column
    return cols


def story_sheets(wb) -> list[SheetInfo]:
    """Every sheet that has a 'Test Case ID' header in its first rows (dashboards are ignored)."""
    found = []
    for ws in wb.worksheets:
        for r in range(1, 8):
            cols = _columns(ws, r)
            if "id" in cols:
                story, label = story_of(ws.title)
                found.append(SheetInfo(ws, r, cols, story, label))
                break
    return found


def read_rows(wb) -> list[Row]:
    rows = []
    for info in story_sheets(wb):
        ws, c = info.ws, info.cols

        def val(r, key):
            return ws.cell(r, c[key]).value if key in c else None

        for r in range(info.header_row + 1, ws.max_row + 1):
            tid = clean_id(val(r, "id"))
            if not tid:
                continue
            auto = norm(val(r, "auto_status"))
            status = normalize_status(auto if auto else val(r, "status"))
            rows.append(Row(
                sheet=ws.title, story=info.story, story_label=info.story_label, row=r, test_id=tid,
                status=status,
                candidate=norm(val(r, "candidate")).lower() == "yes",
                ios=norm(val(r, "ios")).lower() == "yes",
                priority=norm(val(r, "priority")),
                expected=norm(val(r, "expected")),
                steps=norm(val(r, "steps")),
                description=norm(val(r, "description")),
                test_data=norm(val(r, "test_data")),
                precondition=norm(val(r, "precondition")),
                case_type=normalize_case_type(val(r, "case_type")),
                case_type_raw=norm(val(r, "case_type")),
            ))
    return rows


def has_case_type_column(wb) -> bool:
    return any("case_type" in info.cols for info in story_sheets(wb))


def check_duplicates(rows: list[Row]) -> None:
    seen: dict[str, Row] = {}
    dups = []
    for row in rows:
        if row.test_id in seen:
            dups.append(f"{row.test_id} ({seen[row.test_id].sheet} row {seen[row.test_id].row} and {row.sheet} row {row.row})")
        seen[row.test_id] = row
    if dups:
        raise UserError("Duplicate testcase IDs in the workbook: " + "; ".join(dups))


def input_workbooks() -> list[Path]:
    return sorted(p for p in INPUT_DIR.glob("*.xlsx") if not p.name.startswith("~$"))


def resolve_workbooks(name: str | None) -> tuple[Path, Path]:
    """Return (input workbook, Android canonical output workbook).

    The canonical Android workbook is 'Android-<name>.xlsx' if it exists, otherwise the older
    un-prefixed '<name>.xlsx' (which holds the existing Android results). Never both."""
    inputs = input_workbooks()
    if not inputs:
        raise UserError(f"No input workbook (.xlsx) in {INPUT_DIR}.")
    if name:
        # An exact name wins, so "LoginV1" never also matches "LoginV10"; otherwise a unique part of the name.
        match = [p for p in inputs if p.name.lower() == name.lower() or p.stem.lower() == name.lower()]
        if not match:
            match = [p for p in inputs if name.lower() in p.stem.lower()]
        if len(match) != 1:
            raise UserError(f"--workbook '{name}' matched {len(match)} input workbooks: {[p.name for p in match]}. "
                            "Give the full file name.")
        src = match[0]
    elif len(inputs) == 1:
        src = inputs[0]
    else:
        # Several versions side by side (V1, V2 ...): never pick one silently, the newest is not always the one meant.
        raise UserError("More than one input workbook; pass -Workbook <name>. Input workbooks: "
                        + ", ".join(p.name for p in inputs))
    global _SCOPE_WORKBOOK
    _SCOPE_WORKBOOK = src
    prefixed = OUTPUT_DIR / f"Android-{src.name}"
    plain = OUTPUT_DIR / src.name
    if prefixed.exists() and plain.exists():
        raise UserError(f"Both '{prefixed.name}' and '{plain.name}' exist in Output Testcases; keep only one canonical workbook.")
    if prefixed.exists():
        return src, prefixed
    if plain.exists():
        return src, plain
    return src, prefixed  # does not exist yet; caller copies the INPUT workbook to this name


def ensure_output(src: Path, out: Path) -> bool:
    """Create the canonical workbook by copying the INPUT workbook. Returns True if created."""
    if out.exists():
        return False
    import shutil
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, out)
    return True


def resolve_previous(name: str) -> Path:
    """The earlier version's output workbook whose results are carried over: a file name or stem in
    Output Testcases, or a path."""
    path = Path(name)
    candidates = [path] if path.suffix.lower() == ".xlsx" and path.exists() else []
    if not candidates:
        stem = path.stem if path.suffix.lower() == ".xlsx" else path.name
        candidates = [p for p in OUTPUT_DIR.glob("*.xlsx")
                      if not p.name.startswith("~$") and (p.name.lower() == path.name.lower() or p.stem.lower() == stem.lower())]
    if len(candidates) != 1:
        found = ", ".join(p.name for p in OUTPUT_DIR.glob("*.xlsx") if not p.name.startswith("~$"))
        raise UserError(f"--previous '{name}' does not name exactly one output workbook. In Output Testcases: {found or 'none'}")
    return candidates[0].resolve()


def workbook_key(path: Path) -> str:
    """The <Workbook> part of suites/<Workbook>/<platform>/: the input workbook file name without .xlsx.
    An output workbook name ('Android-<name>.xlsx', or the older un-prefixed '<name>.xlsx') maps to the same key."""
    stem = path.stem
    return stem[len("Android-"):] if stem.lower().startswith("android-") else stem


def suite_root(key: str) -> Path:
    """suites/<Workbook>/android: story suites <Story>.json, and first/ passed/ failed/ full/ below it."""
    return SUITES_DIR / key / PLATFORM


# ------------------------------------------------------------ spec test map ---

@dataclass
class SpecTest:
    test_id: str
    spec: str      # spec path relative to the automation root, forward slashes
    title: str     # the full it() title: "TC_US003_001: Verify ..."
    file: Path
    line: int

    @property
    def where(self) -> str:
        return f"{self.file.name}:{self.line}"


# it('TC_US003_001: title', ...), also it.only / it.skip and template-literal titles. The ID rule is the framework's
# testCaseIdOf(): ^(TC_[A-Za-z0-9_]+): at the start of the title.
_IT_RE = re.compile(r"""\bit(?:\.only|\.skip)?\s*\(\s*(['"`])((TC_[A-Za-z0-9_]+):(?:\\.|(?!\1).)*)\1""", re.S)


# The confirmed input workbook, set by resolve_workbooks(). Its regression folder src/tests/regression/<stem>/ holds
# that workbook's story specs; IDs may repeat in other workbooks' folders, so only this folder is scanned when it
# exists. Without it (flat legacy layout, or before a moved folder exists) the whole src/tests tree is scanned.
_SCOPE_WORKBOOK: Path | None = None


def spec_scope() -> Path:
    if _SCOPE_WORKBOOK is not None:
        folder = TESTS_DIR / "regression" / _SCOPE_WORKBOOK.stem
        if folder.is_dir():
            return folder
    return TESTS_DIR


def smoke_scope() -> Path | None:
    """The workbook's smoke folder src/tests/smoke/<WorkbookName>/: P0 cases are implemented only there."""
    if _SCOPE_WORKBOOK is None:
        return None
    name = re.sub(r"[_\s-]*v\d+(?:[_.]\d+)*$", "", _SCOPE_WORKBOOK.stem, flags=re.I)
    name = re.sub(r"[_\s-]*test[_\s-]?cases$", "", name, flags=re.I)
    folder = TESTS_DIR / "smoke" / name
    return folder if folder.is_dir() else None


def spec_files() -> list[Path]:
    scope = spec_scope()
    files = set(scope.rglob("*.test.ts")) if scope.is_dir() else set()
    smoke = smoke_scope()
    if smoke is not None and scope != TESTS_DIR:
        files |= set(smoke.rglob("*.test.ts"))
    return sorted(files)


def method_map() -> tuple[dict[str, list[SpecTest]], list[str]]:
    """Scan src/tests/**/*.test.ts for it() titles that start with a testcase ID and a colon.
    P0 cases are implemented in the workbook's smoke folder, the others in its regression folder; both are scanned.
    Ignore legacy generated workbook-smoke projections (marker files).
    Returns ({id: [SpecTest...]}, warnings). Commented-out it() lines are ignored."""
    out: dict[str, list[SpecTest]] = {}
    for path in spec_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        if text.startswith(("// @generated workbook-smoke story=", "// @generated workbook-smoke workbook=")):
            continue
        if "TC_" not in text:
            continue
        for m in _IT_RE.finditer(text):
            line_start = text.rfind("\n", 0, m.start()) + 1
            if "//" in text[line_start:m.start()] or text[line_start:m.start()].lstrip().startswith("*"):
                continue
            tid = clean_id(m.group(3))
            rel = path.relative_to(ROOT).as_posix()
            out.setdefault(tid, []).append(
                SpecTest(tid, rel, " ".join(m.group(2).split()), path, text.count("\n", 0, m.start()) + 1))
    warnings = [f"{tid} maps to {len(ts)} it() tests: " + ", ".join(t.where for t in ts)
                for tid, ts in out.items() if len(ts) > 1]
    return out, warnings


# ----------------------------------------------------------------- handoff ---

@dataclass
class HandoffEntry:
    test_id: str
    state: str
    test: str      # the Test column (the it() title)
    note: str


def handoff_path(story: str) -> Path:
    return HANDOFF_DIR / f"{story}.md"


def read_handoff(story: str) -> dict[str, HandoffEntry] | None:
    path = handoff_path(story)
    if not path.exists():
        return None
    entries: dict[str, HandoffEntry] = {}
    section = ""
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            section = line[3:].strip().lower()
            continue
        if not section.startswith("testcases") or not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 4 or cells[0].lower() == "test case id" or set(cells[0]) <= {"-", " "}:
            continue
        entries[clean_id(cells[0])] = HandoffEntry(clean_id(cells[0]), cells[1], cells[2], cells[3])
    return entries


def add_repair(story: str, test_id: str, shown: str, cause: str) -> bool:
    """Append an Open row under 'Repairs needed' unless an Open one already exists. True if added."""
    path = handoff_path(story)
    if not path.exists():
        return False
    lines = path.read_text(encoding="utf-8").splitlines()
    start = next((i for i, l in enumerate(lines) if l.lower().startswith("## repairs needed")), None)
    if start is None:
        return False
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    for l in lines[start + 1:end]:
        if l.startswith("|") and test_id in l and l.strip().endswith("Open |"):
            return False
    shown = shown.replace("|", "/").replace("\n", " ")[:300]
    row = f"| {test_id} | {shown} | {cause} | Open |"
    table = [i for i in range(start + 1, end) if lines[i].startswith("|")]
    if table:
        lines.insert(table[-1] + 1, row)
    else:
        block = ["| Test Case ID | What the device showed | Suspected cause | State |", "| --- | --- | --- | --- |", row]
        pos = start + 1
        lines[pos:pos] = block
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return True
