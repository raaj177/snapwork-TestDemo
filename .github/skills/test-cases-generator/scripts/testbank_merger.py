"""Test bank loading and merging functionality for test-cases-generator.
Preserves existing sheets, updates specified user stories, and handles Mode E deletions.
"""
from __future__ import annotations

import copy
import re
from pathlib import Path
from typing import Any

from common import (
    is_delete_mode,
    is_update_mode,
    normalize_project_mode,
)


def _matches_story(sheet: str, label: str, target: str) -> bool:
    """Check if sheet name or module label matches target user story to delete."""
    t = str(target or "").strip().lower()
    s = str(sheet or "").strip().lower()
    l = str(label or "").strip().lower()
    if not t:
        return False
    if t == s or t == l:
        return True

    def clean(x: str) -> str:
        return re.sub(r"[^a-z0-9]", "", str(x or "").lower())

    ct = clean(t)
    cs = clean(s)
    cl = clean(l)
    if not ct:
        return False
    if ct == cs or ct == cl:
        return True

    # Word boundary substring match on raw strings
    pattern = re.escape(t)
    if re.search(r"\b" + pattern + r"\b", s, re.IGNORECASE) or re.search(r"\b" + pattern + r"\b", l, re.IGNORECASE):
        return True

    # Clean prefix check ensuring boundary at digit transitions
    for cand in (cs, cl):
        if cand.startswith(ct):
            remainder = cand[len(ct):]
            if not remainder or not remainder[0].isdigit():
                return True
        if ct.startswith(cand) and len(cand) >= 3:
            remainder = ct[len(cand):]
            if not remainder or not remainder[0].isdigit():
                return True

    return False


