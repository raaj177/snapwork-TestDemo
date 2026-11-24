# Setup Guide

## Prerequisites (verified on the bootstrap machine)

| Tool | Version found at bootstrap | Notes |
| --- | --- | --- |
| Node.js | v24.22.1 | `engines.node >=24.22.1` (WebdriverIO 10 needs 22.23.4+ / 24.22.1+ / 26.12.1+) |
| npm | 11.19.1 | |
| Java | OpenJDK 17.0.20.1 | needed by the Android SDK and the Allure CLI |
| Android SDK | `ANDROID_HOME` set; build-tools 36.0.0 (aapt) | `platform-tools` (adb 1.0.41) on PATH |
| Appium | 4.0.0, project-local | drivers `uiautomator2@10.0.0`, `xcuitest@13.6.1` are project devDependencies (`npx appium driver list --installed` shows `[installed (npm)]`) |
| Xcode | iOS only, macOS | not available on Windows |

No global packages and no `appium driver install` are needed: `npm ci` installs everything pinned in `package-lock.json`.

## Install and check

```powershell
npm ci
.\scripts\verify-environment.ps1
npm run typecheck
npm run lint
```

## Configuration

1. `.env` is Git-ignored; it was created from `.env.example` at bootstrap. Never commit it.
2. App values come from the app build (deferred at bootstrap):
   - Android: put the APK in `apps/android/` and run `.\scripts\setup-android.ps1 -Apk apps\android\<file>.apk -Write` (reads `aapt dump badging`).
   - iOS (macOS): `./scripts/setup-ios.sh --app apps/ios/<file>.ipa --write` (reads `Info.plist`).
3. `DEVICE_UDID`: empty = the only connected device; set it when several are connected.
4. Test users: `src/data/test-data.json` names the password variable (`passwordEnv`); the value goes in `.env` or the CI credential store. Private, non-secret QA data (usernames, customer IDs) can go in the Git-ignored `src/data/test-data.local.json` (copy `test-data.local.example.json`).

| Variable | Purpose | Default |
| --- | --- | --- |
| `PLATFORM` | `android` / `ios` | `android` |
| `TEST_ENV` | `qa` (the only environment) | `qa` |
| `APPIUM_HOST`, `APPIUM_PORT` | local host starts Appium through `@wdio/appium-service` | `127.0.0.1`, `4723` |
| `APP_PACKAGE`, `APP_ACTIVITY`, `START_ACTIVITY` | Android app | empty (deferred) |
| `BUNDLE_ID` | iOS app | empty (deferred) |
| `APP_PATH` | install at session start; empty = installed already | empty |
| `NO_RESET` | keep app data between sessions | `true` |
| `MOCHA_RETRIES` | retries per test (3 attempts) | `2` |
| `MAX_INSTANCES` | parallel workers (one device + ports each) | `1` |
| `AUTOMATION_RESULTS_FILE`, `ALLURE_RESULTS_DIR`, `JUNIT_DIR`, `LOG_DIR` | output locations | see `.env.example` |
| `LOG_LEVEL`, `WDIO_LOG_LEVEL`, `STEP_SCREENSHOTS` | logging | `info`, `warn`, `true` |

## Type-check and lint without a device

`npm run typecheck` and `npm run lint` never start a session. The device-free tooling tests: `npm run smoke:test`, `npm run run-commands:test`, `npm run report:share:test`, `npm run test-data:test`.

## Running a story spec

```powershell
npm run test:android -- --spec "src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts"
npm run test:ios -- --spec "<same path>"          # macOS
$env:TEST_IDS="TC_US001_001,TC_US001_002"; npm run test:android
```
