# Framework Architecture

## Workspace and QA pipeline

```text
<WorkspaceRoot>/
  .github/_requirements/   input: BRD / user stories, ADRs, designs, API specs (documents only, never the app build)
  .github/skills/          the pipeline skills (orchestrator, automation-setup, generator, reviewer, implement, run-tests)
  orchestration/           pipeline-state.json + PIPELINE_PROGRESS.md (resume point)
  Automation/              this framework (flat Mobile layout)
    testcase/              workbook lifecycle (below)
```

Pipeline: **Phase 1** automation-setup builds this framework (no app needed) → **Phase 2** test-cases-generator writes `testcase/Generated Testcases/<Doc>_TestCases_v1_0.xlsx` → **Phase 3** review cycle writes `testcase/Review Reports/` and revisions in `testcase/Revised Testcases/`; a version with full and risk-weighted coverage ≥ 90% is copied unchanged to `testcase/Testcases/` → **Phase 4** implement-testcases-v2 reads the app build from `apps/<platform>/` into `.env` and writes page objects + story specs for the approved workbook.

Workbook lifecycle: `Generated Testcases/` → `Review Reports/` → `Revised Testcases/` → `Testcases/` (automation input, never edited) → `Output Testcases/` (`Android-`/`iOS-<name>.xlsx` run results) and `CSV Files/<Platform>/<Feature Name>/`.

| Layer | Tool | Version (pinned) |
| --- | --- | --- |
| Language | TypeScript (`strict`) | 6.0.3 |
| Client / runner | WebdriverIO, @wdio/cli, local-runner, mocha-framework | 10.2.0 |
| Server | Appium (project-local) + uiautomator2 / xcuitest drivers | 4.0.0 / 10.0.0 / 13.6.1 |
| Assertions | expect-webdriverio | 8.1.0 |
| Reporting | @wdio/allure-reporter, spec, junit; allure-commandline | 10.2.0; 2.46.1 |
| Logging | winston | 3.19.0 |
| Config | dotenv + zod | 18.0.10 / 4.6.7 |
| Workbooks | exceljs | 4.4.0 |
| Synthetic data (opt-in) | @faker-js/faker | 10.6.0 |
| Code quality | ESLint + typescript-eslint, Prettier | 10.15.0 / 8.73.0, 3.10.1 |

## Folders

| Folder | Responsibility |
| --- | --- |
| `config/` | `env.ts` (the one configuration layer), wdio shared/android/ios/local/grid configs, device capability presets, per-environment values |
| `src/pages/common` | `BasePage` (locators, atomic actions, polling checks, step screenshots); `src/pages/android`, `src/pages/ios` platform pages (added later) |
| `src/components/` | reusable UI pieces (added later) |
| `src/services/` | app lifecycle, device facts, API (axios), session/context, test data, test values |
| `src/fixtures/` | `fixtures.user/message/value` |
| `src/data/` | `test-data.json` (committed, no secrets), `test-data.local.example.json`, schema, synthetic generators |
| `src/reporting/` | statuses, `BlockedError`, testcase-ID helpers, `ResultWriter` (CSV), `AllureEvidence` |
| `src/utils/` | Logger, Redactor, TestState, Locators, waits, gestures, screenshots, retry |
| `src/tests/regression/<WorkbookFolder>/` | one spec per story (added by implement-testcases-v2) |
| `src/tests/smoke/` | generated P0 smoke specs + manifests (never hand-written) |
| `suites/` | suite templates; status suites created later from real results |
| `evidence/<platform>/<Screen>/` | UI dumps + screenshots + `locators.md` that page-object locators come from |
| `automation-handoff/` | `<story>.md` per implemented story (Keep/Change/Add/Blocked) |
| `scripts/` | environment, Appium, evidence, report, smoke, run and report tooling |
| `Jira/` | verified Jira records of smoke bugs (`issues.json`, written only by `jira_bugs.py record`) |
| `jenkins/`, `.github/workflows/` | CI |

## Configuration precedence

process environment (CI/CLI) → `.env` (local, Git-ignored) → safe defaults in `config/env.ts`, validated with zod at startup. App values (`APP_PACKAGE`, `APP_ACTIVITY`, `BUNDLE_ID`, `APP_PATH`) live only in `.env` / Jenkins parameters, never in code.

## Test traceability contract

- One spec per implemented story: `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts`; `<WorkbookFolder>` = approved workbook file name without `.xlsx`.
- One top-level `describe('<StoryId> <story name>')`; one `it('<TC_ID>: <workbook Test Description>')` per testcase. A test body never branches on the platform.
- `testCaseIdOf(title)` reads `^(TC_[A-Za-z0-9_]+):` from the `it()` title; the ID is added to Allure (`addTestId` + `testCaseId` label) in `beforeTest`.
- A test that cannot prove its expected result throws `BlockedError(reason)` → `Blocked`, never `Fail`.
- Selection: `--spec <file>` + one grep `(?:^|\s)(?:ID1|ID2):` (Mocha matches the full title), or `TEST_IDS=ID1,ID2` which the wdio config turns into `mochaOpts.grep` in-process (used by Jenkins).
- Implementation is read only from `it()` titles: a folder or file proves nothing.

## Results and evidence

- `ResultWriter` (afterTest) appends one row per finished attempt to `AUTOMATION_RESULTS_FILE` with the header `Test Case ID,Execution Status,Actual Result,Automation Remark,Spec File,Test Title,Duration (ms),Timestamp`; statuses `Pass`, `Fail`, `Skip`, `Blocked` (`Not Executed` exists but is never assigned by the writer).
- Allure: per-test `Logger` attachment, step screenshots (`screenshots/steps/<TC_ID>/NN_<label>_<time>.png`, before submission taps and when popups/messages show; `STEP_SCREENSHOTS=false` turns them off), failure screenshot + redacted page source + diagnostics.
- Labels on every result: `executionType`, `runId`, `specFile`, `storyId`, `storyName`, `testCaseId`, `platform`, `environment`, `workbook`, `epic`, `feature` (used by `report:share`).
- JUnit XML in `test-results/junit/` (Jenkins).

## How implement-testcases-v2 extends the framework

It adds `src/pages/<platform>/*Page.ts` (+ `src/pages/index.ts`), story specs in `src/tests/regression/<WorkbookFolder>/`, evidence under `evidence/`, handoff files, the run scripts (`run.cmd`, `scripts/run.ps1`, `scripts/run-tests.ps1`, `scripts/testrun/`), and regenerates the P0 smoke specs with `npm run smoke:generate`.
