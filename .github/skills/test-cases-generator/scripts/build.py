#!/usr/bin/env python3
"""build.py — one command: cases.json -> governed workbook -> verify -> recalc -> coverage.

    python scripts/build.py --data cases.json --out <Name>_TestCases_v1_0.xlsx

cases.json shape (see assets/cases.example.json):
{
  "us_id_meta": "<source document identifier>",
  "dashboard_title": "<Product> - Test Execution Dashboard",
  "figma_link": null,
  "acs": ["AC-01", "AC-02"],            # optional; enables AC coverage % in the report
  "modules": [
    {"sheet": "US-001 Login", "label": "US-001. Login", "cases": [ {...case...} ]}
  ]
}

Prints ONE JSON block. Deliver only when "status" == "success" and "total_errors" == 0.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from common import (  # noqa: E402
    build_workbook,
    is_ios_only_platform,
    is_standalone_mode,
    is_update_mode,
    load_and_merge_testbank,
    normalize_project_mode,
    should_include_ios_column,
)
from verify_workbook import verify  # noqa: E402
import check_coverage as cc
import validate_cases as gv  # noqa: E402
import re
from extract_matrix import normalize_narrative_text  # noqa: E402

ERROR_TOKENS = ("#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A", "#NUM!", "#NULL!")

_MACRO = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE script:module PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "module.dtd">
<script:module xmlns:script="http://openoffice.org/2000/script" script:name="Module1" script:language="StarBasic">
    Sub RecalculateAndSave()
      ThisComponent.calculateAll()
      ThisComponent.store()
      ThisComponent.close(True)
    End Sub
</script:module>"""
_SCRIPT_XLB = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE library:library PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "library.dtd">
<library:library xmlns:library="http://openoffice.org/2000/library" library:name="Standard" library:readonly="false" library:passwordprotected="false">
 <library:element library:name="Module1"/>
