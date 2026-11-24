# P0 smoke tests (written here, and only here)

Contract: `.github/skills/implement-testcases-v2/references/p0-smoke.md`.

```text
src/tests/smoke/<WorkbookName>/<StoryId>.test.ts         one per story: the story's P0 tests (Automation Candidate = Yes, Priority = P0). P1/P2 tests go in src/tests/regression/<WorkbookFolder>/
src/tests/smoke/generated/<WorkbookName>/manifest.json   every eligible P0 case, implemented and missing
```

`<WorkbookName>` = workbook file name without `.xlsx`, the version suffix and a trailing `_TestCases` (`01_Biller_MDM_TestCases_v1_1.xlsx` → `01_Biller_MDM`).

| Command | Does |
| --- | --- |
| `npm run smoke:generate -- --workbook "<file>"` | writes only the manifest (it never writes or changes a test file) |
| `npm run smoke:check -- --workbook "<file>" [--with-project-checks]` | read-only: MISSING / MISPLACED (P0 in regression, P1/P2 in smoke) / DUPLICATE / TITLE / STALE / MISMATCH, then `COVERAGE COMPLETE` or `COVERAGE INCOMPLETE: <n> missing` |
| `npm run smoke:run -- --workbook "<file>" --platform android [--build-id <id>] [--partial]` | check + complete P0 run (or `--partial`: PARTIAL - INCONCLUSIVE) + run record in `reports/smoke/<WorkbookName>/<BuildId>/` |
| `npm run smoke:record -- --workbook "<file>" --folder reports/smoke/<WorkbookName>/<BuildId>` | recomputes the decision of an existing build |
| `npm run smoke:test` | device-free fixture tests |

Selection: every story worksheet; Automation Candidate = Yes, Priority = P0, not deleted/invalidated, valid unique `TC_` ID (iOS also IOS Testcase = Yes). Decision: `INCONCLUSIVE` (incomplete coverage, partial, no result, Skip or Blocked) → `REJECT` (any Fail) → `ACCEPT`.

Each case exists once (P0 here, P1/P2 in regression), so full runs (`test:android`, `npm run regression`, `.un`) include this folder without running a case twice. Jenkins `TEST_SUITE=regression` runs only `src/tests/regression/**`; `TEST_SUITE=smoke` runs the P0 gate.
