"""Fingerprint review inputs; plan safe reuse of case-level semantic assessments."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path

from openpyxl import load_workbook


VERSION = 1


def digest_file(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def digest_value(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, ensure_ascii=True, sort_keys=True, default=str).encode()
    ).hexdigest()


def case_hashes(path: Path) -> tuple[dict[str, str], dict[str, list[str]]]:
    cases: dict[str, str] = {}
    schemas: dict[str, list[str]] = {}
    workbook = load_workbook(path, read_only=True, data_only=False)
    try:
        for sheet in workbook:
            headers: list[str] | None = None
            id_column = -1
            for row in sheet.iter_rows(values_only=True):
                values = [str(value).strip() if value is not None else "" for value in row]
                if headers is None:
                    matches = [i for i, value in enumerate(values)
                               if value.casefold() == "test case id"]
                    if not matches:
                        continue
                    if len(matches) != 1 or len(set(values)) != len(values):
                        raise ValueError(f"Ambiguous headers in {sheet.title}")
                    headers, id_column = values, matches[0]
                    schemas[sheet.title] = headers
                    continue
                case_id = values[id_column]
                if not case_id:
                    if any(values):
                        raise ValueError(f"Non-empty row without Test Case ID in {sheet.title}")
                    continue
                if case_id in cases:
                    raise ValueError(f"Duplicate Test Case ID: {case_id}")
                # Include raw values and sheet identity; never hash titles alone.
                cases[case_id] = digest_value([sheet.title, headers, list(row)])
    finally:
        workbook.close()
    if not cases:
        raise ValueError("No testcase rows found; perform a full review without cache reuse")
    return cases, schemas


def snapshot(workbook: Path, sources: list[Path], scope: str, platform: str) -> dict:
    skills = Path(__file__).resolve().parents[2]
    rules = {
        str(path.relative_to(skills)): digest_file(path)
        for name in ("test-cases-reviewer", "test-cases-generator", "testcase-review-cycle")
        for path in sorted((skills / name).rglob("*"))
        if path.is_file() and path.suffix in {".md", ".py", ".json", ".yaml", ".yml"}
    }
    before = digest_file(workbook)
    cases, schemas = case_hashes(workbook)
    if digest_file(workbook) != before:
        raise ValueError("Workbook changed during fingerprinting; retry with stable inputs")
    return {
        "version": VERSION,
        "context": {
            "sources": {str(path.resolve()): digest_file(path) for path in sources},
            "rules": rules,
            "scope": scope,
            "platform": platform,
            "schemas": schemas,
        },
        "workbook_sha256": before,
        "cases": cases,
    }


def plan(current: dict, previous: dict | None) -> dict:
    reason = ""
    if previous is None:
        reason = "No previous cache"
    elif previous.get("version") != VERSION:
        reason = "Cache version changed"
    elif previous.get("context") != current["context"]:
        reason = "Sources, rules, scope, platform, or testcase schema changed"
    elif not isinstance(previous.get("cases"), dict) or not all(
        isinstance(key, str) and isinstance(value, str)
        for key, value in previous["cases"].items()
    ):
        raise ValueError("Invalid cached case fingerprints")
    elif not isinstance(previous.get("report"), str) or not isinstance(
        previous.get("report_sha256"), str
    ):
        raise ValueError("Cache has no verified review report")
    elif not Path(previous["report"]).is_file():
        reason = "Previous review report is missing"
    elif digest_file(Path(previous["report"])) != previous["report_sha256"]:
        reason = "Previous review report changed"
    if reason:
        return {"mode": "full", "reason": reason,
                "review_case_ids": sorted(current["cases"]), "removed_case_ids": [],
                "reusable_case_ids": []}
    old = previous["cases"]
    new = current["cases"]
    return {
        "mode": "incremental",
        "reason": "Evidence, rules, scope, platform, schemas and previous report match",
        "review_case_ids": sorted(key for key in new if old.get(key) != new[key]),
        "removed_case_ids": sorted(old.keys() - new.keys()),
        "reusable_case_ids": sorted(key for key in new if old.get(key) == new[key]),
        "previous_report": previous["report"],
    }


def write_cache(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(value, stream, indent=2, sort_keys=True)
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("plan", "record"))
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--source", type=Path, action="append", required=True,
                        help="Repeat for ALL authoritative and supporting evidence files")
    parser.add_argument("--scope", required=True)
    parser.add_argument("--platform", required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--inputs-sha256",
                        help="Input fingerprint returned by plan before review")
    parser.add_argument("--verified", action="store_true",
                        help="Attest Gate 10 completed; does not itself verify the report")
    args = parser.parse_args()
    if args.command == "record" and (
        not args.report or not args.verified or not args.inputs_sha256
    ):
        parser.error("record requires --report, --inputs-sha256 and --verified")
    if args.cache.resolve() in {args.workbook.resolve(), *(
        path.resolve() for path in args.source
    )} or (args.report and args.cache.resolve() == args.report.resolve()):
        parser.error("--cache must not overwrite an input or report")
    current = snapshot(args.workbook, args.source, args.scope, args.platform)
    if args.command == "plan":
        previous = (json.loads(args.cache.read_text(encoding="utf-8"))
                    if args.cache.exists() else None)
        if previous is not None and not isinstance(previous, dict):
            raise ValueError("Cache must contain a JSON object")
        result = plan(current, previous)
        result["inputs_sha256"] = digest_value(current)
        print(json.dumps(result, indent=2))
    else:
        if digest_value(current) != args.inputs_sha256:
            parser.error("Inputs changed since plan; rerun plan and review before recording")
        if args.report.resolve() == args.workbook.resolve():
            parser.error("The review report must not be the source workbook")
        current["report"] = str(args.report.resolve())
        current["report_sha256"] = digest_file(args.report)
        write_cache(args.cache, current)
        print(json.dumps({"status": "recorded", "cache": str(args.cache)}))


if __name__ == "__main__":
    main()
