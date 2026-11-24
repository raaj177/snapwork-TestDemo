# Workbook Commands: `npm run smoke` and `npm run regression`

Contract for the two short, workbook-based run commands every framework built by this skill gets, with an automatic shareable Allure report per run. Build them at bootstrap (tooling, docs, device-free tests). In an existing project, `implement-testcases-v2` adds what is missing. They sit next to the existing commands and change none of them: `.\run ...` (the Android run scripts that write the output workbook), `npm run smoke:run` (the strict complete-coverage P0 gate) and `npm run report:share` (cross-run snapshots) keep working as before.

## 1. Commands

```powershell
npm run smoke -- "<Approved Workbook>.xlsx"
npm run smoke -- "<Approved Workbook>.xlsx" --dry-run
npm run regression -- "<Approved Workbook>.xlsx"
npm run regression -- "<Approved Workbook>.xlsx" US002 US003
npm run regression -- "<Approved Workbook>.xlsx" US002 US003 --dry-run
```

| Option | Meaning |
| --- | --- |
| first positional (required) | approved workbook: a file name in `testcase/Testcases/`, or a path that resolves inside it |
| further positionals | regression only: story IDs (`^US\d+$`, case-insensitive) |
| `--dry-run` | selection and preflight report only; no device session, no report |
| `--retries <0-5>` | default **0** for these commands (the project default of `.\run` is untouched) |
| `--strict` | smoke only: exit non-zero when coverage is incomplete (the full gate is still `smoke:run`) |
| `--update-workbook` | also write results into the output workbook through `testrun.py update` (default: workbook results untouched) |
| `--platform android\|ios\|web` | only when the framework supports more than one; default from `PLATFORM` |

Any other argument, a second workbook, an option without its value or a story ID in a smoke command stops with exit 2 and the usage text. Code in `scripts/run/` (`cli.mjs` plus modules, plain Node, no new dependency, every function logs per "Method rules"); the npm scripts are `"smoke": "node scripts/run/cli.mjs smoke"` and `"regression": "node scripts/run/cli.mjs regression"`. Every child process is started with an argument array (`spawn(cmd, args, { shell: false })`): a workbook name or grep pattern is never concatenated into a shell string.

## 2. Workbook and testcase selection

