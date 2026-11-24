#!/usr/bin/env python
"""Android test-run helper: choose rows, build JSON suites, write results to the workbook.

  python scripts/testrun/testrun.py select  --type fail --story US003
  python scripts/testrun/testrun.py suites  --type pass
  python scripts/testrun/testrun.py suites  --type fail --refresh
  python scripts/testrun/testrun.py suites  --type fail --story US001 --ids TC_US001_006
  python scripts/testrun/testrun.py update  --csv test-results/automation-results/x.csv --expect-file test-results/testrun/selected-ids.txt

Workbook update (a new version of the input workbook, for example V1 -> V2):

  python scripts/testrun/testrun.py diff         --workbook LoginV2 --previous Android-LoginV1.xlsx
  python scripts/testrun/testrun.py reset-suites --workbook LoginV2 --previous Android-LoginV1.xlsx [--dry-run]
  python scripts/testrun/testrun.py prepare      --workbook LoginV2 --previous Android-LoginV1.xlsx [--dry-run]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import openpyxl  # noqa: E402

import suites as S  # noqa: E402
import upgrade as U  # noqa: E402
import workbook as W  # noqa: E402
from common import (UserError, check_case_types, check_duplicates, console_utf8, read_rows,  # noqa: E402
                    resolve_previous, resolve_workbooks, suite_root, workbook_key)


def load_rows(args):
    src, out = resolve_workbooks(args.workbook)
    if args.output_workbook:
        out = Path(args.output_workbook)
    elif not out.exists() or getattr(args, "previous", None):
        # The output workbook is created (or rebuilt) by 'prepare' before a run. A dry run selects from what
        # prepare would write, so the rows chosen are the rows the real run would choose.
        res = U.prepare(args.workbook, getattr(args, "previous", None), dry_run=True)
        return res.rows, Path(f"{res.output.name} ({res.action})")
    path = out if out.exists() else src
    wb = openpyxl.load_workbook(path, data_only=False)
    rows = read_rows(wb)
    check_duplicates(rows)
    check_case_types(rows)
    return rows, path


def do_select(args, generate: bool):
    rows, path = load_rows(args)
    key = workbook_key(resolve_workbooks(args.workbook)[0])
    sel = S.select(rows, args.type, args.story, args.ids)
    ids_file = S.write_selection_file(sel)
    print(f"Workbook: {path.name} | run type: {args.type} | stories: {', '.join(args.story) if args.story else 'all'}")
    print(f"Selected {len(sel.rows)} row(s); ids written to {ids_file}")
    per_story: dict[str, int] = {}
    for r in sel.rows:
        per_story[r.story_label] = per_story.get(r.story_label, 0) + 1
    for story, n in per_story.items():
        print(f"  {story}: {n}")
    for w in sel.warnings:
        print(f"WARNING: {w}")
    if sel.left_out:
        print(f"Left out ({len(sel.left_out)}):")
        for tid, why in sel.left_out:
            print(f"  {tid}: {why}")
    if not sel.rows:
        if generate and getattr(args, "refresh", False):
            # Refresh after a run: no row has this status any more, so the status folder must be emptied,
            # otherwise its old suites would run testcases whose status has changed.
            removed = S.clear(args.type, key)
            print(f"No row is {S.TITLE[args.type]} now; {S.FOLDER[args.type]}/ emptied ({len(removed)} file(s) removed).")
            return 0
        print("Nothing to run.")
        return 3
    if generate:
        res = S.generate(sel, key, args.story)
        for f in res.removed:
            print(f"Removed stale suite file: {f}")
        run_list = S.write_run_list(res.story_files.values())
        print(f"Suites written under {res.folder}")
        for story, p in res.story_files.items():
            print(f"  {p.name}: {res.counts[story]} testcase(s)")
        print(f"Suites to run listed in {run_list}")
        print("Validated: JSON parses, spec files exist, one it() per ID in its spec, counts reconcile.")
    return 0


def do_update(args):
    out = W.update(
        csv_path=Path(args.csv) if args.csv else None,
        workbook_name=args.workbook,
        expect_file=Path(args.expect_file) if args.expect_file else None,
        partial_ok=args.partial_ok, ai_notes=args.ai_notes, ai_max=args.ai_max,
        sync_blocked=args.sync_blocked, stories=args.story, handoff_repairs=args.handoff_repairs,
        dry_run=args.dry_run, output_override=Path(args.output_workbook) if args.output_workbook else None)
    print(f"Workbook: {out.workbook}")
    for m in out.messages:
        print(m)
    print(f"Rows written: {len(out.written)} -> " + ", ".join(f"{k} {v}" for k, v in sorted(out.counts.items())))
    for story, counts in out.by_story.items():
        print(f"  {story}: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    if args.dry_run:
        for tid, (status, actual, remark) in out.written.items():
            print(f"  [{status}] {tid}\n      actual: {actual[:140]}\n      remark: {remark[:240]}")
    if out.flagged:
        print(f"NEEDS REVIEW ({len(out.flagged)}): {', '.join(out.flagged)}  (element not found / timeout: stale locator or product change?)")
    if out.repairs_added:
        print(f"Repairs added to the handoff: {', '.join(out.repairs_added)}")
    return 0


def do_diff(args):
    print(U.format_report(U.diff(args.workbook, args.previous, args.story)))
    return 0


def do_prepare(args):
    res = U.prepare(args.workbook, args.previous, args.dry_run)
    print(f"Output workbook: {res.output.name} ({res.action})")
    for m in res.messages:
        print(m)
    if res.carried or res.reset or res.deleted:
        print(f"Carried over (unchanged): {len(res.carried)}")
        for reason, ids in res.reset.items():
            print(f"Start Not Executed - {reason} ({len(ids)}): " + ", ".join(ids))
        if res.deleted:
            print(f"Deleted in the workbook, never run ({len(res.deleted)}): " + ", ".join(res.deleted))
        if res.test_data_carried:
            print(f"Test data statuses carried over: {res.test_data_carried}")
    return 0


def do_reset_suites(args):
    rows, path = load_rows(args)
    key = workbook_key(resolve_workbooks(args.workbook)[0])
    prev_key = workbook_key(resolve_previous(args.previous)) if args.previous else None
    res = S.reset_for_update(rows, key, prev_key, args.dry_run, args.include_manual)
    verb = "Would remove" if args.dry_run else "Removed"
    print(f"Suites: {res.folder} | workbook: {path.name}" + (f" | previous suites: {suite_root(prev_key)}" if prev_key else ""))
    print(f"{verb} {len(res.removed)} old suite file(s):")
    for f in res.removed:
        print(f"  {f}")
    print(f"{'Would write' if args.dry_run else 'Wrote and validated'} {len(res.written)} story suite(s):")
    for name, n in res.written.items():
        print(f"  {name}: {n} testcase(s)")
    for story, ids in res.blocked.items():
        print(f"  {story}: Blocked in the handoff, no it(): {', '.join(ids)}")
    if res.kept_manual:
        print(f"Kept {len(res.kept_manual)} hand-made suite(s) in {' and '.join(f + '/' for f in S.MANUAL_FOLDERS)} (add --include-manual to remove them):")
        for f in res.kept_manual:
            print(f"  {f}")
    if res.no_method:
        print(f"WARNING: {len(res.no_method)} row(s) of automated stories have no it() and no Blocked entry: {', '.join(res.no_method)}")
    if res.not_automated:
        print(f"Stories not automated yet (no it(), no handoff): {', '.join(res.not_automated)}")
    print("passed/ and failed/ fill again from the new output workbook after the first run.")
    return 0


def main(argv=None) -> int:
    console_utf8()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--workbook", help="input workbook name (required when testcase/Testcases holds more than one)")
    common.add_argument("--output-workbook", help="override the canonical output workbook path (testing)")
    common.add_argument("--story", nargs="*", help="story IDs, e.g. US003 US011 (default: all)")
    common.add_argument("--ids", nargs="*", help="only these testcase IDs, e.g. TC_US001_006 (still filtered by --type)")
    prev = argparse.ArgumentParser(add_help=False)
    prev.add_argument("--previous", help="output workbook of the previous version (file name in Output Testcases); "
                                         "results of unchanged rows are carried over from it")
    sub = p.add_subparsers(dest="cmd", required=True)

    for name, helptext in (("select", "choose rows and write the id list"), ("suites", "choose rows and build the JSON suites")):
        sp = sub.add_parser(name, parents=[common, prev], help=helptext)
        sp.add_argument("--type", required=True, choices=S.RUN_TYPES)
        if name == "suites":
            sp.add_argument("--refresh", action="store_true",
                            help="status-folder refresh after a run (pass/fail): if no row has the status, empty the folder instead of stopping")

    up = sub.add_parser("update", parents=[common], help="write a results CSV into the workbook")
    up.add_argument("--csv", help="results CSV from the run")
    up.add_argument("--expect-file", help="ids that must all have a result (test-results/testrun/selected-ids.txt)")
    up.add_argument("--partial-ok", action="store_true", help="write even if some selected ids have no result")
    up.add_argument("--ai-notes", action="store_true", help="add a one-line AI note to Fail rows (uses the claude CLI)")
    up.add_argument("--ai-max", type=int, default=10, help="max AI notes per update (default 10)")
    up.add_argument("--sync-blocked", action="store_true", help="write handoff-Blocked rows still 'Not Executed' as Blocked")
    up.add_argument("--handoff-repairs", action="store_true", help="add NEEDS REVIEW rows to the handoff 'Repairs needed'")
    up.add_argument("--dry-run", action="store_true", help="show what would be written; save nothing")

    df = sub.add_parser("diff", parents=[common, prev], help="workbook update: what changed per testcase ID, and the plan")
    pr = sub.add_parser("prepare", parents=[common, prev], help="create (or rebuild) the output workbook of the chosen input workbook")
    pr.add_argument("--dry-run", action="store_true", help="show what would be carried over; write nothing")
    rs = sub.add_parser("reset-suites", parents=[common, prev], help="workbook update: remove the old version's suites, rewrite story suites")
    rs.add_argument("--dry-run", action="store_true", help="list what would be removed and written; change nothing")
    rs.add_argument("--include-manual", action="store_true",
                    help="also remove the hand-made suites in diagnostics/ and reruns/ (only after the user agreed)")
    _ = df

    args = p.parse_args(argv)
    try:
        if args.cmd == "select":
            return do_select(args, generate=False)
        if args.cmd == "suites":
            return do_select(args, generate=True)
        if args.cmd == "diff":
            return do_diff(args)
        if args.cmd == "prepare":
            return do_prepare(args)
        if args.cmd == "reset-suites":
            return do_reset_suites(args)
        return do_update(args)
    except UserError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
