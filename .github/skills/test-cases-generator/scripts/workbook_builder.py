"""Governed testcase workbook builder.

Creates the reference-style Excel output required by SKILL.md:
- Dashboard (manual execution)
- Automation Dashboard (Automation Candidate == Yes, using Automation Status)
- iOS Dashboard (IOS Testcase == Yes, using manual Status)
- Config (central dropdown values)
- Test Data Requirements (story-wise execution prerequisites)
- One sheet per module / user story
- On a story update, the workbook is a separate copy holding only the updated sheets under their original names
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
import re

import xlsxwriter

from common import (
    AUTOMATION_STATUSES,
    CATEGORIES,
    MANUAL_STATUSES,
    PRIORITIES,
    SOURCE_CLASSIFICATIONS,
    TEST_CASE_TYPES,
    TEST_DATA_STATUSES,
    TESTCASE_HEADERS,
    TYPES,
    YES_NO,
    ModuleSpec,
    _col_letter,
    _first,
    _normalise_case,
    _parse_modules,
    _safe_sheet_name,
    _write_remarks_cell,
    is_android_only_platform,
    is_delete_mode,
    is_greenfield_parity_mode,
    is_ios_only_platform,
    is_update_mode,
    normalize_project_mode,
    resolve_platform_columns,
    should_create_ios_dashboard,
    should_include_ios_column,
)
from dashboard_renderer import render_governed_dashboards
from check_coverage import (
    COVERAGE_DIMENSIONS,
    detect_case_dimensions,
    infer_expected_dimensions,
    infer_requirement_risk,
    split_ac_ids,
)


def _synthesize_rtm(
    specs: Sequence[ModuleSpec],
    platform: str = "",
    us_id_meta: str = ""
) -> list[dict[str, Any]]:
    """Synthesize complete 23-column RTM items from module test cases and requirements."""
    # Group test cases by Requirement Reference
    req_groups: dict[str, list[tuple[ModuleSpec, Mapping[str, Any]]]] = {}
    for spec in specs:
        for c in spec.cases:
            ref = str(_first(c, "requirement_reference", "Requirement Reference", "requirement", "AC ID", default="")).strip()
            if not ref:
                ref = f"{spec.module_label} | General Coverage"
            req_groups.setdefault(ref, []).append((spec, c))

    rtm_rows: list[dict[str, Any]] = []
    req_counter = 1

    for ref, case_list in req_groups.items():
        spec, first_c = case_list[0]
        # Parse requirement ID
        ac_matches = split_ac_ids(ref)
        if ac_matches:
            req_id = sorted(ac_matches)[0]
            req_id_type = "SOURCE ID"
        elif "BR-" in ref or "RULE-" in ref:
            br_m = re.search(r"\b(BR-[^|]+|RULE-[^|]+)\b", ref)
            req_id = br_m.group(1).strip() if br_m else f"REQ-{req_counter:03d}"
            req_id_type = "SOURCE ID"
        else:
            req_id = f"WAC-{req_counter:03d}"
            req_id_type = "WORKING ID"

        # Story ID
        story_m = re.search(r"\b(US-\d+|EPIC-\d+|STORY-\d+)\b", ref + " " + spec.module_label, re.I)
        story_id = story_m.group(1).upper() if story_m else "US-001"

        # Collect mapped test case and scenario IDs
        tc_ids = []
        sc_ids = []
        covered_dims: set[str] = set()
        has_blocked = False
        has_auto = False
        has_ios = False
        has_android = False

        combined_text_list = []
        for s, c in case_list:
            cid = str(_first(c, "case_id", "Test Case ID", default="")).strip()
            sid = str(_first(c, "scenario_id", "Test Scenario ID", default="")).strip()
            if cid and cid not in tc_ids:
                tc_ids.append(cid)
            if sid and sid not in sc_ids:
                sc_ids.append(sid)

            src = str(_first(c, "source_type", "Source Type", default="SOURCE")).upper()
            status = str(_first(c, "status", "Status", default="Not Executed")).lower()
            if src == "BLOCKED" or status == "blocked":
                has_blocked = True

            auto = str(_first(c, "automation_candidate", "Automation Candidate", default="No")).strip().lower()
            if auto == "yes":
                has_auto = True

            ios_val = str(_first(c, "ios_testcase", "IOS Testcase", default="No")).strip().lower()
            if ios_val == "yes":
                has_ios = True

            steps_txt = str(_first(c, "steps", "Test Steps", default="")).lower()
            if "android:" in steps_txt or "hardware back" in steps_txt:
                has_android = True
            if "ios:" in steps_txt or "edge swipe" in steps_txt or "edge-swipe" in steps_txt:
                has_ios = True

            case_norm = {
                "Type": _first(c, "type", "Type", default="Positive"),
                "Test Category": _first(c, "category", "Test Category", default="Functional"),
                "IOS Testcase": _first(c, "ios_testcase", "IOS Testcase", default="No"),
                "Test Title": _first(c, "description", "Test Description", default=""),
                "Steps": _first(c, "steps", "Test Steps", default=""),
                "Expected Result": _first(c, "expected_result", "Expected Result", default=""),
                "Preconditions": _first(c, "precondition", "Preconditions", default=""),
                "Test Data": _first(c, "test_data", "Test Data", default=""),
                "Remarks": _first(c, "remarks", "Remarks", default=""),
            }
            c_dims = detect_case_dimensions(case_norm)
            covered_dims |= c_dims
            combined_text_list.append(case_norm["Test Title"] + " " + case_norm["Expected Result"])

        all_text = " ".join(combined_text_list)
        risk = infer_requirement_risk(ref + " " + all_text)
        expected_dims = infer_expected_dimensions(ref + " " + all_text)

        dim_cov = sorted(covered_dims & expected_dims)
        dim_missing = sorted(expected_dims - covered_dims)

        if has_blocked and not dim_cov:
            cov_status = "Blocked / Needs Clarification"
            map_quality = "Blocked"
            gap_risk = "Specification ambiguity or pending requirement clarification (RQ)"
            suggested_outline = "Resolve pending requirement question before designing automated assertions."
            rec = "Clarify open requirement with product owner / client"
        elif not tc_ids:
            cov_status = "Not Covered"
            map_quality = "None"
            gap_risk = "Requirement completely lacks test case coverage"
            suggested_outline = f"When {ref} condition occurs -> verify expected observable outcome."
            rec = "Generate positive and boundary test cases immediately"
        elif dim_missing:
            cov_status = "Partially Covered"
            map_quality = "Partial"
            gap_risk = f"Missing coverage dimensions: {', '.join(dim_missing)}"
            suggested_outline = f"Verify {', '.join(dim_missing)} condition for {ref} -> assert expected rejection/state transition."
            rec = f"Add test cases covering missing dimensions: {', '.join(dim_missing)}"
        else:
            cov_status = "Covered"
            map_quality = "Full"
            gap_risk = "None - fully covered across expected dimensions"
            suggested_outline = "Coverage complete across all expected dimensions."
            rec = "Retain valid coverage; maintain traceability"

        # Platform coverage
        if "mobile" in platform.lower():
            if has_android and has_ios:
                platform_cov = "Android+iOS"
            elif has_ios:
                platform_cov = "iOS only"
            elif has_android:
                platform_cov = "Android only"
            else:
                platform_cov = "Mobile shared"
        else:
            platform_cov = "Not platform-specific"

        # Requirement text formulation
        req_summary = ref
        if len(case_list) == 1:
            req_summary = f"{ref}: {str(_first(first_c, 'description', 'Test Description', default=''))}"

        rtm_rows.append({
            "requirement_id": req_id,
            "requirement_id_type": req_id_type,
            "user_story_id": story_id,
            "module": spec.module_label,
            "requirement_text": req_summary,
            "requirement_kind": str(_first(first_c, "category", "Test Category", default="Functional")),
            "risk_level": risk,
            "source_document": us_id_meta or "BRD / User Stories",
            "source_location": spec.module_label,
            "mapped_test_case_ids": ", ".join(tc_ids),
            "mapped_scenario_ids": ", ".join(sc_ids),
            "valid_case_count": len(tc_ids),
            "expected_dimensions": ", ".join(sorted(expected_dims)),
            "dimensions_covered": ", ".join(dim_cov),
            "missing_dimensions": ", ".join(dim_missing) if dim_missing else "None",
            "mapping_quality": map_quality,
            "coverage_status": cov_status,
            "platform_coverage": platform_cov,
            "automation_coverage": "Yes" if has_auto else "No",
            "gap_risk": gap_risk,
            "suggested_test_outline": suggested_outline,
            "reviewer_recommendation": rec,
            "human_review_status": "Pending Review",
        })
        req_counter += 1

    return rtm_rows


def _render_rtm_sheet(wb: Any, ws: Any, rtm_items: Sequence[Mapping[str, Any]], formats: dict[str, Any]) -> None:
    """Render the 23-column Requirement Traceability Matrix worksheet."""
    headers = [
        "Requirement ID",
        "Requirement ID Type",
        "User Story ID",
        "User Story / Module",
        "Requirement / Acceptance Criterion",
        "Requirement Kind",
        "Risk Level",
        "Source Document",
        "Source Location",
        "Mapped Test Case IDs",
        "Mapped Scenario IDs",
        "Valid Case Count",
        "Expected Dimensions",
        "Dimensions Covered",
        "Missing Dimensions",
        "Mapping Quality",
        "Coverage Status",
        "Platform Coverage",
        "Automation Coverage",
        "Gap / Risk",
        "Suggested Test Outline",
        "Reviewer Recommendation",
        "Human Review Status",
    ]
    widths = [18, 16, 16, 32, 44, 18, 14, 24, 20, 28, 24, 14, 30, 30, 26, 16, 22, 18, 18, 34, 40, 34, 18]

    last_col = len(headers) - 1
    ws.merge_range(0, 0, 0, last_col, "Requirement Traceability Matrix (RTM)", formats["title"])
    ws.merge_range(1, 0, 1, last_col,
                   "Bidirectional traceability linking business requirements, user stories, and acceptance criteria to test cases, verifying multi-dimensional coverage depth (Gate 4a) and risk classification.",
                   formats["meta"])

    for c, h in enumerate(headers):
        ws.write(2, c, h, formats["header"])

    centered_cols = {0, 1, 2, 5, 6, 11, 15, 16, 17, 18, 22}

    for r, item in enumerate(rtm_items, 3):
        row_vals = [
            str(item.get("requirement_id", "")),
            str(item.get("requirement_id_type", "SOURCE ID")),
            str(item.get("user_story_id", "")),
            str(item.get("module", "")),
            str(item.get("requirement_text", "")),
            str(item.get("requirement_kind", "Functional")),
            str(item.get("risk_level", "Medium")),
            str(item.get("source_document", "")),
            str(item.get("source_location", "")),
            str(item.get("mapped_test_case_ids", "")),
            str(item.get("mapped_scenario_ids", "")),
            int(item.get("valid_case_count", 0)),
            str(item.get("expected_dimensions", "")),
            str(item.get("dimensions_covered", "")),
            str(item.get("missing_dimensions", "None")),
            str(item.get("mapping_quality", "Full")),
            str(item.get("coverage_status", "Covered")),
            str(item.get("platform_coverage", "Not platform-specific")),
            str(item.get("automation_coverage", "No")),
            str(item.get("gap_risk", "")),
            str(item.get("suggested_test_outline", "")),
            str(item.get("reviewer_recommendation", "")),
            str(item.get("human_review_status", "Pending Review")),
        ]
        for c, val in enumerate(row_vals):
            fmt = formats["center"] if c in centered_cols else formats["body"]
            ws.write(r, c, val, fmt)

    end_row = max(100, 3 + len(rtm_items) + 50)
    # Conditional formatting on Risk Level (col G / 6)
    ws.conditional_format(f"G4:G{end_row}", {"type": "text", "criteria": "containing", "value": "High", "format": wb.add_format({"bg_color": "#F8CBAD", "font_color": "#C00000"})})
    ws.conditional_format(f"G4:G{end_row}", {"type": "text", "criteria": "containing", "value": "Medium", "format": wb.add_format({"bg_color": "#FFF2CC", "font_color": "#B2A100"})})
    ws.conditional_format(f"G4:G{end_row}", {"type": "text", "criteria": "containing", "value": "Low", "format": wb.add_format({"bg_color": "#E2EFDA", "font_color": "#375623"})})

    # Conditional formatting on Coverage Status (col Q / 16)
    ws.conditional_format(f"Q4:Q{end_row}", {"type": "text", "criteria": "containing", "value": "Covered", "format": wb.add_format({"bg_color": "#C6EFCE", "font_color": "#006100"})})
    ws.conditional_format(f"Q4:Q{end_row}", {"type": "text", "criteria": "containing", "value": "Partially Covered", "format": wb.add_format({"bg_color": "#FFE699", "font_color": "#7F6000"})})
    ws.conditional_format(f"Q4:Q{end_row}", {"type": "text", "criteria": "containing", "value": "Not Covered", "format": wb.add_format({"bg_color": "#FFC7CE", "font_color": "#9C0006"})})
    ws.conditional_format(f"Q4:Q{end_row}", {"type": "text", "criteria": "containing", "value": "Blocked", "format": wb.add_format({"bg_color": "#D9D9D9", "font_color": "#595959"})})

    for c, w in enumerate(widths):
        ws.set_column(c, c, w)
    ws.set_row(0, 26)
    ws.set_row(1, 36)
    ws.set_row(2, 34)
    ws.freeze_panes(3, 0)
    ws.autofilter(2, 0, max(3, 2 + len(rtm_items)), last_col)


def _render_heatmap_sheet(wb: Any, ws: Any, specs: Sequence[ModuleSpec], rtm_items: Sequence[Mapping[str, Any]], formats: dict[str, Any]) -> None:
    """Render the Coverage Heatmap worksheet with Multi-dimensional depth and Risk x Coverage Matrix."""
    headers = [
        "User Story / Module",
        "Positive",
        "Negative",
        "Boundary",
        "State / Transition",
        "Role / Permission",
        "Error Handling",
        "Platform Variant",
        "Integration / Data",
        "Total Reqs",
        "Covered",
        "Partial",
        "Not Covered",
        "Blocked",
        "Coverage %",
    ]
    widths = [36, 14, 14, 14, 18, 18, 16, 16, 18, 14, 14, 14, 14, 14, 16]

    last_col = len(headers) - 1
    ws.merge_range(0, 0, 0, last_col, "Coverage Heatmap & Multi-Dimensional Depth Matrix", formats["title"])
    ws.merge_range(1, 0, 1, last_col,
                   "Visual distribution of the 8 Coverage Dimensions across user stories and risk tiers. Green = Fully Covered, Amber = Partially Covered, Red = Uncovered, Grey = Blocked.",
                   formats["meta"])

    # Section 1: User Story x Coverage Dimension Depth
    ws.write(3, 0, "1. User Story × Coverage Dimension Depth (Gate 4a)", formats["section"])
    for c in range(1, len(headers)):
        ws.write(3, c, "", formats["section"])
    ws.merge_range(3, 0, 3, last_col, "1. User Story × Coverage Dimension Depth (Gate 4a)", formats["section"])

    for c, h in enumerate(headers):
        ws.write(4, c, h, formats["header"])

    # Aggregate RTM items by story/module
    story_map: dict[str, list[Mapping[str, Any]]] = {}
    for item in rtm_items:
        mod = str(item.get("module", "Module"))
        story_map.setdefault(mod, []).append(item)

    # In case a spec has no rtm items
    for spec in specs:
        story_map.setdefault(spec.module_label, [])

    curr_row = 5
    tot_reqs_all = 0
    tot_cov_all = 0
    tot_part_all = 0
    tot_not_all = 0
    tot_blk_all = 0

    green_fmt = wb.add_format({"border": 1, "align": "center", "bg_color": "#C6EFCE", "font_color": "#006100"})
    amber_fmt = wb.add_format({"border": 1, "align": "center", "bg_color": "#FFE699", "font_color": "#7F6000"})
    red_fmt = wb.add_format({"border": 1, "align": "center", "bg_color": "#FFC7CE", "font_color": "#9C0006"})

    dim_keys = [
        "Positive / happy path",
        "Negative / invalid input",
        "Boundary",
        "State / transition",
        "Role / permission",
        "Error / exception handling",
        "Platform variant",
        "Integration / data",
    ]

    for mod, items in story_map.items():
        total_reqs = len(items)
        cov_count = sum(1 for it in items if str(it.get("coverage_status", "")).lower() == "covered")
        part_count = sum(1 for it in items if "partially" in str(it.get("coverage_status", "")).lower())
        not_count = sum(1 for it in items if "not covered" in str(it.get("coverage_status", "")).lower())
        blk_count = sum(1 for it in items if "blocked" in str(it.get("coverage_status", "")).lower())

        tot_reqs_all += total_reqs
        tot_cov_all += cov_count
        tot_part_all += part_count
        tot_not_all += not_count
        tot_blk_all += blk_count

        cov_pct = round(cov_count / total_reqs * 100, 1) if total_reqs else 0.0

        ws.write(curr_row, 0, mod, formats["label"])

        # Write each dimension ratio
        for idx, dk in enumerate(dim_keys, 1):
            exp_c = sum(1 for it in items if dk in str(it.get("expected_dimensions", "")))
            cov_c = sum(1 for it in items if dk in str(it.get("dimensions_covered", "")))
            if exp_c == 0:
                ws.write(curr_row, idx, "-", formats["center"])
            else:
                txt = f"{cov_c}/{exp_c}"
                fmt = green_fmt if cov_c >= exp_c else (amber_fmt if cov_c > 0 else red_fmt)
                ws.write(curr_row, idx, txt, fmt)

        ws.write(curr_row, 9, total_reqs, formats["center"])
        ws.write(curr_row, 10, cov_count, green_fmt if cov_count == total_reqs and total_reqs > 0 else formats["center"])
        ws.write(curr_row, 11, part_count, amber_fmt if part_count > 0 else formats["center"])
        ws.write(curr_row, 12, not_count, red_fmt if not_count > 0 else formats["center"])
        ws.write(curr_row, 13, blk_count, formats["center"])
        ws.write(curr_row, 14, cov_pct / 100.0, formats["pct"])
        curr_row += 1

    # Total row for Table 1
    ws.write(curr_row, 0, "Total", formats["total_label"])
    for idx in range(1, 9):
        ws.write(curr_row, idx, "", formats["total"])
    ws.write(curr_row, 9, tot_reqs_all, formats["total"])
    ws.write(curr_row, 10, tot_cov_all, formats["total"])
    ws.write(curr_row, 11, tot_part_all, formats["total"])
    ws.write(curr_row, 12, tot_not_all, formats["total"])
    ws.write(curr_row, 13, tot_blk_all, formats["total"])
    overall_pct = round(tot_cov_all / tot_reqs_all * 100, 1) if tot_reqs_all else 0.0
    ws.write(curr_row, 14, overall_pct / 100.0, formats["pct"])
    curr_row += 3

    # Section 2: Risk x Coverage Matrix (Section 7.3)
    ws.merge_range(curr_row, 0, curr_row, 6, "2. Risk Tier × Coverage Matrix (Section 7.3)", formats["section"])
    curr_row += 1

    r_headers = ["Risk Tier", "Total Requirements", "Fully Covered", "Partially Covered", "Not Covered", "Blocked", "Risk-Weighted %"]
    r_widths = [26, 20, 18, 18, 18, 18, 20]
    for c, rh in enumerate(r_headers):
        ws.write(curr_row, c, rh, formats["header"])
    curr_row += 1

    tiers = [
        ("High Risk (Weight 3)", 3, [it for it in rtm_items if str(it.get("risk_level", "")).lower() == "high"]),
        ("Medium Risk (Weight 2)", 2, [it for it in rtm_items if str(it.get("risk_level", "")).lower() == "medium"]),
        ("Low Risk (Weight 1)", 1, [it for it in rtm_items if str(it.get("risk_level", "")).lower() == "low"]),
    ]

    total_weight_all = 0
    weighted_score_all = 0.0

    for name, weight, r_items in tiers:
        t_reqs = len(r_items)
        fc = sum(1 for it in r_items if str(it.get("coverage_status", "")).lower() == "covered")
        pc = sum(1 for it in r_items if "partially" in str(it.get("coverage_status", "")).lower())
        nc = sum(1 for it in r_items if "not covered" in str(it.get("coverage_status", "")).lower())
        bc = sum(1 for it in r_items if "blocked" in str(it.get("coverage_status", "")).lower())

        tier_score = (fc * 1.0 + pc * 0.5)
        tier_weight = t_reqs * weight
        tier_pct = round(tier_score / t_reqs * 100, 1) if t_reqs else 0.0

        total_weight_all += tier_weight
        weighted_score_all += (tier_score * weight)

        ws.write(curr_row, 0, name, formats["label"])
        ws.write(curr_row, 1, t_reqs, formats["center"])
        ws.write(curr_row, 2, fc, formats["center"])
        ws.write(curr_row, 3, pc, formats["center"])
        ws.write(curr_row, 4, nc, formats["center"])
        ws.write(curr_row, 5, bc, formats["center"])
        ws.write(curr_row, 6, tier_pct / 100.0, formats["pct"])
        curr_row += 1

    overall_rw_pct = round(weighted_score_all / total_weight_all * 100, 1) if total_weight_all else 0.0
    ws.write(curr_row, 0, "Overall Risk-Weighted Score", formats["total_label"])
    ws.write(curr_row, 1, tot_reqs_all, formats["total"])
    ws.write(curr_row, 2, tot_cov_all, formats["total"])
    ws.write(curr_row, 3, tot_part_all, formats["total"])
    ws.write(curr_row, 4, tot_not_all, formats["total"])
    ws.write(curr_row, 5, tot_blk_all, formats["total"])
    ws.write(curr_row, 6, overall_rw_pct / 100.0, formats["pct"])

    for c, w in enumerate(widths):
        ws.set_column(c, c, w)
    ws.set_row(0, 26)
    ws.set_row(1, 36)
    ws.set_row(4, 32)
    ws.freeze_panes(5, 0)


def build_workbook(
    out_path: str,
    modules: Iterable[Any],
    us_id_meta: str = "",
    dashboard_title: str = "Test Execution Dashboard",
    mod_prefix: str = "US",
    figma_link: str | None = None,
    author: str = "QA Team",
    version: str = "1.0",
    test_data_requirements: Sequence[Mapping[str, Any]] | None = None,
    max_formula_row: int = 5000,
    platform: str = "",
    project_mode: str = "GREENFIELD",
    rtm: Sequence[Mapping[str, Any]] | None = None,
    coverage_heatmap: Mapping[str, Any] | None = None,
) -> str:
    """Build a governed testcase workbook with live dashboards."""
    specs = _parse_modules(modules)
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    mode = normalize_project_mode(project_mode)
    delete_mode = is_delete_mode(mode)
    update_mode = is_update_mode(mode)
    include_ios_col = should_include_ios_column(platform)
    create_ios_dash = should_create_ios_dashboard(platform)
    ios_only = is_ios_only_platform(platform)

    used = {"dashboard", "automation dashboard", "config", "test data requirements"}
    if create_ios_dash:
        used.add("ios dashboard")
    has_tct = any(
        any(c.get("Test Case Type") or c.get("test_case_type") for c in spec.cases)
        for spec in specs
    )
    include_tct_col = update_mode or (delete_mode and has_tct)
    story_update = update_mode and any(spec.baseline_cases for spec in specs)
    # (spec, unused, sheet name). Dashboard module rows follow this list.
    module_pairs: list[tuple[ModuleSpec, str | None, str]] = []
    # (spec, sheet name, cases, kind) kind is updated or only.
    sheet_jobs: list[tuple[ModuleSpec, str, Sequence[Mapping[str, Any]], str]] = []
    for spec in specs:
        name = _safe_sheet_name(spec.sheet_name, used)
        kind = "updated" if story_update else "only"
        sheet_jobs.append((spec, name, spec.cases, kind))
        module_pairs.append((spec, None, name))

    wb = xlsxwriter.Workbook(str(out))
    wb.set_calc_mode("auto")
    wb.set_properties({"title": dashboard_title, "author": author, "subject": f"Project Mode: {mode}", "comments": f"Project Mode: {mode}. Generated by governed QA testcase workbook builder"})

    # ----- Formats -----
    title_fmt = wb.add_format({"bold": True, "font_size": 16, "font_color": "#FFFFFF", "bg_color": "#1F4E78", "align": "left", "valign": "vcenter"})
    meta_fmt = wb.add_format({"italic": True, "font_color": "#404040", "bg_color": "#D9EAF7", "text_wrap": True, "valign": "vcenter"})
    header_fmt = wb.add_format({"bold": True, "font_color": "#FFFFFF", "bg_color": "#4472C4", "border": 1, "align": "center", "valign": "vcenter", "text_wrap": True})
    body_fmt = wb.add_format({"border": 1, "valign": "top", "text_wrap": True})
    center_fmt = wb.add_format({"border": 1, "align": "center", "valign": "top", "text_wrap": True})
    dash_section_fmt = wb.add_format({"bold": True, "font_color": "#FFFFFF", "bg_color": "#5B9BD5", "border": 1})
    dash_header_fmt = wb.add_format({"bold": True, "font_color": "#FFFFFF", "bg_color": "#4472C4", "border": 1, "align": "center", "text_wrap": True})
    dash_body_fmt = wb.add_format({"border": 1, "align": "center"})
    dash_label_fmt = wb.add_format({"border": 1, "align": "left"})
    pct_fmt = wb.add_format({"border": 1, "align": "center", "num_format": "0.00%"})
    total_fmt = wb.add_format({"bold": True, "bg_color": "#D9EAD3", "border": 1, "align": "center"})
    total_label_fmt = wb.add_format({"bold": True, "bg_color": "#D9EAD3", "border": 1})
    config_header_fmt = wb.add_format({"bold": True, "font_color": "#FFFFFF", "bg_color": "#4472C4", "border": 1})
    config_body_fmt = wb.add_format({"border": 1})
    bold_inline_fmt = wb.add_format({"bold": True})

    formats_dict = {
        "title": title_fmt,
        "meta": meta_fmt,
        "header": header_fmt,
        "body": body_fmt,
        "center": center_fmt,
        "section": dash_section_fmt,
        "label": dash_label_fmt,
        "pct": pct_fmt,
        "total": total_fmt,
        "total_label": total_label_fmt,
    }

    # Column positions in testcase sheets (0 based).
    actual_headers = list(TESTCASE_HEADERS)
    if not include_ios_col:
        actual_headers.remove("IOS Testcase")
    if include_tct_col:
        if "IOS Testcase" in actual_headers:
            ios_idx = actual_headers.index("IOS Testcase")
            actual_headers.insert(ios_idx + 1, "Test Case Type")
        else:
            reg_idx = actual_headers.index("Regression Candidate (Yes/No)")
            actual_headers.insert(reg_idx + 1, "Test Case Type")

    header_index = {h: i for i, h in enumerate(actual_headers)}
    category_col = _col_letter(header_index["Test Category"])
    platform_col = _col_letter(header_index["Platform"])
    status_col = _col_letter(header_index["Status"])
    candidate_col = _col_letter(header_index["Automation Candidate (Yes/No)"])
    ios_col = _col_letter(header_index["IOS Testcase"]) if "IOS Testcase" in header_index else None
    tct_col = _col_letter(header_index["Test Case Type"]) if "Test Case Type" in header_index else None
    auto_status_col = _col_letter(header_index["Automation Status"])
    priority_col = _col_letter(header_index["Priority (P0/P1/P2)"])
    data_first = 4
    data_last = max_formula_row

    # Create required workbook sheets in reference order.
    dashboard_ws = wb.add_worksheet("Dashboard")
    automation_dashboard_ws = wb.add_worksheet("Automation Dashboard")
    ios_dashboard_ws = wb.add_worksheet("iOS Dashboard") if create_ios_dash else None

    # ----- Config -----
    config = wb.add_worksheet("Config")
    config_cols = [
        ("Status", MANUAL_STATUSES),
        ("Test Category", CATEGORIES),
        ("Type", TYPES),
        ("Priority", PRIORITIES),
        ("Automation Candidate", YES_NO),
        ("Regression Candidate", YES_NO),
    ]
    if include_ios_col:
        config_cols.append(("IOS Testcase", YES_NO))
    config_cols.extend([
        ("Automation Status", AUTOMATION_STATUSES),
        ("Source Type", SOURCE_CLASSIFICATIONS),
        ("Test Data Status", TEST_DATA_STATUSES),
    ])
    if include_tct_col:
        config_cols.append(("Test Case Type", TEST_CASE_TYPES))
    config_cols.append(("Project Mode", [mode]))
    for c, (name, values) in enumerate(config_cols):
        config.write(0, c, name, config_header_fmt)
        for r, value in enumerate(values, 1):
            config.write(r, c, value, config_body_fmt)
        config.set_column(c, c, max(18, len(name) + 2))
    config.freeze_panes(1, 0)

    # Named ranges make validations resilient and readable.
    config_col_map = {name: _col_letter(i) for i, (name, _) in enumerate(config_cols)}
    wb.define_name("ManualStatusList", f"=Config!${config_col_map['Status']}$2:${config_col_map['Status']}$9")
    wb.define_name("CategoryList", f"=Config!${config_col_map['Test Category']}$2:${config_col_map['Test Category']}$6")
    wb.define_name("TypeList", f"=Config!${config_col_map['Type']}$2:${config_col_map['Type']}$4")
    wb.define_name("PriorityList", f"=Config!${config_col_map['Priority']}$2:${config_col_map['Priority']}$4")
    wb.define_name("YesNoList", f"=Config!${config_col_map['Automation Candidate']}$2:${config_col_map['Automation Candidate']}$3")
    wb.define_name("AutomationStatusList", f"=Config!${config_col_map['Automation Status']}$2:${config_col_map['Automation Status']}$8")
    wb.define_name("SourceTypeList", f"=Config!${config_col_map['Source Type']}$2:${config_col_map['Source Type']}$5")
    wb.define_name("TestDataStatusList", f"=Config!${config_col_map['Test Data Status']}$2:${config_col_map['Test Data Status']}$6")
    if include_tct_col and "Test Case Type" in config_col_map:
        tct_config_col = config_col_map["Test Case Type"]
        wb.define_name("TestCaseTypeList", f"=Config!${tct_config_col}$2:${tct_config_col}$5")

    # ----- Test Data Requirements (Enhanced Story-Wise Traceability) -----
    td_ws = wb.add_worksheet("Test Data Requirements")
    td_headers = [
        "Test Data ID",
        "User Story ID",
        "User Story / Module",
        "Test Data Description",
        "Required For",
        "Requirement Reference",
        "Data Setup / Preparation Notes",
        "Environment / Platform",
        "Status"
    ]
    td_ws.merge_range(0, 0, 0, len(td_headers) - 1, "Test Data Requirements", title_fmt)
    td_ws.merge_range(1, 0, 1, len(td_headers) - 1,
                      "Unique actionable test-data prerequisites organized with user story traceability. Do not store actual credentials, passwords, account numbers, PII, or secrets here.", meta_fmt)
    for c, h in enumerate(td_headers):
        td_ws.write(2, c, h, header_fmt)

    seen_td: set[str] = set()
    td_rows = []
    for i, item in enumerate(test_data_requirements or [], 1):
        desc = str(_first(item, "description", "Test Data Description", default="")).strip()
        if not desc or desc.casefold() in {"n/a", "na", "none", "not applicable", "no special test data"}:
            continue
        key = re.sub(r"\s+", " ", desc).strip().casefold()
        if key in seen_td:
            continue
        seen_td.add(key)
        td_id = str(_first(item, "id", "test_data_id", "Test Data ID", default=f"TD-{len(td_rows)+1:03d}")).strip() or f"TD-{len(td_rows)+1:03d}"
        required_for = str(_first(item, "required_for", "Required For", default="")).strip()
        us_id = str(_first(item, "user_story_id", "User Story ID", default="")).strip()
        if not us_id:
            m_us = re.search(r"\b(US-\d+|EPIC-\d+)\b", required_for, re.I)
            us_id = m_us.group(1).upper() if m_us else ""
        us_label = str(_first(item, "module", "User Story / Module", default=required_for)).strip()
        req_ref = str(_first(item, "requirement_reference", "Requirement Reference", default="")).strip()
        notes = str(_first(item, "notes", "Data Setup / Preparation Notes", default="")).strip()
        env_plat = str(_first(item, "environment", "Environment / Platform", default=platform)).strip()
        status = str(_first(item, "status", "Status", default="Not Prepared")).strip() or "Not Prepared"
        if status not in TEST_DATA_STATUSES:
            status = "Not Prepared"
        td_rows.append([td_id, us_id, us_label, desc, required_for, req_ref, notes, env_plat, status])

    td_centered = {0, 1, 7, 8}
    for r, row in enumerate(td_rows, 3):
        for c, value in enumerate(row):
            td_ws.write(r, c, value, center_fmt if c in td_centered else body_fmt)

    td_end_row = max(500, 3 + max(len(td_rows), 1) + 200)
    td_ws.data_validation(f"I4:I{td_end_row}", {"validate": "list", "source": "=TestDataStatusList"})
    td_ws.conditional_format(f"I4:I{td_end_row}", {"type": "text", "criteria": "containing", "value": "Available", "format": wb.add_format({"bg_color": "#C6EFCE", "font_color": "#006100"})})
    td_ws.conditional_format(f"I4:I{td_end_row}", {"type": "text", "criteria": "containing", "value": "Blocked", "format": wb.add_format({"bg_color": "#FFC7CE", "font_color": "#9C0006"})})
    for c, w in enumerate([14, 16, 28, 48, 30, 24, 32, 20, 16]):
        td_ws.set_column(c, c, w)
    td_ws.set_row(0, 26)
    td_ws.set_row(1, 36)
    td_ws.set_row(2, 32)
    td_ws.freeze_panes(3, 0)
    td_ws.autofilter(2, 0, max(3, 2 + len(td_rows)), len(td_headers) - 1)

    # ----- Module testcase sheets -----
    for spec, sheet_name, case_rows, kind in sheet_jobs:
        ws = wb.add_worksheet(sheet_name)
        sheet_headers = list(actual_headers)
        sheet_index = {h: i for i, h in enumerate(sheet_headers)}
        last_col = len(sheet_headers) - 1
        ws.merge_range(0, 0, 0, last_col, spec.module_label, title_fmt)
        meta_parts = [f"Project Mode: {mode}", f"User Story/Module: {us_id_meta or spec.module_label}", "Source: Governed requirement extraction", f"Author: {author}", f"Version: {version}"]
        if kind == "updated":
            meta_parts.append(f"Updated copy. Previous test cases: {len(spec.baseline_cases)}")
        if figma_link:
            meta_parts.insert(2, f"Figma: {figma_link}")
        ws.merge_range(1, 0, 1, last_col, "   |   ".join(meta_parts), meta_fmt)
        for c, h in enumerate(sheet_headers):
            ws.write(2, c, h, header_fmt)

        rows = []
        for c in case_rows:
            r = _normalise_case(c, spec.module_label, include_ios=include_ios_col, is_ios_only=ios_only)
            if include_tct_col:
                if "IOS Testcase" in sheet_headers:
                    tct_insert_idx = sheet_headers.index("IOS Testcase") + 1
                else:
                    tct_insert_idx = sheet_headers.index("Regression Candidate (Yes/No)") + 1
                r.insert(tct_insert_idx, _first(c, "test_case_type", "Test Case Type", default="existing"))
            if len(r) != len(sheet_headers):
                raise ValueError(f"{sheet_name}: case column count {len(r)} does not match headers {len(sheet_headers)}")
            rows.append(r)

        centered = {"Test Scenario ID", "Test Case ID", "Priority (P0/P1/P2)", "Type (Positive/Negative/Edge Case)", "Test Category", "Platform", "Status", "Automation Candidate (Yes/No)", "Regression Candidate (Yes/No)", "IOS Testcase", "Test Case Type", "Source Type", "Automation Status", "Developer Status"}
        for r, row in enumerate(rows, 3):
            for c, value in enumerate(row):
                header = sheet_headers[c]
                fmt = center_fmt if header in centered else body_fmt
                if header == "Remarks" and isinstance(value, str) and "no automation reason" in value.lower():
                    _write_remarks_cell(ws, r, c, value, fmt, bold_inline_fmt)
                else:
                    ws.write(r, c, value, fmt)

        # Ensure blank execution fields still have governed defaults where cases omitted them.
        for r in range(3, 3 + len(rows)):
            status_idx = sheet_index["Status"]
            auto_status_idx = sheet_index["Automation Status"]
            if not rows[r - 3][status_idx]:
                ws.write(r, status_idx, "Not Executed", center_fmt)
            if not rows[r - 3][auto_status_idx]:
                ws.write(r, auto_status_idx, "Not Executed", center_fmt)

        # Config-backed dropdowns. Resolve columns from this sheet's headers.
        end_excel_row = max(500, min(max_formula_row, 3 + max(len(rows), 1) + 200))
        def rng(header: str) -> str:
            col = _col_letter(sheet_index[header])
            return f"{col}4:{col}{end_excel_row}"

        ws.data_validation(rng("Priority (P0/P1/P2)"), {"validate": "list", "source": "=PriorityList"})
        ws.data_validation(rng("Type (Positive/Negative/Edge Case)"), {"validate": "list", "source": "=TypeList"})
        ws.data_validation(rng("Test Category"), {"validate": "list", "source": "=CategoryList"})
        ws.data_validation(rng("Status"), {"validate": "list", "source": "=ManualStatusList"})
        ws.data_validation(rng("Automation Candidate (Yes/No)"), {"validate": "list", "source": "=YesNoList"})
        ws.data_validation(rng("Regression Candidate (Yes/No)"), {"validate": "list", "source": "=YesNoList"})
        if "IOS Testcase" in sheet_headers:
            ws.data_validation(rng("IOS Testcase"), {"validate": "list", "source": "=YesNoList"})
        ws.data_validation(rng("Source Type"), {"validate": "list", "source": "=SourceTypeList"})
        if "Test Case Type" in sheet_headers:
            ws.data_validation(rng("Test Case Type"), {"validate": "list", "source": "=TestCaseTypeList"})
        ws.data_validation(rng("Automation Status"), {"validate": "list", "source": "=AutomationStatusList"})

        # Conditional formatting for execution visibility.
        ws.conditional_format(rng("Status"), {"type": "text", "criteria": "containing", "value": "Pass", "format": wb.add_format({"bg_color": "#C6EFCE", "font_color": "#006100"})})
        ws.conditional_format(rng("Status"), {"type": "text", "criteria": "containing", "value": "Fail", "format": wb.add_format({"bg_color": "#FFC7CE", "font_color": "#9C0006"})})
        ws.conditional_format(rng("Automation Status"), {"type": "text", "criteria": "containing", "value": "Pass", "format": wb.add_format({"bg_color": "#C6EFCE", "font_color": "#006100"})})
        ws.conditional_format(rng("Automation Status"), {"type": "text", "criteria": "containing", "value": "Fail", "format": wb.add_format({"bg_color": "#FFC7CE", "font_color": "#9C0006"})})

        widths_map = {
            "Module": 50, "Test Scenario ID": 17, "Test Scenarios": 34, "Test Case ID": 17,
            "Test Description": 42, "Requirement Reference": 28, "Priority (P0/P1/P2)": 16,
            "Pre-condition": 34, "Type (Positive/Negative/Edge Case)": 22, "Test Steps": 46,
            "Test Data": 30, "Expected Result": 46, "Test Category": 20, "Platform": 18,
            "Actual Result": 30, "Status": 16, "Automation Candidate (Yes/No)": 20,
            "Regression Candidate (Yes/No)": 20, "IOS Testcase": 14, "Test Case Type": 16,
            "Source Type": 16, "Remarks": 36, "BA Comments": 28, "Developer Status": 20,
            "Developer Comment": 32, "Automation Status": 22, "Actual Automation Result": 30,
            "Automation Remark": 40,
        }
        for c, h in enumerate(sheet_headers):
            ws.set_column(c, c, widths_map.get(h, 20))
        ws.set_row(0, 26)
        ws.set_row(1, 36)
        ws.set_row(2, 42)
        ws.freeze_panes(3, 0)
        ws.autofilter(2, 0, max(3, 2 + len(rows)), last_col)

    # Render Dashboards
    platform_info = resolve_platform_columns(platform, specs)
    render_governed_dashboards(
        dashboard_ws=dashboard_ws,
        automation_dashboard_ws=automation_dashboard_ws,
        ios_dashboard_ws=ios_dashboard_ws,
        module_pairs=module_pairs,
        dashboard_title=dashboard_title,
        update_mode=update_mode,
        story_update=story_update,
        candidate_col=candidate_col,
        auto_status_col=auto_status_col,
        status_col=status_col,
        category_col=category_col,
        priority_col=priority_col,
        ios_col=ios_col,
        tct_col=tct_col,
        data_first=data_first,
        data_last=data_last,
        title_fmt=title_fmt,
        dash_section_fmt=dash_section_fmt,
        dash_header_fmt=dash_header_fmt,
        dash_body_fmt=dash_body_fmt,
        dash_label_fmt=dash_label_fmt,
        pct_fmt=pct_fmt,
        total_fmt=total_fmt,
        total_label_fmt=total_label_fmt,
        platform_col=platform_col,
        platform_info=platform_info,
    )

    wb.close()
    return str(out)
