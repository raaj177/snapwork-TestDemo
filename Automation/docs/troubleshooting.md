# Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ECONNREFUSED 127.0.0.1:4723` / session not created | Appium not reachable | Local runs start Appium through `@wdio/appium-service`; check `logs/wdio/` and that port 4723 is free (`netstat -ano \| findstr :4723`). For a remote grid use `config/wdio.grid.conf.ts`. |
| `adb devices` shows `unauthorized` | USB debugging prompt not accepted | Unlock the device, accept the prompt, run `adb devices` again. |
| `App ... is not installed` / wrong app opens | `APP_PACKAGE` mismatch | Re-read the build: `.\scripts\setup-android.ps1 -Apk <apk>`; compare with `.env`. |
| `Invalid configuration (.env / environment)` | a value fails the zod schema | The message names the variable; fix it in `.env` or the process environment. |
| `Invalid testcase ID(s) in TEST_IDS` | an ID does not match `^TC_[A-Za-z0-9_]+$` | Fix `TEST_IDS`; the run stops before a session. |
| No Allure results / `npm run report` finds nothing | no test ran, or `ALLURE_RESULTS_DIR` points elsewhere | Run a spec first; check `allure-results/`. `allure generate` needs Java. |
| `Port 8200 is in use` | another UiAutomator2 session | Stop that run, or set `UIAUTOMATOR2_SYSTEM_PORT`. The tools never kill processes. |
| `stale lock from <runId>` (exit 7) | an earlier `npm run smoke/regression` was interrupted | Confirm no run is active, delete `test-results/runs/.lock`, run again. |
| `uiautomator2` / `xcuitest` missing in `verify-environment` | `node_modules` incomplete | `npm ci` (drivers are project devDependencies). |
| Instrumentation process not running / socket hang up | UiAutomator2 server lost | Recorded as an environment problem; rerun. Repeated: reboot the device, update the driver with the lockfile. |
| iOS run on Windows | XCUITest needs macOS + Xcode | Use a macOS agent. |
