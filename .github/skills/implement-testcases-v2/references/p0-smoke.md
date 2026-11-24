# P0 Smoke Workflow

Reusable logic for the P0 smoke gate of every testcase workbook. Load it in Execution Step 7 of every story implementation, in a workbook update, and whenever the user asks for smoke, P0, a build gate or a build decision. The approved testcase workbook is the only source of truth. Never generate a placeholder test for a case that has no real implementation.

The framework tooling described here (`smoke:generate`, `smoke:check`, `smoke:run`, `smoke:record`) is created by `automation-setup` ("Mandatory workbook-driven smoke foundation"). When a project lacks any of it, add it first, following this file and the automation-setup "Method rules" (no `private`, every method logs), then run its fixture tests.

## 1. Select the smoke cases

Read **every story worksheet** of the confirmed approved workbook in `testcase/Testcases/`. A row is an eligible P0 smoke case only when all of these hold:

| Condition | Rule |
| --- | --- |
| Automation Candidate | `Yes` (trimmed, case-insensitive) |
| Priority | `P0` (trimmed, case-insensitive); P1, P2 and blank are excluded |
| Not deleted or invalidated | Test Case Type is not `deleted` / `invalidated`; a row without a Test Case Type column counts as active |
| Valid ID | matches `^TC_[A-Za-z0-9_]+$` |
| Unique ID | appears once across the whole workbook; a duplicate ID is a coverage error (section 4), never silently de-duplicated |

- Group the selected cases by story ID, taken from the worksheet's story (for example `US002`, `US003`). **Discover the stories from the workbook; never hardcode a story list.**
- For iOS, also require `IOS Testcase = Yes` (`platforms.md`).
- When `testcase/Testcases/` holds several versions of one workbook, use only the version the user confirmed. Never merge versions.

## 2. Where each case is implemented: P0 in smoke, everything else in regression

The workbook's **Priority** column decides the file a testcase lives in. A case is implemented in exactly one place:

| Workbook row | Implemented in |
| --- | --- |
| Automation Candidate = Yes **and Priority = P0** | **only** the story's smoke spec `src/tests/smoke/<WorkbookName>/<StoryId>.test.ts` |
| Automation Candidate = Yes and Priority P1 / P2 | **only** the story's regression spec `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts` (`regression-layout.md`) |

```text
src/tests/
  smoke/
    <WorkbookName>/
      US002.test.ts                   # the story's P0 tests (hand-written, the only copy)
      US003.test.ts
    generated/
      <WorkbookName>/
        manifest.json                 # written by smoke:generate
  regression/
    <WorkbookFolder>/                 # approved workbook file name without .xlsx
      US-002. <Story title>.test.ts   # the story's P1/P2 tests only
```

`<WorkbookName>` is the input workbook's file name without `.xlsx`, a trailing version suffix (`_v1_1`, `V2`) and a trailing `_TestCases`/`_Testcases`: `01_Biller_MDM_TestCases_v1_1.xlsx` → `01_Biller_MDM`. A story with only P0 cases has a smoke spec and no regression spec; a story with only P1/P2 cases has a regression spec and no smoke spec. A file is created with its first `it()`, never as a placeholder.

For every selected P0 case:

1. Find its `it('<exact ID>: <workbook title>')` in the story's smoke spec. If none exists, implement a real test **there** (the normal Execution Steps 5 to 8: device inspection, page objects, the `it()`). Never put a P0 case in a regression spec, and never a P1/P2 case in a smoke spec; `smoke:check` reports both as `MISPLACED`.
2. The ID and the title after the colon must match the workbook exactly.
3. It is verified by running it on the target app build and platform with the printed run command (the user runs it; this skill never does).
4. A case whose behavior cannot be reached or verified gets no `it()` and is listed `Blocked` in the handoff with the exact reason. A Blocked case counts as **missing** for smoke coverage: never as implemented, never as passed.
5. Credentials and test-account values come from environment variables (`.env`, Git-ignored) or the CI secret store. Never write them into test source, the manifest, results CSVs, run records or logs.
6. When a row's priority changes in a workbook update (P0 ↔ P1/P2), move its `it()` to the other folder in the same change.

