"""Story update dashboard renderer for governed testcase workbooks.

Handles baseline comparisons and diff counts when updating existing user stories.
"""
from __future__ import annotations

from typing import Any, Mapping, Sequence

from common import (
    CATEGORIES,
    PRIORITIES,
    _active_total,
    _col_letter,
    _countifs,
    _first,
    _sum_countifs,
)


def render_story_dashboard(
    ws: Any,
    kind: str,
    module_pairs: list[tuple[Any, str | None, str]],
    dashboard_title: str,
    ios_dashboard_ws: Any,
    tct_col: str | None,
    candidate_col: str,
    ios_col: str | None,
    auto_status_col: str,
    status_col: str,
    category_col: str,
    priority_col: str,
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
    """Previous totals are fixed values from baseline_cases, because the original sheets
    are not in this workbook. Updated totals exclude invalidated.

    Automation and iOS previous/updated totals reference the Dashboard cells for that
    population so they stay equal to the Dashboard.
    """
    if platform_info is None:
        from common import resolve_platform_columns
        specs = [spec for spec, _, _ in module_pairs]
        platform_info = resolve_platform_columns(specs=specs)
    platform_col_names = [name for name, _ in platform_info]

    def prev_count(cases: Sequence[Mapping[str, Any]], flag: str | None, dim: str | None, dim_value: str | None) -> int:
        n = 0
        for case in cases:
            if flag == "automation" and str(_first(case, "automation", "automation_candidate", "Automation Candidate", "Automation Candidate (Yes/No)", default="No")).strip() != "Yes":
                continue
            if flag == "ios" and str(_first(case, "ios_testcase", "IOS Testcase", "iOS Testcase", default="")).strip() != "Yes":
                continue
            if dim == "category" and str(_first(case, "category", "Test Category", default="Functional")).strip() != dim_value:
                continue
            if dim == "priority" and str(_first(case, "priority", "Priority", "Priority (P0/P1/P2)", default="P1")).strip() != dim_value:
                continue
            n += 1
        return n

    all_baseline = [case for spec, _, _ in module_pairs for case in spec.baseline_cases]
    manual_cols = [
        "Summary", "Previous Total", "Updated Total",
        "Previous Automation", "Updated Automation",
    ]
    if ios_dashboard_ws is not None:
        manual_cols += ["Previous iOS", "Updated iOS"]
    manual_cols += platform_col_names
    manual_cols += [
        "Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "On Hold", "Deferred",
        "Existing", "New", "Modified", "Invalidated", "Pass %",
    ]
    if kind == "automation":
        cols = [
            "Summary", "Previous Total", "Updated Total",
        ] + platform_col_names + [
            "Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "Test Data Dependency",
            "Existing", "New", "Modified", "Invalidated", "Pass %",
        ]
        title = "Automation " + dashboard_title
    elif kind == "ios":
        cols = [
            "Summary", "Previous Total", "Updated Total",
        ] + [
            "Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "On Hold", "Deferred",
            "Existing", "New", "Modified", "Invalidated", "Pass %",
        ]
        title = "iOS " + dashboard_title
    else:
        cols = manual_cols
        title = dashboard_title

    assert tct_col
    pct_idx = cols.index("Pass %")
    upd_letter = _col_letter(cols.index("Updated Total"))
    pass_letter = _col_letter(cols.index("Pass"))
    updated_sheets = [updated for _, _, updated in module_pairs]
    manual_statuses = ["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "On Hold", "Deferred"]
    auto_statuses = ["Not Executed", "Pass", "Fail", "Blocked", "Skip", "NA", "Test Data Dependency"]
    statuses = auto_statuses if kind == "automation" else manual_statuses
    type_names = (("Existing", "existing"), ("New", "new"), ("Modified", "modified"), ("Invalidated", "invalidated"))

    def pct_formula(excel_row: int) -> str:
        return f"=IF({upd_letter}{excel_row}=0,0,{pass_letter}{excel_row}/{upd_letter}{excel_row})"

    def dash_ref(col_name: str, excel_row: int) -> str:
        return f"=Dashboard!{_col_letter(manual_cols.index(col_name))}{excel_row}"

    def population() -> list[tuple[str, str]]:
        if kind == "automation":
            return [(candidate_col, "Yes")]
        if kind == "ios":
            return [(ios_col, "Yes")]
        return []

    ws.merge_range(0, 0, 0, len(cols) - 1, title, title_fmt)
    ws.write(2, 0, "Overall Summary", dash_section_fmt)
    for c, h in enumerate(cols):
        ws.write(3, c, h, dash_header_fmt)
    ws.write(4, 0, "Overall", total_label_fmt)

    module_start = 8
    ws.write(module_start - 2, 0, "User Story / Module-wise Summary", dash_section_fmt)
    for c, h in enumerate(cols):
        ws.write(module_start - 1, c, h, dash_header_fmt)

    for i, (spec, _, updated_sheet) in enumerate(module_pairs):
        r = module_start + i
        excel_row = r + 1
        ws.write(r, 0, updated_sheet, dash_label_fmt)
        extra = population()
        if kind == "manual":
            ws.write_number(r, 1, prev_count(spec.baseline_cases, None, None, None), dash_body_fmt)
            ws.write_formula(r, 2, _active_total(updated_sheet, [], tct_col, data_first, data_last), dash_body_fmt)
        elif kind == "automation":
            ws.write_formula(r, 1, dash_ref("Previous Automation", excel_row), dash_body_fmt)
            ws.write_formula(r, 2, dash_ref("Updated Automation", excel_row), dash_body_fmt)
        else:
            ws.write_formula(r, 1, dash_ref("Previous iOS", excel_row), dash_body_fmt)
            ws.write_formula(r, 2, dash_ref("Updated iOS", excel_row), dash_body_fmt)

        for status in statuses:
            if kind == "automation":
                criteria = [(candidate_col, "Yes"), (auto_status_col, status), (tct_col, "<>invalidated")]
            elif kind == "ios":
                criteria = [(ios_col, "Yes"), (status_col, status), (tct_col, "<>invalidated")]
            else:
                criteria = [(status_col, status), (tct_col, "<>invalidated")]
            ws.write_formula(r, cols.index(status), _countifs(updated_sheet, criteria, data_first, data_last), dash_body_fmt)

        if kind != "ios":
            for plat_name, plat_pat in platform_info:
                variants = [plat_pat]
                if "+" in plat_pat:
                    for v in [plat_pat.replace(" ", ""), plat_pat.replace("+", " + "), plat_pat.replace("+", ", ")]:
                        if v not in variants:
                            variants.append(v)
                    if "Mobile Web" in plat_pat:
                        pwa_pat = plat_pat.replace("Mobile Web", "PWA")
                        for v in [pwa_pat, pwa_pat.replace(" ", ""), pwa_pat.replace("+", " + "), pwa_pat.replace("+", ", ")]:
                            if v not in variants:
                                variants.append(v)
                elif "," in plat_pat:
                    for v in [plat_pat.replace(", ", "+").replace(",", "+"), plat_pat.replace(", ", " + ").replace(",", " + ")]:
                        if v not in variants:
                            variants.append(v)
                elif plat_pat.lower() in ("mobile web", "pwa"):
                    for v in ["Mobile Web", "PWA", "mobile web", "pwa"]:
                        if v not in variants:
                            variants.append(v)
                parts = []
                for var in variants:
                    plat_criteria = list(extra) + [(platform_col, var), (tct_col, "<>invalidated")]
                    f_val = _countifs(updated_sheet, plat_criteria, data_first, data_last).lstrip("=")
                    parts.append(f_val)
                ws.write_formula(r, cols.index(plat_name), "=" + "+".join(parts), dash_body_fmt)

        for name, value in type_names:
            ws.write_formula(
                r, cols.index(name),
                _countifs(updated_sheet, list(extra) + [(tct_col, value)], data_first, data_last),
                dash_body_fmt,
            )
        ws.write_formula(r, pct_idx, pct_formula(excel_row), pct_fmt)

        if kind == "manual":
            ws.write_number(r, cols.index("Previous Automation"), prev_count(spec.baseline_cases, "automation", None, None), dash_body_fmt)
            ws.write_formula(r, cols.index("Updated Automation"), _active_total(updated_sheet, [(candidate_col, "Yes")], tct_col, data_first, data_last), dash_body_fmt)
            if "Previous iOS" in cols:
                ws.write_number(r, cols.index("Previous iOS"), prev_count(spec.baseline_cases, "ios", None, None), dash_body_fmt)
                ws.write_formula(r, cols.index("Updated iOS"), _active_total(updated_sheet, [(ios_col, "Yes")], tct_col, data_first, data_last), dash_body_fmt)

    total_row = module_start + len(module_pairs)
    ws.write(total_row, 0, "Total", total_label_fmt)
    for c in range(1, len(cols)):
        if c == pct_idx:
            ws.write_formula(total_row, c, pct_formula(total_row + 1), pct_fmt)
        else:
            col = _col_letter(c)
            ws.write_formula(total_row, c, f"=SUM({col}{module_start + 1}:{col}{total_row})", total_fmt)
    for c in range(1, len(cols)):
        if c == pct_idx:
            ws.write_formula(4, c, pct_formula(5), pct_fmt)
        else:
            col = _col_letter(c)
            ws.write_formula(4, c, f"={col}{total_row + 1}", total_fmt)

    def write_dimension(section_title: str, start: int, labels: Sequence[str], dim_col: str, dim: str) -> None:
        flag = None if kind == "manual" else kind
        ws.write(start - 2, 0, section_title, dash_section_fmt)
        for c, h in enumerate(cols):
            ws.write(start - 1, c, h, dash_header_fmt)
        for i, label in enumerate(labels):
            r = start + i
            excel_row = r + 1
            row_ref = f"$A{excel_row}"
            ws.write(r, 0, label, dash_label_fmt)
            extra = population()
            upd_criteria = [(dim_col, row_ref)] + extra + [(tct_col, "<>invalidated")]
            ws.write_number(r, 1, prev_count(all_baseline, flag, dim, label), dash_body_fmt)
            ws.write_formula(r, 2, _sum_countifs(updated_sheets, upd_criteria, data_first, data_last), dash_body_fmt)
            for status in statuses:
                if kind == "automation":
                    criteria = [(dim_col, row_ref), (candidate_col, "Yes"), (auto_status_col, status), (tct_col, "<>invalidated")]
                elif kind == "ios":
                    criteria = [(dim_col, row_ref), (ios_col, "Yes"), (status_col, status), (tct_col, "<>invalidated")]
                else:
                    criteria = [(dim_col, row_ref), (status_col, status), (tct_col, "<>invalidated")]
                ws.write_formula(r, cols.index(status), _sum_countifs(updated_sheets, criteria, data_first, data_last), dash_body_fmt)
            if kind != "ios":
                for plat_name, plat_pat in platform_info:
                    variants = [plat_pat]
                    if "+" in plat_pat:
                        for v in [plat_pat.replace(" ", ""), plat_pat.replace("+", " + "), plat_pat.replace("+", ", ")]:
                            if v not in variants:
                                variants.append(v)
                        if "Mobile Web" in plat_pat:
                            pwa_pat = plat_pat.replace("Mobile Web", "PWA")
                            for v in [pwa_pat, pwa_pat.replace(" ", ""), pwa_pat.replace("+", " + "), pwa_pat.replace("+", ", ")]:
                                if v not in variants:
                                    variants.append(v)
                    elif "," in plat_pat:
                        for v in [plat_pat.replace(", ", "+").replace(",", "+"), plat_pat.replace(", ", " + ").replace(",", " + ")]:
                            if v not in variants:
                                variants.append(v)
                    elif plat_pat.lower() in ("mobile web", "pwa"):
                        for v in ["Mobile Web", "PWA", "mobile web", "pwa"]:
                            if v not in variants:
                                variants.append(v)
                    parts = []
                    for var in variants:
                        plat_dim_criteria = [(dim_col, row_ref)] + extra + [(platform_col, var), (tct_col, "<>invalidated")]
                        f_val = _sum_countifs(updated_sheets, plat_dim_criteria, data_first, data_last).lstrip("=")
                        parts.append(f_val)
                    ws.write_formula(r, cols.index(plat_name), "=" + "+".join(parts), dash_body_fmt)
            for name, value in type_names:
                ws.write_formula(
                    r, cols.index(name),
                    _sum_countifs(updated_sheets, [(dim_col, row_ref)] + extra + [(tct_col, value)], data_first, data_last),
                    dash_body_fmt,
                )
            ws.write_formula(r, pct_idx, pct_formula(excel_row), pct_fmt)
            if kind == "manual":
                ws.write_number(r, cols.index("Previous Automation"), prev_count(all_baseline, "automation", dim, label), dash_body_fmt)
                ws.write_formula(r, cols.index("Updated Automation"), _sum_countifs(updated_sheets, [(dim_col, row_ref), (candidate_col, "Yes"), (tct_col, "<>invalidated")], data_first, data_last), dash_body_fmt)
                if "Previous iOS" in cols:
                    ws.write_number(r, cols.index("Previous iOS"), prev_count(all_baseline, "ios", dim, label), dash_body_fmt)
                    ws.write_formula(r, cols.index("Updated iOS"), _sum_countifs(updated_sheets, [(dim_col, row_ref), (ios_col, "Yes"), (tct_col, "<>invalidated")], data_first, data_last), dash_body_fmt)

    category_start = total_row + 5
    write_dimension("Test Category-wise Summary", category_start, CATEGORIES, category_col, "category")
    priority_start = category_start + len(CATEGORIES) + 4
    write_dimension("Priority-wise Summary", priority_start, PRIORITIES, priority_col, "priority")

    for c, w in enumerate([36] + [18] * (len(cols) - 1)):
        ws.set_column(c, c, w)
    ws.freeze_panes(4, 1)

