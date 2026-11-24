#!/usr/bin/env python3
"""Hard preflight governance validator for cases.json.

Prevents generation of structurally valid but governance-invalid workbooks.
Called automatically by build.py before workbook creation.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Mapping

MANUAL_STATUSES = {"Not Executed", "Pass", "Fail", "Skip", "NA", "Blocked", "On Hold", "Deferred"}
AUTOMATION_STATUSES = {"Not Executed", "Pass", "Fail", "Skip", "NA", "Blocked", "Test Data Dependency"}
SOURCE_TYPES = {"SOURCE", "DERIVED", "ADVISORY", "BLOCKED"}
PRIORITIES = {"P0", "P1", "P2"}
TYPES = {"Positive", "Negative", "Edge Case"}
CATEGORIES = {"Functional", "Field Validation", "UI", "Compatibility", "Usability"}
YES_NO = {"Yes", "No"}
TEST_DATA_STATUSES = {"Not Prepared", "Requested", "In Progress", "Available", "Blocked"}
RQ_RE = re.compile(r"\bRQ[-_][A-Za-z0-9][A-Za-z0-9_-]*\b", re.I)
TRACE_RE = re.compile(r"\b(?:US|AC|WAC|BR|REQ|RULE|API|SEC|COMP|REF)[-_ ]?[A-Za-z0-9][A-Za-z0-9_.-]*\b", re.I)

ALIASES = {
    "scenario_id": ("scenario_id", "Test Scenario ID", "Scenario ID"),
    "scenario": ("scenario", "Test Scenarios", "Test Scenario", "Scenario"),
    "case_id": ("case_id", "Test Case ID", "test_case_id"),
    "description": ("description", "Test Description", "desc", "Test Title"),
    "requirement_reference": ("requirement_reference", "Requirement Reference", "requirement", "AC ID"),
    "priority": ("priority", "Priority", "Priority (P0/P1/P2)"),
    "type": ("type", "type_", "Type", "Test Type"),
    "steps": ("steps", "Test Steps", "Steps"),
    "expected_result": ("expected_result", "expected", "Expected Result"),
    "category": ("category", "Test Category"),
    "platform": ("platform", "Platform", "target_platform", "Platform Support"),
    "status": ("status", "Status", "execution_status", "Execution Status"),
    "automation_candidate": ("automation", "automation_candidate", "Automation Candidate", "Automation Candidate (Yes/No)"),
    "regression_candidate": ("regression", "regression_candidate", "Regression Candidate", "Regression Candidate (Yes/No)"),
    "ios_testcase": ("ios_testcase", "IOS Testcase", "iOS Testcase"),
    "source_type": ("source_type", "Source Type", "source_classification", "Source Classification"),
    "remarks": ("remarks", "Remarks"),
    "ba_comments": ("ba_comments", "BA Comments", "ba_comment", "BA Comment"),
    "automation_status": ("automation_status", "Automation Status"),
    "developer_status": ("developer_status", "Developer Status"),
    "developer_comment": ("developer_comment", "Developer Comment", "developer_comments", "Developer Comments"),
    "test_case_type": ("test_case_type", "Test Case Type"),
    "precondition": ("precondition", "precond", "Pre-condition", "Preconditions"),
    "test_data": ("test_data", "data", "Test Data"),
    "actual_result": ("actual_result", "Actual Result"),
    "actual_automation_result": ("actual_automation_result", "Actual Automation Result"),
    "automation_remark": ("automation_remark", "Automation Remark"),
}

AS_IS_FIELDS = (
    "scenario_id", "scenario", "description", "requirement_reference", "priority",
    "precondition", "type", "steps", "test_data", "expected_result", "category", "platform",
    "actual_result", "status", "automation_candidate", "regression_candidate",
    "ios_testcase", "source_type", "remarks", "ba_comments",
    "developer_status", "developer_comment", "automation_status",
    "actual_automation_result", "automation_remark",
)

def _same_text(case: Mapping[str, Any], field: str) -> str:
    value = first(case, field)
    if field in {"status", "automation_status"} and not value:
        value = "Not Executed"
    if field == "platform":
        return value.casefold().strip()
    return re.sub(r"\s+", " ", value).strip()

def first(d: Mapping[str, Any], field: str, default: str = "") -> str:
    for k in ALIASES[field]:
        if k in d and d[k] is not None:
            return str(d[k]).strip()
    return default

def _err(errors, code, module, tc, msg):
    errors.append({"code": code, "module": module, "tc": tc, "message": msg})

def normalize_project_mode(mode: str | None) -> str:
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

VALID_MODES = {
    "GREENFIELD",
    "BROWNFIELD",
    "GREENFIELD With Updated User Story",
    "Brownfield — Existing App, From Scratch",
    "Delete user story tab (Mode E)",
}

def is_update_mode(mode: str | None) -> bool:
    return normalize_project_mode(mode) in {
        "BROWNFIELD",
        "GREENFIELD With Updated User Story",
        "Brownfield — Existing App, From Scratch",
    }

def is_delete_mode(mode: str | None) -> bool:
    return normalize_project_mode(mode) == "Delete user story tab (Mode E)"


def should_include_ios_column(platform: str | None) -> bool:
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


def is_ios_only_platform(platform: str | None) -> bool:
    if not platform:
        return False
    p = str(platform).strip().lower()
    return "ios" in p and "android" not in p and "both" not in p


def classify_platform_indicators(has_m: bool, has_w: bool, has_p: bool) -> str | None:
    if has_m and not has_w and not has_p:
        classification = "mobile"
    elif not has_m and has_w and not has_p:
        classification = "web"
    elif not has_m and not has_w and has_p:
        classification = "pwa"
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
    return classification

def is_standalone_mode(mode: str | None) -> bool:
    return normalize_project_mode(mode) == "GREENFIELD"

VAGUE_EXPECTED = (
    "works correctly", "functions as expected", "error is shown", "processed successfully",
    "data saves successfully", "appropriate result", "relevant state", "displayed correctly",
    "system should work correctly", "user should get proper response", "application should behave as expected",
    "proper response", "work correctly", "behave as expected"
)

PROHIBITED_TEST_DATA = {
    "synthetic valid test data",
    "invalid test inputs",
    "synthetic valid credentials",
    "valid user id; incorrect password",
    "random data",
    "sample test data",
    "test data",
    "test inputs",
    "dummy data",
    "n/a",
    "na",
    "none",
    "not applicable",
}

def validate_data(data: dict, skeleton: dict | None = None) -> dict:
    errors=[]; warnings=[]
    raw_mode = data.get("project_mode", "GREENFIELD")
    project_mode = normalize_project_mode(raw_mode)
    if project_mode not in VALID_MODES:
        _err(errors,"GV000","GLOBAL","",f"project_mode must be one of: GREENFIELD, BROWNFIELD, GREENFIELD With Updated User Story, Brownfield — Existing App, From Scratch, Delete user story tab (Mode E). Got '{raw_mode}'")
        project_mode = "GREENFIELD"
    update_mode = is_update_mode(project_mode)
    delete_mode = is_delete_mode(project_mode)
    proj_platform = str(data.get("platform") or "").strip().lower()
    include_ios = should_include_ios_column(proj_platform)
    is_ios_only = is_ios_only_platform(proj_platform)
    modules=data.get("modules")
    if not isinstance(modules, list) or not modules:
        return {"status":"failed","errors":[{"code":"GV001","module":"","tc":"","message":"modules must be a non-empty list"}],"warnings":[],"counts":{}}
    seen_scn={}; seen_tc={}; total=0; reg_yes=0; reg_no=0; ios_yes=0; ios_no=0; auto_yes=0; auto_no=0
    blocked_cases=0
    p0_count=0; p1_count=0; p2_count=0
    previous_cases=0
    tct_counts={"existing":0, "modified":0, "new":0, "invalidated":0}
    case_platforms: list[str] = []
    for mi,m in enumerate(modules,1):
        if not isinstance(m, dict):
            _err(errors,"GV002",f"module#{mi}","","module must be an object"); continue
        module=str(m.get("label") or m.get("module_label") or m.get("sheet") or m.get("sheet_name") or f"module#{mi}").strip()
        cases=m.get("cases") or m.get("test_cases") or []
        if not isinstance(cases,list):
            _err(errors,"GV003",module,"","cases must be a list"); continue
        baseline=m.get("baseline_cases", None)
        if update_mode:
            if not isinstance(baseline, list):
                _err(errors,"GV216",module,"",f"baseline_cases is required in {project_mode} so previous counts match the original Dashboard")
                baseline=[]
        elif not delete_mode and baseline:
            _err(errors,"GV217",module,"",f"baseline_cases is not allowed in {project_mode}")
            baseline=[]
        baseline_by_id={}
        for bidx, b in enumerate(baseline or [], 1):
            if not isinstance(b, dict):
                _err(errors,"GV218",module,f"baseline#{bidx}","baseline case must be an object"); continue
            btc=first(b,"case_id")
            if not btc:
                _err(errors,"GV219",module,f"baseline#{bidx}","baseline Test Case ID is mandatory"); continue
            if not first(b, "platform"):
                b["platform"] = str(data.get("platform") or "mobile app").strip()
            if btc.casefold() in baseline_by_id:
                _err(errors,"GV220",module,btc,f"Duplicate baseline Test Case ID: {btc}")
            else:
                baseline_by_id[btc.casefold()]=b
            previous_cases += 1
        mapped_prior={}
        is_cross="generic cross-cutting" in module.casefold() or "generic cross-cutting" in str(m.get("sheet","")).casefold()
        if is_cross:
            _err(errors,"GV005",module,"","Generic Cross-Cutting module/sheet is excluded from this skill output. Remove it and keep only source story/module testcases.")
        for idx,c in enumerate(cases,1):
            total+=1
            if not isinstance(c,dict):
                _err(errors,"GV004",module,f"row#{idx}","case must be an object"); continue
            tc=first(c,"case_id") or f"row#{idx}"
            scn=first(c,"scenario_id"); scenario=first(c,"scenario"); desc=first(c,"description")
            req=first(c,"requirement_reference"); steps=first(c,"steps"); er=first(c,"expected_result")
            src=first(c,"source_type").upper(); remarks=first(c,"remarks")
            status=first(c,"status", "Not Executed"); auto_status=first(c,"automation_status", "Not Executed")
            pri=first(c,"priority", "P1"); typ=first(c,"type", "Positive"); cat=first(c,"category", "Functional")
            auto=first(c,"automation_candidate", "No").strip(); reg=first(c,"regression_candidate")
            auto_remark=first(c,"automation_remark").strip()
            tct=first(c,"test_case_type")
            # required identity/content
            if not scn: _err(errors,"GV101",module,tc,"Test Scenario ID is mandatory")
            elif scn.casefold() in seen_scn and seen_scn[scn.casefold()] != module:
                _err(errors,"GV102",module,tc,f"Duplicate Test Scenario ID across modules: {scn}")
            else: seen_scn.setdefault(scn.casefold(),module)
            if not first(c,"case_id"): _err(errors,"GV103",module,tc,"Test Case ID is mandatory")
            elif tc.casefold() in seen_tc: _err(errors,"GV104",module,tc,f"Duplicate Test Case ID: {tc}")
            else: seen_tc[tc.casefold()]=module
            for code,field,val in (("GV105","Test Scenarios",scenario),("GV106","Test Description",desc),("GV107","Test Steps",steps),("GV108","Expected Result",er)):
                if not val: _err(errors,code,module,tc,f"{field} is mandatory")
            # traceability/source
            if src not in SOURCE_TYPES: _err(errors,"GV201",module,tc,f"Invalid or missing Source Type: {src or '<blank>'}")
            if src in {"SOURCE","DERIVED","BLOCKED"} and not req:
                _err(errors,"GV202",module,tc,f"Requirement Reference is mandatory for {src}")
            if src in {"SOURCE","DERIVED"} and req and not TRACE_RE.search(req):
                warnings.append({"code":"GW201","module":module,"tc":tc,"message":f"Requirement Reference does not look like a stable US/AC/WAC/BR/REQ/RULE/API/SEC/COMP/REF ID: {req}"})
            if src == "BLOCKED" or status == "Blocked":
                blocked_cases += 1
            if status == "Blocked" and not remarks:
                _err(errors,"GV206",module,tc,"Status=Blocked requires a blocker reason in Remarks")
            if src=="BLOCKED":
                if "tbd" not in er.casefold(): _err(errors,"GV203",module,tc,"BLOCKED case Expected Result must contain TBD")
                if not RQ_RE.search(remarks): _err(errors,"GV204",module,tc,"BLOCKED case Remarks must contain an RQ-... Requirement Question")
            # enums
            if status not in MANUAL_STATUSES: _err(errors,"GV301",module,tc,f"Invalid Status '{status}'. Use Config values; design-stage default is 'Not Executed'.")
            if auto_status not in AUTOMATION_STATUSES: _err(errors,"GV302",module,tc,f"Invalid Automation Status '{auto_status}'")
            if pri not in PRIORITIES: _err(errors,"GV303",module,tc,f"Invalid Priority '{pri}'")
            elif pri == "P0": p0_count += 1
            elif pri == "P1": p1_count += 1
            elif pri == "P2": p2_count += 1
            if typ not in TYPES: _err(errors,"GV304",module,tc,f"Invalid Type '{typ}'")
            cat_val = "UI" if cat in {"UI/UX", "UI / UX"} else cat
            if cat_val not in CATEGORIES: _err(errors,"GV305",module,tc,f"Invalid Test Category '{cat}'")
            if auto not in YES_NO:
                _err(errors,"GV306",module,tc,f"Automation Candidate must be Yes/No, got '{auto}'")
            elif auto == "Yes":
                auto_yes += 1
            else:
                auto_no += 1
                if not re.search(r"No automation reason:", remarks, re.IGNORECASE):
                    warnings.append({"code":"GW306","module":module,"tc":tc,"message":"Automation Candidate is 'No' but Remarks does not append the reason formatted as '**No automation reason:** <reason>' (all remarks must be in Remarks column only, Decision Rule 7)."})
                if auto_remark:
                    warnings.append({"code":"GW307","module":module,"tc":tc,"message":"Automation Candidate reason must not be placed in Automation Remark column. All remarks must be in the Remarks column only."})
                if re.search(r"automated assertions cannot be finalized", remarks, re.IGNORECASE):
                    warnings.append({"code":"GW308","module":module,"tc":tc,"message":"Generic boilerplate automation reason detected ('automated assertions cannot be finalized'). Provide a substantive explanation describing the concrete rules/fields and why assertions cannot be defined without inventing requirements."})
            if reg not in YES_NO:
                _err(errors,"GV307",module,tc,f"Regression Candidate must be explicitly Yes/No, got '{reg or '<blank>'}'")
            elif reg=="Yes":
                reg_yes+=1
            else:
                reg_no+=1
            if include_ios:
                ios = first(c, "ios_testcase").strip()
                if is_ios_only:
                    # Platform is iOS: every entry in ios column must be Yes in every testcase
                    if ios and ios.lower() == "no":
                        _err(errors, "GV308", module, tc, f"Platform is iOS: every entry in IOS Testcase must be 'Yes', got '{ios}'")
                    else:
                        if isinstance(c, dict):
                            c["ios_testcase"] = "Yes"
                        ios_yes += 1
                else:
                    if ios not in YES_NO:
                        _err(errors, "GV308", module, tc, f"IOS Testcase must be explicitly Yes/No, got '{ios or '<blank>'}'")
                    elif ios == "Yes":
                        ios_yes += 1
                    else:
                        ios_no += 1

            # Platform validation (Sections 1-7: Platform Standard)
            plat_val = first(c, "platform").strip()
            if not plat_val:
                default_plat = str(data.get("platform") or "").strip()
                if not default_plat:
                    default_plat = "Mobile App"
                plat_val = default_plat
                if isinstance(c, dict):
                    c["platform"] = plat_val
            if not plat_val:
                _err(errors, "GV310", module, tc, "Platform column is mandatory and must contain assigned platform(s) or explicit review status.")
            else:
                case_platforms.append(plat_val.lower())
                tokens = [t.strip().lower() for t in re.split(r"[,/|;+]+", plat_val) if t.strip()]
                invalid_tokens = [t for t in tokens if not any(k in t for k in ("mobile", "web", "pwa", "ios", "android", "app"))]
                if invalid_tokens:
                    warnings.append({"code": "GW310", "module": module, "tc": tc, "message": f"Potential hallucinated platform in Platform column: '{', '.join(invalid_tokens)}'. Allowed platforms: mobile app, web, mobile web, or combinations thereof."})

                # Capability contradiction check (Section 3 & 4)
                text_combined = f"{scn} {desc} {steps} {er}".lower()
                mobile_kw = ["face id", "touch id", "biometric prompt", "hardware back", "back gesture", "gesture-driven", "native camera", "native file picker", "system file picker", "app lifecycle", "push notification tray"]
                if any(k in text_combined for k in mobile_kw) and not any(any(k in t for k in ("mobile", "ios", "android", "app")) for t in tokens):
                    warnings.append({"code": "GW314", "module": module, "tc": tc, "message": "Mobile-specific capability detected in test case steps/scenario, but Platform column does not include 'Mobile App'."})

                web_kw = ["desktop browser", "browser refresh", "browser tabs", "browser cookies", "local storage", "session storage", "drag and drop", "drag-and-drop", "desktop file dialog", "browser download", "1920x1080"]
                if any(k in text_combined for k in web_kw) and not any("web" in t for t in tokens):
                    warnings.append({"code": "GW314", "module": module, "tc": tc, "message": "Web-specific capability detected in test case steps/scenario, but Platform column does not include 'Web'."})

                mobile_web_kw = ["add to home screen", "install prompt", "web app manifest", "service worker", "offline caching", "standalone display mode", "mobile web"]
                if any(k in text_combined for k in mobile_web_kw) and not any(k in t for t in tokens for k in ("mobile web", "pwa")):
                    warnings.append({"code": "GW314", "module": module, "tc": tc, "message": "Mobile Web-specific capability detected in test case steps/scenario, but Platform column does not include 'Mobile Web'."})

            # Priority calibration (Priority 8)
            CRITICAL_KEYWORDS = {"auth", "login", "payment", "money", "fund", "transfer", "security", "data loss", "regulatory", "compliance", "encryption", "credential"}
            if pri == "P0" and typ in {"Negative", "Edge Case"}:
                combined_text = (scn + " " + desc + " " + remarks).lower()
                if not any(k in combined_text for k in CRITICAL_KEYWORDS):
                    warnings.append({"code": "GW305", "module": module, "tc": tc, "message": f"P0 assigned to {typ} case without evident business-criticality or high-impact risk. Validate priority calibration."})

            # Boundary contradiction check (Priority 9)
            if typ in {"Negative", "Edge Case"} or "boundary" in desc.lower() or "limit" in desc.lower() or "maximum" in desc.lower():
                exceeds_match = re.search(r"(?:exceed(?:s|ing)?|greater than|more than|above|over|maximum)\s+(\d+)", steps + " " + desc, re.I)
                if exceeds_match:
                    er_clean = re.sub(r"\b(?:without|no)\s+error\b", "", er, flags=re.I)
                    pos_terms = ["accepted", "saved", "processed successfully", "succeeds", "successful", "valid", "allowed"]
                    neg_terms = ["rejected", "validation error", "invalid", "prohibited", "fail", "blocked", "error"]
                    if any(pt in er.lower() for pt in pos_terms) and not any(nt in er_clean.lower() for nt in neg_terms):
                        _err(errors, "GV309", module, tc, f"Boundary case contradicts documented limits: tests exceeding limit but expects success/acceptance: '{er}'")

            if src != "BLOCKED" and er:
                er_lower = er.lower()
                for vp in VAGUE_EXPECTED:
                    if vp in er_lower and len(er.split()) < 8:
                        warnings.append({"code":"GW205","module":module,"tc":tc,"message":f"Expected Result contains vague phrasing '{vp}' without sufficient observable detail: {er}"})
                        break

            # Test Data quality check
            td = first(c, "test_data").strip()
            is_id_ref = bool(re.match(r"^(?:td|test\s*data)[\s\-_]*\d+$", td, re.IGNORECASE))
            if td.casefold() in PROHIBITED_TEST_DATA or is_id_ref:
                warnings.append({
                    "code": "GW214",
                    "module": module,
                    "tc": tc,
                    "message": f"Test Data contains generic placeholder or test data ID reference '{td}' (e.g. TD1, TD2). Provide realistic sample data reflecting exact requirement rules (e.g. 'PAN ID: AYNMH8765J' for PAN, 'Adhi@23435g' for password), or keep it empty if no test data is possible."
                })

            # Bare shorthand codes and generic terms check in narrative columns (R82 / R85)
            bare_screen_pat = re.compile(r"(?:\b(?:on|navigate to|open|from|at|in|view)\s+S\d{1,2}\b|\bS\d{1,2}\s+screen\b|\bscreen\s+S\d{1,2}\b|\bS\d{1,2}\b(?=\s*[\.,;\)\-–]))", re.IGNORECASE)
            bare_err_pat = re.compile(r"(?:\b(?:displays|shows|verify|assert|with)\s+E\d{2,3}\b|\bE\d{2,3}\s+error\b|\berror\s+E\d{2,3}\b|\bE\d{2,3}\b(?=\s*[\.,;\)\-–]))", re.IGNORECASE)
            bare_step_pat = re.compile(r"\b(?:perform|execute|follow|complete|go to|at|in)\s+step\s+\d+\b(?!\s*[\-–:])", re.IGNORECASE)
            bare_page_pat = re.compile(r"\b(?:navigate to|open|from|on|at|in)\s+page\s+\d+\b(?!\s*[\-–:])", re.IGNORECASE)
            for f_name, f_val in (("Test Scenarios", scn), ("Test Description", desc), ("Preconditions", first(c, "precondition")), ("Test Steps", steps), ("Expected Result", er), ("Remarks", remarks)):
                if bare_screen_pat.search(f_val):
                    warnings.append({"code": "GW215", "module": module, "tc": tc, "message": f"Bare screen code detected in {f_name} ('{bare_screen_pat.search(f_val).group(0)}'). Replace with full descriptive screen name from user story (e.g. 'Login Basic screen' instead of 'S1')."})
                if bare_err_pat.search(f_val):
                    warnings.append({"code": "GW216", "module": module, "tc": tc, "message": f"Bare error code detected in {f_name} ('{bare_err_pat.search(f_val).group(0)}'). Replace with exact descriptive error message text from user story Error Catalogue."})
                if bare_step_pat.search(f_val):
                    warnings.append({"code": "GW217", "module": module, "tc": tc, "message": f"Bare generic step reference detected in {f_name} ('{bare_step_pat.search(f_val).group(0)}'). Replace with concrete action/description from user story (e.g. 'Click on continue button' instead of 'step 1')."})
                if bare_page_pat.search(f_val):
                    warnings.append({"code": "GW218", "module": module, "tc": tc, "message": f"Bare generic page reference detected in {f_name} ('{bare_page_pat.search(f_val).group(0)}'). Use referenced title/name if defined in user story (e.g. 'Applicant Details screen' instead of 'Page 1')."})

            if update_mode:
                if not tct:
                    _err(errors,"GV210",module,tc,f"Test Case Type is mandatory in {project_mode} mode")
                elif tct not in {"existing", "modified", "new", "invalidated"}:
                    _err(errors,"GV211",module,tc,f"Invalid Test Case Type '{tct}'. Allowed values: existing, modified, new, invalidated")
                else:
                    tct_counts[tct] += 1
            elif delete_mode:
                if tct:
                    if tct not in {"existing", "modified", "new", "invalidated"}:
                        _err(errors,"GV211",module,tc,f"Invalid Test Case Type '{tct}'. Allowed values: existing, modified, new, invalidated")
                    else:
                        tct_counts[tct] += 1
            else:
                if "test_case_type" in c or "Test Case Type" in c:
                    _err(errors,"GV212",module,tc,f"Test Case Type field is not allowed in {project_mode} mode")
            if update_mode and tct in {"existing", "modified", "invalidated"}:
                prior=baseline_by_id.get(tc.casefold())
                if prior is None:
                    _err(errors,"GV221",module,tc,f"{tct} case has no matching original test case. Do not invent a prior ID.")
                elif tc.casefold() in mapped_prior:
                    _err(errors,"GV222",module,tc,"This original test case is already used. Do not merge or fold cases.")
                else:
                    mapped_prior[tc.casefold()]=tct
                    if first(c,"scenario_id").casefold() != first(prior,"scenario_id").casefold():
                        _err(errors,"GV223",module,tc,"Preserve the original Scenario ID.")
                    if tct == "existing":
                        for field in AS_IS_FIELDS:
                            if _same_text(c, field) != _same_text(prior, field):
                                _err(errors,"GV224",module,tc,f"Existing case must be retained as-is; '{field}' differs from the original test case.")
                                break
                    elif tct == "invalidated" and not first(c,"remarks"):
                        _err(errors,"GV225",module,tc,"Invalidated case must explain the evidence in Remarks.")
                    elif tct == "modified":
                        if not first(c, "remarks"):
                            _err(errors, "GV228", module, tc, "Modified case must document the modification reason in Remarks (Reviewer Rule 6).")
                        elif all(_same_text(c, field) == _same_text(prior, field) for field in AS_IS_FIELDS):
                            warnings.append({"code":"GW213","module":module,"tc":tc,"message":"Modified case matches the original. Classify it as existing if nothing changed (Reviewer Rule 6: do not classify as Modified only because wording changed)."})
            elif update_mode and tct == "new" and tc.casefold() in baseline_by_id:
                _err(errors,"GV226",module,tc,"New case reuses an original Test Case ID. Preserve that ID on the existing, modified, or invalidated row.")
        if update_mode and project_mode != "Brownfield — Existing App, From Scratch":
            for prior_id, prior in baseline_by_id.items():
                if prior_id not in mapped_prior:
                    _err(errors,"GV227",module,first(prior,"case_id"),"Original test case is missing from the updated cases. Classify it as existing, modified, or invalidated.")
    # Test Data Requirements: consolidated and unique across workbook.
    td_items = data.get("test_data_requirements", [])
    if td_items is None:
        td_items = []
    if not isinstance(td_items, list):
        _err(errors,"GV401","Test Data Requirements","","test_data_requirements must be a list")
        td_items = []
    seen_td_ids=set(); seen_td_desc=set()
    for i,item in enumerate(td_items,1):
        if not isinstance(item,dict):
            _err(errors,"GV402","Test Data Requirements",f"row#{i}","test data requirement must be an object"); continue
        td_id=str(item.get("id") or item.get("test_data_id") or item.get("td_id") or item.get("Test Data ID") or "").strip()
        desc=str(item.get("description") or item.get("Test Data Description") or "").strip()
        raw_status=str(item.get("status") or "Not Prepared").strip()
        status = "Available" if raw_status.lower() in {"ready", "available"} else raw_status
        if not td_id:
            _err(errors,"GV403","Test Data Requirements",f"row#{i}","Test Data ID is mandatory")
        elif td_id.casefold() in seen_td_ids:
            _err(errors,"GV404","Test Data Requirements",td_id,f"Duplicate Test Data ID: {td_id}")
        else: seen_td_ids.add(td_id.casefold())
        if not desc:
            _err(errors,"GV405","Test Data Requirements",td_id or f"row#{i}","Test Data Description is mandatory")
        else:
            key=re.sub(r"\s+"," ",desc).strip().casefold()
            if key in seen_td_desc:
                _err(errors,"GV406","Test Data Requirements",td_id or f"row#{i}",f"Duplicate Test Data Description: {desc}")
            else: seen_td_desc.add(key)
        if status not in TEST_DATA_STATUSES:
            _err(errors,"GV407","Test Data Requirements",td_id or f"row#{i}",f"Invalid Test Data Status '{status}'")

    # blanket regression is a governance warning; hard error when advisory/cross-cutting exists and all are Yes
    if total >= 5 and reg_yes == total:
        warnings.append({"code":"GW301","module":"ALL","tc":"","message":"All test cases are marked Regression Candidate=Yes. Review for blanket classification per R20/R21/R42."})
    if total >= 5 and ios_yes == total and not is_ios_only:
        warnings.append({"code":"GW302","module":"ALL","tc":"","message":"All test cases are marked IOS Testcase=Yes. Review for selective iOS execution classification per R50/R51."})
    if total >= 5:
        if p0_count == total:
            warnings.append({"code":"GW303","module":"ALL","tc":"","message":"100% of test cases are marked P0. Review priority calibration: P0 should be reserved for business-criticality and high-impact criteria, not assigned solely because a scenario is negative or an edge case."})
        elif p0_count == 0:
            warnings.append({"code":"GW304","module":"ALL","tc":"","message":"0% of test cases are marked P0. Verify that critical journeys and major flows are appropriately prioritized."})

    # Blanket platform assignment check (Section 3/4)
    if total >= 10 and case_platforms:
        all_multi = all(("mobile" in p and "web" in p and ("pwa" in p or "mobile web" in p)) for p in case_platforms)
        if all_multi:
            warnings.append({
                "code": "GW311",
                "module": "ALL",
                "tc": "",
                "message": "Blanket multi-platform assignment detected: 100% of test cases assigned 'Mobile App, Web, Mobile Web' without scenario-level applicability filtering (Section 3/4 violation). Assign platforms based on scenario applicability."
            })

    # Project-level Mobile Web implies Web check (Section 1/6)
    proj_plat = str(data.get("platform") or "").lower()
    has_pwa_proj = "pwa" in proj_plat or "mobile web" in proj_plat or any(("pwa" in p or "mobile web" in p) for p in case_platforms)
    has_web_proj = "web" in proj_plat or any("web" in p for p in case_platforms)
    if has_pwa_proj and not has_web_proj:
        warnings.append({
            "code": "GW313",
            "module": "GLOBAL",
            "tc": "",
            "message": "Mobile Web is an enhanced implementation of Web and requires Web to be present. Mobile Web scope exists without confirmed Web scope (Section 1/6)."
        })
    
    # Deterministic skeleton verification (Fix 1)
    if skeleton and isinstance(skeleton, dict):
        expected_cases = skeleton.get("expected_total_cases")
        if expected_cases is not None and total != expected_cases:
            _err(errors, "GV501", "GLOBAL", "", f"Deterministic skeleton mismatch: Expected exactly {expected_cases} test cases, got {total}.")
        skel_cases = skeleton.get("cases") or []
        if not skel_cases and skeleton.get("modules"):
            for sm in skeleton["modules"]:
                skel_cases.extend(sm.get("cases") or [])
        if skel_cases:
            for sc in skel_cases:
                scid = first(sc, "case_id").casefold()
                if scid and scid not in seen_tc:
                    warnings.append({"code": "GW501", "module": "GLOBAL", "tc": first(sc, "case_id"), "message": f"Deterministic skeleton test case ID '{first(sc, 'case_id')}' is missing from cases.json."})

    has_m = any(any(k in p for k in ("mobile", "ios", "android", "app")) for p in case_platforms)
    has_w = any("web" in p for p in case_platforms)
    has_p = any(("pwa" in p or "mobile web" in p or "mobile_web" in p) for p in case_platforms)

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

    counts_out = {
        "modules": len(modules),
        "cases": total,
        "classification": classification,
        "blocked_cases": blocked_cases,
        "executable_cases": total - blocked_cases,
        "automation_yes": auto_yes,
        "automation_no": auto_no,
        "regression_yes": reg_yes,
        "regression_no": reg_no,
        "ios_yes": ios_yes,
        "ios_no": ios_no,
        "platform_mobile": sum(1 for p in case_platforms if any(k in p for k in ("mobile", "ios", "android", "app"))),
        "platform_web": sum(1 for p in case_platforms if "web" in p),
        "platform_pwa": sum(1 for p in case_platforms if ("pwa" in p or "mobile web" in p)),
        "platform_mobile_web": sum(1 for p in case_platforms if ("pwa" in p or "mobile web" in p)),
        "test_data_requirements": len(td_items),
    }
    if update_mode:
        counts_out.update({
            "existing_count": tct_counts["existing"],
            "modified_count": tct_counts["modified"],
            "new_count": tct_counts["new"],
            "invalidated_count": tct_counts["invalidated"],
            "previous_cases": previous_cases,
            "updated_cases": tct_counts["existing"] + tct_counts["modified"] + tct_counts["new"],
        })
    return {"status":"success" if not errors else "failed","errors":errors,"warnings":warnings,"counts":counts_out}

def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", required=True, help="cases.json")
    ap.add_argument("--skeleton", help="Path to skeleton.json generated by extract_matrix.py (optional)")
    a=ap.parse_args()
    data=json.loads(Path(a.data).read_text(encoding="utf-8"))
    skel = json.loads(Path(a.skeleton).read_text(encoding="utf-8")) if a.skeleton and Path(a.skeleton).exists() else None
    report=validate_data(data, skeleton=skel)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["status"]=="success" else 1

if __name__ == "__main__":
    raise SystemExit(main())
