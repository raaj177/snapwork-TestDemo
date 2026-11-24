# Workbook Run Commands: `npm run smoke` and `npm run regression`

```powershell
npm run smoke -- "<Approved Workbook>.xlsx"
npm run smoke -- "<Approved Workbook>.xlsx" --dry-run
npm run regression -- "<Approved Workbook>.xlsx"
npm run regression -- "<Approved Workbook>.xlsx" US002 US003
npm run regression -- "<Approved Workbook>.xlsx" US002 US003 --dry-run
```

| Option | Meaning |
| --- | --- |
| workbook (required) | a file name in `testcase/Testcases/` (names with spaces are fine), or a path inside it |
| story IDs | regression only: `US002 US003` |
| `--dry-run` | selection + read-only preflight; no session, no report |
| `--retries <0-5>` | default **0** for these commands |
| `--strict` | smoke only: exit 6 instead of running when coverage is incomplete |
| `--update-workbook` | also update the output workbook (`testrun.py update`, once installed) |
| `--platform android\|ios` | default from `PLATFORM` |

They do not change `.\run ...`, `npm run smoke:run` (the strict P0 build gate) or `npm run report:share`.

## What is selected

- A testcase is its **ID + exact title** (`Test Description`) in this workbook. The implementation is the `it('<ID>: <title>')` in `src/tests/regression/<WorkbookFolder>/` (the whole regression folder only while that folder does not exist). An exact match elsewhere is `MISPLACED` and not run.
- Smoke: active rows with Automation Candidate = Yes and Priority = P0 that have an implementation. Regression: every active Automation Candidate = Yes row with an implementation (optionally only the given stories).
- Never selected: rows Blocked in `automation-handoff/<story>.md`, `it.skip` / `xit`, title mismatches, rows without an `it()`.
- Smoke with missing cases runs the implemented ones and is labelled **INCOMPLETE COVERAGE** everywhere (partial). No placeholder test is ever created.

## Device readiness (Android)

Connected and authorized (`adb devices`), awake, unlocked, the app installed and **open at its start screen**. The commands never install, wake, unlock, clear or kill anything; a failed check exits 3 with the fix.

- Configuration precedence: process env > `.env` > defaults; the source of each value is printed.
- Device: a **process** `DEVICE_UDID` is honoured; otherwise the only online device is used, even when `.env` holds another (stale) ID. Several online devices → set `$env:DEVICE_UDID="<id>"`.
- Ports: the Appium port and `UIAUTOMATOR2_SYSTEM_PORT` must be free.
- One worker, retries 0, `noReset: true`.
- iOS: no preflight yet → exit 3; run `npm run test:ios -- --spec <file>`.

## Outputs

- `test-results/runs/<RUN_ID>/`: `allure-results/`, `junit/`, `results.csv`, `logs/`, `run.json` (private raw artifacts; never shared wholesale).
- `report/runs/<RUN_ID>/` (run page, smoke Allure report or one Allure report per epic, `report-scope.json`, `README.txt`), `report/<RUN_ID>.zip`, and the dashboard `report/index.html`.
- Share the run's ZIP only. Presentation copies omit logs, stack traces, parameters, page sources and screenshots.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | all selected passed with results |
| 1 | the runner reported failures |
| 2 | usage / selection error |
| 3 | preflight failed |
| 4 | missing results (`NO RESULT <ID>`) |
| 5 | report generation failed (only when nothing worse happened) |
| 6 | `--strict` smoke with incomplete coverage |
| 7 | lock held or stale |

## Lock recovery

`test-results/runs/.lock` is created before preflight and removed at the end. "another run is in progress" → wait. "stale lock from <runId>" → confirm no run is active, delete `test-results/runs/.lock`, run again. The tools never delete a lock or kill a process on their own.

## Safety

These commands run what the workbook selects. Sensitive flows (OTP, payment, lockout) need the user's approval and lockout tests a separately approved disposable account. Tooling is validated with `--dry-run` and `npm run run-commands:test` only.
