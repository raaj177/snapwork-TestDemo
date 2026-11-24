# testrun - script-based test execution (Android)

Script-based test execution, no AI needed. Needs Python 3 + `openpyxl`, Node.js + npm with the project's
`node_modules` installed, adb, Appium. Nothing here edits TypeScript code.

## One command

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 -Type <first|pass|fail|full> [-Workbook <name>] [-Previous <output workbook>] [-Story US003,US011] [-Ids TC_US003_004,TC_US003_005] [-AiNotes] [-DryRun]
```

| -Type | Runs | Suite built in |
| --- | --- | --- |
| `first` | rows `Not Executed` (and Blocked rows the handoff changed to Implemented) | `suites/<Workbook>/android/first/` |
| `pass` | regression: rows currently Pass | `suites/<Workbook>/android/passed/` |
| `fail` | rows currently Fail or Skip (Skip = environment failure) | `suites/<Workbook>/android/failed/` |
| `full` | every in-scope row that has an `it()` | `suites/<Workbook>/android/full/` |

`<Workbook>` is the input workbook file name without `.xlsx`. Each suite is one story, in the shape of
`suites/templates/story-suite.template.json`: `{"story", "platform", "spec", "ids"}`. `-Ids` limits the run to those
testcase IDs (still filtered by `-Type`). `-Workbook` is required when `testcase/Testcases/` holds more than one input
workbook (for example V1 and V2); the scripts never pick one.

Flow: preflight (Python, Node.js/npm, `node_modules`, `npm run typecheck`, `npm run lint`, device online and equal to
`DEVICE_UDID` in `.env`, Appium reachable) -> prepare the output workbook -> select rows -> build + validate the suites
-> free the UiAutomator2 port (`UIAUTOMATOR2_SYSTEM_PORT`) -> start Appium with `scripts/start-appium.ps1` unless it
already answers, `-NoAppium` is given or the wdio config starts it (`@wdio/appium-service`) ->
`wdio run config/wdio.android.conf.ts --spec <story spec> --mochaOpts.grep "(?:^|\s)(?:<ID1>|<ID2>):"` with `PLATFORM=android` and
`AUTOMATION_RESULTS_FILE=test-results/automation-results/<type>-<stories>-<stamp>-results.csv` (prints
`[ROW DONE] n/total <id> <result> in <s> s` as each row ends, and `[ROW RETRY] <id> attempt n/max failed (...)` for
each failed attempt Mocha reruns; only the final attempt is recorded) -> stop Appium if the script started it -> write
results to the workbook -> refresh the `passed/` (rows now Pass) and `failed/` (rows now Fail or Skip) suites for every
story; a folder with no such row is emptied. `-DryRun` stops before running, prints the `npx wdio` line and writes no
workbook.

## Workbook update (a new version of the input workbook, V1 -> V2)

```powershell
python scripts/testrun/testrun.py diff         --workbook LoginV2 --previous Android-LoginV1.xlsx                    # per ID: type, changed fields, it(), plan
python scripts/testrun/testrun.py reset-suites --workbook LoginV2 --previous Android-LoginV1.xlsx --dry-run          # list old suites to remove, story suites to write
python scripts/testrun/testrun.py reset-suites --workbook LoginV2 --previous Android-LoginV1.xlsx                    # after the user agreed: remove them, rewrite suites/LoginV2/android/<Story>.json
python scripts/testrun/testrun.py reset-suites --workbook LoginV2 --previous Android-LoginV1.xlsx --include-manual   # also remove hand-made diagnostics/ and reruns/ suites (user agreed)
powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 -Type first -Workbook LoginV2 -Previous Android-LoginV1.xlsx
```

- `Test Case Type` column (optional): `new`, `modified`, `existing` (or blank), `deleted` (older name `invalidated`).
  Any other value stops the scripts. Without the column, rows are compared with the previous version field by field
  (title, pre-condition, steps, test data, expected result, Automation Candidate).
- `prepare` (run by `run-tests.ps1` before selecting rows) creates `Output Testcases/Android-<new name>.xlsx` from the new
  input workbook and copies Actual Result, Status, Automation Status and Automation Remark of every unchanged
  Automation Candidate = Yes row from the `-Previous` workbook, plus the Test Data Requirements statuses. New, modified
  and changed rows start Not Executed, so `-Type first` runs only them. Deleted rows are never run. IDs only in the
  previous workbook are dropped and listed. Written to a temp file, verified, then put in place. The previous output
  workbook is never changed.
- Input workbook replaced under the same name: `-Previous` with its own output file name rebuilds that file in place.
  Without it, `prepare` stops when the input workbook no longer matches its output workbook.
- `reset-suites` removes the generated `first/`, `passed/`, `failed/`, `full/` and `cr/` suites of the new workbook's
  folder and of the `--previous` version's folder, removes the previous version's story suites, and rewrites the story
  suites `suites/<new Workbook>/android/<Story>.json` from the new workbook (Android only). Hand-made suites in
  `diagnostics/` and `reruns/` are kept and listed unless `--include-manual` is given.
- Several stories or IDs for `run-tests.ps1` are separated by commas (`-Story US001,US003`); with `powershell -File`
  values separated by spaces are not passed as a list.

## Individual steps (run from `Automation/`)

```powershell
python scripts/testrun/testrun.py prepare --workbook LoginV2 [--previous Android-LoginV1.xlsx] [--dry-run]
python scripts/testrun/testrun.py select --type fail --story US003      # list rows, write test-results/testrun/selected-ids.txt
python scripts/testrun/testrun.py suites --type pass                    # (re)build suites for a run type; lists them in test-results/testrun/suite-files.txt
python scripts/testrun/testrun.py suites --type fail --refresh          # status refresh: empties failed/ when no row is Fail or Skip
python scripts/testrun/testrun.py update --csv <results.csv> --expect-file test-results/testrun/selected-ids.txt [--dry-run]
```

`update` options: `--ai-notes [--ai-max 10]`, `--sync-blocked`, `--handoff-repairs`, `--partial-ok`, `--output-workbook <path>` (testing).

## Rules the scripts enforce

- Rows are matched by exact testcase ID and by header text (never by column letter). Duplicate IDs stop the run.
- A testcase is implemented when one `it()` in the workbook's regression folder `src/tests/regression/<Workbook>/` (all of `src/tests/**/*.test.ts` while that folder does not exist) has a title starting with its ID and a colon
  (`it('TC_US003_001: ...'`). Commented-out lines are ignored. An ID with more than one `it()` is left out and listed;
  a story has at most one smoke spec (its P0 cases, suite `<Story>.smoke.json`) and one regression spec (its P1/P2 cases, suite `<Story>.json`); tests spread over more spec files stop the suite build.
- Only `Automation Candidate = Yes` rows are touched, in their own story tab. Only Automation Status and Automation Remark
  change (Status and Actual Result are left as they are; a sheet without an Automation Status column gets the result in
  Status). Automation Remark holds the run's actual result (observed value or failure reason), then ` | ` and the remark
  (evidence path, attempt history, review flags).
- Selected IDs must all have a result, otherwise nothing is written (`--partial-ok` overrides).
- The results CSV has the header `Test Case ID,Execution Status,Actual Result,Automation Remark,Spec File,Test Title,Duration (ms),Timestamp`;
  one row per finished attempt, and the last row of an ID wins.
- Blocked-in-handoff rows are never run. Rows with an `Open` repair in the handoff are left out and listed. Rows whose
  Test Case Type is `deleted` are never run.
- The canonical workbook is `Android-<name>.xlsx` if present, else the older `<name>.xlsx`; never both. It is written to a temp file,
  verified (sheets, formulas, merged cells, validations, every written value), then swapped in. If Excel has it open the run
  stops with a message and the CSV is kept.
- A Fail whose message shows a WebdriverIO element or wait error (`element ... wasn't found`, `still not displayed`,
  `no such element`, `stale element reference`, `waitUntil` timeout, ...) keeps status Fail but its remark starts with
  `[NEEDS REVIEW ...]` (stale locator or product change?). A session error (`session not created`, `Failed to create
  session`, `invalid session id`, `ECONNREFUSED`, ...) and a frozen or dead UI server ("Could not proxy command",
  "instrumentation process is not running", "Appium session creation failed") become Skip (environment).
  Assertion failures are always Fail.

## Failure "why"

Facts (no AI): the error, the newest evidence file saved for the testcase under `screenshots/` during this run, and the
visible texts of the screen at failure read from the page source attached in `allure-results/` ("Screen at failure
showed: ..."). With `-AiNotes` a one-line `AI note:` from the `claude` CLI is added for Fail rows.

## Not built yet

iOS.
