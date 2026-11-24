# Mobile Automation Framework (Android + iOS)

TypeScript + WebdriverIO 10 + Appium 4 + Mocha + Allure. Flat layout: this folder is the framework root.

## Workbook run commands

```powershell
npm run smoke -- "<Approved Workbook>.xlsx"
npm run smoke -- "<Approved Workbook>.xlsx" --dry-run
npm run regression -- "<Approved Workbook>.xlsx"
npm run regression -- "<Approved Workbook>.xlsx" US002 US003
npm run regression -- "<Approved Workbook>.xlsx" US002 US003 --dry-run
```

The workbook is a file in `testcase/Testcases/`. Details, prerequisites, exit codes and lock recovery: [docs/run-commands.md](docs/run-commands.md).

## Status at bootstrap

- Built by `automation-setup` in **framework-only mode** (no app yet). `APP_PACKAGE`, `APP_ACTIVITY`, `BUNDLE_ID`, `APP_PATH` and the app display name are **deferred**: they are read from the app build (`aapt dump badging` / `Info.plist`) at the start of the orchestrator's Phase 4 (`scripts/setup-android.ps1 -Apk <apk> -Write` does the Android part).
- No story specs, page objects or sample tests exist yet: `implement-testcases-v2` adds them from the approved workbook.

## Quick start

```powershell
npm ci                       # pinned versions from package-lock.json (Appium drivers included)
copy .env.example .env       # only if .env does not exist; fill in the app values
.\scripts\verify-environment.ps1
npm run typecheck            # the "compile" step, no device needed
npm run lint
npm run test:android -- --spec "src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts"
```

Once implement-testcases-v2 has installed the run scripts: `.\run US001 US002 -Type first|pass|fail|full`.

## npm scripts

| Script | Does |
| --- | --- |
| `typecheck` / `lint` / `lint:fix` / `format` / `format:check` | code quality, no device |
| `test:android` / `test:ios` | `wdio run config/wdio.<platform>.conf.ts` |
| `test:regression` | labelled regression run + raw-results archive (iOS, direct runs) |
| `smoke` / `regression` | workbook run commands with preflight, run folder and per-run report |
| `smoke:generate` / `smoke:check` / `smoke:run` / `smoke:record` | P0 smoke build gate ([src/tests/smoke/README.md](src/tests/smoke/README.md)) |
| `report` | Allure HTML in `allure-report/` + `logger/` + `Screenshots/` |
| `report:share` | shareable `report/` snapshot from saved results |
| `smoke:test` / `run-commands:test` / `report:share:test` / `test-data:test` | device-free tooling tests |
| `clean` | removes generated run output only |

## Where things are

See [docs/framework-architecture.md](docs/framework-architecture.md). Results: `test-results/automation-results/automation-results.csv`, `allure-results/`, `allure-report/`, `logs/`, `screenshots/`; per-run folders `test-results/runs/<RUN_ID>/`; reports `report/`; smoke build records `reports/smoke/<WorkbookName>/<BuildId>/`.

## Jenkins

`jenkins/Jenkinsfile.mobile`: create a **Pipeline** job, "Pipeline script from SCM", **Script Path** `Automation/jenkins/Jenkinsfile.mobile`. Plugins: NodeJS (tool name `NodeJS-24`), JUnit, HTML Publisher, Timestamper, Credentials Binding. The job's agent must be **the machine the phone is attached to over USB** (iOS: a macOS agent with Xcode).

| Parameter | Use |
| --- | --- |
| `TEST_SUITE` | `smoke` (P0 cases), `regression` (all implemented workbook cases, P0 + P1/P2), `integration` (`src/tests/integration/`), `all` (regression + integration) |
| `WORKBOOK` | approved workbook in `testcase/Testcases/` (empty = the only one there) |
| `STORIES` | regression only: `US002 US003` (empty = every story) |
| `SMOKE_GATE` / `SMOKE_PARTIAL` | smoke: the P0 build gate with ACCEPT / REJECT / INCONCLUSIVE (`smoke:run`), partial when coverage is incomplete |
| `RERUN_FAILED` | after **all** tests have run, run the failed ones once more (default `1`; `0` = off); the last attempt is the result, Blocked is never rerun |
| `RETRIES` | immediate retries inside the run (default `0`) |
| `TEST_ID` / `SPEC` | direct run of testcase IDs or one spec (overrides `TEST_SUITE`) |
| `ANDROID_HOME` | SDK folder with `platform-tools/adb` (empty = the agent's variable) |
| `DEVICE_UDID` | phone serial from `adb devices` (empty = the only connected device) |
| `LAUNCH_APP` | bring the app to the foreground before the tests (default on) |
| `APP_PACKAGE`, `APP_ACTIVITY`, `APP_PATH`, `BUNDLE_ID` | app values (empty = from the `.env` file credential) |
| `ENV_FILE_CREDENTIALS_ID` | Jenkins **Secret file** credential holding a complete `.env`; copied for the build, deleted afterwards |
| `NORMAL_USER_CREDENTIALS_ID` | Jenkins **Username with password** credential of the normal test account |

Stages: Checkout → Configuration (`.env` from the credential) → Install (`npm ci`) → Type-check and lint → Appium driver → **Device check** (`npm run ci:device`: serial, model, Android version / SDK, screen awake / locked, installed app version; optionally starts the app) → Tests. The build publishes JUnit, **Run Reports** (`report/index.html`, one report per smoke / regression run), the Allure report (direct runs) and archives `report/`, `test-results/`, `reports/smoke/`, `screenshots/`, `logs/`.

Prepare the phone once: USB debugging authorized for the agent, **Stay awake** while charging (Developer options), no screen lock, the app installed.

## Documentation

- [docs/framework-architecture.md](docs/framework-architecture.md) — workspace, QA pipeline, folders, contracts
- [docs/setup-guide.md](docs/setup-guide.md) — prerequisites, versions, configuration
- [docs/coding-standards.md](docs/coding-standards.md) — method rules (no `private`, every method logs), locators
- [docs/run-commands.md](docs/run-commands.md) — `npm run smoke` / `npm run regression`
- [docs/troubleshooting.md](docs/troubleshooting.md)