The smoke spec follows the same rules as every spec (`../assets/testcase-method-template.md`): imports, page constants and `it()` blocks only, no logger and no functions; every step is a page or start-service method that logs `started` / `finished` / `failed: <reason>`, so a smoke run in Jenkins prints each step of each P0 case.

```ts
// P0 smoke cases of US-002. Mobile Number Login.
// Only workbook rows with Automation Candidate = Yes and Priority = P0 are implemented here; P1/P2 cases of this
// story go in src/tests/regression/01_Biller_MDM_TestCases_v1_1/. Write and change these tests here (this file is not generated).
import allureReporter from '@wdio/allure-reporter';
import { fixtures } from '../../../fixtures/test-data.fixture';
import { createLoginPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const loginPage = createLoginPage();

describe('US002 Mobile Number Login', () => {
    it('TC_US002_001: Verify ...', async () => {
        allureReporter.addStory('Login inactive until both fields are filled');
        allureReporter.addSeverity('critical');
        const mobileNumber = fixtures.value('sampleMobileNumber');
        const password = fixtures.value('samplePassword');
        await startService.openMobileNumberLogin();
        await loginPage.verifyLoginActivatesAfterMobileThenPassword(mobileNumber, password);
        recordActualResult('Login stayed inactive until both fields held values, then became active.');
    });
});
```

- The `describe('<StoryId> <story name>')`, hooks, retries, `[TEST START]`/`[TEST END]` logs, `ResultWriter`, Allure evidence and the per-test log work exactly as in a regression spec.
- Runs: `npm run smoke` and `smoke:run` run the smoke specs. `npm run regression`, `.\run` and `test:android` / `test:ios` find implementations in **both** folders, so a full regression also runs the P0 cases; because each case exists once, nothing runs twice. Jenkins `TEST_SUITE=regression` runs `src/tests/regression/**` (P1/P2 only), `TEST_SUITE=smoke` runs the P0 gate.
- `scripts/lib/specs.mjs` and `scripts/testrun/common.py` scan the workbook's regression folder and its smoke folder. A legacy file starting with `// @generated workbook-smoke` (the earlier generated layout) is ignored by the mapping, refused by `smoke:generate` and reported `STALE` by `smoke:check`: delete it and keep the P0 tests in the hand-written smoke spec.

## 3. Write the manifest

`npm run smoke:generate -- --workbook "<approved file name>"` writes **only** the manifest `src/tests/smoke/generated/<WorkbookName>/manifest.json`. It never writes or changes a spec.

```json
{
  "generator": "smoke:generate",
  "workbook": "01_Biller_MDM_TestCases_v1_1.xlsx",
  "workbookName": "01_Biller_MDM",
  "workbookSha256": "<hash of the approved workbook file>",
  "platform": "android",
  "selection": { "automationCandidate": "Yes", "priority": "P0", "excludeTypes": ["deleted", "invalidated"] },
  "stories": [
    {
      "story": "US002",
      "smokeSpec": "src/tests/smoke/01_Biller_MDM/US002.test.ts",
      "smokeSha256": "<hash of the smoke spec>",
      "eligible": [
        { "id": "TC_US002_001", "title": "Verify ...", "status": "implemented" },
        { "id": "TC_US002_004", "title": "Verify ...", "status": "implemented" },
        { "id": "TC_US002_007", "title": "Verify ...", "status": "missing", "reason": "Blocked: OTP cannot be read on the device" }
      ]
    }
  ],
  "totals": { "eligible": 3, "implemented": 2, "missing": 1 },
  "coverageComplete": false
}
```

- It lists **all** eligible P0 cases, which are implemented (in the story's smoke spec), and which are missing (with the handoff's Blocked reason, `no it() found`, `misplaced in regression`, `wrong story file` or `title mismatch`). This makes incomplete coverage visible.
- It holds no credentials, test data values, device IDs or timestamps (so regenerating unchanged inputs gives an identical file).
- Repeatable (byte-identical for unchanged inputs). Regenerate after any addition, title or behavior change, deletion, Automation Candidate change or reprioritization, and after a workbook update.

## 4. Check coverage before the build gate

`npm run smoke:check -- --workbook "<approved file name>"` is read-only and exits non-zero on any of these:

