"""Governed testcase workbook builder and shared constants/helpers.

Creates the reference-style Excel output required by SKILL.md:
- Dashboard (manual execution)
- Automation Dashboard (Automation Candidate == Yes, using Automation Status)
- iOS Dashboard (IOS Testcase == Yes, using manual Status)
- Config (central dropdown values)
- Test Data Requirements (unique execution-data prerequisites)
- One sheet per module / user story
- On a story update, the workbook is a separate copy holding only the updated sheets under their original names

The builder is intentionally data-driven. Test-design governance remains in SKILL.md and
references; this module provides core schemas, helpers, and exports.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence
import re


MANUAL_STATUSES = [
    "Not Executed", "Pass", "Fail", "Skip", "NA", "Blocked", "On Hold", "Deferred"
]
AUTOMATION_STATUSES = [
    "Not Executed", "Pass", "Fail", "Skip", "NA", "Blocked", "Test Data Dependency"
]
CATEGORIES = ["Functional", "Field Validation", "UI", "Compatibility", "Usability"]
TYPES = ["Positive", "Negative", "Edge Case"]
PRIORITIES = ["P0", "P1", "P2"]
YES_NO = ["Yes", "No"]
SOURCE_CLASSIFICATIONS = ["SOURCE", "DERIVED", "ADVISORY", "BLOCKED"]
TEST_DATA_STATUSES = ["Not Prepared", "Requested", "In Progress", "Available", "Blocked"]
TEST_CASE_TYPES = ["existing", "modified", "new", "invalidated"]

# Explicit order required by the governed workbook contract.
TESTCASE_HEADERS = [
    "Module",
    "Test Scenario ID",
    "Test Scenarios",
    "Test Case ID",
    "Test Description",
    "Requirement Reference",
    "Priority (P0/P1/P2)",
    "Pre-condition",
    "Type (Positive/Negative/Edge Case)",
    "Test Steps",
    "Test Data",
    "Expected Result",
    "Test Category",
    "Platform",
    "Actual Result",
    "Status",
    "Automation Candidate (Yes/No)",
    "Regression Candidate (Yes/No)",
    "IOS Testcase",
    "Source Type",
    "Remarks",
    "BA Comments",
    "Developer Status",
    "Developer Comment",
    "Automation Status",
    "Actual Automation Result",
    "Automation Remark",
]


@dataclass(frozen=True)
class ModuleSpec:
    sheet_name: str
    module_label: str
    cases: Sequence[Mapping[str, Any]]
    baseline_cases: Sequence[Mapping[str, Any]] = ()


def _safe_sheet_name(name: str, used: set[str]) -> str:
    """Return an Excel-safe <=31-char unique sheet name with complete words."""
    cleaned = re.sub(r"[\[\]:*?/\\]", "-", str(name)).strip() or "Module"
    if len(cleaned) > 31:
        if " " in cleaned[:31]:
            wb = cleaned[:31].rsplit(" ", 1)[0].strip()
            cleaned = wb if len(wb) >= 5 else cleaned[:31]
        else:
            cleaned = cleaned[:31]
    candidate = cleaned
    n = 2
    while candidate.casefold() in used:
        suffix = f"-{n}"
        candidate = (cleaned[: 31 - len(suffix)] + suffix).strip()
        n += 1
    used.add(candidate.casefold())
    return candidate


def _quote_sheet(name: str) -> str:
    return "'" + name.replace("'", "''") + "'"


def _first(mapping: Mapping[str, Any], *keys: str, default: Any = "") -> Any:
    for key in keys:
        if key in mapping and mapping[key] is not None:
            return mapping[key]
    return default


def _write_remarks_cell(ws: Any, r: int, c: int, val: Any, body_fmt: Any, bold_fmt: Any) -> None:
    """Render 'No automation reason:' with a bold title in Excel, supporting markdown syntax."""
    val_str = str(val or "")
    if "no automation reason" in val_str.lower():
        m = re.search(r"^(.*?)(?:\*{0,2}No automation reason:?\*{0,2}\s*)(.*)$", val_str, re.IGNORECASE | re.DOTALL)
        if m:
            prefix = m.group(1)
            reason = m.group(2).strip()
            bold_title = "No automation reason: "
            try:
                if prefix and reason:
                    ws.write_rich_string(r, c, prefix, bold_fmt, bold_title, body_fmt, reason, body_fmt)
                    return
                elif not prefix and reason:
                    ws.write_rich_string(r, c, bold_fmt, bold_title, body_fmt, reason, body_fmt)
                    return
                elif prefix and not reason:
                    ws.write_rich_string(r, c, prefix, bold_fmt, bold_title.rstrip(), body_fmt)
                    return
                else:
                    ws.write_rich_string(r, c, bold_fmt, bold_title.rstrip(), body_fmt)
                    return
            except Exception:
                pass
    ws.write(r, c, val, body_fmt)


def format_platform_cell(val: str) -> str:
    """Format platform string with proper display labels (Mobile App, Web, Mobile Web).
    
    Returns canonical single or combination labels, e.g.:
    - 'Mobile App'
    - 'Web'
    - 'Mobile Web'
    - 'Mobile App+Web'
    - 'Mobile App+Mobile Web'
    - 'Web+Mobile Web'
    - 'Mobile App+Web+Mobile Web'
    """
    if not val:
        return ""
    v = str(val).strip()
    if not v:
        return ""
    v_lower = v.lower()
    has_mobile_web = bool(re.search(r"\bmobile[\s_]+web\b", v_lower) or "pwa" in v_lower or "progressive web app" in v_lower)
    v_without_mw = re.sub(r"\bmobile[\s_]+web\b", "", v_lower)
    v_without_mw = re.sub(r"\bprogressive[\s_]+web[\s_]+app\b", "", v_without_mw)
    v_without_mw = re.sub(r"\bpwa\b", "", v_without_mw)
    tokens_without_mw = [t.strip() for t in re.split(r"[,/|;+]+", v_without_mw) if t.strip()]

    labels = []
    if any(any(k in t for k in ("mobile", "ios", "android", "app")) for t in tokens_without_mw) or "mobile app" in v_lower:
        labels.append("Mobile App")
    if any("web" in t for t in tokens_without_mw) or "website" in v_without_mw:
        labels.append("Web")
    if has_mobile_web:
        labels.append("Mobile Web")

    if labels:
        if len(labels) == 1:
            return labels[0]
        return "+".join(labels)
    return v


def should_include_ios_column(platform: str | None) -> bool:
    """Return True if the platform includes iOS and should render the 'IOS Testcase' column.
    
    Rule 3 & 4:
    - If platform is Android: remove IOS column from every user story tab.
    - For platforms Mobile Web, Web, Web + Mobile Web: IOS column should not be present in user story tabs.
    - If platform is Both Android and iOS, iOS, or combinations with Mobile App: IOS column IS present.
    """
    if not platform:
        return True
    p = str(platform).strip().lower()
    # Explicit Android-only platform
    if "android" in p and "ios" not in p and "both" not in p:
        return False
    # Pure web / mobile web platforms
    pure_web_variants = {
        "web", "mobile web", "mobile_web", "pwa",
        "web + mobile web", "web+mobile web", "web, mobile web",
        "web + pwa", "web+pwa", "web, pwa", "web_pwa",
    }
    if p in pure_web_variants:
        return False
    return True


def should_create_ios_dashboard(platform: str | None) -> bool:
    """Return True if iOS Dashboard tab should be created in the Excel workbook.
    
    Rule 3 & 4:
    - If platform is Android: ios dashboard tab should not be created in the excel.
    - For platforms Mobile Web, Web, Web + Mobile Web: ios dashboard tab should not be created.
    - If platform is Both Android and iOS, iOS, or combinations with Mobile App: ios dashboard tab IS created.
    """
    return should_include_ios_column(platform)


def is_ios_only_platform(platform: str | None) -> bool:
    """Return True if platform is iOS-only (Option 3 of Mobile App)."""
    if not platform:
        return False
    p = str(platform).strip().lower()
    return "ios" in p and "android" not in p and "both" not in p


def is_android_only_platform(platform: str | None) -> bool:
    """Return True if platform is Android-only (Option 2 of Mobile App)."""
    if not platform:
        return False
    p = str(platform).strip().lower()
    return "android" in p and "ios" not in p and "both" not in p


def _normalise_case(case: Mapping[str, Any], module_label: str, include_ios: bool = True, is_ios_only: bool = False) -> list[Any]:
    """Accept common governed key aliases and output TESTCASE_HEADERS order (conditionally including IOS Testcase)."""
    status = str(_first(case, "status", "Status", "execution_status", "Execution Status", default="Not Executed"))
    auto_status = str(_first(case, "automation_status", "Automation Status", default="Not Executed"))
    if status.lower() == "fail":
        status = "Fail"
    if auto_status.lower() == "fail":
        auto_status = "Fail"

    auto_val = str(_first(case, "automation", "automation_candidate", "Automation Candidate", "Automation Candidate (Yes/No)", default="No")).strip()
    remarks_val = str(_first(case, "remarks", "Remarks", default="") or "").strip()
    auto_remark_val = str(_first(case, "automation_remark", "Automation Remark", default="") or "").strip()

    if auto_val.casefold() == "no":
        if not re.search(r"No automation reason:", remarks_val, re.IGNORECASE):
            reason_text = auto_remark_val
            if reason_text:
                if remarks_val:
                    remarks_val = f"{remarks_val} | **No automation reason:** {reason_text}"
                else:
                    remarks_val = f"**No automation reason:** {reason_text}"
        # All remarks in Remarks column only: do not update or put reason in Automation Remark
        auto_remark_val = ""

    test_data_val = str(_first(case, "test_data", "data", "Test Data", default="") or "").strip()
    if test_data_val.casefold() in {"n/a", "na", "none", "not applicable", "null", "undefined", "no special test data"}:
        test_data_val = ""

    platform_val = str(_first(case, "platform", "Platform", "target_platform", default="") or "").strip()
    if not platform_val:
        platform_val = "Mobile App"

    ba_comments_val = str(_first(case, "ba_comments", "BA Comments", "ba_comment", "BA Comment", default="") or "").strip()

    if is_ios_only:
        ios_val = "Yes"
    else:
        ios_val = str(_first(case, "ios_testcase", "IOS Testcase", "iOS Testcase", default="")).strip()

    row = [
        _first(case, "module", "Module", default=module_label),
        _first(case, "scenario_id", "Test Scenario ID", "Scenario ID"),
        _first(case, "scenario", "Test Scenarios", "Test Scenario", "Scenario"),
        _first(case, "case_id", "Test Case ID", "test_case_id"),
        _first(case, "description", "Test Description", "desc", "Test Title"),
        _first(case, "requirement_reference", "Requirement Reference", "requirement", "AC ID"),
        _first(case, "priority", "Priority", "Priority (P0/P1/P2)", default="P1"),
        _first(case, "precondition", "precond", "Pre-condition", "Preconditions"),
        _first(case, "type", "type_", "Type", "Test Type", default="Positive"),
        _first(case, "steps", "Test Steps", "Steps"),
        test_data_val,
        _first(case, "expected_result", "expected", "Expected Result"),
        _first(case, "category", "Test Category", default="Functional"),
        platform_val,
        _first(case, "actual_result", "Actual Result"),
        status,
        auto_val,
        _first(case, "regression", "regression_candidate", "Regression Candidate", "Regression Candidate (Yes/No)", default=""),
    ]
    if include_ios:
        row.append(ios_val)
    row.extend([
        _first(case, "source_type", "Source Type", "source_classification", "Source Classification", default=""),
        remarks_val,
        ba_comments_val,
        _first(case, "developer_status", "Developer Status", default=""),
        _first(case, "developer_comment", "Developer Comment", "developer_comments", "Developer Comments", default=""),
        auto_status,
        _first(case, "actual_automation_result", "Actual Automation Result"),
        auto_remark_val,
    ])
    return row


def _parse_modules(modules: Iterable[Any]) -> list[ModuleSpec]:
    result: list[ModuleSpec] = []
    for item in modules:
        if isinstance(item, ModuleSpec):
            result.append(item)
            continue
        if isinstance(item, Mapping):
            sheet = str(_first(item, "sheet_name", "sheet", "title", "module", default="Module"))
            label = str(_first(item, "label", "module_label", "us_label", "module", default=sheet))
            cases = _first(item, "cases", "test_cases", default=[])
            baseline = _first(item, "baseline_cases", "baseline", default=[]) or []
            result.append(ModuleSpec(sheet, label, tuple(cases), tuple(baseline)))
            continue
        if isinstance(item, (tuple, list)) and len(item) == 3:
            sheet, label, cases = item
            result.append(ModuleSpec(str(sheet), str(label), tuple(cases), ()))
            continue
        raise TypeError("Each module must be ModuleSpec, mapping, or (sheet_name, module_label, cases)")
    if not result:
        raise ValueError("At least one module is required")
    return result


def _col_letter(idx_zero_based: int) -> str:
    idx = idx_zero_based + 1
    out = ""
    while idx:
        idx, rem = divmod(idx - 1, 26)
        out = chr(65 + rem) + out
    return out


def _sum_formula(parts: list[str]) -> str:
    return "=" + "+".join(parts) if parts else "=0"


def _quoted_criterion(value: str) -> str:
    if value.startswith('"') or value.startswith("$"):
        return value
    return f'"{value}"'


def _countifs(sheet: str | None, criteria: Sequence[tuple[str, str]], first: int, last: int) -> str:
    """COUNTIF/COUNTIFS for one sheet. A missing sheet counts as zero."""
    if not sheet or not criteria:
        return "=0"
    q = _quote_sheet(sheet)
    parts: list[str] = []
    for col, value in criteria:
        parts.append(f"{q}!${col}${first}:${col}${last}")
        parts.append(_quoted_criterion(value))
    if len(criteria) == 1:
        return f"=COUNTIF({parts[0]},{parts[1]})"
    return f"=COUNTIFS({','.join(parts)})"


def _sum_countifs(sheets: Sequence[str | None], criteria: Sequence[tuple[str, str]], first: int, last: int) -> str:
    parts = [_countifs(sheet, criteria, first, last)[1:] for sheet in sheets if sheet]
    return _sum_formula(parts) if parts else "=0"


def _active_total(sheet: str | None, extra: Sequence[tuple[str, str]], tct_col: str, first: int, last: int) -> str:
    """Existing + Modified + New on one sheet, excluding Invalidated."""
    if not sheet:
        return "=0"
    parts = [
        _countifs(sheet, list(extra) + [(tct_col, tct)], first, last)[1:]
        for tct in ("existing", "modified", "new")
    ]
    return "=" + "+".join(parts)


def _manual_count_formula(sheet: str, status_col: str, status: str, first: int, last: int) -> str:
    q = _quote_sheet(sheet)
    return f'=COUNTIF({q}!${status_col}${first}:${status_col}${last},"{status}")'


def _automation_count_formula(sheet: str, candidate_col: str, auto_status_col: str, status: str, first: int, last: int) -> str:
    q = _quote_sheet(sheet)
    return (
        f'=COUNTIFS({q}!${candidate_col}${first}:${candidate_col}${last},"Yes",'
        f'{q}!${auto_status_col}${first}:${auto_status_col}${last},"{status}")'
    )


def _cross_sheet_dimension_formula(
    sheets: Sequence[str], dim_col: str, row_ref: str, status_col: str | None,
    status: str | None, candidate_col: str | None, auto_status_col: str | None,
    first: int, last: int,
) -> str:
    parts: list[str] = []
    for sheet in sheets:
        q = _quote_sheet(sheet)
        criteria = [f'{q}!${dim_col}${first}:${dim_col}${last}', row_ref]
        if candidate_col:
            criteria += [f'{q}!${candidate_col}${first}:${candidate_col}${last}', '"Yes"']
        if status:
            col = auto_status_col if candidate_col else status_col
            assert col
            criteria += [f'{q}!${col}${first}:${col}${last}', f'"{status}"']
        joined = ",".join(criteria)
        parts.append(f"COUNTIFS({joined})")
    return _sum_formula(parts)


def normalize_project_mode(mode: str | None) -> str:
    """Normalize project mode string into one of the supported modes."""
    if not mode:
        return "GREENFIELD"
    m = re.sub(r"\s+", " ", str(mode)).strip()
    m_clean = m.upper().replace("—", "-").replace("–", "-")
    if m_clean in {"GREENFIELD", "MODE A", "MODE A: GREENFIELD"}:
        return "GREENFIELD"
    if m_clean in {"BROWNFIELD", "MODE B", "MODE B: BROWNFIELD"}:
        return "BROWNFIELD"
    if "GREENFIELD" in m_clean and ("UPDATED" in m_clean or "STORY" in m_clean):
        return "GREENFIELD With Updated User Story"
    if "BROWNFIELD" in m_clean and ("FROM SCRATCH" in m_clean or "EXISTING APP, FROM SCRATCH" in m_clean):
        return "Brownfield — Existing App, From Scratch"
    if "MODE E" in m_clean or "DELETE" in m_clean:
        return "Delete user story tab (Mode E)"
    return m


def is_update_mode(mode: str | None) -> bool:
    """True for Modes B, C, and D (modes that update an existing story)."""
    norm = normalize_project_mode(mode)
    return norm in {
        "BROWNFIELD",
        "GREENFIELD With Updated User Story",
        "Brownfield — Existing App, From Scratch",
    }


def is_delete_mode(mode: str | None) -> bool:
    """True strictly for Mode E: Delete user story tab."""
    return normalize_project_mode(mode) == "Delete user story tab (Mode E)"


def is_standalone_mode(mode: str | None) -> bool:
    """True strictly for standalone GREENFIELD (Mode A)."""
    norm = normalize_project_mode(mode)
    return norm == "GREENFIELD"


def is_greenfield_parity_mode(mode: str | None) -> bool:
    """True strictly for standalone GREENFIELD (Mode A)."""
    return normalize_project_mode(mode) == "GREENFIELD"


def normalize_confirmed_platforms(platforms: Any) -> list[str]:
    """Normalize input confirmed platforms into a canonical list, e.g. ['mobile app', 'web', 'mobile web']."""
    if not platforms:
        return []
    if isinstance(platforms, (list, tuple, set)):
        p_str = " ".join(str(p) for p in platforms).lower()
    else:
        p_str = str(platforms).lower()

    has_mw = bool(re.search(r"\bmobile[\s_]+web\b", p_str) or "pwa" in p_str or "progressive web app" in p_str)
    p_without_mw = re.sub(r"\bmobile[\s_]+web\b", "", p_str)
    p_without_mw = re.sub(r"\bprogressive[\s_]+web[\s_]+app\b", "", p_without_mw)
    p_without_mw = re.sub(r"\bpwa\b", "", p_without_mw)
    tokens = set(re.split(r"[,/|_\s+-]+", p_without_mw))

    res = []
    if any(k in tokens for k in ("mobile", "ios", "android", "app")) or "mobile app" in p_str:
        res.append("mobile app")
    if "web" in tokens or "website" in tokens:
        res.append("web")
    if has_mw:
        res.append("mobile web")
    return res


def detect_platform_evidence(text: str) -> dict:
    """Evidence-based platform detection adhering to Section 2 of the Platform Standard.
    Evaluates Mobile, Web, and Mobile Web across:
    1. Explicit evidence
    2. Supporting evidence
    3. Missing evidence
    4. Contradictory evidence
    5. Final classification
    6. Confidence level
    """
    text_lower = text.lower()

    # --- 1. Mobile Detection ---
    mobile_explicit_patterns = [
        r"\bios\b", r"\biphone\b", r"\bipad\b", r"\bswift\b", r"\bswiftui\b", r"\buikit\b",
        r"\bxcode\b", r"\btestflight\b", r"\bapp store\b", r"\bios app\b", r"\bnative ios\b",
        r"\bface id\b", r"\btouch id\b", r"\bapple pay\b", r"\bios simulator\b",
        r"\bandroid\b", r"\bkotlin\b", r"\bjetpack compose\b", r"\bandroid studio\b",
        r"\bapk\b", r"\baab\b", r"\bgoogle play store\b", r"\bandroid app\b", r"\bnative android\b",
        r"\bandroid emulator\b", r"\bbiometric prompt\b",
        r"\bflutter mobile\b", r"\breact native app\b", r"\bkotlin multiplatform mobile\b",
        r"\bkmp ios app\b", r"\bmobile sdk\b", r"\bdevice permissions\b", r"\bmobile push notifications\b",
        r"\bnative apps?\b", r"\binstalled from an? \.(?:apk|ipa)\b", r"\b\.apk\b", r"\b\.ipa\b",
        r"\breal android and ios devices\b", r"\bemulators and simulators\b", r"\breal devices?\b"
    ]
    mobile_supporting_patterns = [
        r"\bfigma\b", r"\bwireframes?\b", r"\bconnect me\b", r"\bmobile\b",
        r"\bpre login ui\b", r"\bpost login ui\b", r"\btaps?\b", r"\bswipes?\b"
    ]
    mobile_contradictory_patterns = [
        r"\bdesktop only\b", r"\bweb only\b", r"\bno mobile support\b"
    ]

    mobile_explicit = [p for p in mobile_explicit_patterns if re.search(p, text_lower)]
    mobile_supporting = [p for p in mobile_supporting_patterns if re.search(p, text_lower)]
    mobile_contradictory = [p for p in mobile_contradictory_patterns if re.search(p, text_lower)]

    mobile_missing = []
    if not mobile_explicit:
        mobile_missing.append("No explicit native iOS/Android SDK or OS version requirements specified")

    if (mobile_explicit or (mobile_supporting and "figma" in text_lower)) and not mobile_contradictory:
        mobile_status = "Confirmed"
        mobile_confidence = "High" if mobile_explicit else "Medium"
        mobile_reason = "Supported by mobile Figma wireframes and mobile UI interaction specifications."
    else:
        mobile_status = "Not Confirmed"
        mobile_confidence = "None"
        mobile_reason = "No native mobile requirements or mobile screen designs identified."

    # --- 2. Web Detection ---
    web_explicit_patterns = [
        r"\bwebsite in a desktop browser\b", r"\bdesktop browser\b", r"\bchromium\b",
        r"\bfirefox\b", r"\bwebkit\b", r"\bsafari engine\b", r"\bchrome,\s*edge\b",
        r"\bbrowser refresh\b", r"\bbrowser tabs\b", r"\bcookies\b", r"\blocal storage\b",
        r"\bsession storage\b", r"\bresponsive web\b", r"\bdesktop viewport\b",
        r"\b1920x1080\b", r"\bbrowser-based (?:application|app)\b"
    ]
    web_supporting_patterns = [
        r"\bwebsite\b", r"\bweb app\b", r"\bweb application\b", r"\bweb portal\b", r"\bweb dashboard\b"
    ]
    web_contradictory_patterns = [
        r"\bmobile only\b", r"\bnative app only\b", r"\bno web version\b"
    ]

    # Filter out external URL references like https://... which are not web app evidence
    text_without_external_urls = re.sub(r"https?://\S+", "", text_lower)

    web_explicit = [p for p in web_explicit_patterns if re.search(p, text_without_external_urls)]
    web_supporting = [p for p in web_supporting_patterns if re.search(p, text_without_external_urls)]
    web_contradictory = [p for p in web_contradictory_patterns if re.search(p, text_without_external_urls)]

    web_missing = []
    if not web_explicit:
        web_missing.append("No desktop browser UI specifications, browser storage, or browser-specific workflows")

    if web_explicit and not web_contradictory:
        web_status = "Confirmed"
        web_confidence = "High"
        web_reason = "Explicit browser-based application or desktop browser UI requirements found."
    elif web_supporting and not web_contradictory:
        web_status = "Confirmed"
        web_confidence = "Medium"
        web_reason = "Supporting web application/portal terminology identified in specification."
    else:
        web_status = "Not Confirmed"
        web_confidence = "None"
        web_reason = "No browser-based application requirements or desktop browser UI evidence in supplied documents."

    # --- 3. Mobile Web Detection ---
    pwa_explicit_patterns = [
        r"\bmobile\s+web\b", r"\bpwa\b", r"\bprogressive web app\b", r"\bservice worker\b", r"\bweb app manifest\b",
        r"\bmanifest\.json\b", r"\binstallable website\b", r"\badd to home screen\b",
        r"\binstall prompt\b", r"\bstandalone display mode\b"
    ]
    pwa_supporting_patterns = [
        r"\boffline web app\b", r"\bweb push api\b", r"\bbrowser cache\b", r"\bcache api\b",
        r"\bindexeddb\b", r"\bbackground sync\b"
    ]
    pwa_contradictory_patterns = [
        r"\bno mobile web\b", r"\bno pwa\b", r"\bnative only\b"
    ]

    pwa_explicit = [p for p in pwa_explicit_patterns if re.search(p, text_lower)]
    pwa_supporting = [p for p in pwa_supporting_patterns if re.search(p, text_lower)]
    pwa_contradictory = [p for p in pwa_contradictory_patterns if re.search(p, text_lower)]

    pwa_missing = []
    if not pwa_explicit:
        pwa_missing.append("No Service Worker, Web App Manifest, Add to Home Screen, or Mobile Web requirements specified")

    # Critical rule: Mobile Web detection
    if pwa_explicit and not pwa_contradictory:
        pwa_status = "Confirmed"
        pwa_confidence = "High"
        pwa_reason = "Explicit Mobile Web capabilities and manifest/service worker specified."
    elif pwa_supporting and not pwa_contradictory:
        pwa_status = "Confirmed"
        pwa_confidence = "Medium"
        pwa_reason = "Supporting offline caching / background sync capabilities specified for Mobile Web."
    else:
        pwa_status = "Not Confirmed"
        pwa_confidence = "None"
        pwa_reason = "No Mobile Web implementation requirements, manifest, or service worker found."

    # --- 4. Final Classification ---
    has_m = (mobile_status == "Confirmed")
    has_w = (web_status == "Confirmed")
    has_p = (pwa_status == "Confirmed")

    if has_m and not has_w and not has_p:
        classification = "mobile"
    elif not has_m and has_w and not has_p:
        classification = "web"
    elif not has_m and not has_w and has_p:
        classification = "mobile_web"
    elif has_m and has_w and not has_p:
        classification = "mobile+web"
    elif has_m and not has_w and has_p:
        classification = "mobile+mobile_web"
    elif not has_m and has_w and has_p:
        classification = "web+mobile_web"
    elif has_m and has_w and has_p:
        classification = "mobile+web+mobile_web"
    else:
        classification = None

    confirmed_list = []
    if has_m:
        confirmed_list.append("mobile app")
    if has_w:
        confirmed_list.append("web")
    if has_p:
        confirmed_list.append("mobile web")

    mobile_dict = {
        "explicit_evidence": [p.replace(r"\b", "") for p in mobile_explicit],
        "supporting_evidence": [p.replace(r"\b", "") for p in mobile_supporting],
        "missing_evidence": mobile_missing,
        "contradictory_evidence": [p.replace(r"\b", "") for p in mobile_contradictory],
        "status": mobile_status,
        "confidence": mobile_confidence,
        "reason": mobile_reason
    }

    web_dict = {
        "explicit_evidence": [p.replace(r"\b", "") for p in web_explicit],
        "supporting_evidence": [p.replace(r"\b", "") for p in web_supporting],
        "missing_evidence": web_missing,
        "contradictory_evidence": [p.replace(r"\b", "") for p in web_contradictory],
        "status": web_status,
        "confidence": web_confidence,
        "reason": web_reason
    }

    pwa_dict = {
        "explicit_evidence": [p.replace(r"\b", "") for p in pwa_explicit],
        "supporting_evidence": [p.replace(r"\b", "") for p in pwa_supporting],
        "missing_evidence": pwa_missing,
        "contradictory_evidence": [p.replace(r"\b", "") for p in pwa_contradictory],
        "status": pwa_status,
        "confidence": pwa_confidence,
        "reason": pwa_reason
    }

    # Overall confidence and review status
    if not classification:
        overall_confidence = "None"
        proj_review_req = True
        proj_review_remarks = "No supported platforms could be confirmed from documented evidence."
    elif any(p.get("confidence") == "Medium" for p in [mobile_dict, web_dict, pwa_dict] if p.get("status") == "Confirmed"):
        overall_confidence = "Medium"
        proj_review_req = False
        proj_review_remarks = ""
    else:
        overall_confidence = "High"
        proj_review_req = False
        proj_review_remarks = ""

    platforms_dict = {
        "Mobile": mobile_dict,
        "Web": web_dict,
        "Mobile Web": pwa_dict,
        "PWA": pwa_dict
    }

    return {
        "mobile": mobile_dict,
        "web": web_dict,
        "mobile_web": pwa_dict,
        "pwa": pwa_dict,
        "platforms": platforms_dict,
        "confirmed_platforms": confirmed_list,
        "project_classification": classification,
        "confidence": overall_confidence,
        "review_required": proj_review_req,
        "review_remarks": proj_review_remarks,
        "indicators": {"mobile": has_m, "web": has_w, "mobile_web": has_p, "pwa": has_p}
    }


def detect_platform(text: str) -> tuple[str | None, dict[str, bool]]:
    """Detect platform based on 7 combination rules from User Story document.
    Performs evidence-based platform classification.
    Returns (classification, indicators_dict).
    If no indicators match, classification is None.
    """
    evidence = detect_platform_evidence(text)
    return evidence["project_classification"], evidence["indicators"]


def classify_testcase_platform(case: dict, project_platforms: str | list[str] | set[str] | None = None) -> dict:
    """Test Case-Level Platform Applicability Engine (Sections 3, 4 & 5).
    Governed by the Automation Types definitions:
    - Mobile: Native apps installed from an .apk / .ipa
              Runs on: Real Android and iOS devices, emulators and simulators
    - Web: The website in a desktop browser
           Runs on: Chromium (Chrome, Edge), Firefox, WebKit (Safari engine)
    - Mobile Web: The web app as a phone user opens it: in the mobile browser, or installed to the home screen
           Runs on: Chrome on Android, Safari on iOS (real devices)

    Independently analyzes a test case across its title, scenario, steps, expected results,
    preconditions, and category to determine whether it is:
    - Mobile-specific (assigns 'mobile app')
    - Web-specific (assigns 'web')
    - Mobile Web-specific (assigns 'mobile web')
    - Shared Business Logic / Platform-Neutral (assigns confirmed project platforms)

    Applies the decision algorithm:
    Assigns strictly the intersection of required platforms and confirmed project platforms.
    """
    confirmed = normalize_confirmed_platforms(project_platforms)

    # Extract all textual content
    scn = str(case.get("scenario") or case.get("Test Title") or case.get("title") or "")
    desc = str(case.get("description") or case.get("desc") or "")
    steps = str(case.get("steps") or case.get("Test Steps") or "")
    er = str(case.get("expected_result") or case.get("expected") or "")
    prec = str(case.get("precondition") or case.get("precond") or "")
    rem = str(case.get("remarks") or "")
    cat = str(case.get("category") or case.get("Test Category") or "")

    full_text = f"{scn} {desc} {steps} {er} {prec} {rem} {cat}".lower()

    # --- 1. Mobile-Specific Signature Detection ---
    mobile_indicators = [
        r"\bface id\b", r"\btouch id\b", r"\bbiometric prompt\b", r"\bfingerprint\b",
        r"\bandroid:\b", r"\bios:\b", r"\bhardware back\b", r"\bswipe from left edge\b",
        r"\bback gesture\b", r"\bgesture-driven\b", r"\bdevice permissions?\b",
        r"\bcamera permission\b", r"\bnative camera\b", r"\bnative (?:file|document) picker\b",
        r"\bsystem file picker\b", r"\buidocumentpicker\b", r"\baction_get_content\b",
        r"\bphoto gallery picker intent\b", r"\bbackgrounding by os\b", r"\bapp lifecycle\b",
        r"\bnative deep link\b", r"\bpush notification tray\b"
    ]
    is_mobile_specific = any(re.search(p, full_text) for p in mobile_indicators)

    # --- 2. Web-Specific Signature Detection ---
    web_indicators = [
        r"\bdesktop browser\b", r"\bchromium\b", r"\bfirefox\b", r"\bwebkit\b",
        r"\bsafari engine\b", r"\bbrowser refresh\b", r"\bbrowser back/forward\b",
        r"\bbrowser url bar\b", r"\bbrowser tabs?\b", r"\bbrowser cookies?\b",
        r"\blocal storage\b", r"\bsession storage\b", r"\bdrag and drop\b", r"\bdrag-and-drop\b",
        r"\bdesktop file dialog\b", r"\bright-click context menu\b", r"\bdesktop viewport\b",
        r"\b1920x1080\b", r"\bbrowser download bar\b", r"\bbrowser download handling\b",
        r"\bkeyboard tab navigation\b"
    ]
    is_web_specific = any(re.search(p, full_text) for p in web_indicators)

    # --- 3. Mobile Web-Specific Signature Detection ---
    pwa_indicators = [
        r"\badd to home screen\b", r"\binstall prompt\b", r"\binstallable website\b",
        r"\ba2hs\b", r"\bstandalone display mode\b", r"\bweb app manifest\b",
        r"\bservice worker\b", r"\bcache api\b", r"\boffline resource caching\b",
        r"\bbackground sync\b", r"\bweb push api\b", r"\bpwa push notification\b",
        r"\bmobile\s+web\b"
    ]
    is_pwa_specific = any(re.search(p, full_text) for p in pwa_indicators)

    # --- Decision Algorithm (Intersection with Confirmed Project Platforms) ---
    review_required = "No"
    review_remarks = ""

    if is_mobile_specific and not is_web_specific and not is_pwa_specific:
        platform_type = "Mobile-specific"
        platform_evidence = "Scenario verifies mobile-native OS capabilities (biometrics, gestures, hardware back, or native picker)."
        assigned = "mobile app"
        if "mobile app" in confirmed or not confirmed:
            confidence = "High"
        else:
            confidence = "Low"
            review_required = "Yes"
            review_remarks = "Test scenario requires Mobile platform, but Mobile is not confirmed in project scope."

    elif is_web_specific and not is_mobile_specific and not is_pwa_specific:
        platform_type = "Web-specific"
        platform_evidence = "Scenario verifies desktop browser-specific behaviors, layout, storage, or drag-and-drop."
        assigned = "web"
        if "web" in confirmed:
            confidence = "High"
        else:
            confidence = "Low"
            review_required = "Yes"
            review_remarks = "Test scenario requires Web platform, but Web is not confirmed in project scope."

    elif is_pwa_specific and not is_mobile_specific:
        platform_type = "Mobile Web-specific"
        platform_evidence = "Scenario verifies Mobile Web capabilities (manifest, Service Worker, or Add to Home Screen)."
        assigned = "mobile web"
        if "mobile web" in confirmed or "pwa" in confirmed:
            confidence = "High"
        else:
            confidence = "Low"
            review_required = "Yes"
            review_remarks = "Test scenario requires Mobile Web platform, but Mobile Web is not confirmed in project scope."

    else:
        # Shared Business Logic / Platform-Neutral
        platform_type = "Shared"
        platform_evidence = "Shared business logic, calculations, field validations, or API workflows applicable across confirmed project platforms."

        # Assign strictly to confirmed project platforms
        if confirmed:
            assigned = ", ".join(confirmed)
            confidence = "High"
        else:
            assigned = "mobile app"
            confidence = "Medium"
            review_required = "Yes"
            review_remarks = "No project platforms confirmed; defaulted to mobile app pending platform confirmation."

    return {
        "project_platforms": ", ".join(confirmed) if confirmed else "None Confirmed",
        "assigned_platform": assigned,
        "platform_type": platform_type,
        "platform_evidence": platform_evidence,
        "confidence": confidence,
        "review_required": review_required,
        "review_remarks": review_remarks
    }


def resolve_platform_columns(
    platform_str: str = "",
    specs: Any = None,
) -> list[tuple[str, str]]:
    """Determine active platform columns for dashboards based on platforms detected in test cases.

    Only platforms that are present in the test cases' Platform column (or confirmed for project)
    are included. Multi-platform combinations (e.g. 'Mobile App+Web') form distinct columns so
    that each test case belongs to exactly one column, ensuring the sum of platform columns
    equals Total Test Cases.
    Returns a list of (display_name, formula_pattern) tuples, e.g.:
    [("Mobile App", "Mobile App"), ("Mobile App+Web", "Mobile App+Web")]
    """
    detected: list[str] = []
    seen: set[str] = set()

    def _add(p_raw: Any) -> None:
        if not p_raw:
            return
        p_str = str(p_raw).strip()
        if not p_str:
            return
        canon = format_platform_cell(p_str)
        if not canon:
            canon = "Mobile App"
        norm_key = canon.lower().replace(" ", "")
        if norm_key not in seen:
            seen.add(norm_key)
            detected.append(canon)

    # Inspect test cases across modules to collect all distinct platforms
    if specs:
        for spec in specs:
            cases = getattr(spec, "cases", None)
            if cases is None and isinstance(spec, dict):
                cases = spec.get("cases") or spec.get("test_cases")
            if not cases and isinstance(spec, (list, tuple)) and len(spec) >= 3:
                cases = spec[2]
            if cases:
                for c in cases:
                    if isinstance(c, dict):
                        c_plat = _first(c, "platform", "Platform", "target_platform", default="")
                        _add(c_plat)

    # Fallback to platform_str if no cases or no platforms found in specs
    if not detected and platform_str:
        _add(platform_str)

    # Ultimate fallback if nothing was detected anywhere
    if not detected:
        detected = ["Mobile App"]

    CANONICAL_ORDER = [
        "mobileapp",
        "web",
        "mobileweb",
        "mobileapp+web",
        "mobile+web",
        "mobileapp+mobileweb",
        "mobile+mobileweb",
        "web+mobileweb",
        "mobileapp+web+mobileweb",
        "mobile+web+mobileweb",
    ]

    def _order_key(name: str) -> tuple[int, str]:
        key = name.lower().replace(" ", "")
        if key in CANONICAL_ORDER:
            return (CANONICAL_ORDER.index(key), name)
        return (len(CANONICAL_ORDER), name)

    detected.sort(key=_order_key)
    return [(name, name) for name in detected]


# Re-export testbank merger functions and workbook builder for full backwards compatibility
def load_and_merge_testbank(*args, **kwargs):
    from testbank_merger import load_and_merge_testbank as _lmt
    return _lmt(*args, **kwargs)

def _matches_story(*args, **kwargs):
    from testbank_merger import _matches_story as _ms
    return _ms(*args, **kwargs)

def build_workbook(*args, **kwargs):
    import workbook_builder
    return workbook_builder.build_workbook(*args, **kwargs)


if __name__ == "__main__":
    raise SystemExit("Import build_workbook() from this module; see scripts/example_data.py")
