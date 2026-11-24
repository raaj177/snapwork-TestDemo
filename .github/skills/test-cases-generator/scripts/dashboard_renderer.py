"""Standard and executive dashboard renderer for governed testcase workbooks.

Renders live Excel formulas for:
- Manual Execution Dashboard
- Automation Dashboard (Automation Candidate == Yes, using Automation Status)
- iOS Dashboard (IOS Testcase == Yes, using manual Status)
Delegates to story_dashboard for story update / baseline diff workbooks.
"""
from __future__ import annotations

import re
from typing import Any, Mapping, Sequence

from common import (
    CATEGORIES,
    PRIORITIES,
    _automation_count_formula,
    _col_letter,
    _cross_sheet_dimension_formula,
    _first,
    _manual_count_formula,
    _quote_sheet,
    _sum_formula,
    format_platform_cell,
    resolve_platform_columns,
)
from story_dashboard import render_story_dashboard


def _match_plat(case: Mapping[str, Any], pat: str) -> bool:
    plat_str = str(_first(case, "platform", "Platform", "target_platform", default="Mobile App") or "Mobile App").strip()
    c_canon = format_platform_cell(plat_str).lower().replace(" ", "")
    p_canon = format_platform_cell(pat).lower().replace(" ", "")
    return c_canon == p_canon


def _platform_criteria_parts(
    q: str,
    platform_col: str,
    plat_pat: str,
    data_first: int,
    data_last: int,
    extra_criteria: list[tuple[str, str]] | None = None,
) -> list[str]:
    """Build formula parts matching plat_pat and any whitespace/separator/pwa variants."""
    variants = [plat_pat]
    if "+" in plat_pat:
        compact = plat_pat.replace(" ", "")
        spaced = plat_pat.replace("+", " + ")
        comma = plat_pat.replace("+", ", ")
        for v in [compact, spaced, comma]:
            if v not in variants:
                variants.append(v)
        if "Mobile Web" in plat_pat:
            pwa_pat = plat_pat.replace("Mobile Web", "PWA")
            for v in [pwa_pat, pwa_pat.replace(" ", ""), pwa_pat.replace("+", " + "), pwa_pat.replace("+", ", ")]:
                if v not in variants:
                    variants.append(v)
    elif "," in plat_pat:
        compact = plat_pat.replace(", ", "+").replace(",", "+")
        spaced = plat_pat.replace(", ", " + ").replace(",", " + ")
        for v in [compact, spaced]:
            if v not in variants:
                variants.append(v)
    elif plat_pat.lower() in ("mobile web", "pwa"):
        for v in ["Mobile Web", "PWA", "mobile web", "pwa"]:
            if v not in variants:
                variants.append(v)

    parts: list[str] = []
    for var in variants:
        crit_pairs: list[str] = []
        if extra_criteria:
            for c_col, c_val in extra_criteria:
                crit = c_val if (c_val.startswith('"') or c_val.startswith("$")) else f'"{c_val}"'
                crit_pairs.append(f'{q}!${c_col}${data_first}:${c_col}${data_last},{crit}')
        crit_pairs.append(f'{q}!${platform_col}${data_first}:${platform_col}${data_last},"{var}"')
        if len(crit_pairs) == 1 and not extra_criteria:
            parts.append(f'COUNTIF({crit_pairs[0]})')
        else:
            parts.append(f'COUNTIFS({",".join(crit_pairs)})')
    return parts


def _match_status(case: Mapping[str, Any], status: str, is_auto: bool) -> bool:
    if is_auto:
        val = str(_first(case, "automation_status", "Automation Status", default="Not Executed")).strip()
    else:
        val = str(_first(case, "status", "Status", default="Not Executed")).strip()
    return val.lower() == status.lower()


