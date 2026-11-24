---
name: implement-testcases-v2
description: Write or repair TypeScript/WebdriverIO/Appium/Mocha automation for one user story from the input testcase workbook (rows with Automation Candidate = Yes), one story spec file and one it() per testcase ID, for Android. Reuses existing code, type-checks and lints it without running any test, writes the handoff file, installs the bundled run scripts into the project, and then prints the exact command in chat for the user to run (first run, rerun failures, regression or full rerun). The scripts run the tests, write results into the canonical workbook and refresh the passed and failed suites. Handles a new version of the workbook (updated, new, deleted and unchanged testcases, with or without a Test Case Type column): updates and deletes the code to match it, replaces the old version's suites, and the scripts create the new version's output workbook with the unchanged rows' results carried over. Also reviews failing testcases (comparing the workbook, the app source and the test code) and re-checks Blocked rows. MUST be used whenever automation code for workbook testcases is written, updated or repaired. Use when asked to "automate story X", "implement or write automation code", "repair a broken locator", "fix the repairs listed in the handoff", "review or fix the failed testcases", "re-check the blocked testcases", "give me the command to run it" or "a new version of the workbook came in". iOS runs are not covered by the scripts yet; run the iOS spec directly with `npm run test:ios -- --spec <file>` (results are not written to the output workbook).
---

# Purpose

Turns the testcase workbook into working, type-checked automation code, one story at a time, then hands the user a ready-to-paste command that runs it. The skill itself never runs a test and never writes the workbook: the bundled scripts (`scripts/run-tests.ps1` and `scripts/testrun/`) do that when the user runs the printed command.

# Trigger Conditions

Use this skill when:

- the user asks to automate a story or write automation code for workbook testcases
- the handoff file has `Open` repairs to fix, or the user asks to repair a broken locator
- the user asks to review or fix failed testcases
- the user asks to re-check Blocked testcases
- the user asks for the command to run, rerun or regress testcases
- a new version of the workbook arrived (testcases updated, added or deleted), or the workbook has a Test Case Type column

Do not use this skill to run tests, record results or edit the workbook yourself. The scripts do that.

# Inputs

- Platform (mandatory, confirmed by the user): Android or iOS. The run scripts support Android only
- Input testcase workbook (mandatory, confirmed by the user): rows with Automation Candidate = Yes
- Scope (mandatory, confirmed by the user): the Story ID, or specific Test Case IDs, or "all stories" in the workbook
- Previous output workbook: asked only for a workbook update (`references/workbook-update.md`)
- `automation-handoff/<story>.md` (iOS: `<story>-ios.md`), if it exists
- The automation project, and the connected device or simulator with the installed app (inspected before any locator is written; no data is submitted)
- For a Fail review: the platform's canonical output workbook and the evidence saved by earlier runs; app source as reference only

# References

## Common References (MUST read before writing code)

- `references/shared-rules.md` - rules shared by every run
- `references/platforms.md` - Android and iOS: row selection, files per platform, iOS framework readiness, iOS locators and tooling
- `references/automation-playbook.md` - discovery, what a test may assert, locator order, mandatory device inspection
- `references/typescript-wdio-standards.md` - reuse-first decisions, spec and `it()` rules, waits, retries, progress logs, type-check and lint

## Task References (load only when required)

- `references/fail-review.md` - only for a Fail review or a Blocked re-check
- `references/run-scripts.md` - always before the closing steps: installing the scripts and choosing the command to print
- `references/p0-smoke.md` - always in Execution Step 7, in a workbook update, and when asked about smoke, P0, a build gate or a build decision: P0 case selection, per-story smoke specs, the manifest, the coverage check, the ACCEPT / REJECT / INCONCLUSIVE decision and the per-build run record
- `references/workbook-update.md` - only for a workbook update: a new version of an already automated workbook, a Test Case Type column, or an input workbook that no longer matches its output workbook

