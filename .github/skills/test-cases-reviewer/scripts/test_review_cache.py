import tempfile
import unittest
import json
import subprocess
import sys
from pathlib import Path

from openpyxl import Workbook

from review_cache import case_hashes, digest_file, plan, snapshot, write_cache


class ReviewCacheTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.workbook = self.root / "cases.xlsx"
        self.source = self.root / "story.md"
        self.source.write_text("Approved story", encoding="utf-8")
        self.report = self.root / "review.xlsx"
        self.report.write_bytes(b"verified-report-fixture")
        self.write_cases([("TC-1", "Valid"), ("TC-2", "Invalid")])

    def write_cases(self, rows):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "US001"
        sheet.append(["Test Case ID", "Expected Result"])
        for row in rows:
            sheet.append(row)
        workbook.save(self.workbook)
        workbook.close()

    def current(self):
        return snapshot(self.workbook, [self.source], "US001", "Android")

    def previous(self):
        value = self.current()
        value.update(report=str(self.report), report_sha256=digest_file(self.report))
        return value

    def test_first_review_is_full(self):
        self.assertEqual(plan(self.current(), None)["mode"], "full")

    def test_unchanged_cases_reusable(self):
        result = plan(self.current(), self.previous())
        self.assertEqual(result["mode"], "incremental")
        self.assertEqual(result["review_case_ids"], [])
        self.assertEqual(result["reusable_case_ids"], ["TC-1", "TC-2"])

    def test_added_changed_and_removed_cases(self):
        previous = self.previous()
        self.write_cases([("TC-1", "Changed"), ("TC-3", "New")])
        result = plan(self.current(), previous)
        self.assertEqual(result["review_case_ids"], ["TC-1", "TC-3"])
        self.assertEqual(result["removed_case_ids"], ["TC-2"])
        self.assertEqual(result["reusable_case_ids"], [])

    def test_context_changes_invalidate(self):
        for field in ("sources", "rules", "scope", "platform", "schemas"):
            with self.subTest(field=field):
                previous = self.previous()
                previous["context"][field] = "changed"
                self.assertEqual(plan(self.current(), previous)["mode"], "full")

    def test_changed_source_invalidates(self):
        previous = self.previous()
        self.source.write_text("Revised story", encoding="utf-8")
        self.assertEqual(plan(self.current(), previous)["mode"], "full")

    def test_changed_or_missing_report_invalidates(self):
        previous = self.previous()
        self.report.write_bytes(b"changed")
        self.assertEqual(plan(self.current(), previous)["mode"], "full")
        self.report.unlink()
        self.assertEqual(plan(self.current(), previous)["mode"], "full")

    def test_duplicate_and_blank_ids_rejected(self):
        for rows in ([("TC-1", "a"), ("TC-1", "b")], [("", "missing ID")]):
            with self.subTest(rows=rows):
                self.write_cases(rows)
                with self.assertRaises(ValueError):
                    case_hashes(self.workbook)

    def test_cache_atomic_roundtrip_and_no_input_modification(self):
        before = digest_file(self.workbook)
        cache = self.root / ".review-cache" / "doc.json"
        previous = self.previous()
        write_cache(cache, previous)
        self.assertEqual(json.loads(cache.read_text()), previous)
        self.assertEqual(plan(self.current(), previous)["mode"], "incremental")
        self.assertEqual(digest_file(self.workbook), before)

    def test_cli_record_then_reuse_and_reject_stale_inputs(self):
        script = Path(__file__).with_name("review_cache.py")
        cache = self.root / "cache.json"
        arguments = [
            "--workbook", str(self.workbook), "--source", str(self.source),
            "--scope", "US001", "--platform", "Android", "--cache", str(cache),
        ]
        first = subprocess.run(
            [sys.executable, str(script), "plan", *arguments],
            check=True, capture_output=True, text=True,
        )
        fingerprint = json.loads(first.stdout)["inputs_sha256"]
        record = [
            sys.executable, str(script), "record", *arguments,
            "--report", str(self.report), "--verified", "--inputs-sha256", fingerprint,
        ]
        subprocess.run(record, check=True, capture_output=True, text=True)
        reused = subprocess.run(
            [sys.executable, str(script), "plan", *arguments],
            check=True, capture_output=True, text=True,
        )
        self.assertEqual(json.loads(reused.stdout)["mode"], "incremental")
        before = cache.read_bytes()
        self.source.write_text("changed after plan", encoding="utf-8")
        rejected = subprocess.run(record, capture_output=True, text=True)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("Inputs changed", rejected.stderr)
        self.assertEqual(cache.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
