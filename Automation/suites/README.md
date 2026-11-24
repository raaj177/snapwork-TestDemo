# Suites

A suite is a JSON file in the shape of `templates/story-suite.template.json`: one story, one platform, one spec, the testcase IDs to run. The run scripts turn it into `--spec <file>` + one grep `(?:^|\s)(?:ID1|ID2):`.

| Kind | Purpose |
| --- | --- |
| normal | every implemented testcase of a story |
| diagnostic | a few IDs to investigate a failure |
| isolated rerun | one ID, run alone to rule out interference |
| status-filtered | `suites/<Workbook>/<platform>/passed/` and `.../failed/` — created later by the run scripts **from real results**, never at bootstrap |

Smoke specs (`src/tests/smoke/**`) are never part of a story suite.