## Platform References (load only when required)

- `references/flutter.md` - only when the app under test is a Flutter app

# Assets

- `assets/handoff-format.md` - template and field values for `automation-handoff/<story>.md`; MUST be used for the handoff
- `assets/testcase-method-template.md` - base for every new testcase `it()`
- `assets/page-object-template.md` - base for every page object and page method: constructor locators in priority order, small action methods, flow methods, `verify...` methods, logging; MUST be used for page objects
- `assets/retry-framework.md` - reference code for the test-level and step-level retry; use it when the project lacks them

# Scripts

Bundled in this skill and copied into the automation project's `scripts/` folder (see `references/run-scripts.md`):

- `scripts/run-tests.ps1` - one command: preflight, prepare the output workbook, select rows, build the JSON suite, run `wdio` on the device, write the workbook, refresh `passed/` and `failed/`
- `scripts/testrun/` - the Python helpers it calls (`common.py`, `suites.py`, `workbook.py`, `upgrade.py`, `facts.py`, `testrun.py`, `README.md`). Needs Python 3 and `openpyxl`. `testrun.py diff` and `testrun.py reset-suites` are also used by this skill in a workbook update
- `scripts/run.ps1` (copied to the project's `scripts/`) and `scripts/project-root/run.cmd` (copied to the project root, next to `package.json`) - the short command the user types, `.\run US001 US002 -Type full`. `run.cmd` starts `scripts/run.ps1` with the execution policy bypassed, which passes its options to `scripts/run-tests.ps1`, clears old Allure output first and builds and opens the Allure report afterwards. Never put a `run.ps1` in the project root: PowerShell would pick it over `run.cmd` and fail where scripts are disabled

"Compile" in this skill means `npm run typecheck` (`tsc --noEmit`) plus `npm run lint`, run in the automation project. Neither needs a device.

# Execution Steps

1. **Ask before any other work (mandatory).** Unless the user's request already names all three, ask the user, and wait for the answer:
   - which platform: Android or iOS;
   - which input testcase workbook to use (list the workbooks found in the testcase input folder as options);
   - which scope to work on: a Story ID, specific Test Case IDs, or all stories in that workbook.

   Never infer any answer from handoff files, open-repair state, recent commits, open or locked files, or workbook order. Do not read the code, inspect the device, edit, type-check or lint until the user has answered. If the request leaves any of the three out, ask for it.

2. Discover the local contract: repository instructions, the confirmed workbook, the automation framework, existing suites and the `automation-handoff/` folder. Prefer existing project conventions.
3. Read every row in the confirmed scope. Keep only the rows in scope for the platform (shared rule 1 and `references/platforms.md`): Automation Candidate = Yes, and for iOS also IOS Testcase = Yes. **Check for a workbook update** (`references/workbook-update.md`, "When it is a workbook update"): the workbook has a Test Case Type column, `testcase/Output Testcases/` holds the output workbook of an earlier version while code or handoff files already exist for these stories, or the workbook no longer matches its own output workbook. If so, ask the one question about the previous output workbook, and follow `references/workbook-update.md` for steps 4 to 9.
4. Decide the work from the request, within the confirmed scope only:
   - `Open` repairs in the handoff for that scope: fix them first, before writing anything new;
   - named testcases to fix, or a Fail review: follow `references/fail-review.md`;
   - re-check Blocked rows: follow `references/fail-review.md`;
   - a workbook update: follow `references/workbook-update.md` (diff, settle the `Check` lines with the user, then Keep, Change, Add or Delete per row);
   - only the command was asked for: skip to step 9;
   - otherwise implement the story.

   If `Open` repairs exist outside the confirmed scope, mention them in the report but do not fix them. When the scope is "all stories", work through them in workbook order and finish each story's code and handoff before the next.

5. **Inspect the device before writing any locator (mandatory).** App source is a secondary reference only; it never replaces the device. For every screen an in-scope row touches, take the UI hierarchy (Android: `uiautomator dump`) and a screenshot, following `references/automation-playbook.md` (Device inspection), and save them as locator evidence in `evidence/<platform>/<Screen>/<state>.xml|.png` with `scripts/capture-evidence.ps1 -Screen <Screen> -State <state>` (`<Screen>` = the page object name without `Page`). Every locator written or changed gets a row in `evidence/<platform>/<Screen>/locators.md` naming the dump it was verified in, or **No** with the reason (Locator evidence, same file). Tapping through navigation to reach a screen is allowed; typing into forms, submitting, ordering or paying is not. If no device is online, stop and ask the user to connect one; do not write locators from source instead. A screen whose hierarchy exposes no readable text or descriptions cannot prove its rows: list them `Blocked`. Never run a test (`wdio run`) or a suite. For iOS, first check the framework can drive iOS (`references/platforms.md`, iOS framework readiness) and add what is missing before any iOS locator work.
6. Scan the project for what already exists, then decide per row: Keep, Change, Add or Blocked (see `references/typescript-wdio-standards.md`; Keep only when the `it()` still matches the row's title, pre-condition, steps, test data and expected result). In a workbook update the diff's Plan column decides, and rows deleted from the workbook get Delete.
7. Write or update the code from `assets/page-object-template.md` (page objects first: constructor locators, small action methods, flow methods, `verify...` methods) and `assets/testcase-method-template.md` (the `it()` that calls them), and the standards. Update existing files in place. For iOS, an `it()` that already exists for Android is reused: add the iOS locators or steps to the page objects, and never add a second `it()` or a platform branch in the test body.
   **Mandatory P0 smoke gate (`references/p0-smoke.md`):** the approved workbook is the source of truth. Select, across every story worksheet of the confirmed workbook, the active rows with Automation Candidate = Yes and Priority = P0 that have a valid, unique ID, grouped by story ID discovered from the workbook (never a hardcoded story list). Each one needs a real `it()` with the workbook's exact ID and title **in its story's smoke spec** `src/tests/smoke/<WorkbookName>/<StoryId>.test.ts`, never in a regression spec (P1/P2 cases go only in the regression spec); a case that cannot be reached is `Blocked` and counts as missing, never as implemented. No placeholder tests. Then run `npm run smoke:generate -- --workbook "<approved file name>"`, which writes only `src/tests/smoke/generated/<WorkbookName>/manifest.json` (all eligible P0 cases, implemented and missing). Then run the read-only `npm run smoke:check -- --workbook "<approved file name>"`: it fails on a missing, misplaced (P0 in regression or P1/P2 in smoke), duplicated or title-mismatched case or a stale manifest. If the tooling is missing, add it first (`../automation-setup/SKILL.md`, "Mandatory workbook-driven smoke foundation"). Never skip the gate or report incomplete coverage as complete. Do not run device tests for this gate; print the `smoke:run` command instead (`references/p0-smoke.md`, section 8).
8. Before compiling, go through every assertion (`expectTrue`, `expect(...)`) in the story spec. Each appear or state check must reach a polling wait, and each absence check must follow a positive anchor (`references/typescript-wdio-standards.md`, "Every expected check waits"). Then run `npm run typecheck` and `npm run lint`, and `npm run test-data:test` when test data or its services changed. A type or lint error is fixed here. Create or update the platform's handoff file in the `assets/handoff-format.md` format. Every in-scope row appears exactly once as `Implemented` or `Blocked`; a deleted row is removed and listed under "Removed testcases". Set a repair to `Fixed (<date>)` only after the fix type-checks and lints. In a workbook update, then replace the old version's suites with `testrun.py reset-suites`: dry run first, show the user the list and run it for real only after the user says yes (`references/workbook-update.md`, step 7).
   Testcase folder: `testcase/` in this skill and its references means the project's workbook folder. It is `<framework root>/testcase/` in a flat Mobile project and the shared `<AutomationDir>/testcase/` (`../testcase/` from `Automation/Mobile`) in a Mobile + Web project; never create a `testcase/` inside `Mobile/`. The run scripts resolve it the same way (`TESTCASE_DIR`, else the framework's own `testcase/`, else `../testcase/`). Output workbooks are always platform-prefixed (`Android-`, `iOS-`), so a shared folder never mixes platforms.

9. **Install the run scripts and print the command.** Follow `references/run-scripts.md`: copy the bundled scripts into the project's `scripts/` folder (and `run.cmd` into the project root) when missing, never overwrite a changed project copy without asking, check Python and `openpyxl` are present, check Node.js, npm and `node_modules`, the device, `DEVICE_UDID` in the local `.env`, the Android SDK variable and the input workbook location, read the existing output workbook's Status column before choosing `first`, `fail` or `full`, add `-Workbook "<full file name>"` whenever `testcase/Testcases/` holds more than one input workbook and `-Previous` in a workbook update, put story IDs as plain words before `-Type` (`.\run US001 US003 -Type first`), and print the one short `.\run` command that matches the work just done, inside a fenced code block in the chat. Do not run it unless the user explicitly asks; if they do, follow section 5 of that file.
   **Workbook commands.** Check `npm run smoke` and `npm run regression` exist (`../automation-setup/references/workbook-commands.md`; add what is missing, with its device-free tests). Run both with `--dry-run` against the confirmed approved workbook (`npm run smoke -- "<file>" --dry-run`, `npm run regression -- "<file>" <stories> --dry-run`): they start no session and write nothing. Report the printed candidate / implemented / missing / excluded / selected counts, and print the two real commands for the user beside the `.\run` command, saying that they create a per-run report under `report/runs/<RUN_ID>/` with a ZIP and leave the workbook unchanged.
10. Report using the Output Format.

# Rules

- Always confirm the platform, the workbook and the scope (story, testcase IDs or all stories) with the user before starting, as in Execution Step 1. Never pick them yourself.
- Never write a locator for a screen you have not dumped on the device (Execution Step 5). Report every locator as verified on the device or not, and never present source-derived locators as checked.
- Keep `evidence/<platform>/<Screen>/` in step with the page objects: one folder per page object, its dumps and screenshots, and a `locators.md` row for every locator of `src/pages/common|<platform>/<Screen>Page.ts` (strategy, value, evidence file and node, verified Yes/No). A locator added, changed or removed changes its row in the same pass. Test-account values never go into evidence files (`{{NAME}}` placeholders).
- Build locators in the page object's constructor with the `BasePage` builders in this priority: `byRole` (≈ getByRole) → `byId` (≈ getById) → `byLabel` → `byText` → `byXPath` last; in a web view `byAria` → `byCss` before XPath. Every XPath gets a handoff Note with the reason (`references/automation-playbook.md`, "Locator rules").
- One page object per screen. Shared locators and every method live in `src/pages/common/<Screen>Page.ts`; platform-specific locators and actions live in `src/pages/android/<Screen>Page.ts` / `src/pages/ios/<Screen>Page.ts`, which extend the common page; specs get pages from the factory in `src/pages/index.ts`, never with `new`. Never use the `private` keyword (or a `#private` member) in any method or field you write, in page objects or anywhere else: helpers are `protected` (`assets/page-object-template.md`, rules 9 and 10).
- Page objects have one small method per user action, flow methods that combine them, and `verify...` methods for expected results; every method you write or change (public or `protected`, in page objects, services and utils) logs start/end through the logger, and on failure logs `describeError(error)` and rethrows (`assets/page-object-template.md`, rules 6 and 11). Before compiling, check every method you wrote against these two rules. Passwords/OTPs are typed with `secret = true`; identifiers are logged with `maskValue`. **Specs only call methods**: no logger, no spec-level functions, no `try`/`catch`, no `expectTrue` and never a locator or `$()`. Each testcase's steps are page flow methods (and start-service methods for start states) that log `started` / `finished` / `failed: <reason>`, so the Jenkins console shows every step (`assets/testcase-method-template.md`, "The test file only calls methods"). Before compiling, search the specs you wrote for `logger`, `function ` and `try {`; any hit is moved into a page or service method.
- Every story spec relies on the framework resilience in `references/typescript-wdio-standards.md` (Freezes and hangs, Retries): a failed or frozen test is rerun from the start up to 3 attempts (`mochaOpts.retries` = 2), and a launch step (app start + first screen check) is retried on a freeze up to 2 attempts (`src/utils/RetryUtils.ts`). Add what is missing before writing story code, from `assets/retry-framework.md`. Story tests put their first screen check inside the launch step and never add their own retry.
- Every assertion that something appears or changes state (element, page, keyboard, banner, message, selected, enabled, masked or plain text) goes through a page-object method that polls with a bounded wait (15 s; 20 s for a back-end response). It is never checked once right after the action. Absence checks follow a positive anchor, never a fixed pause. Review every assertion against this before compiling (`references/typescript-wdio-standards.md`, "Every expected check waits").
- In a workbook update, never touch the code of a row whose plan is Keep. A modified row is changed in place in the `it()` whose title starts with its ID. A row marked `deleted` loses its `it()` and the code only it used; a row that only disappeared from the workbook, or is no longer an Automation Candidate, loses its `it()` only after the user says yes. Never carry an old result over by hand: the run scripts do it.
- Never change Android behavior while adding iOS support. Android handoff, suites, workbook and code paths stay as they are.
- This skill never runs a test, never starts a test session, never writes the workbook and never records a result. It only writes code, the handoff and the bundled scripts, and prints the command. The user runs the command.
- The script calls allowed are `npm run smoke -- "<file>" --dry-run`, `npm run regression -- "<file>" [stories] --dry-run`, `scripts/run-tests.ps1 -Type <type> -DryRun`, to check that the suite can be built, and in a workbook update `testrun.py diff` and `testrun.py reset-suites`. None of them starts a device session or writes a workbook or a result. `reset-suites` deletes suite files, so its real run (without `--dry-run`) needs the user's yes to the dry run's list; `--include-manual` (hand-made `diagnostics/` and `reruns/` suites) needs a separate yes.
- Also allowed and required: `smoke:generate` (writes only the manifest), the read-only `smoke:check` and the device-free smoke fixture tests. They never start a device session or write a spec, an approved workbook, a result or a run record. `smoke:run` starts a device session, so this skill only prints it. Each case is implemented once: P0 in the smoke spec, P1/P2 in the regression spec; testcase-to-`it()` mapping scans both folders of the workbook.
- ACCEPT needs complete P0 coverage and every P0 test passing; incomplete coverage, a partial run, a missing result, an environment Skip or a Blocked case is INCONCLUSIVE; otherwise a Fail is REJECT (`references/p0-smoke.md`, section 6). Never state a build decision that `smoke:record` did not produce, and never call a Fail a product defect without a Fail review.
- Keep credentials and test-account values out of source, the manifest, results, run records and logs: they come from `.env` or the CI secret store only.
- Never edit the workbook, a results CSV or a generated suite by hand.
- Rows marked Automation Candidate = No are never implemented. For iOS, rows with IOS Testcase other than Yes are never implemented either.
- Write each test as the workbook states it. Never change it to match what the app does.
- **Placement by priority:** P0 rows (Automation Candidate = Yes, Priority = P0) are implemented **only** in the story's smoke spec `src/tests/smoke/<WorkbookName>/<StoryId>.test.ts`; P1/P2 rows **only** in its regression spec `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts` (`references/p0-smoke.md` section 2, `references/regression-layout.md`). Move flat or misplaced specs and `it()` blocks with `git mv` / in the same change and update suites, handoffs and docs; create a story's file only with its first `it()` (pending stories get none; a folder never means implemented). A case that passes alone but whose precondition a workbook run cannot yet reach reliably is `Blocked` in the handoff with `passes standalone`, and its `it()` throws `BlockedError` when the precondition is missing (section 4); never clear app data or bypass security to fake it.
- Test data: `fixtures` first (Git-ignored `test-data.local.json` overrides single shared fields; shared values and `{{env:NAME}}` references otherwise). Only a testcase that needs it calls `resolveTestValue(...)` for a named field: the workbook Test Data cell when it holds exactly one explicitly mapped value, a seeded Faker value only when the cell is blank, `Blocked` for an ambiguous cell (`../automation-setup/references/test-data-sources.md`). Never generate credentials, OTPs, registered contacts or expected values, and never put local or private values in code, docs, handoffs or reports.
- Update existing specs in place. Never create a second spec for a story or overwrite existing files. Delete an `it()` only in a workbook update, as `references/workbook-update.md` says; otherwise list an `it()` whose workbook row is gone as having no matching workbook row.
- A row the device cannot show, or whose expected result is undefined, gets no `it()` and is listed `Blocked` with the exact reason.
- The run scripts are Android only. For iOS, finish the code and the handoff, then tell the user the scripts do not cover iOS yet and to run the iOS spec directly with `npm run test:ios -- --spec <file>` (no iOS run script exists yet, so results are not written to the output workbook).
- A story is complete only when every in-scope row has exactly one `it()` or a `Blocked` entry, `npm run typecheck` and `npm run lint` pass, every `Open` repair is `Fixed`, every requested Fail review is recorded, the story's P0 tests are in its smoke spec and its P1/P2 tests in its regression spec (at most one file of each), with no duplicated testcase IDs and no `MISPLACED` case, the handoff file is written, `smoke:generate` and `smoke:check` ran for its workbook with none of this story's P0 cases missing except Blocked ones (other stories' missing cases are reported, not fixed), and the run command has been printed (Android). In a workbook update also: no `it()` is left for a deleted row, every `Check` line was settled with the user, and `reset-suites` has replaced the old version's suites.

# Output Format

- platform, story and testcase counts: Implemented and Blocked
- P0 smoke gate per testcase workbook (`references/p0-smoke.md`, section 8): approved file name, eligible P0 IDs grouped by story with counts, the smoke specs holding them (`src/tests/smoke/<WorkbookName>/<StoryId>.test.ts`), the manifest path, implemented and missing IDs with reasons, the `smoke:check` result line (`COVERAGE COMPLETE` or `COVERAGE INCOMPLETE: <n> missing`), and the `smoke:run` command to print (labelled `PARTIAL - INCONCLUSIVE` when coverage is incomplete). Coverage is not complete until `smoke:check` says so.
- device inspection: the screens dumped, and the locators verified on the device out of the total (for example "14 of 16"); name each locator that was not verified and why
- any framework change made to support iOS (wdio iOS config, device presets, `env.ts`, `BasePage`), that Android code paths were left unchanged, and the recommendation to run an Android Regression to confirm it
- what was kept, changed and added, by testcase ID, plus any `it()` that needs the user's decision or has no matching workbook row
- code areas changed, including any product-code change and why
- regression layout (`references/regression-layout.md`, section 5): the workbook folder, specs moved (old → new path) and references updated, story files created, stories still pending, cases blocked in workbook runs although they pass standalone
- test data: fields resolved through `resolveTestValue` by testcase ID and their source (local, shared, workbook cell, synthetic), never the values; the checks run (typecheck, lint, `npm run test-data:test`, smoke tooling tests, `--dry-run` discovery) and whether any device run was performed
- exact reason for each Blocked row
- the `npm run typecheck` and `npm run lint` results
- for a Fail review: each testcase's finding and action, and which need a rerun
- for a workbook update: the new and previous workbooks; the rows by plan (kept, changed, added, deleted, re-checked), each `Check` line with the user's answer, the code removed for each deleted row (`it()` blocks, page-object methods, whole spec files), and the suites removed and written by `reset-suites`
- workbook commands: the `--dry-run` counts of `npm run smoke` and `npm run regression` (candidates, implemented, missing, excluded, selected, coverage), and the two commands to run, kept apart from anything verified on a device
- the handoff file path (for iOS, the `-ios` file)
- scripts: installed, already up to date, or skipped (and why)
- **the run command, in a fenced code block, with one line saying what it does**, and the optional flags (`-Ids`, `-AiNotes`, `-HandoffRepairs`, `-DryRun`, `-NoReport`). In a workbook update, say that the run creates the new version's output workbook with the unchanged rows' results carried over and runs only the new and changed rows, and give the optional regression command. For iOS, say instead that the scripts do not cover it and to run the iOS spec directly with `npm run test:ios -- --spec <file>` (results are not written to the output workbook)

# Example

## Request

"Automate story US003."

## Clarification

The request names the story but neither the platform nor the workbook, so ask first: "Android or iOS?" and "Which workbook is US003 in?", offering the workbooks found in the testcase input folder. Start only after the user answers.

## Recommendation

The story spec and 5 `it()` tests already exist. Two workbook rows are new, and one row's expected result changed.

| Test Case ID                 | Decision | Action                                                                |
| ---------------------------- | -------- | --------------------------------------------------------------------- |
| TC_US003_001 to TC_US003_003 | Keep     | Left untouched                                                        |
| TC_US003_004                 | Change   | Assertion updated to the new expected result                          |
| TC_US003_005                 | Add      | `it()` added to the existing `US-003. Mobile Number Login.test.ts` spec |
| TC_US003_006                 | Blocked  | The device cannot show the state without submitting a live order      |

`npm run typecheck` and `npm run lint` pass. No test was run. Handoff written to `automation-handoff/US003.md`. Run scripts were already in `scripts/`. Run this to execute the story and update the workbook:

```powershell
.\run US003 -Type first
```

## Workbook update example

`LoginAuthenticationV1.xlsx` was automated and run. `LoginAuthenticationV2.xlsx` arrives with a Test Case Type column. The skill asks platform, workbook (V2) and scope (all stories), sees the column, and asks: "Which output workbook holds the previous version's results?" The user picks `Android-LoginAuthenticationV1.xlsx`. The diff says:

| Test Case ID | Type                    | Plan   | Action                                                                  |
| ------------ | ----------------------- | ------ | ----------------------------------------------------------------------- |
| TC_US002_003 | modified                | Change | Assertion updated to the new expected result                            |
| TC_US003_008 | deleted                 | Delete | `it('TC_US003_008: ...')` and a page-object method only it used removed |
| TC_US003_009 | existing, steps changed | Check  | User: treat as modified; step added                                     |
| TC_US003_015 | missing from V2         | Check  | User: delete; `it()` removed                                            |
| TC_US003_017 | new                     | Add    | `it()` added to `US-003. Mobile Number Login.test.ts`                   |
| all others   | existing                | Keep   | Untouched                                                               |

Type-checked and linted, handoffs updated, `reset-suites` removed the V1 suites under `suites/LoginAuthenticationV1/android/` and wrote `US001.json` to `US003.json` under `suites/LoginAuthenticationV2/android/`. Run this to create `Android-LoginAuthenticationV2.xlsx` (unchanged rows keep their V1 results) and run the new and changed rows:

```powershell
.\run -Type first -Workbook "LoginAuthenticationV2" -Previous "Android-LoginAuthenticationV1.xlsx"
```

## Code Suggestion

See `assets/testcase-method-template.md` for the `it()` shape.