def _write_standard_dashboard(
    ws: Any,
    automation: bool,
    ios_only: bool,
    module_pairs: list[tuple[Any, str | None, str]],
    dashboard_title: str,
    update_mode: bool,
    candidate_col: str,
    ios_col: str | None,
    auto_status_col: str,
    status_col: str,
    category_col: str,
    priority_col: str,
    tct_col: str | None,
    data_first: int,
    data_last: int,
    title_fmt: Any,
    dash_section_fmt: Any,
    dash_header_fmt: Any,
    dash_body_fmt: Any,
    dash_label_fmt: Any,
    pct_fmt: Any,
    total_fmt: Any,
    total_label_fmt: Any,
    platform_col: str = "N",
    platform_info: list[tuple[str, str]] | None = None,
) -> None:
    physical = [(spec, updated) for spec, _baseline, updated in module_pairs]
    sheet_names = [updated for _, _, updated in module_pairs]

    if platform_info is None:
        specs = [spec for spec, _, _ in module_pairs]
        platform_info = resolve_platform_columns(specs=specs)
    platform_col_names = [name for name, _ in platform_info]

    if automation:
        title = "Automation " + dashboard_title
    elif ios_only:
        title = "iOS " + dashboard_title
    else:
        title = dashboard_title
    platform_cols = [] if ios_only else platform_col_names
    cols = (
        ["Summary", "Total Automation Candidates"] + platform_cols + ["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "Test Data Dependency", "Pass %"]
        if automation else
        ["Summary", "Total iOS Test Cases" if ios_only else "Total Test Cases"] + platform_cols + ["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "On Hold", "Deferred", "Pass %"]
    )
    if update_mode:
        cols = cols[:-1] + ["New", "Modified", "Invalidated"] + cols[-1:]
    ws.merge_range(0, 0, 0, len(cols) - 1, title, title_fmt)
    pct_col = len(cols) - 1
    total_col_letter = _col_letter(1)
    pass_col_letter = _col_letter(cols.index("Pass"))
    ws.write(2, 0, "Overall Summary", dash_section_fmt)
    for c, h in enumerate(cols):
        ws.write(3, c, h, dash_header_fmt)
    ws.write(4, 0, "Overall", total_label_fmt)

    # Module-wise starts at row 8 (Excel row 9), close to the supplied reference workbook.
    module_start = 8
    ws.write(module_start - 2, 0, "User Story / Module-wise Summary", dash_section_fmt)
    for c, h in enumerate(cols):
        ws.write(module_start - 1, c, h, dash_header_fmt)

    overall_col_totals = [0] * len(cols)
    all_active_cases: list[Mapping[str, Any]] = []

    for i, (spec, sheet_name) in enumerate(physical):
        r = module_start + i
        ws.write(r, 0, sheet_name, dash_label_fmt)
        q = _quote_sheet(sheet_name)

        spec_cases = list(spec.cases) if hasattr(spec, "cases") and spec.cases else []
        if automation:
            active_cases = [c for c in spec_cases if str(_first(c, "automation", "automation_candidate", "Automation Candidate", "Automation Candidate (Yes/No)", default="No")).strip().lower() == "yes"]
        elif ios_only:
            active_cases = [c for c in spec_cases if str(_first(c, "ios", "ios_testcase", "IOS Testcase", default="No")).strip().lower() == "yes"]
        else:
            active_cases = spec_cases
        all_active_cases.extend(active_cases)

        m_tot = len(active_cases)
        m_pass = sum(1 for c in active_cases if _match_status(c, "Pass", automation))
        m_pct = (m_pass / m_tot) if m_tot > 0 else 0.0

        module_col_values = [0] * len(cols)
        module_col_values[1] = m_tot

        if automation:
            ws.write_formula(r, 1, f'=COUNTIF({q}!${candidate_col}${data_first}:${candidate_col}${data_last},"Yes")', dash_body_fmt, value=m_tot)
            for plat_name, plat_pat in platform_info:
                plat_idx = cols.index(plat_name)
                plat_cnt = sum(1 for c in active_cases if _match_plat(c, plat_pat))
                module_col_values[plat_idx] = plat_cnt
                parts = _platform_criteria_parts(q, platform_col, plat_pat, data_first, data_last, extra_criteria=[(candidate_col, "Yes")])
                ws.write_formula(r, plat_idx, _sum_formula(parts), dash_body_fmt, value=plat_cnt)
            statuses = ["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "Test Data Dependency"]
            for status in statuses:
                st_idx = cols.index(status)
                st_cnt = sum(1 for c in active_cases if _match_status(c, status, automation))
                module_col_values[st_idx] = st_cnt
                ws.write_formula(r, st_idx, _automation_count_formula(sheet_name, candidate_col, auto_status_col, status, data_first, data_last), dash_body_fmt, value=st_cnt)
            ws.write_formula(r, pct_col, f'=IF({total_col_letter}{r+1}=0,0,{pass_col_letter}{r+1}/{total_col_letter}{r+1})', pct_fmt, value=m_pct)
        elif ios_only:
            assert ios_col
            ws.write_formula(r, 1, f'=COUNTIF({q}!${ios_col}${data_first}:${ios_col}${data_last},"Yes")', dash_body_fmt, value=m_tot)
            statuses = ["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "On Hold", "Deferred"]
            for status in statuses:
                st_idx = cols.index(status)
                st_cnt = sum(1 for c in active_cases if _match_status(c, status, automation))
                module_col_values[st_idx] = st_cnt
                ws.write_formula(r, st_idx,
                    f'=COUNTIFS({q}!${ios_col}${data_first}:${ios_col}${data_last},"Yes",'
                    f'{q}!${status_col}${data_first}:${status_col}${data_last},"{status}")', dash_body_fmt, value=st_cnt)
            ws.write_formula(r, pct_col, f'=IF({total_col_letter}{r+1}=0,0,{pass_col_letter}{r+1}/{total_col_letter}{r+1})', pct_fmt, value=m_pct)
        else:
            ws.write_formula(r, 1, f'=COUNTA({q}!$D${data_first}:$D${data_last})', dash_body_fmt, value=m_tot)
            for plat_name, plat_pat in platform_info:
                plat_idx = cols.index(plat_name)
                plat_cnt = sum(1 for c in active_cases if _match_plat(c, plat_pat))
                module_col_values[plat_idx] = plat_cnt
                parts = _platform_criteria_parts(q, platform_col, plat_pat, data_first, data_last, extra_criteria=[])
                ws.write_formula(r, plat_idx, _sum_formula(parts), dash_body_fmt, value=plat_cnt)
            statuses = ["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "On Hold", "Deferred"]
            for status in statuses:
                st_idx = cols.index(status)
                st_cnt = sum(1 for c in active_cases if _match_status(c, status, automation))
                module_col_values[st_idx] = st_cnt
                ws.write_formula(r, st_idx, _manual_count_formula(sheet_name, status_col, status, data_first, data_last), dash_body_fmt, value=st_cnt)
            ws.write_formula(r, pct_col, f'=IF({total_col_letter}{r+1}=0,0,{pass_col_letter}{r+1}/{total_col_letter}{r+1})', pct_fmt, value=m_pct)

        if update_mode:
            assert tct_col
            for j, tct_val in enumerate(["new", "modified", "invalidated"]):
                col_idx = len(cols) - 4 + j
                tct_cnt = sum(1 for c in active_cases if str(_first(c, "test_case_type", "Test Case Type", default="existing")).strip().lower() == tct_val)
                module_col_values[col_idx] = tct_cnt
                if automation:
                    ws.write_formula(r, col_idx, f'=COUNTIFS({q}!${candidate_col}${data_first}:${candidate_col}${data_last},"Yes",{q}!${tct_col}${data_first}:${tct_col}${data_last},"{tct_val}")', dash_body_fmt, value=tct_cnt)
                elif ios_only:
                    assert ios_col
                    ws.write_formula(r, col_idx, f'=COUNTIFS({q}!${ios_col}${data_first}:${ios_col}${data_last},"Yes",{q}!${tct_col}${data_first}:${tct_col}${data_last},"{tct_val}")', dash_body_fmt, value=tct_cnt)
                else:
                    ws.write_formula(r, col_idx, f'=COUNTIF({q}!${tct_col}${data_first}:${tct_col}${data_last},"{tct_val}")', dash_body_fmt, value=tct_cnt)

        for c_idx in range(1, len(cols)):
            if c_idx != pct_col:
                overall_col_totals[c_idx] += module_col_values[c_idx]

    tot_cases = overall_col_totals[1]
    pass_col_idx = cols.index("Pass")
    tot_pass = overall_col_totals[pass_col_idx]
    tot_pct = (tot_pass / tot_cases) if tot_cases > 0 else 0.0

    total_row = module_start + len(physical)
    ws.write(total_row, 0, "Total", total_label_fmt)

    for c in range(1, len(cols)):
        if c == pct_col:
            ws.write_formula(total_row, pct_col, f'=IF({total_col_letter}{total_row+1}=0,0,{pass_col_letter}{total_row+1}/{total_col_letter}{total_row+1})', pct_fmt, value=tot_pct)
        else:
            col = _col_letter(c)
            ws.write_formula(total_row, c, f'=SUM({col}{module_start+1}:{col}{total_row})', total_fmt, value=overall_col_totals[c])

    # Overall formulas link to module total row, guaranteeing one reconciliation path.
    for c in range(1, len(cols)):
        if c == pct_col:
            ws.write_formula(4, pct_col, f'=IF({total_col_letter}5=0,0,{pass_col_letter}5/{total_col_letter}5)', pct_fmt, value=tot_pct)
        else:
            col = _col_letter(c)
            ws.write_formula(4, c, f'={col}{total_row+1}', total_fmt, value=overall_col_totals[c])

    # Category-wise and Priority-wise summaries are live COUNTIFS across all module sheets.
    category_start = total_row + 5
    ws.write(category_start - 2, 0, "Test Category-wise Summary", dash_section_fmt)
    for c, h in enumerate(cols):
        ws.write(category_start - 1, c, h, dash_header_fmt)
    for i, category in enumerate(CATEGORIES):
        r = category_start + i
        ws.write(r, 0, category, dash_label_fmt)
        row_ref = f'$A{r+1}'
        cat_cases = [c for c in all_active_cases if str(_first(c, "category", "test_category", "Test Category", default="")).strip().lower() == category.lower()]
        cat_tot = len(cat_cases)
        cat_pass = sum(1 for c in cat_cases if _match_status(c, "Pass", automation))
        cat_pct = (cat_pass / cat_tot) if cat_tot > 0 else 0.0

        if automation:
            total_formula = _cross_sheet_dimension_formula(sheet_names, category_col, row_ref, status_col, None, candidate_col, auto_status_col, data_first, data_last)
        elif ios_only:
            assert ios_col
            parts = []
            for sheet_name in sheet_names:
                q = _quote_sheet(sheet_name)
                parts.append(f'COUNTIFS({q}!${category_col}${data_first}:${category_col}${data_last},{row_ref},{q}!${ios_col}${data_first}:${ios_col}${data_last},"Yes")')
            total_formula = _sum_formula(parts)
        else:
            total_formula = _cross_sheet_dimension_formula(sheet_names, category_col, row_ref, status_col, None, None, auto_status_col, data_first, data_last)
        ws.write_formula(r, 1, total_formula, dash_body_fmt, value=cat_tot)

        # Platform counts for Category (omitted on iOS Dashboard)
        if not ios_only:
            for plat_name, plat_pat in platform_info:
                plat_cnt = sum(1 for c in cat_cases if _match_plat(c, plat_pat))
                parts = []
                for sheet_name in sheet_names:
                    q = _quote_sheet(sheet_name)
                    if automation:
                        parts.extend(_platform_criteria_parts(q, platform_col, plat_pat, data_first, data_last, extra_criteria=[(category_col, row_ref), (candidate_col, "Yes")]))
                    else:
                        parts.extend(_platform_criteria_parts(q, platform_col, plat_pat, data_first, data_last, extra_criteria=[(category_col, row_ref)]))
                ws.write_formula(r, cols.index(plat_name), _sum_formula(parts), dash_body_fmt, value=plat_cnt)

        status_list = (["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "Test Data Dependency"] if automation else ["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "On Hold", "Deferred"])
        for status in status_list:
            st_cnt = sum(1 for c in cat_cases if _match_status(c, status, automation))
            if automation:
                f = _cross_sheet_dimension_formula(sheet_names, category_col, row_ref, status_col, status, candidate_col, auto_status_col, data_first, data_last)
            elif ios_only:
                assert ios_col
                parts = []
                for sheet_name in sheet_names:
                    q = _quote_sheet(sheet_name)
                    parts.append(f'COUNTIFS({q}!${category_col}${data_first}:${category_col}${data_last},{row_ref},{q}!${ios_col}${data_first}:${ios_col}${data_last},"Yes",{q}!${status_col}${data_first}:${status_col}${data_last},"{status}")')
                f = _sum_formula(parts)
            else:
                f = _cross_sheet_dimension_formula(sheet_names, category_col, row_ref, status_col, status, None, auto_status_col, data_first, data_last)
            ws.write_formula(r, cols.index(status), f, dash_body_fmt, value=st_cnt)
        ws.write_formula(r, pct_col, f'=IF({total_col_letter}{r+1}=0,0,{pass_col_letter}{r+1}/{total_col_letter}{r+1})', pct_fmt, value=cat_pct)

        if update_mode:
            assert tct_col
            for j, tct_val in enumerate(["new", "modified", "invalidated"]):
                col_idx = len(cols) - 4 + j
                tct_cnt = sum(1 for c in cat_cases if str(_first(c, "test_case_type", "Test Case Type", default="existing")).strip().lower() == tct_val)
                if automation:
                    f = _cross_sheet_dimension_formula(sheet_names, category_col, row_ref, tct_col, tct_val, candidate_col, tct_col, data_first, data_last)
                elif ios_only:
                    assert ios_col
                    parts = []
                    for sheet_name in sheet_names:
                        q = _quote_sheet(sheet_name)
                        parts.append(f'COUNTIFS({q}!${category_col}${data_first}:${category_col}${data_last},{row_ref},{q}!${ios_col}${data_first}:${ios_col}${data_last},"Yes",{q}!${tct_col}${data_first}:${tct_col}${data_last},"{tct_val}")')
                    f = _sum_formula(parts)
                else:
                    f = _cross_sheet_dimension_formula(sheet_names, category_col, row_ref, tct_col, tct_val, None, tct_col, data_first, data_last)
                ws.write_formula(r, col_idx, f, dash_body_fmt, value=tct_cnt)

    priority_start = category_start + len(CATEGORIES) + 4
    ws.write(priority_start - 2, 0, "Priority-wise Summary", dash_section_fmt)
    for c, h in enumerate(cols):
        ws.write(priority_start - 1, c, h, dash_header_fmt)
    for i, priority in enumerate(PRIORITIES):
        r = priority_start + i
        ws.write(r, 0, priority, dash_label_fmt)
        row_ref = f'$A{r+1}'
        pri_cases = [c for c in all_active_cases if str(_first(c, "priority", "Priority", "Priority (P0/P1/P2)", default="")).strip().lower() == priority.lower()]
        pri_tot = len(pri_cases)
        pri_pass = sum(1 for c in pri_cases if _match_status(c, "Pass", automation))
        pri_pct = (pri_pass / pri_tot) if pri_tot > 0 else 0.0

        if automation:
            total_formula = _cross_sheet_dimension_formula(sheet_names, priority_col, row_ref, status_col, None, candidate_col, auto_status_col, data_first, data_last)
        elif ios_only:
            assert ios_col
            parts = []
            for sheet_name in sheet_names:
                q = _quote_sheet(sheet_name)
                parts.append(f'COUNTIFS({q}!${priority_col}${data_first}:${priority_col}${data_last},{row_ref},{q}!${ios_col}${data_first}:${ios_col}${data_last},"Yes")')
            total_formula = _sum_formula(parts)
        else:
            total_formula = _cross_sheet_dimension_formula(sheet_names, priority_col, row_ref, status_col, None, None, auto_status_col, data_first, data_last)
        ws.write_formula(r, 1, total_formula, dash_body_fmt, value=pri_tot)

        # Platform counts for Priority (omitted on iOS Dashboard)
        if not ios_only:
            for plat_name, plat_pat in platform_info:
                plat_cnt = sum(1 for c in pri_cases if _match_plat(c, plat_pat))
                parts = []
                for sheet_name in sheet_names:
                    q = _quote_sheet(sheet_name)
                    if automation:
                        parts.extend(_platform_criteria_parts(q, platform_col, plat_pat, data_first, data_last, extra_criteria=[(priority_col, row_ref), (candidate_col, "Yes")]))
                    else:
                        parts.extend(_platform_criteria_parts(q, platform_col, plat_pat, data_first, data_last, extra_criteria=[(priority_col, row_ref)]))
                ws.write_formula(r, cols.index(plat_name), _sum_formula(parts), dash_body_fmt, value=plat_cnt)

        status_list = (["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "Test Data Dependency"] if automation else ["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "On Hold", "Deferred"])
        for status in status_list:
            st_cnt = sum(1 for c in pri_cases if _match_status(c, status, automation))
            if automation:
                f = _cross_sheet_dimension_formula(sheet_names, priority_col, row_ref, status_col, status, candidate_col, auto_status_col, data_first, data_last)
            elif ios_only:
                assert ios_col
                parts = []
                for sheet_name in sheet_names:
                    q = _quote_sheet(sheet_name)
                    parts.append(f'COUNTIFS({q}!${priority_col}${data_first}:${priority_col}${data_last},{row_ref},{q}!${ios_col}${data_first}:${ios_col}${data_last},"Yes",{q}!${status_col}${data_first}:${status_col}${data_last},"{status}")')
                f = _sum_formula(parts)
            else:
                f = _cross_sheet_dimension_formula(sheet_names, priority_col, row_ref, status_col, status, None, auto_status_col, data_first, data_last)
            ws.write_formula(r, cols.index(status), f, dash_body_fmt, value=st_cnt)
        ws.write_formula(r, pct_col, f'=IF({total_col_letter}{r+1}=0,0,{pass_col_letter}{r+1}/{total_col_letter}{r+1})', pct_fmt, value=pri_pct)

        if update_mode:
            assert tct_col
            for j, tct_val in enumerate(["new", "modified", "invalidated"]):
                col_idx = len(cols) - 4 + j
                tct_cnt = sum(1 for c in pri_cases if str(_first(c, "test_case_type", "Test Case Type", default="existing")).strip().lower() == tct_val)
                if automation:
                    f = _cross_sheet_dimension_formula(sheet_names, priority_col, row_ref, tct_col, tct_val, candidate_col, tct_col, data_first, data_last)
                elif ios_only:
                    assert ios_col
                    parts = []
                    for sheet_name in sheet_names:
                        q = _quote_sheet(sheet_name)
                        parts.append(f'COUNTIFS({q}!${priority_col}${data_first}:${priority_col}${data_last},{row_ref},{q}!${ios_col}${data_first}:${ios_col}${data_last},"Yes",{q}!${tct_col}${data_first}:${tct_col}${data_last},"{tct_val}")')
                    f = _sum_formula(parts)
                else:
                    f = _cross_sheet_dimension_formula(sheet_names, priority_col, row_ref, tct_col, tct_val, None, tct_col, data_first, data_last)
                ws.write_formula(r, col_idx, f, dash_body_fmt, value=tct_cnt)

    widths = [30] + [16] * (len(cols) - 1)
    for c, w in enumerate(widths):
        ws.set_column(c, c, w)
    ws.freeze_panes(4, 1)


def render_governed_dashboards(
    dashboard_ws: Any,
    automation_dashboard_ws: Any,
    ios_dashboard_ws: Any,
    module_pairs: list[tuple[Any, str | None, str]],
    dashboard_title: str,
    update_mode: bool,
    story_update: bool,
    candidate_col: str,
    auto_status_col: str,
    status_col: str,
    category_col: str,
    priority_col: str,
    ios_col: str | None,
    tct_col: str | None,
    data_first: int,
    data_last: int,
    title_fmt: Any,
    dash_section_fmt: Any,
    dash_header_fmt: Any,
    dash_body_fmt: Any,
    dash_label_fmt: Any,
    pct_fmt: Any,
    total_fmt: Any,
    total_label_fmt: Any,
    platform_col: str = "N",
    platform_info: list[tuple[str, str]] | None = None,
) -> None:
    """Render live manual, automation, and iOS dashboards."""
    if platform_info is None:
        specs = [spec for spec, _, _ in module_pairs]
        platform_info = resolve_platform_columns(specs=specs)

    if story_update:
        render_story_dashboard(
            dashboard_ws, "manual", module_pairs, dashboard_title, ios_dashboard_ws,
            tct_col, candidate_col, ios_col, auto_status_col, status_col, category_col, priority_col,
            data_first, data_last, title_fmt, dash_section_fmt, dash_header_fmt, dash_body_fmt,
            dash_label_fmt, pct_fmt, total_fmt, total_label_fmt, platform_col, platform_info,
        )
        render_story_dashboard(
            automation_dashboard_ws, "automation", module_pairs, dashboard_title, ios_dashboard_ws,
            tct_col, candidate_col, ios_col, auto_status_col, status_col, category_col, priority_col,
            data_first, data_last, title_fmt, dash_section_fmt, dash_header_fmt, dash_body_fmt,
            dash_label_fmt, pct_fmt, total_fmt, total_label_fmt, platform_col, platform_info,
        )
        if ios_dashboard_ws:
            render_story_dashboard(
                ios_dashboard_ws, "ios", module_pairs, dashboard_title, ios_dashboard_ws,
                tct_col, candidate_col, ios_col, auto_status_col, status_col, category_col, priority_col,
                data_first, data_last, title_fmt, dash_section_fmt, dash_header_fmt, dash_body_fmt,
                dash_label_fmt, pct_fmt, total_fmt, total_label_fmt, platform_col, platform_info,
            )
    else:
        _write_standard_dashboard(
            dashboard_ws, False, False, module_pairs, dashboard_title, update_mode,
            candidate_col, ios_col, auto_status_col, status_col, category_col, priority_col, tct_col,
            data_first, data_last, title_fmt, dash_section_fmt, dash_header_fmt, dash_body_fmt,
            dash_label_fmt, pct_fmt, total_fmt, total_label_fmt, platform_col, platform_info,
        )
        _write_standard_dashboard(
            automation_dashboard_ws, True, False, module_pairs, dashboard_title, update_mode,
            candidate_col, ios_col, auto_status_col, status_col, category_col, priority_col, tct_col,
            data_first, data_last, title_fmt, dash_section_fmt, dash_header_fmt, dash_body_fmt,
            dash_label_fmt, pct_fmt, total_fmt, total_label_fmt, platform_col, platform_info,
        )
        if ios_dashboard_ws:
            _write_standard_dashboard(
                ios_dashboard_ws, False, True, module_pairs, dashboard_title, update_mode,
                candidate_col, ios_col, auto_status_col, status_col, category_col, priority_col, tct_col,
                data_first, data_last, title_fmt, dash_section_fmt, dash_header_fmt, dash_body_fmt,
                dash_label_fmt, pct_fmt, total_fmt, total_label_fmt, platform_col, platform_info,
            )
