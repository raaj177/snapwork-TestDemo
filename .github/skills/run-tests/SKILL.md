---
name: run-tests
description: Give the exact short command to run the mobile automation in <WorkspaceRoot>/Automation by story and run type (first, pass/regression, fail/rerun failures, full), and run it when asked. Use when the user asks how to run the project, run a story (US001, US002, ...), run regression, rerun failures, run specific testcase IDs, rebuild the output workbook after a workbook change, or wants the run command.
---

# Run the automation

Project folder: the mobile framework, `<WorkspaceRoot>/Automation` (platform Mobile) or `<WorkspaceRoot>/Automation/Mobile` (platform Mobile + Web), built by `automation-setup`; `implement-testcases-v2` installs the run scripts. Below, `Automation` means that folder. Workbooks (`testcase/Testcases/`, `testcase/Output Testcases/`) are in `<WorkspaceRoot>/Automation/testcase/` in both layouts: with Mobile + Web that folder is shared by both frameworks (not `Automation/Mobile/testcase/`). The Playwright framework in `Automation/Web` has no run scripts yet: there, give `npx playwright test --grep "<ID>:"` (or `npm test`) run from `Automation/Web`.
Entry point: `Automation/run.cmd` → `scripts/run.ps1` → `scripts/run-tests.ps1` (a forwarder `run.cmd` in the workspace root makes `.\run` work there too). `run.cmd` bypasses the execution policy, so it works where PowerShell scripts are disabled; never add a `run.ps1` next to it.

If `Automation/run.cmd` does not exist, the framework or the run scripts are not installed yet: say so and point to the `qa-automation-orchestrator` (or `implement-testcases-v2`) instead of giving a command.

## Command

```powershell
cd <WorkspaceRoot>\Automation
.\run <stories> -Type <type> [options]
```

Stories are plain words before the options (`US001 US002`); none = every story. `-Type` defaults to `full`.

| Option | Meaning |
| --- | --- |
| `-Type first` | Rows never run (Not Executed) |
| `-Type pass` | Regression: rows currently Pass |
| `-Type fail` | Rows currently Fail or Skip |
| `-Type full` | Every in-scope row (default) |
| `-Ids TC_US002_006,TC_US002_007` | Only these testcase IDs (still filtered by `-Type`; use `full` to force) |
| `-Workbook <name>` | Input workbook in `testcase/Testcases/`; needed only when there is more than one |
| `-Previous "<Platform>-<workbook>.xlsx"` | The input workbook was edited: rebuild the output workbook, keeping results of unchanged rows |
| `-Retries 0` | Reruns of a failed test for this run (default 2 = 3 attempts). `0` is fastest when failures are already known |
| `-DryRun` | Show which rows would run; run nothing |
| `-NoReport` | Skip building and opening the Allure report |
| `-AiNotes` / `-HandoffRepairs` / `-NoUpdate` | Passed through to `run-tests.ps1` |

A real run clears `allure-results`/`allure-report`, checks device + Appium + typecheck/lint, runs the rows on the device in `.env` (`DEVICE_UDID`), writes Automation Status/Remark to `testcase/Output Testcases/<Platform>-<workbook>.xlsx`, then builds and opens the Allure report (with `logger/` and `Screenshots/`). Open the latest report again with `npm run report:open`.

## Examples

| Goal | Command |
| --- | --- |
| One story, everything | `.\run US001 -Type full` |
| Several stories | `.\run US001 US002 -Type full` |
| Rerun only failures | `.\run US002 -Type fail` |
| Regression of every story | `.\run -Type pass` |
| First run of new rows | `.\run -Type first` |
| One testcase | `.\run US002 -Type full -Ids TC_US002_006` |
| Preview without running | `.\run US001 US002 -Type fail -DryRun` |
| After editing the input workbook | `.\run US002 -Type full -Previous "Android-<workbook>.xlsx"` |

## Workbook commands (simplest)

From the framework folder (full contract: `automation-setup/references/workbook-commands.md`):

```powershell
npm run smoke -- "<Approved Workbook>.xlsx"
npm run regression -- "<Approved Workbook>.xlsx"
npm run regression -- "<Approved Workbook>.xlsx" US002 US003
npm run smoke -- "<Approved Workbook>.xlsx" --dry-run
```