- **Workbook.** Required. Resolve against `testcase/Testcases/` (shared folder rules as elsewhere). Reject: a missing file, a path outside that folder (after resolving `..` and symlinks), a non-`.xlsx`, a `~$` lock file, or a name that matches more than one file. Names with spaces are fine.
- **Reader.** Reuse the project's workbook reader (the one `smoke:generate` uses); never a second parser with different rules.
- **Identity.** A testcase is identified by **ID and exact title within this workbook's scope**. IDs may repeat across epics/workbooks, so an implementation is the regression `it()` (Web: `test()`) whose title is exactly `<ID>: <workbook title>`, found in this workbook's regression folder `src/tests/regression/<WorkbookFolder>/` (the workbook file name without `.xlsx`; the whole `src/tests/regression/` only when that folder does not exist yet). While the folder exists, an exact ID + title match outside it is reported as `MISPLACED` and not run until it is moved (implement-testcases-v2 `references/regression-layout.md`). A folder or file without a matching `it()` is never counted as implemented. Same ID with another title → excluded as `title-mismatch`. The same ID + title in two specs → stop (exit 2, `AMBIGUOUS`).
- **Smoke selection:** active rows (not `deleted` / `invalidated`) with Automation Candidate = Yes and Priority = P0, across every story worksheet, that have an implementation. Equivalent to the smoke manifest's eligible set, but computed fresh from the workbook and specs (the manifest is never counted as executable coverage).
- **Regression selection:** every active Automation Candidate = Yes row with an implementation, in every story of the workbook, or only the stories given. A story ID that does not exist in the workbook stops with exit 2.
- **Never selected:** rows `Blocked` in the handoff (`automation-handoff/<story>.md`), `it.skip` / `test.skip` / `xit`, pending tests (no body), `BlockedError`-only tests, rows without an implementation. No placeholder test is ever created.
- **Printed before anything runs** (and written to the run's metadata):

```text
Workbook   : <file name>  (sheets: 4, stories: US001 US002 US003 US004)
Type       : smoke | regression [US002 US003]
Candidates : 18   eligible rows in scope
Implemented: 15   real it() with exact ID + title
Missing    : 3    TC_US003_004 (no it()), TC_US004_002 (Blocked: <reason>), ...
Excluded   : 2    TC_US002_009 (title-mismatch), TC_US002_011 (it.skip)
Selected   : 15   -> run <RUN_ID>
Coverage   : INCOMPLETE (3 eligible cases not executable)  |  COMPLETE
```

  Smoke with missing cases still runs the implemented ones (partial), labelled `INCOMPLETE COVERAGE` in the terminal, `run.json`, the report and the dashboard. With `--strict` it exits 6 instead of running.

## 3. Configuration and preflight (Android)

- **Configuration precedence:** process environment > `.env` > `config/env.ts` defaults. Print the source of each non-secret value used (`DEVICE_UDID: process env`, `APP_PACKAGE: .env`).
- **Device:** `adb devices` (argument array). An explicit **process** `DEVICE_UDID` is honoured and must be online. Otherwise exactly one online device is used and passed to the run as `DEVICE_UDID`, even when `.env` holds another (stale) ID: print `".env DEVICE_UDID <masked> is not connected; using the only online device <masked>"`. None online, or `unauthorized` / `offline` only → exit 3 with the fix. More than one online and no process `DEVICE_UDID` → exit 3 listing the masked IDs with the command to choose (`$env:DEVICE_UDID="<id>"; npm run ...`).
- **Device facts** for metadata: model (`getprop ro.product.model`), Android version (`ro.build.version.release`), SDK level. The serial is stored masked only.
- **App installed:** `pm path <APP_PACKAGE>`; missing → exit 3 ("install the build yourself"). Never install.
- **Awake and unlocked:** `dumpsys power` (wakefulness `Awake`) and `dumpsys window` (keyguard not showing). Asleep or locked → exit 3 ("wake and unlock the device"). Never send a wake, unlock or swipe key.
- **Starting screen:** the app is in the foreground (`dumpsys activity activities`, resumed activity's package = `APP_PACKAGE`); when `START_ACTIVITY` is configured, also that activity. Otherwise exit 3 ("open the app at its start screen"). The first test's own launch check then verifies the actual screen.
- **App state retained:** no `clearApp`, no reinstall, `appium:noReset: true`, `appium:fullReset: false` for these commands; tests whose precondition needs a fresh launch keep calling `freshLaunch` themselves.
- **One worker**, retries 0 unless `--retries` is given.
- **Ports:** check the Appium port and `appium:systemPort` (and any other port the config uses) with a TCP connect to `127.0.0.1`. In use → exit 3 naming the port and how to find the owner (`netstat -ano | findstr :<port>` / `lsof -i :<port>`). Never kill a process.
- **Remote / grid devices:** not supported by these commands unless the framework already has a working remote config; then preflight skips the local checks and says so.
- **iOS:** until an iOS preflight (booted simulator or paired device via `xcrun`, app installed, unlocked) exists in the project, the commands stop with exit 3 and point to `npm run test:ios -- --spec <file>`.
- **Web:** no device preflight; check `BASE_URL` is set and reachable (one HEAD/GET), Playwright browsers installed, one worker, retries 0.

`--dry-run` runs the selection and the preflight checks that do not change anything (device list, app installed, awake, foreground, ports) and prints them; it never starts a session.

## 4. Terminal logging

- Framework `Logger` at `info` on the console, live: method/step messages, `[TEST START]` / `[TEST END]`, and screen-wait outcomes (`Login screen shown after 2.3 s`, `... not shown within 15 s`). Use the existing Logger and Redactor; file logs and per-test `Logger` attachments are unchanged.
- WebdriverIO `logLevel: 'warn'` (Playwright: the `list` reporter) for these commands, so raw WebDriver polling is hidden while warnings and errors stay. Worker output streams live (no `outputDir` buffering of worker stdout for these commands); the spec reporter summary prints at the end.
- Never print credentials or typed values (secrets are already hidden by `type(..., true)`; identifiers via `maskValue`).
- Do not claim that every method is instrumented: the final report says which layers log (pages, services, hooks) as checked.

## 5. Run isolation and safety

- **Run ID:** `<type>-<yyyyMMdd-HHmmss>-<4 random hex>` (`smoke-20261118-101530-a3f9`).
- **Run folder:** `test-results/runs/<RUN_ID>/` holding `allure-results/`, `junit/`, `results.csv`, `logs/`, `run.json` (non-secret: runId, type, workbook, stories, selected / missing / excluded IDs, retries, platform, device model and OS, masked serial, app package and version, environment, startedAt, finishedAt, timeZone, runner exit code, config sources). Never cleared afterwards and never mixed with another run.
- **Configurable outputs:** the wdio / Playwright config reads `ALLURE_RESULTS_DIR`, `JUNIT_DIR`, `AUTOMATION_RESULTS_FILE` and `LOG_DIR`, defaulting to today's paths (`allure-results/`, `test-results/junit/`, ...), so `.\run`, Jenkins and `test:*` behave exactly as before.
- **Labels:** every result carries the shareable-report labels (`share-report.md` section 2) with `EXECUTION_TYPE` = `smoke` / `regression` and `RUN_ID` = the run ID.
- **Selection passed safely:** one spec list and one grep pattern built from validated IDs (`^TC_[A-Za-z0-9_]+$`) as `(?:^|\s)(?:TC_A|TC_B):` (Mocha and Playwright match the full title, `<describe names> <ID>: <title>`, so never anchor the ID at `^` alone), passed as separate arguments (`--spec`, `<file>`, `--mochaOpts.grep`, `<pattern>`) with `shell: false`.
- **Lock:** `test-results/runs/.lock` (pid, runId, command, startedAt) created exclusively before preflight and removed in `finally`. A lock held by a running process → exit 7 ("another run is in progress: <runId>"). A lock whose pid is not running → exit 7 with the recovery: "stale lock from <runId> (<time>): confirm no run is active, delete `test-results/runs/.lock`, run again". Never deletes a lock on its own and never kills a process.
- **Missing results:** after the run, every selected ID without a result row is listed as `NO RESULT` and the run is `INCOMPLETE` (exit 4 even when the runner exited 0).
- **Exit codes:** 0 all selected passed with results; 1 runner reported failures; 2 usage / selection error; 3 preflight failed; 4 missing results; 5 report generation failed (only when nothing worse happened; the runner's failure code always wins); 6 `--strict` smoke with incomplete coverage; 7 lock held or stale.
- **Safety:** these commands run what the workbook selects; they never add OTP, payment, lockout or other sensitive tests to prove that the tooling works. Existing rules stay: sensitive flows need the user's approval and lockout tests a separately approved disposable account. Validating the tooling uses `--dry-run` and the device-free tests only.

## 6. Automatic report per run

After the runner finishes (pass or fail), the command builds that run's report from `test-results/runs/<RUN_ID>/` only, with the share-report builder (`share-report.md`): sanitized copies, local Allure CLI, `--single-file` when supported, neutral categories, **Regression** never "Normal", no edits to generated HTML, no historical results merged in.

```text
report/
  index.html                         dashboard: completed runs newest first, then snapshots
  runs/
    <RUN_ID>/
      index.html                     run summary (generated, not Allure)
      report-scope.json
      README.txt
      smoke/index.html               smoke run: one Allure report
      regression/index.html          regression run: lists every epic (workbook) in the run
      regression/<WorkbookFolder>/index.html   ONE Allure report with all of that epic's user stories
  <RUN_ID>.zip                       presentation files of that run only
  snapshots/<SnapshotId>/...         written by npm run report:share (unchanged contract)
```

- One folder per epic: `<WorkbookFolder>` is the run's workbook file name without `.xlsx`; its one Allure report holds every executed story of that workbook (Behaviors: epic → story → testcase, from the `epic` / `feature` labels, `share-report.md` section 2). Story IDs come from the executed results' `storyId` labels; a selected story with no result is listed on the epic row as "selected, no result". A run of only some stories is labelled "Partial epic: <n> of <m> stories". No per-story report folders.
- No result at all → no Allure report is generated; the run page and dashboard show "No testcase results were produced" with the runner exit code, and the command exits non-zero. Some results missing → the available evidence is published with an `INCOMPLETE RUN` warning and the missing IDs; exit 4.
- `report-scope.json` per run: workbook, type, stories, selected IDs, observed result rows, retried attempts, distinct testcases, missing IDs, excluded IDs with reasons, status totals, per-epic summary with its per-story summaries, coverage limitation (smoke `INCOMPLETE COVERAGE`), date range and time zone, runner exit code, omitted diagnostics.
- `README.txt`: how to open (extract the ZIP, open `index.html`; whether `file://` opening was verified or a local server is needed), what was omitted, that raw artifacts in `test-results/runs/<RUN_ID>/` are private and never shared wholesale, that an assertion failure is not a confirmed defect.
- **Privacy:** presentation copies exclude raw driver steps, logs, parameters, stack traces, page sources and unreviewed screenshots/attachments; configured secrets (the Redactor's list and every `.env` key whose name contains PASS, PIN, OTP, TOKEN, SECRET, KEY) are redacted from retained metadata. The raw run folder stays local and is never put in a ZIP. Nothing is uploaded.
- **Dashboard** (`report/index.html`, rebuilt from every `runs/*/report-scope.json` and `snapshots/*/report-scope.json` after each run): per run the type, workbook, actual date range, status counts, missing results, coverage warning and relative links to the run page and its ZIP; the newest run first, earlier runs marked "historical". Relative links only, responsive plain HTML, no external resources.
- **ZIP** `report/<RUN_ID>.zip`: that run's presentation files (`runs/<RUN_ID>/**`) with the folder structure kept, plus a copy of the dashboard entry page that links to it; nothing from `test-results/`.
- The builder refuses to write outside `report/`, and never deletes another run's folder or ZIP.

## 7. Documentation

`docs/run-commands.md` (linked from the framework README) states: the exact commands, story filters, `--dry-run`, prerequisites and device readiness (device connected and authorized, awake, unlocked, app installed and open at its start screen), configuration precedence and the stale-`.env` device rule, retries 0 and one worker, which cases are never selected and what partial coverage means, output paths (`test-results/runs/<RUN_ID>/`, `report/`), how to share (the run's ZIP only), the exit codes, lock recovery, and the privacy limits. `README.md` shows the five commands at the top.

## 8. Device-free tests and validation

`npm run run-commands:test` (Node's built-in `node --test`, fixtures under `scripts/run/__tests__/`) covers: argument parsing including workbook names with spaces; unknown options, missing values, extra workbooks, story IDs in smoke, unsafe and out-of-folder paths; single / multiple / no / unauthorized device lists and the stale-`.env` rule (with a fake `adb` runner); an occupied port rejected and no process killed (a real listening socket in the test); ID + title matching across two workbooks with repeated IDs, title mismatch and ambiguous duplicates; counts (candidates, implemented, missing, excluded, selected) and missing-result detection; latest-outcome and retry counting inside one run; secret redaction and removal of logs, stacks, parameters and page sources; exit-code precedence; smoke report generation and regression grouped into one report per epic with all its stories (two workbooks → two epic folders, partial-epic label, links with spaces) from synthetic Allure results; ZIP entries; dashboard links resolving.

Bootstrap validation: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run run-commands:test`. When an approved workbook exists (implement-testcases-v2, not bootstrap): `npm run smoke -- "<file>" --dry-run` and `npm run regression -- "<file>" --dry-run`, reporting the printed counts. Open a generated report page in a browser only when a real run produced one. Device runs only with the user's explicit approval. Always separate what was verified (tooling, dry runs, device-free tests) from what was not executed (device behaviour).