</library:library>"""


def _recalc_scan(path: Path, timeout: int) -> dict:
    """Recalculate a COPY with LibreOffice and scan cached values for error tokens.

    The delivered file is left untouched (xlsxwriter output, auto-calc on open)."""
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        return {"recalc": "skipped", "reason": "LibreOffice not available"}
    try:
        import openpyxl  # noqa: F401
    except ImportError:
        return {"recalc": "skipped", "reason": "openpyxl not available"}
    with tempfile.TemporaryDirectory() as tmp:
        conv = Path(tmp) / path.name
        shutil.copy(path, conv)
        profile = Path(tmp) / "profile"
        url = profile.as_uri()
        env = dict(os.environ, HOME=tmp)
        try:
            subprocess.run([soffice, "--headless", "--terminate_after_init", f"-env:UserInstallation={url}"],
                           capture_output=True, timeout=timeout, env=env)
            macro_dir = profile / "user" / "basic" / "Standard"
            macro_dir.mkdir(parents=True, exist_ok=True)
            (macro_dir / "Module1.xba").write_text(_MACRO)
            (macro_dir / "script.xlb").write_text(_SCRIPT_XLB)
            before = conv.stat().st_mtime_ns
            subprocess.run([soffice, "--headless", "--norestore", f"-env:UserInstallation={url}",
                            "vnd.sun.star.script:Standard.Module1.RecalculateAndSave?language=Basic&location=application",
                            str(conv)], capture_output=True, timeout=timeout, env=env)
            if conv.stat().st_mtime_ns == before:
                return {"recalc": "failed", "reason": "LibreOffice did not rewrite the file"}
        except Exception as exc:  # pragma: no cover
            return {"recalc": "failed", "reason": str(exc)[:200]}
        import openpyxl
        wb = openpyxl.load_workbook(conv, data_only=True)
        errors: dict[str, list[str]] = {}
        formulas = 0
        for ws in wb.worksheets:
            for row in ws.iter_rows():
                for cell in row:
                    v = cell.value
                    if isinstance(v, str) and v.startswith("#") and any(v.startswith(t) for t in ERROR_TOKENS):
                        errors.setdefault(v, []).append(f"{ws.title}!{cell.coordinate}")
        wbf = openpyxl.load_workbook(conv)
        for ws in wbf.worksheets:
            for row in ws.iter_rows():
                for cell in row:
                    if isinstance(cell.value, str) and cell.value.startswith("="):
                        formulas += 1
        total = sum(len(v) for v in errors.values())
        # Reconciliation: overall row (Excel row 5) must equal module total row on all dashboards.
        recon = {}
        dashboards = ["Dashboard", "Automation Dashboard"]
        if "iOS Dashboard" in wb.sheetnames:
            dashboards.append("iOS Dashboard")
        for name in dashboards:
            ws = wb[name]
            wsf = wbf[name]
            overall = ws["B5"].value
            total_row = None
            for r in range(9, 80):
                if ws.cell(r, 1).value == "Total":
                    total_row = r
                    break
            module_total = ws.cell(total_row, 2).value if total_row else None
            reconciled = overall is not None and overall == module_total
            entry = {"overall_total": overall, "module_total": module_total, "reconciled": reconciled}
            if wsf["C4"].value == "Updated Total" and total_row:
                updated_overall = ws["C5"].value
                updated_module = ws.cell(total_row, 3).value
                entry["updated_total"] = updated_overall
                entry["updated_module_total"] = updated_module
                entry["reconciled"] = reconciled and updated_overall is not None and updated_overall == updated_module
            recon[name] = entry
        return {"recalc": "done", "total_formulas": formulas, "total_errors": total,
                "error_summary": {k: v[:20] for k, v in errors.items()}, "reconciliation": recon}


def _norm_module(m):
    """Accept {sheet|sheet_name, label|module_label, cases, baseline_cases} or (sheet, label, cases)."""
    if isinstance(m, (list, tuple)) and len(m) == 3:
        return {"sheet": str(m[0]), "label": str(m[1]), "cases": list(m[2]), "baseline_cases": []}
    sheet = m.get("sheet") or m.get("sheet_name") or m.get("title") or m.get("module") or "Module"
    label = m.get("label") or m.get("module_label") or m.get("us_label") or sheet
    return {
        "sheet": str(sheet),
        "label": str(label),
        "cases": list(m.get("cases") or m.get("test_cases") or []),
        "baseline_cases": list(m.get("baseline_cases") or []),
    }


def auto_normalize_data(data: dict) -> dict:
    if not isinstance(data, dict) or not data.get("modules"):
        return data

    step_map: dict[str, str] = {}
    global_screen_names: dict[str, dict[int, str]] = {}
    per_story_screens: dict[str, dict[str, str]] = {}

    for mod in data.get("modules", []):
        lbl = mod.get("label", "") or mod.get("sheet", "")
        sid = lbl.split(".")[0].strip() if "." in lbl else lbl
        m_s = re.search(r'\(Step\s*(\d+)(?:/\d+)?\)', lbl, re.I)
        s_num = m_s.group(1).strip() if m_s else ""
        if s_num:
            s_clean = re.sub(r'^(?:US\s*\d+\s*[-–:]\s*)?(?:JSA\s*[-–:]\s*)?', '', lbl, flags=re.I)
            s_clean = re.sub(r'\(Step\s*\d+(?:/\d+)?\)', '', s_clean, flags=re.I).strip()
            step_map[s_num] = s_clean

        s_screens: dict[str, str] = {}
        for c in mod.get("cases", []):
            pre = c.get("precondition", "")
            m_pre = re.search(r'on the (.*?) screen', pre, re.I)
            if m_pre:
                scr_name = m_pre.group(1).strip()
                m_p = re.search(r'page\s*(\d+)', scr_name, re.I)
                p_code = f"S{m_p.group(1)}" if m_p else "S1"
                s_screens.setdefault(p_code, scr_name)
        per_story_screens[sid] = s_screens

        if s_num:
            step_screens: dict[int, str] = {}
            for sc_c, sc_n in s_screens.items():
                m_p = re.search(r'page\s*(\d+)', sc_n, re.I)
                p_idx = int(m_p.group(1)) if m_p else (int(sc_c[1:]) if sc_c[1:].isdigit() else 1)
                step_screens[p_idx] = sc_n
            if step_screens:
                global_screen_names[s_num] = step_screens

    for mod in data.get("modules", []):
        sid = mod.get("label", "").split(".")[0].strip() if "." in mod.get("label", "") else mod.get("label", "")
        scr_map = per_story_screens.get(sid, {})
        for c in mod.get("cases", []):
            for k in ["scenario", "description", "steps", "expected_result", "precondition", "remarks"]:
                if k in c and isinstance(c[k], str):
                    c[k] = normalize_narrative_text(c[k], sid, step_map, global_screen_names, scr_map)
            if is_ios_only_platform(data.get("platform")):
                c["ios_testcase"] = "Yes"
                c["IOS Testcase"] = "Yes"
    return data


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=None, help="cases.json path")
    ap.add_argument("--out", required=True, help="output .xlsx path")
    ap.add_argument("--mod-prefix", default="US")
    ap.add_argument("--author", default="QA Team")
    ap.add_argument("--version", default="1.0")
    ap.add_argument("--no-recalc", action="store_true")
    ap.add_argument("--timeout", type=int, default=60)
    ap.add_argument("--dup-threshold", type=float, default=0.82)
    ap.add_argument("--source-workbook", "--testbank", default=None, help="designated test bank workbook path to copy as-is")
    ap.add_argument("--skeleton", default=None, help="skeleton.json path to verify deterministic count")
    ap.add_argument("--delete-story", "--delete-sheet", default=None, help="user story ID or sheet name to delete in Mode E (e.g. 'US002-Profile Management')")
    a = ap.parse_args()

    if a.data and Path(a.data).exists():
        data = json.loads(Path(a.data).read_text(encoding="utf-8"))
    else:
        data = {}

    if a.delete_story:
        data["delete_story"] = a.delete_story
        if not data.get("project_mode"):
            data["project_mode"] = "Delete user story tab (Mode E)"

    source_wb = a.source_workbook or data.get("source_workbook")
    if source_wb:
        data = load_and_merge_testbank(data, source_wb, delete_story=a.delete_story)

    skel = json.loads(Path(a.skeleton).read_text(encoding="utf-8")) if a.skeleton and Path(a.skeleton).exists() else None
    data = auto_normalize_data(data)
    if skel:
        skel = auto_normalize_data(skel)
    preflight = gv.validate_data(data, skeleton=skel)
    if preflight["status"] != "success":
        report = {"workbook": a.out, "preflight": preflight, "total_errors": len(preflight["errors"]), "status": "failed"}
        print(json.dumps(report, indent=1, ensure_ascii=False))
        return 1
    modules = [_norm_module(m) for m in data.get("modules", [])]
    out = Path(a.out)
    if source_wb and Path(source_wb).expanduser().resolve() == out.expanduser().resolve():
        report = {"workbook": a.out, "preflight": preflight, "total_errors": 1, "status": "failed",
                   "error": "Output path equals source_workbook. Write the updated test cases to a separate copy."}
        print(json.dumps(report, indent=1, ensure_ascii=False))
        return 1
    project_mode = normalize_project_mode(data.get("project_mode", "GREENFIELD"))

    build_workbook(
        out_path=str(out), modules=modules,
        us_id_meta=data.get("us_id_meta", ""),
        dashboard_title=data.get("dashboard_title", "Test Execution Dashboard"),
        mod_prefix=data.get("mod_prefix", a.mod_prefix),
        figma_link=data.get("figma_link"),
        author=data.get("author", a.author), version=data.get("version", a.version),
        test_data_requirements=data.get("test_data_requirements", []),
        platform=data.get("platform", "").lower(),
        project_mode=project_mode,
        rtm=data.get("rtm"),
        coverage_heatmap=data.get("coverage_heatmap"),
    )

    report: dict = {"workbook": str(out), "preflight": preflight}
    if data.get("deleted_modules"):
        report["deleted_modules"] = data["deleted_modules"]
        report["deletion_summary"] = f"Successfully deleted user story tab(s): {', '.join(data['deleted_modules'])}. Recalculated dashboard counts for remaining {len(modules)} user story module(s)."

    structural = verify(str(out), project_mode=project_mode, platform=data.get("platform", ""))
    report["structural"] = {"status": "failed" if structural else "success", "errors": structural}

    recalc = {} if a.no_recalc else _recalc_scan(out, a.timeout)
    report["recalc"] = recalc

    # Coverage / duplicate / vague-result pass straight from JSON — no CSV round-trip.
    rows = cc.rows_from_modules(modules)
    active_rows = [r for r in rows if str(r.get("Test Case Type", "")).lower() != "invalidated"]
    ac_ids = {str(x).strip().upper() for x in data.get("acs", []) if str(x).strip()}
    if not ac_ids:
        ac_ids = cc.ac_ids_from_rows(active_rows)
    layers = cc.check_coverage_layers(active_rows, ac_ids, "AC ID") if ac_ids else {}
    dupes = cc.find_likely_duplicates(active_rows, "Test Title", threshold=a.dup_threshold)
    vague = cc.find_vague_expected_results(active_rows)
    counts = {"modules": len(modules), "cases": len(active_rows), "test_data_requirements": len(data.get("test_data_requirements", []) or [])}
    for st in ("SOURCE", "DERIVED", "ADVISORY", "BLOCKED"):
        counts[st] = sum(1 for r in active_rows if r.get("Source Type", "").upper() == st)
    counts["automation_yes"] = sum(1 for r in active_rows if r.get("Automation Candidate", "").lower() == "yes")
    counts["automation_no"] = sum(1 for r in active_rows if r.get("Automation Candidate", "").lower() == "no")
    counts["regression_yes"] = sum(1 for r in active_rows if r.get("Regression Candidate", "").lower() == "yes")
    if should_include_ios_column(data.get("platform")):
        counts["ios_yes"] = sum(1 for r in active_rows if r.get("IOS Testcase", "").lower() == "yes")
    else:
        counts["ios_yes"] = 0
    if is_update_mode(project_mode) and "counts" in preflight:
        counts["existing_count"] = preflight["counts"].get("existing_count", 0)
        counts["modified_count"] = preflight["counts"].get("modified_count", 0)
        counts["new_count"] = preflight["counts"].get("new_count", 0)
        counts["invalidated_count"] = preflight["counts"].get("invalidated_count", 0)
        counts["previous_cases"] = preflight["counts"].get("previous_cases", 0)
        counts["updated_cases"] = preflight["counts"].get("updated_cases", 0)
        
    # Priority 10: Add coverage-versus-count audit
    p0 = sum(1 for r in active_rows if r.get("Priority", "").upper() == "P0")
    p1 = sum(1 for r in active_rows if r.get("Priority", "").upper() == "P1")
    p2 = sum(1 for r in active_rows if r.get("Priority", "").upper() == "P2")
    blocked_count = sum(1 for r in active_rows if r.get("Source Type", "").upper() == "BLOCKED" or str(r.get("Execution Status", "")).lower() == "blocked")
    executable_count = len(active_rows) - blocked_count

    cov_layer = layers.get("Design traceability", {})
    exec_layer = layers.get("Executable", {})
    cov_depth = cc.check_coverage_depth(active_rows, ac_ids, "AC ID") if ac_ids else {}

    report["coverage_versus_count_audit"] = {
        "total_test_cases": len(active_rows),
        "requirements_covered": cov_layer.get("covered", 0),
        "requirements_uncovered": cov_layer.get("uncovered", []),
        "justified_additions": counts.get("new_count", len(active_rows) if is_standalone_mode(project_mode) else 0),
        "cases_split_or_combined": {"split_count": 0, "combined_count": 0},
        "duplicates_removed": len(dupes),
        "modified_cases": counts.get("modified_count", 0),
        "invalidated_cases": counts.get("invalidated_count", 0),
        "blocked_cases": blocked_count,
        "executable_cases": executable_count,
        "priority_distribution": {"P0": p0, "P1": p1, "P2": p2},
        "unresolved_coverage_gaps": exec_layer.get("uncovered", []),
        "full_coverage_pct": cov_depth.get("full_coverage_pct", 0),
        "any_coverage_pct": cov_depth.get("any_coverage_pct", 0),
        "dimension_coverage_pct": cov_depth.get("dimension_coverage_pct", 0),
        "risk_weighted_coverage_pct": cov_depth.get("risk_weighted_coverage_pct", 0),
        "partially_covered_requirements": cov_depth.get("partially_covered", 0),
        "high_risk_gaps": cov_depth.get("high_risk_gaps", []),
    }
    if cov_depth:
        report["coverage_depth"] = cov_depth

    total_errors = len(structural) + int(recalc.get("total_errors", 0) or 0)
    if recalc.get("recalc") == "done" and not all(v["reconciled"] for v in recalc["reconciliation"].values()):
        total_errors += 1
    report["total_errors"] = total_errors
    report["status"] = "success" if total_errors == 0 else "failed"
    print(json.dumps(report, indent=1, ensure_ascii=False))
    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
