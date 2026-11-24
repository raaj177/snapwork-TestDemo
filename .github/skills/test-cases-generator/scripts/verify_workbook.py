"""Structural verification for governed testcase workbooks.

This verifier intentionally does not recalculate Excel formulas. It confirms that required
sheets and formula families exist and fails on literal #REF! formula corruption. Excel should
open the workbook in automatic calculation mode (set by common.py).
"""
from __future__ import annotations

import argparse
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def _normalize_mode(mode: str | None) -> str:
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


def should_create_ios_dashboard(platform: str | None) -> bool:
    if not platform:
        return True
    p = str(platform).strip().lower()
    if "android" in p and "ios" not in p and "both" not in p:
        return False
    pure_web_variants = {
        "web", "mobile web", "mobile_web", "pwa",
        "web + mobile web", "web+mobile web", "web, mobile web",
        "web + pwa", "web+pwa", "web, pwa", "web_pwa",
    }
    if p in pure_web_variants:
        return False
    return True


def verify(path: str, project_mode: str = "GREENFIELD", platform: str = "") -> list[str]:
    errors: list[str] = []
    p = Path(path)
    if not p.exists():
        return [f"File not found: {path}"]
    mode = _normalize_mode(project_mode)
    with zipfile.ZipFile(p) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        relmap = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
        sheets = {s.attrib["name"]: relmap[s.attrib[RID]] for s in wb.find("m:sheets", NS)}
        required_sheets = ["Dashboard", "Automation Dashboard", "Config", "Test Data Requirements"]
        if platform:
            expect_ios = should_create_ios_dashboard(platform)
        else:
            expect_ios = "iOS Dashboard" in sheets
        if expect_ios:
            required_sheets.insert(2, "iOS Dashboard")
        for required in required_sheets:
            if required not in sheets:
                errors.append(f"Missing required sheet: {required}")
        if platform and not should_create_ios_dashboard(platform) and "iOS Dashboard" in sheets:
            errors.append(f"Platform '{platform}' must not contain 'iOS Dashboard' sheet")
        formula_text: dict[str, str] = {}
        for name, target in sheets.items():
            data = z.read("xl/" + target.lstrip("/"))
            root = ET.fromstring(data)
            formulas = [(f.text or "") for f in root.findall(".//m:f", NS)]
            formula_text[name] = "\n".join(formulas)
            if "#REF!" in formula_text[name]:
                errors.append(f"{name}: literal #REF! found in formula")
        if "Dashboard" in formula_text:
            text = formula_text["Dashboard"]
            if "COUNTIF" not in text or "COUNTIFS" not in text:
                errors.append("Dashboard: expected COUNTIF/COUNTIFS formulas not found")
        if "Test Data Requirements" in sheets:
            data = z.read("xl/" + sheets["Test Data Requirements"].lstrip("/"))
            root = ET.fromstring(data)
            # Structural presence is mandatory; detailed dropdown validation is enforced by the builder contract.
            if root.find("m:sheetData", NS) is None:
                errors.append("Test Data Requirements: sheet data missing")
        if "Automation Dashboard" in formula_text:
            text = formula_text["Automation Dashboard"]
            if '"Yes"' not in text:
                errors.append("Automation Dashboard: Automation Candidate = Yes filter not found")
            if "COUNTIFS" not in text:
                errors.append("Automation Dashboard: expected COUNTIFS formulas not found")
            if "Test Data Dependency" not in text:
                errors.append("Automation Dashboard: Test Data Dependency status formula not found")
        if "iOS Dashboard" in formula_text:
            text = formula_text["iOS Dashboard"]
            if '"Yes"' not in text:
                errors.append("iOS Dashboard: IOS Testcase = Yes filter not found")
            if "COUNTIF" not in text or "COUNTIFS" not in text:
                errors.append("iOS Dashboard: expected COUNTIF/COUNTIFS formulas not found")

        # Standalone schema purity checks (no TestCaseTypeList in Config)
        if mode == "GREENFIELD":
            defined_names = [d.attrib.get("name", "") for d in wb.findall(".//m:definedName", NS)]
            if "TestCaseTypeList" in defined_names:
                errors.append(f"{mode} schema violation: TestCaseTypeList defined name found in Config")

    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook")
    ap.add_argument("--project-mode", default="GREENFIELD")
    ap.add_argument("--platform", default="")
    args = ap.parse_args()
    errors = verify(args.workbook, project_mode=args.project_mode, platform=args.platform)
    if errors:
        print("status: failed")
        for e in errors:
            print("-", e)
        return 1
    print("status: success")
    print("total_errors: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