- They select from the approved workbook (smoke: implemented active P0 candidates, partial coverage allowed and labelled; regression: all implemented candidates, or the given stories), check the device (one online device auto-detected, app installed and open at its start screen, awake, unlocked, ports free), run with one worker and 0 retries, and write a report per run: `report/runs/<RUN_ID>/`, `report/<RUN_ID>.zip`, dashboard `report/index.html`. The workbook is not updated (add `--update-workbook` to update it).
- Exit codes: 0 passed, 1 failures, 2 usage/selection, 3 preflight, 4 missing results, 5 report failed, 6 `--strict` incomplete smoke, 7 lock. Quote the printed reason. On 7 with a stale lock, tell the user to confirm no run is active and delete `test-results/runs/.lock`; never delete it or kill a process yourself.
- Use `--dry-run` to answer "what would run". Run for real only when the user asks.
- The strict release gate is still `npm run smoke:run` (below); `npm run smoke` is for running what exists.

## P0 smoke build gate

For "run smoke", "run the P0 suite", "is this build OK" or a build decision, use the smoke tooling, not `.\run` (full logic: `implement-testcases-v2/references/p0-smoke.md`). From the framework folder:

```powershell
npm run smoke:check -- --workbook "<approved file name>"
npm run smoke:run -- --workbook "<approved file name>" --platform android
```

- `smoke:check` is read-only: it prints `COVERAGE COMPLETE` or the missing, duplicated, stale or mismatched P0 IDs. Run it first and report what it prints.
- `smoke:run` runs only the workbook's eligible P0 cases, then writes `reports/smoke/<WorkbookName>/<BuildId>/` (`run-record.json`, `results.csv`, Allure results, `summary.md`) and updates the output workbook by testcase ID. Add `--build-id <id>` to use the CI build's ID.
- When coverage is incomplete, `smoke:run` refuses to run. Offer `--partial` only for investigation, and say plainly that the result is `PARTIAL - INCONCLUSIVE` and cannot ACCEPT or REJECT the build.
- Report the decision exactly as `run-record.json` states it: ACCEPT (complete coverage, all P0 pass), REJECT (a P0 test failed; investigate it before calling it a product defect) or INCONCLUSIVE (incomplete coverage, partial run, environment Skip, Blocked, or a missing result). Never work out or soften the decision yourself.
- After a REJECT, offer the `smoke-bugs-to-jira` skill to triage the failures and raise Jira bugs; never file bugs from the decision alone.
- If the `smoke:*` scripts are missing, the framework lacks the smoke foundation: point to `implement-testcases-v2` / `automation-setup` instead of improvising a run.

## Shareable report

For "share the report", "make a report I can send" or "report per epic": from the framework folder run `npm run report:share` (latest run of each type) or `npm run report:share -- --source archive` (latest-outcome snapshot of all archived runs). It builds `report/` (dashboard, `smoke/`, `regression/index.html` listing every epic, `regression/<WorkbookFolder>/` = one Allure report per epic with all its stories, `README.md`, `report-scope.json` and a ZIP) from saved results, without rerunning anything (`automation-setup/references/share-report.md`). Report the warnings it prints (ambiguous classification, partial coverage, omitted screenshots) as they are; share only the ZIP.

## How to answer

1. Map the request to story IDs and one `-Type`; give the `cd` line and the single `.\run ...` line.
2. If unsure what would run, execute it with `-DryRun` and report the selected IDs.
3. Run it for real only when the user asks. Run it in the background with `-NoReport` (`report:open` keeps a web server running and the task never ends), then run `npm run report` and give the user `npm run report:open`. A run takes minutes per row; report the `[ROW DONE]` results and the workbook update honestly.
4. If preflight fails (no device in `adb devices`, `DEVICE_UDID` mismatch, Appium, typecheck), quote the ERROR line and the fix; see `Automation/docs/troubleshooting.md`. "No longer matches its output workbook" means the input workbook was edited: check the changed rows against the specs and test data, then use `-Previous`. Close the workbooks in Excel first, or the rebuild cannot write.
