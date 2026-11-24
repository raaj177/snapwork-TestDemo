# Run Scripts: install them and print the command

> `testcase/` below is the project's workbook folder: the framework's own `testcase/` (flat Mobile) or the shared `Automation/testcase/` (Mobile + Web; `../testcase/` from `Automation/Mobile`). `scripts/testrun/common.py` resolves it (`TESTCASE_DIR`, else own, else `../testcase/`).

Load before the closing steps of every run (in a workbook update, before its diff step). The scripts are Android only. They replace the manual execute step: they prepare the canonical output workbook, pick the rows, build the suite, run it on the device, write the workbook and refresh `passed/` and `failed/`. This skill installs them and prints the command; it never runs the tests.

## 1. Install into the automation project

Source: the skill's `scripts/` folder (`run-tests.ps1`, `run.ps1` and `testrun/`). Destination: the automation project's `scripts/` folder, the one that already holds `start-appium.ps1` and `stop-appium.ps1`.

Also copy `run.cmd` from the skill's `scripts/project-root/` into the automation project's root folder (next to `package.json`). `run.cmd` starts `scripts/run.ps1` with the execution policy bypassed, so `.\run` works where PowerShell scripts are disabled. Never put a `run.ps1` in the project root: PowerShell resolves `.\run` to a `.ps1` before a `.cmd` and stops with "running scripts is disabled on this system". `scripts/run.ps1` passes its options to `scripts/run-tests.ps1`, labels the run (`EXECUTION_TYPE=regression`, `RUN_ID=regression-<time>`), clears `allure-results/` and `allure-report/` before a real run, archives the run's raw results and a `run.json` to `test-results/allure-archive/<RunId>/` afterwards (used by `npm run report:share`), and builds and opens the Allure report afterwards (`npm run report`, `npm run report:open`). The same install rules apply to these two files.

| Situation | Action |
| --- | --- |
| Destination file missing | Copy it from the skill |
| Destination file identical to the skill's | Leave it, report "up to date" |
| Destination file differs | Do not overwrite. Report the file and ask once whether to replace it. The project copy may have been edited on purpose |
| `scripts/start-appium.ps1` or `stop-appium.ps1` missing | Do not create them. Tell the user `run-tests.ps1` needs them to start a local Appium, unless the wdio config starts Appium itself (`@wdio/appium-service`) or the run uses `-NoAppium` with Appium started by hand |

Never copy `__pycache__`. Never edit the project's TypeScript code to suit the scripts. They work with the existing `ResultWriter`, the results CSV (`AUTOMATION_RESULTS_FILE`) and the `it('<ID>: <title>')` title convention as they are.

## 2. Check the prerequisites (read only)