def load_and_merge_testbank(
    data: dict[str, Any],
    source_wb_path: str | Path | None = None,
    delete_story: str | list[str] | None = None,
) -> dict[str, Any]:
    """Load designated test bank (.xlsx) and merge with data:
    - Retain and copy all existing module sheets from the test bank as-is.
    - If Mode E (or delete_story specified), remove the user story tab/module that is no longer part of application.
    - Update only the user story given in the BRD (matching module sheet, or added if new).
    - Merge / clean up Test Data Requirements.
    - If platform not set and iOS Dashboard exists in test bank, set platform='mobile app'.
    """
    source_path = source_wb_path or data.get("source_workbook")
    if not source_path:
        return data

    p = Path(source_path).expanduser()
    if not p.is_file():
        return data

    try:
        import openpyxl
    except ImportError:
        return data

    wb = openpyxl.load_workbook(str(p), data_only=True)
    exclude = {"dashboard", "automation dashboard", "ios dashboard", "config", "test data requirements"}
    source_modules = []

    project_mode = normalize_project_mode(data.get("project_mode", "BROWNFIELD"))
    delete_mode = is_delete_mode(project_mode)
    update_mode = is_update_mode(project_mode)

    # Gather delete targets
    delete_targets: list[str] = []
    del_val = (
        delete_story
        or data.get("delete_story")
        or data.get("delete_stories")
        or data.get("deleted_story")
        or data.get("deleted_user_story")
        or data.get("delete_user_story")
        or data.get("delete_sheet")
        or data.get("deleted_sheets")
    )
    if del_val:
        if isinstance(del_val, str):
            delete_targets = [x.strip() for x in del_val.split(",") if x.strip()]
        elif isinstance(del_val, (list, tuple)):
            delete_targets = [str(x).strip() for x in del_val if str(x).strip()]

    deleted_sheets: list[str] = []
    retained_source_modules: list[dict[str, Any]] = []

    for sheet in wb.sheetnames:
        if sheet.casefold() in exclude:
            continue
        ws = wb[sheet]
        label = str(ws["A1"].value or sheet).strip()

        # In delete mode or if delete_targets specified, check if this sheet is targeted for deletion
        to_delete = any(_matches_story(sheet, label, tgt) for tgt in delete_targets)
        if to_delete:
            deleted_sheets.append(sheet)
            continue

        headers = [c.value for c in ws[3]]
        hmap = {str(h).strip(): i for i, h in enumerate(headers) if h}
        cases = []
        for r in range(4, ws.max_row + 1):
            rvals = [c.value for c in ws[r]]
            if not any(rvals):
                continue
            case = {}
            for h, idx in hmap.items():
                val = rvals[idx] if idx < len(rvals) else None
                case[h] = "" if val is None else str(val)
            if update_mode and not case.get("Test Case Type") and not case.get("test_case_type"):
                case["Test Case Type"] = "existing"
                case["test_case_type"] = "existing"
            if not case.get("Platform") and not case.get("platform"):
                default_plat = str(data.get("platform") or "mobile app").strip()
                case["Platform"] = default_plat
                case["platform"] = default_plat
            cases.append(case)
        retained_source_modules.append({
            "sheet": sheet,
            "label": label,
            "cases": cases,
            "baseline_cases": [dict(c) for c in cases],
        })

    source_modules = retained_source_modules

    # Test Data Requirements
    td_reqs = []
    if "Test Data Requirements" in wb.sheetnames:
        td_ws = wb["Test Data Requirements"]
        for r in range(4, td_ws.max_row + 1):
            vals = [c.value for c in td_ws[r]]
            if any(vals):
                td_reqs.append({
                    "id": str(vals[0] or f"TD-{len(td_reqs)+1:03d}").strip(),
                    "description": str(vals[1] or "").strip(),
                    "required_for": str(vals[2] or "").strip(),
                    "status": str(vals[3] or "Not Prepared").strip(),
                })

    # Clean up test data requirements tied to deleted sheets
    if deleted_sheets:
        cleaned_td_reqs = []
        for td in td_reqs:
            req_for = str(td.get("required_for") or td.get("Required For") or "").strip()
            if not req_for:
                cleaned_td_reqs.append(td)
                continue
            tokens = [t.strip() for t in re.split(r"[,;]", req_for) if t.strip()]
            surviving_tokens = []
            for tok in tokens:
                if not any(_matches_story(tok, tok, del_sheet) for del_sheet in deleted_sheets):
                    surviving_tokens.append(tok)
            if surviving_tokens:
                td_copy = dict(td)
                td_copy["required_for"] = ", ".join(surviving_tokens)
                cleaned_td_reqs.append(td_copy)
        td_reqs = cleaned_td_reqs

    has_ios = "iOS Dashboard" in wb.sheetnames

    # Merge modules
    user_modules = data.get("modules", [])
    if delete_mode and not user_modules:
        merged_modules = source_modules
    else:
        user_modules = [
            um for um in user_modules
            if not any(
                _matches_story(
                    str(um.get("sheet") or um.get("sheet_name") or ""),
                    str(um.get("label") or um.get("module_label") or ""),
                    tgt
                )
                for tgt in delete_targets
            )
        ]
        user_by_sheet = {str(m.get("sheet") or m.get("sheet_name") or "").strip().casefold(): m for m in user_modules}
        user_by_label = {str(m.get("label") or m.get("module_label") or "").strip().casefold(): m for m in user_modules}

        handled = set()
        merged_modules = []
        for sm in source_modules:
            s_key = sm["sheet"].casefold()
            l_key = sm["label"].casefold()
            if s_key in user_by_sheet:
                um = user_by_sheet[s_key]
                if not um.get("baseline_cases"):
                    um["baseline_cases"] = sm["baseline_cases"]
                merged_modules.append(um)
                handled.add(s_key)
            elif l_key in user_by_label:
                um = user_by_label[l_key]
                if not um.get("baseline_cases"):
                    um["baseline_cases"] = sm["baseline_cases"]
                merged_modules.append(um)
                handled.add(l_key)
            else:
                merged_modules.append(sm)

        # Any new user story module not in source test bank
        for um in user_modules:
            s_key = str(um.get("sheet") or um.get("sheet_name") or "").strip().casefold()
            l_key = str(um.get("label") or um.get("module_label") or "").strip().casefold()
            if s_key not in handled and l_key not in handled:
                merged_modules.append(um)

    # Merge TD reqs
    seen_desc = {re.sub(r"\s+", " ", td["description"]).strip().casefold() for td in td_reqs if td.get("description")}
    for td in data.get("test_data_requirements", []):
        desc = re.sub(r"\s+", " ", str(td.get("description") or td.get("Test Data Description") or "")).strip().casefold()
        if desc and desc not in seen_desc:
            td_reqs.append(td)
            seen_desc.add(desc)

    merged_data = copy.deepcopy(data)
    merged_data["modules"] = merged_modules
    merged_data["test_data_requirements"] = td_reqs
    merged_data["deleted_modules"] = deleted_sheets
    if has_ios and not merged_data.get("platform"):
        merged_data["platform"] = "mobile app"

    return merged_data