| Check | Fails when |
| --- | --- |
| Implemented | an eligible P0 case has no `it()` in its story's smoke spec (Blocked counts as missing) |
| Placement | a P0 case is implemented in a regression spec, or a non-P0 case in a smoke spec (`MISPLACED`) |
| Exactly once | an eligible ID appears in more than one `it()`, or twice in the workbook |
| Title match | the `it()` title after `<ID>:` differs from the workbook title |
| Story file | a P0 case is in another story's smoke spec (`MISMATCH`) |
| Stale | the manifest differs from what `smoke:generate` would write now (workbook hash, smoke spec hash, ID set, titles), or a legacy generated smoke file is present |
| Project checks | `npm run typecheck`, `npm run lint` or the smoke fixture tests fail (`smoke:check --with-project-checks`, used by `smoke:run`) |

It prints one line per problem (`MISSING TC_US002_007 (Blocked: ...)`, `MISPLACED TC_US002_025 (P0 case implemented in src/tests/regression/...: move its it() to src/tests/smoke/.../US002.test.ts)`, `DUPLICATE TC_US003_002 in a.test.ts, b.test.ts`, `TITLE TC_US003_004 workbook="..." test="..."`, `STALE manifest.json`) and a final `COVERAGE COMPLETE` or `COVERAGE INCOMPLETE: <n> missing`.

If any P0 case is missing, never report the smoke suite as complete. During incremental story implementation, report the missing IDs and their reasons; do not implement out-of-scope stories on your own or create placeholders.

## 5. Run the P0 suite

`npm run smoke:run -- --workbook "<approved file name>" --platform android|ios|web [--build-id <id>] [--partial]` (Jenkins: `TEST_SUITE=smoke` with `SMOKE_WORKBOOK`, and `SMOKE_PARTIAL` for a partial run; the build ID is `BUILD_TAG`):

1. Runs `smoke:check --with-project-checks`.
2. **Coverage complete:** runs every smoke spec of the workbook in one wdio run with `--mochaOpts.grep` matching exactly the manifest's implemented IDs (`(?:^|\s)(?:TC_A|TC_B|...):`). This is a complete P0 run. The grep matches the full title (`<describe names> <ID>: <title>`), so the ID follows the start or whitespace, never `^` alone; IDs are validated before they enter the pattern and the runner is spawned with an argument array (`shell: false`). Web: the same rule with `.spec.ts`: the P0 tests live in `src/tests/smoke/<WorkbookName>/<StoryId>.spec.ts` and the run passes those specs with `--grep "(?:^|\s)(?:TC_A|TC_B|...):"`.
3. **Coverage incomplete, without `--partial`:** stops before starting a session, prints the missing IDs and records the build as `INCONCLUSIVE` (reason `coverage incomplete`).
4. **Coverage incomplete, with `--partial`:** runs only the implemented IDs for investigation. Every console header, the run record and the report title say `PARTIAL - INCONCLUSIVE`. A partial run can never be ACCEPT or REJECT.
5. Sets `AUTOMATION_RESULTS_FILE` to the build's folder (section 7), so `ResultWriter` writes this run's CSV there, and sets `EXECUTION_TYPE=smoke` and `RUN_ID=<BuildId>` so every Allure result is labelled for the shareable report (`../../automation-setup/references/share-report.md`, section 2). It writes the build folder's `run.json` (runId, `executionType: smoke`, `runType: complete | partial | not-run`, workbook, platform, environment, startedAt, finishedAt, timeZone, decision).

The user runs it, or a CI job does. This skill never runs it; it prints the command (section 8).

`npm run smoke -- "<file>"` (`../../automation-setup/references/workbook-commands.md`) is the everyday command: it runs the implemented P0 cases even when coverage is incomplete, labels the run `INCOMPLETE COVERAGE`, and makes no build decision. Only `smoke:run` decides ACCEPT / REJECT / INCONCLUSIVE.

## 6. Decide the build result

```text
if coverage is incomplete
   or the run was partial
   or any selected ID has no result
   or any result is Skip (environment / infrastructure: no session, frozen UI server, device lost)
   or any result is Blocked:
    INCONCLUSIVE
else if any P0 test is Fail:
    REJECT
else:
    ACCEPT
```