- `python --version` works and `python -c "import openpyxl"` succeeds. If not, tell the user to run `pip install openpyxl`.
- Node.js and npm are on the PATH (`node --version`, `npm --version`) and the project's packages are installed (`node_modules/@wdio/cli` exists), because the run command uses them. If not, say so; do not install them.
- The canonical output workbook resolves: `Output Testcases/Android-<name>.xlsx`, or the older un-prefixed `<name>.xlsx`. The script creates it from the input workbook on the first run if neither exists (in a workbook update, with the unchanged rows' results carried over from the previous output workbook given with `-Previous`).

- **Device:** `adb devices` lists exactly one device in `device` state. `unauthorized` or `offline` means the user must re-authorize USB debugging (unlock, replug, tap Allow). Say so, stop device inspection, and re-run `adb devices` when the user says it is connected. Never carry on as if the screen was inspected.
- **Device ID:** `DEVICE_UDID` in the (Git-ignored) `.env` equals the ID from `adb devices`. A stale or empty ID fails every session, and the script stops on it. Fix the local `.env` and tell the user; never put a real ID in `.env.example`.
- **Android SDK:** `ANDROID_HOME` or `ANDROID_SDK_ROOT` is set, or `scripts/start-appium.ps1` falls back to `%LOCALAPPDATA%\Android\Sdk`. Without it Appium fails every session with "Neither ANDROID_HOME nor ANDROID_SDK_ROOT environment variable was exported". Add the fallback to the project's `start-appium.ps1` when missing.
- **Number of input workbooks:** count the `.xlsx` files in `testcase/Testcases/` (leave out `~$` lock files). When there is more than one, every printed command must carry `-Workbook "<full file name of the confirmed workbook>"`; otherwise the script stops with "More than one input workbook". Use the full file name, quoted, even when it has spaces.
- **Input workbook:** the workbook the user named lives in `testcase/Testcases/`. If it is elsewhere (for example Downloads), copy it there without overwriting, because the script only reads that folder.

Report any gap in the output. Do not install tools yourself, except the two project-local fixes above (`.env` device ID, `start-appium.ps1` fallback).

## 3. Which command to print

Use the workbook status and the work just done. Replace `<story>` with the confirmed Story ID. **Always print the short form `.\run <stories> -Type <type>`**, run from the automation project folder: stories are plain words separated by spaces (`.\run US001 US002 -Type full`), every other option keeps its dash (`-Type`, `-Ids`, `-Workbook`, `-Previous`, `-DryRun`, `-AiNotes`, `-HandoffRepairs`, `-NoUpdate`, `-NoReport`). Several IDs are separated by commas (`-Ids TC_US001_006,TC_US001_009`). Precede it with a `cd` line to the automation project. Only when `run.ps1` is missing and could not be installed, fall back to `powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1` with `-Story US001,US002` (commas, no spaces).

| Work just done | Run type | Command |
| --- | --- | --- |
| Implemented a story, added rows, or re-checked Blocked rows | first run | `.\run <story> -Type first` |
| Workbook update (`workbook-update.md`): code brought in line with the new version | first run of the new version | `.\run -Type first -Workbook "<new input workbook>" -Previous "<previous output workbook>"`. Optional afterwards: `.\run -Type pass -Workbook "<new input workbook>"` (regression of the carried-over passes) or `-Type full` (every row again) |
| Fixed `Open` repairs found by an earlier run | rerun what was running: use `first` if those rows are `Not Executed`, otherwise `full` | same command with that type |
| Fail review with `Rerun needed = Yes` | rerun failures | `.\run <story> -Type fail` |
| User asked for a regression of what passes | regression | `.\run -Type pass` (put story IDs before `-Type` to limit it) |
| User asked for everything again | full rerun | `.\run <story> -Type full` |
| User asked to rerun one or a few rows | same type, limited to those IDs | add `-Ids TC_US001_006,TC_US001_009` to the command (still filtered by `-Type`; use `-Type full` to run an ID whatever its status) |

**Check the canonical output workbook before choosing the type.** `first` selects only rows whose Status is `Not Executed`. If `Output Testcases/Android-<name>.xlsx` already exists with those rows at `Fail`, `Skip` or `Pass` (a run happened earlier), `first` selects 0 rows and prints "Nothing to run". Read the Status column and print `fail` (or `full`) instead. `fail` selects `Fail` and `Skip` rows; environment failures (no session, a frozen UI server) are written as `Skip`, so after an environment fix the right command is `-Type fail`.

If the scope was "all stories", leave the story IDs out. **If `testcase/Testcases/` holds more than one input workbook (for example V1 and V2), always add `-Workbook "<name>"`** with the confirmed workbook's full file name: without it the script stops with "More than one input workbook" rather than guess. In a workbook update the canonical output workbook of the new version does not exist yet, so do not read its Status column: print `first` with `-Previous`.

Print the command in a fenced `powershell` block, then one line on what it does, then the optional flags:

- `-DryRun` builds and checks the suite and prints the `npx wdio run ... --spec ... --mochaOpts.grep ...` line, but runs nothing on the device
- `-AiNotes` adds a one-line AI note to Fail rows
- `-HandoffRepairs` adds element-not-found failures to the handoff "Repairs needed" table, so the next implement run can fix them
- `-NoUpdate` runs the tests but leaves the workbook alone
- `-Retries <0-5>` (`.\run` only) sets TEST_RETRIES for this run: `-Retries 0` gives each failing row one attempt instead of three, the fastest choice when the failures are already known
- `-NoReport` skips building and opening the Allure report (use it when the run is started in the background: `report:open` keeps a web server running until stopped)
- `-Previous "<output workbook>"` (workbook update) carries the unchanged rows' results from that earlier version's output workbook into the new one when it is created; ignored once the new output workbook exists

## 4. What the user should expect

- The script stops before running if no device is online, `DEVICE_UDID` in `.env` is empty or not that device, Node.js/npm or the project's `node_modules` are missing, Appium cannot be reached, or the project does not pass `npm run typecheck` and `npm run lint`.
- The run is `wdio run config/wdio.android.conf.ts --spec <story spec> --mochaOpts.grep "(?:^|\s)(?:<ID1>|<ID2>):"`, with `PLATFORM=android` and `AUTOMATION_RESULTS_FILE` set to the run's own CSV under `test-results/automation-results/`. Appium is started with `scripts/start-appium.ps1` (and stopped afterwards) only when it does not already answer and the wdio config does not start it itself.
- Before selecting rows the script prepares the output workbook: creates it on the first run of an input workbook (with `-Previous`, carrying over the unchanged rows' results), and stops with "no longer matches its output workbook" when the input workbook was replaced under the same name. That message means a workbook update is due: bring it back to this skill.
- The workbook gets each result in the row of its own story tab, and only in two columns: **Automation Status** (Pass, Fail, Skip, Blocked) and **Automation Remark** (the run's actual result - observed value or failure reason - then ` | ` and the remark: evidence path, attempt history, review flags). Status and Actual Result are left as they are; only a sheet without an Automation Status column gets the result in Status. Row selection reads Automation Status when it is filled.
- After the workbook is written, the script rebuilds both status suites for every story, whatever `-Story` or `-Ids` the run had: `suites/<name>/android/passed/` from the rows now `Pass`, and `suites/<name>/android/failed/` from the rows now `Fail` or `Skip`. A folder with no row of its status is emptied. Nothing is refreshed when the workbook was not written (`-DryRun`, `-NoUpdate`, a failed update).
- Rows the handoff lists `Blocked` are never run. Rows with an `Open` repair are left out and listed. Rows whose Test Case Type is `deleted` are never run.
- If any selected row has no result, nothing is written to the workbook and the results CSV is kept.
- A Fail marked `[NEEDS REVIEW ...]` means an element was not found or a wait timed out (`element ... wasn't found`, `still not displayed`, a `waitUntil` timeout): a stale locator or a product change. Bring those back to this skill with "review the failed testcases".
- A Fail whose message is a session or device error (`session not created`, `Failed to create session`, `invalid session id`), or shows the UI server stopped answering ("Could not proxy command", "instrumentation process is not running", "Appium session creation failed"), is written as Skip (environment), not Fail. Nothing about the app was observed.
- The script frees the UiAutomator2 port (`adb forward --remove`, `UIAUTOMATOR2_SYSTEM_PORT`, default 8200) before the run, so a killed earlier run does not fail the first session.
- As each testcase ends the script prints `[ROW DONE] <n>/<total> <id> <PASS|FAIL|SKIP|BLOCKED> in <s> s at <time>`. The time counts every attempt of the row.
- A failed or frozen test is rerun from the start, up to 3 attempts (`mochaOpts.retries` = 2). Each discarded attempt prints `[ROW RETRY] <id> attempt <n>/<max> failed (<reason>) at <time>`. Only the final attempt reaches the workbook; when it needed more than one attempt, the Automation Remark ends with "Attempt <n> of <max>. Earlier attempts failed: ...", also for a Pass. A row that passes only on a later attempt is flaky: point it out to the user.
- If the final attempt froze, the row is written as Skip with the script's environment note, and the earlier attempts' reasons are only in the console and Allure.

## 5. When the user asks you to run the command

The skill does not run tests on its own. If the user explicitly asks you to run the printed command:

- Run it with `-NoReport` in the background with output redirected to a file (`> test-results/last-run.log 2>&1`), then run `npm run report` yourself and give the user `npm run report:open`, never through `| tail` or `| grep`, which hide progress until the end.
- Never pipe `start-appium.ps1` (or anything that starts Appium) into another command such as `| tail`: Appium keeps the pipe open and the command never moves on. Let `run-tests.ps1` start Appium, or start it on its own line.
- **Report each row as it finishes, not only at the end.** Arm a watch on the log (for example a Monitor on `tail -f test-results/last-run.log | grep --line-buffered -E "ROW DONE|ROW RETRY|Rows written|Spec Files|ERROR"`) and send the user one line per `[ROW DONE]` and `[ROW RETRY]` event: the ID, result or failed attempt, time and clock time. Check the watch fires on the first row; if it delivers nothing, read the log yourself and say so rather than staying silent.
- The per-test failure reason is in `test-results/automation-results/<run>-results.csv` (column Actual Result) as soon as the test ends.
- A single command that takes 30 s or more (`timeout of 30000ms exceeded`, `Could not proxy command to the remote server`) is a UiAutomator2 freeze, not a slow test. The framework fails a frozen attempt at once, retries a frozen launch step up to 2 times and reruns the whole test up to 3 attempts, about 65 s per frozen attempt (`typescript-wdio-standards.md`, Freezes and hangs, Retries). A row that keeps freezing can take 6-7 minutes; do not stop it while `[ROW RETRY]` lines keep coming. Stop the run (kill the `node` processes of this project's wdio run and Appium, and the `powershell` run-tests process) only when no new `[ROW RETRY]` or `[ROW DONE]` line appears for 8 minutes; then find the frozen command in the Appium log (under `logs/`, or where the project's config writes it), fix the cause and rerun. A killed run writes nothing to the workbook.
- Expect each failing test to cost its full wait budget once per attempt, so up to 3 times (see `typescript-wdio-standards.md`, Waits and Retries). Tell the user the expected time up front.
- Before a run on a device that has frozen before, suggest `adb logcat -G 16M` so the device-side cause of a freeze is still in the log afterwards (`AccessibilityManagerService: wait for adding window timeout` points at a device that blocks accessibility queries while a window appears).
- To rerun one row after a fix, use `.\run <story> -Type full -Ids <id>` so the result is written to the workbook. A throwaway `npx wdio run` outside the script writes nothing, and the workbook keeps the old result.

## 6. Not covered by the scripts

- **iOS:** no iOS run script exists yet. Finish the code and the handoff, print no run-script command, and tell the user to run the iOS spec directly with `npm run test:ios -- --spec <file>` (no iOS run script exists yet, so results are not written to the output workbook). This includes an iOS workbook update: `prepare` and `reset-suites` cover Android only.
