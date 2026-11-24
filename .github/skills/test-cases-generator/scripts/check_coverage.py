#!/usr/bin/env python3
"""check_coverage.py — deterministic second-pass check (not a QA judgment).

Reports coverage layers separately (design traceability, executable, automation design,
implemented automation, execution, verified pass), likely semantic duplicates, and vague
expected-result triggers. Called automatically by build.py; can also run standalone:

    python check_coverage.py --tests cases.json [--acs acs.txt | --brd brd.txt]
    python check_coverage.py --tests test_cases.csv --brd brd.txt
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from difflib import SequenceMatcher

# Governed-key aliases (same set common.py accepts) -> canonical audit column names.
_MAP = {
    "AC ID": ("requirement_reference", "Requirement Reference", "requirement", "AC ID", "ac_id"),
    "Test Title": ("description", "Test Description", "desc", "Test Title", "title"),
    "Test Case ID": ("case_id", "Test Case ID", "test_case_id"),
    "Preconditions": ("precondition", "precond", "Pre-condition", "Preconditions"),
    "Steps": ("steps", "Test Steps", "Steps"),
    "Expected Result": ("expected_result", "expected", "Expected Result"),
    "Test Data": ("test_data", "data", "Test Data"),
    "Module": ("module", "Module"),
    "Source Type": ("source_type", "Source Type", "source_classification"),
    "Automation Candidate": ("automation", "automation_candidate", "Automation Candidate", "Automation Candidate (Yes/No)"),
    "Regression Candidate": ("regression", "regression_candidate", "Regression Candidate", "Regression Candidate (Yes/No)"),
    "IOS Testcase": ("ios_testcase", "IOS Testcase", "iOS Testcase"),
    "Platform": ("platform", "Platform", "target_platform"),
    "BA Comments": ("ba_comments", "BA Comments", "ba_comment", "BA Comment"),
    "Developer Status": ("developer_status", "Developer Status"),
    "Developer Comment": ("developer_comment", "Developer Comment", "developer_comments", "Developer Comments"),
    "Automation Status": ("automation_status", "Automation Status"),
    "Actual Automation Result": ("actual_automation_result", "Actual Automation Result"),
    "Execution Status": ("status", "Status", "execution_status", "Execution Status"),
    "Test Case Type": ("test_case_type", "Test Case Type"),
    "Evidence Link": ("evidence_link", "Evidence Link", "Evidence"),
    "Risk": ("risk", "Risk"),
    "Priority": ("priority", "Priority", "Priority (P0/P1/P2)"),
}


def _first(d, keys, default=""):
    for k in keys:
        if k in d and d[k] is not None:
            return str(d[k])
    return default


def rows_from_modules(modules) -> list[dict]:
    rows = []
    for m in modules:
        if isinstance(m, dict):
            label = _first(m, ("module_label", "us_label", "label", "module"), _first(m, ("sheet_name", "sheet", "title"), ""))
            cases = m.get("cases") or m.get("test_cases") or []
        else:
            _, label, cases = m
        for c in cases:
            row = {col: _first(c, keys) for col, keys in _MAP.items()}
            row["Module"] = row["Module"] or label
            rows.append(row)
    return rows


def load_rows(path: str) -> list[dict]:
    if path.lower().endswith(".json"):
        data = json.loads(open(path, encoding="utf-8").read())
        return rows_from_modules(data["modules"] if isinstance(data, dict) else data)
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [{k.strip(): (v or "").strip() for k, v in r.items()} for r in csv.DictReader(f)]


def split_ac_ids(raw):
    found = re.findall(r"\b(?:W?AC)[-\s]?[A-Z0-9]*[-\s]?\d+\b", raw or "", flags=re.IGNORECASE)
    return {re.sub(r"\s+", "-", m.upper()) for m in found}


def ac_ids_from_rows(rows):
    ids = set()
    for r in rows:
        ids |= split_ac_ids(r.get("AC ID", ""))
    return ids


def load_ac_ids_from_list(path):
    return {line.strip().upper() for line in open(path, encoding="utf-8") if line.strip()}


def load_ac_ids_from_brd(path):
    return split_ac_ids(open(path, encoding="utf-8").read())


def acs_for(rows, ac_col, predicate=lambda r: True):
    covered = set()
    for r in rows:
        if predicate(r):
            covered |= split_ac_ids(r.get(ac_col, ""))
    return covered


def coverage_result(ac_ids, covered):
    inscope = sorted(ac_ids & covered)
    return {"total_acs": len(ac_ids), "covered": len(inscope), "uncovered_acs": sorted(ac_ids - covered),
            "coverage_pct": round(len(inscope) / len(ac_ids) * 100, 1) if ac_ids else 0.0}


def check_coverage_layers(rows, ac_ids, ac_col="AC ID"):
    src = lambda r: (r.get("Source Type") or "").upper()
    executable = lambda r: src(r) not in {"BLOCKED", "ADVISORY", "ADVISORY - REQUIREMENT CONFIRMATION REQUIRED"}
    layers = {"Design traceability": acs_for(rows, ac_col), "Executable": acs_for(rows, ac_col, executable)}
    if any(r.get("Automation Candidate") for r in rows):
        layers["Automation design"] = acs_for(rows, ac_col, lambda r: executable(r) and r.get("Automation Candidate", "").lower() == "yes")
    if any(r.get("Automation Status") for r in rows):
        impl = {"implemented", "reviewed", "executed", "pass", "passed"}
        layers["Implemented automation"] = acs_for(rows, ac_col, lambda r: executable(r) and r.get("Automation Status", "").lower() in impl)
    if any(r.get("Execution Status") for r in rows):
        not_run = {"", "not executed", "not run", "pending", "blocked", "na", "on hold", "deferred", "test data dependency"}
        layers["Execution"] = acs_for(rows, ac_col, lambda r: executable(r) and r.get("Execution Status", "").lower() not in not_run)
        layers["Verified pass"] = acs_for(rows, ac_col, lambda r: executable(r) and r.get("Execution Status", "").lower() in {"pass", "passed"} and bool(r.get("Evidence Link", "").strip()))
    return {n: coverage_result(ac_ids, v) for n, v in layers.items()}


COVERAGE_DIMENSIONS = [
    "Positive / happy path",
    "Negative / invalid input",
    "Boundary",
    "State / transition",
    "Role / permission",
    "Error / exception handling",
    "Platform variant",
    "Integration / data",
]


def detect_case_dimensions(r: dict) -> set[str]:
    """Detect which of the 8 coverage dimensions a test case row covers (Gate 4a)."""
    dims = set()
    typ = str(r.get("Type") or "").strip()
    cat = str(r.get("Test Category") or "").strip()
    ios = str(r.get("IOS Testcase") or "").strip().lower()
    text = " ".join([
        str(r.get("Test Title") or ""),
        str(r.get("Steps") or ""),
        str(r.get("Expected Result") or ""),
        str(r.get("Preconditions") or ""),
        str(r.get("Test Data") or ""),
        str(r.get("Remarks") or ""),
    ]).lower()

    if typ == "Positive" or any(w in text for w in ["success", "successful", "displays", "rendered", "valid", "navigates", "opens"]):
        dims.add("Positive / happy path")
    if typ == "Negative" or cat == "Field Validation" or any(w in text for w in ["invalid", "fails", "rejected", "error", "prohibited", "suppress"]):
        dims.add("Negative / invalid input")
    if typ == "Edge Case" or any(w in text for w in ["boundary", "limit", "min", "max", "range", "length", "threshold", "exceed", "precision", "characters"]):
        dims.add("Boundary")
    if any(w in text for w in ["state", "transition", "expand", "collapse", "toggle", "session", "logout", "login", "relaunch", "cache", "lifecycle", "lost"]):
        dims.add("State / transition")
    if any(w in text for w in ["role", "permission", "authorized", "unauthorized", "entitlement", "admin", "single", "joint", "survivor", "holder"]):
        dims.add("Role / permission")
    if typ == "Negative" or any(w in text for w in ["timeout", "failure", "retry", "outage", "unavailable", "network", "checksum", "500", "001", "error code"]):
        dims.add("Error / exception handling")
    if ios == "yes" or any(w in text for w in ["android:", "ios:", "gesture", "back button", "face id", "touch id", "biometric", "hardware back", "edge-swipe"]):
        dims.add("Platform variant")
    if any(w in text for w in ["api", "endpoint", "payload", "response", "finone", "finacle", "post", "get", "http", "service", "contract", "hmac"]):
        dims.add("Integration / data")

    if not dims:
        dims.add("Positive / happy path")
    return dims


def infer_expected_dimensions(req_text: str) -> set[str]:
    """Infer expected coverage dimensions from requirement text."""
    exp = {"Positive / happy path"}
    txt = req_text.lower()
    if any(w in txt for w in ["error", "invalid", "fail", "reject", "prevent", "mandatory", "validation", "suppress"]):
        exp.add("Negative / invalid input")
    if any(w in txt for w in ["limit", "range", "max", "min", "length", "format", "boundary", "exceed", "precision", "decimal"]):
        exp.add("Boundary")
    if any(w in txt for w in ["state", "expand", "collapse", "toggle", "session", "logout", "relaunch", "lifecycle", "lost", "refresh"]):
        exp.add("State / transition")
    if any(w in txt for w in ["role", "permission", "authorized", "unauthorized", "holder", "joint", "survivor"]):
        exp.add("Role / permission")
    if any(w in txt for w in ["timeout", "failure", "retry", "outage", "offline", "unavailable", "001", "error code"]):
        exp.add("Error / exception handling")
    if any(w in txt for w in ["android", "ios", "back", "gesture", "mobile", "device", "biometric"]):
        exp.add("Platform variant")
    if any(w in txt for w in ["api", "endpoint", "call", "request", "response", "finone", "finacle", "service", "payload", "checksum"]):
        exp.add("Integration / data")
    return exp


def infer_requirement_risk(req_text: str) -> str:
    """Infer requirement risk level (High, Medium, Low) based on business criticality (Section 7.3)."""
    txt = req_text.lower()
    high_kw = {"auth", "login", "pan", "payment", "money", "fund", "balance", "financial", "security", "checksum", "hmac", "data loss", "regulatory", "compliance", "credential", "session"}
    if any(k in txt for k in high_kw):
        return "High"
    low_kw = {"label", "icon", "wireframe", "color", "display format", "cosmetic", "context action"}
    if any(k in txt for k in low_kw) and not any(k in txt for k in high_kw):
        return "Low"
    return "Medium"


def check_coverage_depth(rows, ac_ids, ac_col="AC ID") -> dict:
    """Assess multi-dimensional coverage depth across the 8 coverage dimensions (Gate 4a & Section 7)."""
    ac_to_rows: dict[str, list[dict]] = {ac: [] for ac in ac_ids}
    for r in rows:
        refs = split_ac_ids(r.get(ac_col, ""))
        for ref in refs:
            if ref in ac_to_rows:
                ac_to_rows[ref].append(r)

    req_details = []
    dim_covered_totals = {d: 0 for d in COVERAGE_DIMENSIONS}
    dim_expected_totals = {d: 0 for d in COVERAGE_DIMENSIONS}

    covered_count = 0
    partial_count = 0
    uncovered_count = 0
    blocked_count = 0

    for ac in sorted(ac_ids):
        mapped = ac_to_rows[ac]
        req_text = " ".join([m.get("Test Title", "") + " " + m.get("Expected Result", "") for m in mapped]) if mapped else ac
        risk = infer_requirement_risk(req_text)
        expected_dims = infer_expected_dimensions(req_text)
        covered_dims = set()
        has_blocked = False

        for m in mapped:
            src = str(m.get("Source Type", "")).upper()
            status = str(m.get("Execution Status", "")).lower()
            if src == "BLOCKED" or status == "blocked":
                has_blocked = True
            c_dims = detect_case_dimensions(m)
            covered_dims |= c_dims

        for d in expected_dims:
            dim_expected_totals[d] += 1
        for d in (covered_dims & expected_dims):
            dim_covered_totals[d] += 1

        missing_dims = sorted(expected_dims - covered_dims)

        if has_blocked and not (covered_dims & expected_dims):
            status = "Blocked / Needs Clarification"
            blocked_count += 1
        elif not mapped:
            status = "Not Covered"
            uncovered_count += 1
        elif missing_dims:
            status = "Partially Covered"
            partial_count += 1
        else:
            status = "Covered"
            covered_count += 1

        req_details.append({
            "requirement_id": ac,
            "risk_level": risk,
            "mapped_cases": [m.get("Test Case ID", "") for m in mapped if m.get("Test Case ID")],
            "expected_dimensions": sorted(expected_dims),
            "covered_dimensions": sorted(covered_dims & expected_dims),
            "missing_dimensions": missing_dims,
            "status": status,
        })

    total_reqs = len(ac_ids)
    eligible = total_reqs
    full_cov_pct = round(covered_count / eligible * 100, 1) if eligible else 0.0
    any_cov_pct = round((covered_count + partial_count) / eligible * 100, 1) if eligible else 0.0
    testable_denom = eligible - blocked_count
    testable_pct = round(covered_count / testable_denom * 100, 1) if testable_denom > 0 else 0.0

    total_expected_dims = sum(dim_expected_totals.values())
    total_covered_dims = sum(dim_covered_totals.values())
    dim_cov_pct = round(total_covered_dims / total_expected_dims * 100, 1) if total_expected_dims else 0.0

    risk_weights = {"High": 3, "Medium": 2, "Low": 1}
    score_map = {"Covered": 1.0, "Partially Covered": 0.5, "Not Covered": 0.0, "Blocked / Needs Clarification": 0.0}

    total_weight = sum(risk_weights.get(rd["risk_level"], 2) for rd in req_details)
    weighted_score = sum(risk_weights.get(rd["risk_level"], 2) * score_map.get(rd["status"], 0.0) for rd in req_details)
    risk_weighted_pct = round(weighted_score / total_weight * 100, 1) if total_weight else 0.0

    high_risk_gaps = [rd["requirement_id"] for rd in req_details if rd["risk_level"] == "High" and rd["status"] != "Covered"]

    return {
        "total_requirements": total_reqs,
        "covered": covered_count,
        "partially_covered": partial_count,
        "not_covered": uncovered_count,
        "blocked": blocked_count,
        "full_coverage_pct": full_cov_pct,
        "any_coverage_pct": any_cov_pct,
        "testable_coverage_pct": testable_pct,
        "dimension_coverage_pct": dim_cov_pct,
        "risk_weighted_coverage_pct": risk_weighted_pct,
        "high_risk_gaps": high_risk_gaps,
        "dimensions_breakdown": {d: {"covered": dim_covered_totals[d], "expected": dim_expected_totals[d]} for d in COVERAGE_DIMENSIONS},
        "requirements": req_details,
    }


def normalize(v):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", (v or "").lower())).strip()


def find_likely_duplicates(rows, title_col="Test Title", threshold=0.82):
    """Semantic duplicate detection comparing requirement, preconditions, actions,
    expected results, and state transitions across modules and tickets, without
    merging genuinely distinct scenarios."""
    fields = [title_col, "Preconditions", "Steps", "Expected Result", "AC ID", "Module", "Risk", "Test Data"]
    out = []
    neg_words = {"error", "fail", "failed", "rejected", "invalid", "denied", "prohibited", "locked", "forbidden", "unauthorized", "blocked"}

    # Precompute normalized attributes once per row to avoid quadratic recomputations
    prep = []
    for r in rows:
        ta = normalize(r.get(title_col, ""))
        pre = normalize(r.get("Preconditions", ""))
        act = normalize(r.get("Steps", ""))
        exp = normalize(r.get("Expected Result", ""))
        sa = " | ".join(normalize(r.get(f, "")) for f in fields)
        req = split_ac_ids(r.get("AC ID", ""))
        has_neg = any(w in exp for w in neg_words)
        mod = str(r.get("Module", "")).strip().lower()
        t_words = set(ta.split())
        prep.append({
            "r": r, "ta": ta, "pre": pre, "act": act, "exp": exp,
            "sa": sa, "req": req, "has_neg": has_neg,
            "module": mod, "t_words": t_words,
            "tc_id": r.get("Test Case ID", "")
        })

    n = len(prep)
    for i in range(n):
        pa = prep[i]
        ta = pa["ta"]
        words_a = pa["t_words"]
        if not ta:
            continue

        for j in range(i + 1, n):
            pb = prep[j]
            tb = pb["ta"]
            words_b = pb["t_words"]
            if not tb:
                continue

            same_scope = (pa["module"] == pb["module"]) or bool(pa["req"] & pb["req"])

            # Ultra-fast token overlap filter (0.1s for 225,000 pairs)
            union_len = len(words_a | words_b) or 1
            overlap = len(words_a & words_b) / union_len
            if overlap < 0.35 and not same_scope:
                continue

            # Pre-filter outcomes
            distinct_outcomes = (
                (pa["has_neg"] != pb["has_neg"]) and
                (not pa["exp"] or not pb["exp"] or overlap < 0.60)
            )
            if distinct_outcomes:
                continue

            tr = SequenceMatcher(None, ta, tb).ratio()
            if tr < 0.70 and not same_scope:
                continue

            act_r = SequenceMatcher(None, pa["act"], pb["act"]).ratio() if (pa["act"] and pb["act"]) else 0.0
            exp_r = SequenceMatcher(None, pa["exp"], pb["exp"]).ratio() if (pa["exp"] and pb["exp"]) else 0.0
            pre_r = SequenceMatcher(None, pa["pre"], pb["pre"]).ratio() if (pa["pre"] and pb["pre"]) else (1.0 if not pa["pre"] and not pb["pre"] else 0.0)

            if exp_r < 0.45 and (pa["has_neg"] != pb["has_neg"]):
                continue

            behavioral_score = (act_r * 0.45) + (exp_r * 0.45) + (pre_r * 0.10)
            sr = SequenceMatcher(None, pa["sa"], pb["sa"]).ratio() if max(tr, behavioral_score) >= 0.70 else 0.0

            req_match = bool(pa["req"] & pb["req"]) if (pa["req"] and pb["req"]) else False
            is_duplicate = False
            effective_semantic_score = max(sr, behavioral_score)

            if max(tr, sr) >= threshold:
                is_duplicate = True
            elif act_r >= 0.80 and exp_r >= 0.80:
                is_duplicate = True
                effective_semantic_score = max(effective_semantic_score, (act_r + exp_r) / 2)
            elif req_match and act_r >= 0.75 and exp_r >= 0.75:
                is_duplicate = True
                effective_semantic_score = max(effective_semantic_score, (act_r + exp_r) / 2)

            if is_duplicate:
                out.append((i, j, pa["tc_id"], pb["tc_id"], round(tr, 3), round(effective_semantic_score, 3)))
    return out


VAGUE = [
    "works correctly", "displayed correctly", "populated correctly", "processed successfully", "relevant state",
    "appropriate result", "functions as expected", "error is shown", "filter works correctly",
    "system should work correctly", "user should get proper response", "application should behave as expected",
    "proper response", "work correctly", "behave as expected"
]


def find_vague_expected_results(rows):
    return [(i, r.get("Test Case ID", ""), r.get("Expected Result", ""), p)
            for i, r in enumerate(rows) for p in VAGUE if p in (r.get("Expected Result") or "").lower()]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tests", required=True)
    ap.add_argument("--acs")
    ap.add_argument("--brd")
    ap.add_argument("--dup-threshold", type=float, default=0.82)
    a = ap.parse_args()
    rows = load_rows(a.tests)
    if not rows:
        sys.exit("ERROR: no test rows found.")
    ac_ids = load_ac_ids_from_list(a.acs) if a.acs else load_ac_ids_from_brd(a.brd) if a.brd else ac_ids_from_rows(rows)
    layers = check_coverage_layers(rows, ac_ids)
    print(json.dumps({
        "total_acs": len(ac_ids),
        "layers": {k: {"covered": v["covered"], "pct": v["coverage_pct"], "uncovered": v["uncovered_acs"]} for k, v in layers.items()},
        "likely_duplicates": [{"a": t[2], "b": t[3], "title": t[4], "semantic": t[5]} for t in find_likely_duplicates(rows, threshold=a.dup_threshold)],
        "vague_expected_results": [{"tc": t[1], "phrase": t[3]} for t in find_vague_expected_results(rows)],
        "note": "Heuristic only. Confirm uncovered ACs and duplicates with human judgment before changing anything.",
    }, indent=1))


if __name__ == "__main__":
    main()