- ACCEPT requires complete P0 coverage **and** every eligible P0 test passing in this build.
- A failed automated test is a result to investigate (`fail-review.md`), not by itself proof of a product bug. The decision text says so for REJECT.
- The decision is computed by `smoke:record` from the manifest and the results CSV, never written by hand.
- After a REJECT (or any failed smoke case), Jira bugs are raised only through `../../smoke-bugs-to-jira/SKILL.md`, and only when the user asks: triage first, one bug per evidence-backed product discrepancy, never one per failed test.

## 7. Record the build

Every `smoke:run` (complete, partial or stopped) writes one run record under a **unique build ID**: the `--build-id` given, else CI's `BUILD_TAG` / `BUILD_ID` / `GITHUB_RUN_ID`, else `<platform>-<appVersion>-<yyyyMMdd-HHmmss>`. If the folder already exists, the run stops rather than overwrite it.

```text
reports/smoke/<WorkbookName>/<BuildId>/
  run-record.json     # the record below
  results.csv         # the ResultWriter CSV of this run (same header as every run)
  allure-results/     # copied when the run produced them; omitted (and noted) otherwise
  summary.md          # human-readable: decision, counts, missing / failed IDs, the INCONCLUSIVE reason
```

`run-record.json`:

```json
{
  "buildId": "android-2.4.1-20261117-101530",
  "workbook": "01_Biller_MDM_TestCases_v1_1.xlsx",
  "workbookSha256": "<from the manifest>",
  "platform": "android",
  "appVersion": "2.4.1 (241)",
  "deviceModel": "Pixel 7 / Android 14",
  "startedAt": "2026-11-17T10:15:30Z",
  "finishedAt": "2026-11-17T10:31:02Z",
  "runType": "complete",
  "selectedIds": ["TC_US002_001", "TC_US002_004", "TC_US003_001"],
  "missingIds": [],
  "results": { "TC_US002_001": "Pass", "TC_US002_004": "Pass", "TC_US003_001": "Fail" },
  "counts": { "eligible": 3, "selected": 3, "Pass": 2, "Fail": 1, "Skip": 0, "Blocked": 0, "noResult": 0 },
  "evidence": { "resultsCsv": "results.csv", "allureResults": "allure-results/" },
  "decision": "REJECT",
  "decisionReason": "1 P0 test failed (TC_US003_001). Investigate before treating it as a product defect."
}
```

- `runType` is `complete`, `partial` or `not-run`; `appVersion` is read from the installed app (Android `dumpsys package <APP_PACKAGE>` versionName/versionCode; iOS the bundle's CFBundleShortVersionString), never typed in. The device is recorded by model and OS only, never by serial or UDID.
- Then update the **separate output workbook** by testcase ID with the existing writer: `python scripts/testrun/testrun.py update --workbook "<approved file name>" --csv "reports/smoke/<WorkbookName>/<BuildId>/results.csv" --expect-file <selected-ids file>` (add `--partial-ok` only for a partial run). It writes `testcase/Output Testcases/<Platform>-<workbook>.xlsx`; **the approved source workbook is never written**.
- Secrets stay out: the record, summary, CSV and copied evidence go through the `Redactor`; no `.env` value other than the platform and the app package appears in them.
- `reports/smoke/` is Git-ignored like every other report; CI archives each build folder as a build artifact. Older build folders are never changed or deleted by `smoke:run` (only by the project's `clean` script when the user runs it).

## 8. Validate and report

Before closing the story or workbook update:

1. `npm run smoke:generate -- --workbook "<file>"`, then `npm run smoke:check -- --workbook "<file>"` (read-only).
2. `npm run typecheck`, `npm run lint` and the project's device-free tests (including the smoke fixture tests).
3. Print the build-gate command for the user (never run it):

```powershell
npm run smoke:run -- --workbook "<approved file name>" --platform android
```

When coverage is incomplete, print instead the partial command, labelled as such:

```powershell
# PARTIAL - INCONCLUSIVE: runs only the implemented P0 cases; cannot ACCEPT or REJECT the build
npm run smoke:run -- --workbook "<approved file name>" --platform android --partial
```

Report per workbook: the approved file name, the eligible P0 IDs grouped by story with their count, the smoke specs holding them (`src/tests/smoke/<WorkbookName>/<StoryId>.test.ts`), any `MISPLACED` case moved, the manifest path, implemented and missing IDs with reasons, the `smoke:check` result line, and the typecheck/lint/test results. Never call coverage complete unless `smoke:check` printed `COVERAGE COMPLETE`.
