---
name: automation-setup
description: Create or complete a reusable enterprise automation framework for an existing application repository - Mobile (TypeScript + WebdriverIO + Appium + Mocha + Allure), Web (TypeScript + Playwright Test + Allure, Page Object Model) or Mobile + Web (in `Automation/Mobile/` and `Automation/Web/`) - with ESLint/Prettier, dotenv-validated config, Winston logging, a `jenkins/` folder (Jenkinsfile.mobile for Android + iOS, Jenkinsfile.web for Playwright) and GitHub Actions. Use once when a project needs its initial automation skeleton. Asks only three questions (application project path, automation directory path, target platform: Mobile, Web or Mobile + Web, with Android / iOS / Android + iOS for Mobile), discovers everything else from the project files, and never guesses project values. Do not use for testcase-workbook processing, feature-test implementation, device or browser execution, reruns, or result promotion.
---

# Automation Setup

Create the reusable automation foundation for the current application repository. This is a one-time bootstrap workflow. It prepares the project structure and shared infrastructure that later testcase-automation workflows (implement-testcases-v2) will use.

## Platform selection and layout

The target platform (intake question 3) decides which frameworks are built and where they go. `<AutomationDir>` is the automation directory confirmed in question 2 (default `<project-root>/Automation`).

| Choice                                      | Frameworks                   | Layout of `<AutomationDir>`                                                                                                                                                                   | Mobile framework root    | Web framework root    |
| ------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------- |
| **Mobile** (Android, iOS, or Android + iOS) | Mobile: WebdriverIO + Appium | **Flat**: the mobile framework directly in `<AutomationDir>` (see "Mobile framework structure"), exactly as before. No `Mobile/` or `Web/` subfolder                                          | `<AutomationDir>`        | -                     |
| **Web**                                     | Web: Playwright + TypeScript | **Web only**: `<AutomationDir>` holds only `Web/`; `Web/` is self-contained, with its own `jenkins/Jenkinsfile.web`, `.github/workflows/web-tests.yml`, `docs/`, `README.md` and `.gitignore` | -                        | `<AutomationDir>/Web` |
| **Mobile + Web**                            | Both                         | **Split**: shared root files (`jenkins/`, `.github/workflows/`, `docs/`, `README.md`, `.gitignore`) + `Mobile/` + `Web/`                                                                      | `<AutomationDir>/Mobile` | `<AutomationDir>/Web` |

The flat Mobile layout is the established framework: `<AutomationDir>/` holds `.github/`, `apps/`, `automation-handoff/`, `config/`, `docs/`, `evidence/`, `Jira/`, `jenkins/`, `scripts/`, `src/` (`assertions`, `components`, `constants`, `data`, `fixtures`, `pages/{android,common,ios}` + `pages/index.ts` page factory added by implement-testcases-v2, `reporting`, `services`, `tests/{smoke,regression,integration}`, `types`, `utils`), `suites/`, `testcase/` and the root config files; `allure-report/`, `allure-results/`, `logs/`, `screenshots/`, `test-results/` and `node_modules/` appear at run/install time. Do not change it when Mobile is chosen.

Only in the split layout (Mobile + Web) do the files that serve both frameworks sit once at `<AutomationDir>`; each framework is its own npm project with its own `package.json`, `node_modules`, `.env` and lockfile. The `<AutomationDir>` root has no `package.json` and no framework code:

```text
<AutomationDir>/
|-- Jira/                     # one shared folder: README.md + issues.json (see "Jira records folder")
|-- jenkins/
|   |-- Jenkinsfile.mobile    # runs in Mobile/
|   `-- Jenkinsfile.web       # runs in Web/
|-- .github/workflows/
|   |-- mobile-tests.yml      # working-directory Mobile/
|   `-- web-tests.yml         # working-directory Web/
|-- docs/                     # one set for both frameworks, a section per framework
|   |-- framework-architecture.md
|   |-- setup-guide.md
|   |-- coding-standards.md
|   `-- troubleshooting.md
|-- shared-contract/          # data both frameworks read (never code)
|   |-- README.md             # what goes where, file shape, shared-account warning
|   `-- test-data/
|       |-- qa.json           # one file per TEST_ENV: common + overrides.web / android / ios
|       |-- uat.json
|       |-- staging.json
|       `-- test-data.schema.json   # JSON Schema: both frameworks validate the same shape
|-- testcase/                 # ONE workbook folder for both frameworks (see "Testcase folder")
|   |-- Generated Testcases/  # step 1: first generation <Doc>_TestCases_v1_0.xlsx (test-cases-generator, Mode A)
|   |-- Review Reports/       # steps 3/5: <Doc>_TestCase_Review_v1_<n>.xlsx (test-cases-reviewer)
|   |-- Revised Testcases/    # step 4: <Doc>_TestCases_v1_1, v1_2 ... regenerated from a review (generator update mode)
|   |-- Testcases/            # automation input: unchanged copy of the QA-approved latest version
|   |-- CSV Files/            # approved result CSVs: CSV Files/<Platform>/<Feature Name>/
|   `-- Output Testcases/     # canonical output workbooks: Android-, iOS-, Web-, PWA-<name>.xlsx
|-- README.md                 # overview: which framework is where, how to run each
|-- .gitignore                # covers both frameworks (patterns match at any depth)
|-- Mobile/                   # "Mobile framework structure" without jenkins/, .github/, docs/, .gitignore, testcase/, src/data/test-data.json
`-- Web/                      # "Web framework structure" without jenkins/, .github/, docs/, .gitignore, testcase/, src/data/test-data.json
```

**Creation order** (after the discovery summary is confirmed, never before):

1. Create the `<AutomationDir>` folder itself (`Automation/`) when it does not exist. Never create `Mobile/` or `Web/` anywhere else, and never let a nested `mkdir -p` be the step that creates `Automation/`.
2. Create the sub-folders inside it: `Mobile/` and `Web/` for Mobile + Web, or `Web/` alone for Web. (Mobile has no sub-folder: its framework files go straight into `Automation/`.)
3. Mobile + Web only: create the shared root files at `<AutomationDir>` (`jenkins/`, `.github/workflows/`, `docs/`, `shared-contract/`, `testcase/`, `README.md`, `.gitignore`).
4. Build each framework inside its own sub-folder (Mobile first, then Web), and run its `npm install` from that sub-folder, never from `<AutomationDir>`.
5. **Every layout: create the workbook folder `testcase/` with all six lifecycle sub-folders**, each holding a `.gitkeep` so Git keeps the empty folder: `Generated Testcases/`, `Review Reports/`, `Revised Testcases/`, `Testcases/`, `CSV Files/`, `Output Testcases/`. Its location depends on the layout (see "Testcase folder"): `<AutomationDir>/testcase/` for Mobile (flat) and for Mobile + Web (shared, created in step 3), `<AutomationDir>/Web/testcase/` for Web only. When the folder already exists (an existing framework is completed in place), create only the missing sub-folders and never move or delete files in it. Report it like the other steps (for example "Created `Automation/testcase/` with Generated Testcases, Review Reports, Revised Testcases, Testcases, CSV Files, Output Testcases").

Report each step in the progress output as it is done (for example "Created `Automation/`", "Created `Automation/Mobile/` and `Automation/Web/`").

What goes where:

- **Shared, at `<AutomationDir>` (Mobile + Web only)**: Jenkins pipelines, GitHub Actions workflows, docs, `shared-contract/`, the `testcase/` workbook folder, the overview README and `.gitignore`. With Web only, these live inside `Web/`.
- **Mobile only, in the mobile framework root**: `apps/`, `config/devices/`, the Android/iOS wdio configs, `pages/android` and `pages/ios`, Appium scripts (`start-appium`, `stop-appium`, `setup-android`, `setup-ios`, `capture-evidence`), `evidence/android` and `evidence/ios`.
- **Web only, in `Web/`**: `playwright.config.ts`, browser projects, base URL per environment, `evidence/web`, browser scripts.
- **Same contract in both, one copy per framework** (each framework installs and runs on its own): the results CSV and its header, `statuses.ts`, `BlockedError`, testcase-ID helpers, Logger/Redactor, Allure with `logger/` and `Screenshots/`, `suites/`, `automation-handoff/`, and the `typecheck` / `lint` / `format` / `report` / `clean` npm scripts.

Never copy code between the two frameworks at run time and never import one framework's files from the other.

### Shared test data (Mobile + Web)

With Mobile + Web there is **one** test-data source, so the same testcase ID runs with the same business data on every platform and the results can be compared. Two framework-local copies drift apart; never create them.

| Data                          | Where                                                                    | Example                                                               |
| ----------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Business data used by both    | `common` in `shared-contract/test-data/<env>.json`                       | test users, account types, amounts, search terms, expected messages   |
| Data that differs by platform | `overrides.web` / `overrides.android` / `overrides.ios` in the same file | a different error text on mobile, a web-only value                    |
| Run and target settings       | each framework's `config/` and `.env`, never test data                   | web base URL, browser, viewport, app package, launch activity, device |
| Secrets                       | `.env` and Jenkins credentials only                                      | passwords, OTP seeds, API keys: the JSON only names the variable      |

File shape (every file starts empty like this at bootstrap; never write example users or values):

```json
{
  "$schema": "./test-data.schema.json",
  "common": { "users": {}, "messages": {}, "values": {} },
  "overrides": { "web": {}, "android": {}, "ios": {} }
}
```

- `users.<key>` = `{ "username", "passwordEnv"?, "description"? }`; `passwordEnv` matches `^[A-Z][A-Z0-9_]*$`. A stored password is rejected (`additionalProperties: false`). Any string may be `{{env:NAME}}`, read from the environment when the value is used.
- `test-data.schema.json` (JSON Schema 2020-12, `$defs` for `user`, `userOverride`, `section`, `overrideSection`) is the one schema. Each framework builds its validator from it with zod's `z.fromJSONSchema` (zod 4), so no extra package and no second schema.
- Each framework's `src/services/test-data.service.ts` reads `<TEST_DATA_DIR>/<TEST_ENV>.json` (`TEST_DATA_DIR` in `config/env.ts`, default `../shared-contract/test-data`, resolved against the framework root), validates it and stops with a message naming each wrong field, then merges `common` with its own override section (Web: `web`; Mobile: `android` or `ios` from `PLATFORM`). An override replaces only the entries, and for a user only the fields, it sets.
- `src/fixtures/test-data.fixture.ts` exposes `fixtures.user(key)`, `fixtures.message(key)`, `fixtures.value(key)` (also exported as `testData`); tests never check which platform they run on. `src/data/` holds `test-data.schema.ts` (loads the shared JSON Schema) and a `README.md` pointing to `shared-contract/`, not a `test-data.json`.
- `shared-contract/README.md` documents the table above, the file shape, and the **shared-account rule**: Mobile and Web pipelines running at the same time with one account can log each other out or change a password or balance mid-test, so every testcase that changes data gets its own account per platform through the override section; read-only data may stay in `common`.

With Mobile only (flat) the framework keeps its local `src/data/test-data.json` exactly as before. With Web only the same shared format is used, self-contained in `Web/test-data/` (`TEST_DATA_DIR=test-data`).

**Local overrides and the opt-in workbook / synthetic fallback (every layout).** Build `references/test-data-sources.md`: a Git-ignored `test-data.local.json` next to the shared file overrides single fields (validated with the same schema, every value registered with the `Redactor`, never committed or shared, secrets still only in `.env` / CI credentials); a committed `test-data.local.example.json` with the empty structure; `src/services/test-value.service.ts` (`resolveTestValue`) with the order local → shared/env reference → the workbook row's Test Data cell when it holds exactly one explicitly mapped value → a seeded `@faker-js/faker` value only when that cell is blank; ambiguous nonblank cells are `Blocked`, missing workbooks/rows/headers are errors; never generated credentials, OTPs, registered contacts or expected values; and the device-free `npm run test-data:test`. The fallback is opt-in per testcase, not framework-wide.

### Testcase folder

`testcase/` (`Generated Testcases/`, `Review Reports/`, `Revised Testcases/`, `Testcases/`, `CSV Files/`, `Output Testcases/`) always sits **directly in `<AutomationDir>`**, never inside `Mobile/` or `Web/`:

| Layout               | Testcase folder                                                            | Used by                                    |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| Mobile (flat)        | `<AutomationDir>/testcase/` (the framework root is `<AutomationDir>`)      | the mobile framework                       |
| Mobile + Web (split) | `<AutomationDir>/testcase/`, one folder **shared** by `Mobile/` and `Web/` | both frameworks (`../testcase/` from each) |
| Web only             | `<AutomationDir>/Web/testcase/` (`Web/` is self-contained)                 | the web framework                          |

- Workbook lifecycle, the same in every layout: test-cases-generator writes `v1_0` to `testcase/Generated Testcases/`; test-cases-reviewer writes `testcase/Review Reports/<Doc>_TestCase_Review_v1_<n>.xlsx`; a revision from a review (generator update mode) writes the next version to `testcase/Revised Testcases/`, and is reviewed again. No file in these three folders is ever overwritten or hand-edited.
- The QA-approved latest version stays where it was written; one unchanged copy goes into `testcase/Testcases/`, and each framework selects its own rows from it (Mobile: `Automation Candidate = Yes`, iOS also `IOS Testcase = Yes`; Web: by the row's `Platform` value).
- Outputs never collide because every file is named or filed by platform: `Output Testcases/Android-<name>.xlsx`, `iOS-<name>.xlsx`, `Web-<name>.xlsx`, `PWA-<name>.xlsx`, and `CSV Files/<Platform>/<Feature Name>/`.
- The run scripts (`scripts/testrun/common.py`, installed by implement-testcases-v2) find the folder themselves: `TESTCASE_DIR` when set, else the framework's own `testcase/`, else `../testcase/` (the shared one). Nothing else in the frameworks hard-codes the path.

## Scope boundary

This workflow creates and validates the framework skeleton only.

Do not:

- require, read, copy, or modify a testcase workbook;
- implement business-feature or user-story testcases, or sample tests such as `login.test.ts`;
- create feature-specific page objects, components or locators;
- connect to a device, start Appium, or start a WebdriverIO session;
- launch a browser, run a Playwright test, or open the web application;
- install, launch, reset, or interact with the application;
- generate result CSVs or mark Pass, Fail, Skip, or Blocked results;
- create or update output workbooks;
- claim that device or browser automation works when only type-checking and linting have been verified.

Testcase intake, feature implementation, device execution, workbook updates, status-filtered suites, and reruns are handled by later automation skills.

## Non-negotiable rules

These rules override every other section, any default, and any wish to finish quickly.

1. **Follow this skill exactly.** Run every section in order. Do not skip, reorder, shorten, or "simplify" a step. If a step cannot be completed, stop and tell the user which step is blocked and why.
2. **Never guess.** Every project-specific value must come from one of two sources: a file you actually read in the application project, or an explicit answer from the user. This includes paths, app package/bundle ID, launch activity, flavors, app type, npm package name, and directory names. Placeholders such as `com.example`, `com.mobile`, `com.company`, `myapp`, `MyApp`, or "a generic name for now" count as guesses and are forbidden.
3. **Never hallucinate.** Do not claim a file, value, version, tool, command result, or validation outcome unless you observed it in this session. Do not report a check as passed unless you ran it and saw it pass.
4. **Do not use other projects as a source of values.** Sibling folders, backups, earlier sessions, and reference frameworks may show structure. Never copy their package names, IDs, or configuration into this project.
5. **Discover, don't interrogate.** Every value other than the three intake answers comes from the project files. When discovery finds several valid candidates that no rule below can settle, list them with file references in the discovery summary and let the user pick there, in that single confirmation message.
6. **No files before confirmation.** Do not create, copy, or modify any file until all three intake questions are answered and the user has confirmed the discovery summary.
7. **No installs without approval.** `npm install` downloads packages; ask once, in the discovery summary, before running it (one approval covers every framework being built). The Appium driver of each target platform (`appium-uiautomator2-driver` for Android, `appium-xcuitest-driver` for iOS) is a pinned project devDependency installed by that same `npm install`, so the framework is ready to drive a device without a manual driver install. Playwright browser binaries (`npx playwright install chromium`) are a separate download into the user's Playwright cache: ask for it as its own line in the same approval; when it is declined, report "browsers not installed" and give the command. Never install global packages, global Appium drivers (`appium driver install` into the user's Appium home), SDKs or apps.

## Mandatory intake questions

Ask exactly **three** questions, one at a time, before any discovery or file creation (question 3 has a follow-up when Mobile is part of the answer):

1. **Application project path:** the absolute path to the application repository (the folder with the app's build files, such as `build.gradle(.kts)`, `settings.gradle`, `pubspec.yaml`, `package.json`, or the Xcode project). **QA teams often have only the app build:** an absolute path to an `.apk` (Android) or `.ipa`/`.app` (iOS) is also a valid answer. Then discovery reads the app values from the build instead of the source (see "App build only" in discovery). For a web application, the web app's URL (`https://...`) is also a valid answer. For Mobile + Web the user may give one answer per surface (for example `mobile: <apk path>; web: <url>`). **No app yet** is also a valid answer when the user says so explicitly (the `qa-automation-orchestrator` always passes it): the framework structure is built without app values (see "Framework only" in discovery).
2. **Automation directory path:** where to create the automation. Offer `<project-root>/Automation` as the default and let the user confirm it or give another path. With Web or Mobile + Web this is the root that holds `Web/` (and `Mobile/`); see "Platform selection and layout".
3. **Target platform:** "Mobile, Web, or Mobile + Web?" When the answer includes Mobile, ask the follow-up "Mobile platform: Android, iOS, or Android + iOS?" in the next message. You may mention which native folders or web build files were found at the project path (for example `android/`, `ios/`, a web `package.json`), but the user picks.

Rules:

- Send one question per message, then wait for the reply. Record the reply exactly as given.
- Validate each answer as soon as it arrives. If the project path does not exist, is empty, or is neither a folder with recognizable application build files, an `.apk`/`.ipa`/`.app` build, nor an `http(s)` URL (and the user did not answer "no app yet"), report what you found and ask question 1 again. Never fall back to the current working directory or to a generic setup.
- For question 2, report whether the directory already exists and what it contains: a mobile TypeScript/WebdriverIO framework (`package.json` with `webdriverio`, `wdio.conf.ts`, `tsconfig.json`) at its root or in `Mobile/`, a Playwright framework (`package.json` with `@playwright/test`, `playwright.config.ts`) in `Web/` or at its root, a different framework (for example Java `pom.xml`/`testng.xml`), or nothing. The parent folder must exist.
- For question 3, accept only Mobile, Web, or Mobile + Web (an older answer "Android", "iOS" or "both" means Mobile with that mobile platform; "both" means Android + iOS, never Mobile + Web). For the follow-up accept only Android, iOS, or Android + iOS. If a chosen platform has no shipping native project, or Web has no web project or URL, at the path, report what you found and ask again (not applicable to "no app yet").
- If a reply is empty or unclear, ask the same question again. Do not fill an answer in yourself.

## Discovery confirmation gate

After discovery (next section), show the user one summary. Each value must include the exact file and line it came from, or be marked "user-provided" (only the three intake answers):

- repository root and automation directory;
- the layout (flat or split, see "Platform selection and layout") and each framework root that will be created or completed (`<AutomationDir>`, or `<AutomationDir>/Mobile` and/or `<AutomationDir>/Web`);
- application type and automation surfaces;
- Mobile: app package/bundle ID for the selected flavor, and the launch activity;
- Web: the base URL of each environment (`qa`, `uat`, `staging`) found, and the browsers (`chromium` by default; `firefox`, `webkit` as Playwright projects);
- npm package name of each framework and display name;
- Node.js and npm versions found, and the dependency versions that will be installed;
- existing automation files that will be preserved, and any non-TypeScript framework found in the automation directory;
- the Jenkins pipelines that will be created in `<AutomationDir>/jenkins/` (see step 11 of discovery and "Jenkins pipelines"), with the framework folder each one runs in and the Jenkins NodeJS tool name;
- every value that still could not be determined.

End the summary with a short **"Needs your choice"** list containing only the values discovery could not settle, each with its candidates and file references, plus the approval to run `npm install` (and, with Web, to download the Playwright Chromium browser). Then ask the user to confirm the summary and answer that list in one reply. Do not create files until they confirm.

## Discover the host project

Only after the three intake questions are answered, and before creating files, derive every other value from the project:

1. **Repository layout.** Locate the repository root and read its instructions (`AGENTS.md`, `README.md`, `CLAUDE.md`), build files, source layout, ignore rules, and developer documentation.
2. **Application type and surfaces.** Identify the stack from build files: `pubspec.yaml` means Flutter, `package.json` with `react-native` means React Native, Android Gradle only means Android native, `package.json` with `react`/`next`/`@angular/core`/`vue` (and no `react-native`) means a web app, and so on. Note any hybrid/webview surface only if the source shows one.
3. **Target platforms.** Use the user's answer to question 3. For Mobile, read only the chosen platform's native project: the `android/` module's `applicationId` for Android, and the `ios/` Xcode project's `PRODUCT_BUNDLE_IDENTIFIER` for iOS. For Web, read the web project's environment files (`.env*`, `environment*.ts`, deployment config, README) for the URL of each environment; a URL given as the answer to question 1 is user-provided, and "which environment is this URL" goes in "Needs your choice" unless the user said so. If the files conflict with the answer, report it with file references. Steps 4-6 apply to Mobile only.
4. **Shipping module.** In multi-module repositories, pick the module whose `applicationId`/bundle ID is a real, non-template identifier. Ignore template or placeholder modules such as a root `android/` with a `com.example.*` ID. If more than one module ships a real app, put the candidates in "Needs your choice."
5. **Flavor / build variant.** Read `productFlavors` (and iOS schemes/configurations). If there is a single flavor or none, use it. If there are several, list each flavor with its resulting package (`applicationId` + `applicationIdSuffix`) in "Needs your choice."
6. **App package and launch activity.** Take the package from `applicationId` plus the chosen flavor's suffix. Take the launch activity from the manifest entry with `MAIN`/`LAUNCHER`, resolving a relative name such as `.MainActivity` against the module `namespace`. Do not invent production identifiers.
7. **Existing automation.** Look in the automation directory (its root, `Mobile/` and `Web/`), in `<project-root>/Automation`, and in sibling folders.
   - A framework of the right kind at its framework root (WebdriverIO at the mobile root, Playwright at `Web/`): validate it and complete it in place. With Mobile + Web, a framework that is already present is completed and only the missing one is built.
   - A flat mobile framework at `<AutomationDir>` while the choice is Web: do not nest `Web/` inside it. Put "choose Mobile + Web (the mobile framework moves into `Mobile/`), or choose another automation directory" in "Needs your choice".
   - A flat mobile framework at `<AutomationDir>` while the choice is Mobile + Web: do not move it yourself. Put "move it into `<AutomationDir>/Mobile/` (back up first to `<project-root>/_backup_flat_mobile_framework/`, reinstall `node_modules` after the move, update the Jenkins/GitHub Actions folder), or choose another automation directory" in "Needs your choice".
   - A framework of another kind (for example Java/TestNG) at the automation directory: do not delete or overwrite it. Put "back it up to `<project-root>/_backup_<kind>_framework/` and replace it, or choose another automation directory" in "Needs your choice."
   - A framework elsewhere: report its path and put "create new vs. complete the existing one" in "Needs your choice."
8. **Names.** Derive them from the project's own files. Never make them up:
   - npm `name`: the root project name (`rootProject.name` in `settings.gradle(.kts)`, `name` in the root `pubspec.yaml` or `package.json`), lowercased, with `-automation` appended (flat layout); in the split layout `-mobile-automation` for `Mobile/` and `-web-automation` for `Web/`;
   - display name: the app's user-facing label (`app_name` string resource, `android:label`, `CFBundleDisplayName`, or the web app's `<title>` / manifest `name`) without flavor suffix;
   - platform and driver defaults (`UiAutomator2` for Android, `XCUITest` for iOS): from the platform the user chose.
9. **Toolchain.** Check locally installed Node.js and npm, and with read-only version commands: for Mobile, Java (needed by the Android SDK), Android SDK/ADB, Appium and its drivers, Xcode (iOS on macOS only); for Web, any Playwright browsers already in the Playwright cache; for both, Allure. Choose dependency versions compatible with the installed Node.js and the Appium drivers.
   **App build only.** When question 1 was answered with an app build instead of a source repository, steps 1–6 and 8 read the build, not source files:

- Android `.apk`: run `aapt dump badging <apk>` (Android SDK `build-tools`, read-only). `package: name='…'` is the app package, `launchable-activity: name='…'` the launch activity, `application-label:'…'` the display name. Flutter shows as `flutter_assets`/`libflutter.so` in `unzip -l <apk>`; note a debug build (`kernel_blob.bin` present: slow cold start).
- iOS `.ipa`/`.app`: read `CFBundleIdentifier` and `CFBundleDisplayName` (or `CFBundleName`) from the app's `Info.plist` (`plutil -p` on macOS, or unzip and read it).
- The repository root is the workspace root (`<WorkspaceRoot>`, the folder that holds `.github/`); the npm `name` is the display name lowercased with spaces replaced by `-`, plus `-automation`.
- Flavors and modules do not apply: the build is one variant. Copy the build into `<AutomationDir>/apps/android/` or `apps/ios/` (Git-ignored) after confirmation.
- Each value's source in the summary is `aapt dump badging <file>` (or `Info.plist`) with the line it came from. If `aapt` is missing, put package and activity in "Needs your choice" and mention `scripts/setup-android.*`, which reads them once build-tools are installed.

**Framework only (no app yet).** When question 1 was answered "no app yet", build the complete structure and leave the app out:

- Skip steps 1–6 and the app-reading part of step 8. The repository root is the workspace root (`<WorkspaceRoot>`, the folder that holds `.github/`); the application type is "mobile native (to be confirmed from the app build)", "web (to be confirmed from the web app URL)", or both.
- npm `name`: the workspace root folder name, lowercased, spaces replaced by `-`, plus `-automation` (flat) or `-mobile-automation` / `-web-automation` (split); its source in the summary is that folder name. The display name is deferred.
- Mobile `.env` gets every non-app value; `APP_PACKAGE`, `APP_ACTIVITY` (Android), `BUNDLE_ID` (iOS) and `APP_PATH` stay empty. List them under deferred values with where they will come from: the app build, read with `aapt dump badging` (Android) or `Info.plist` (iOS) when it is available (the orchestrator does this at the start of its Phase 4).
- Web `.env` gets every non-app value; `BASE_URL` and the per-environment URLs in `config/environments/*.config.ts` stay empty and are listed as deferred, to come from the user or the project's environment files.
- Do not put the deferred app values in "Needs your choice": they are not asked for now.

10. If a value has no source in the project files, put it in "Needs your choice" with what you looked for. Keep project-specific values in configuration (`.env`, `config/`), never embedded in reusable framework code.
11. **Jenkins pipelines (project selection).** Decide which pipelines go in `<AutomationDir>/jenkins/`:
    - **Mobile** (`Jenkinsfile.mobile`, one pipeline for Android and iOS through a `PLATFORM` parameter): whenever Mobile is chosen. Its folder is the mobile framework root relative to the repository root (`Automation` flat, `Automation/Mobile` split).
    - **Web** (`Jenkinsfile.web`, Playwright): whenever Web is chosen; its folder is `<AutomationDir>/Web`. With Mobile only, add it only when the repository already holds a separate web test framework (a `playwright.config.*` with `@playwright/test` in its `package.json`) or the user asks for it; report the folder found, and with none or several put "Jenkins pipelines: Mobile only, or Mobile + Web (web framework folder?)" in "Needs your choice". With Mobile only, never build a web framework.
    - **Jenkins NodeJS tool name** (the `tools { nodejs '...' }` entry): take it from an existing Jenkinsfile in the repository (file and line); otherwise put it in "Needs your choice", offering `NodeJS-<major of the installed Node.js>` as the suggestion.
12. Present the discovery confirmation gate summary and wait for the user to confirm it.

If the automation foundation already exists and satisfies this contract, do not recreate or replace it. Validate it, add only missing essentials, and report what was already present.

## Mobile technology baseline

The sections from here to "Allure foundation" define the **mobile** framework (Mobile or Mobile + Web). The web framework is defined in "Web framework (Playwright)"; "Suite foundation" and "Workbook extension points" apply to both.

| Component                | Technology                                                                                                                                                         | Purpose                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Language                 | TypeScript (`strict: true`)                                                                                                                                        | Type safety and maintainability |
| Mobile automation server | Appium 2.x/3.x (`appium`, project-local) with the platform driver as a project dependency: `appium-uiautomator2-driver` (Android) / `appium-xcuitest-driver` (iOS) | Automate Android and iOS        |
| Automation client        | WebdriverIO (`webdriverio`, `@wdio/cli`, `@wdio/local-runner`, `@wdio/appium-service`)                                                                             | Talks to Appium                 |
| Test runner              | Mocha (`@wdio/mocha-framework`)                                                                                                                                    | Executes and organizes tests    |
| Assertions               | WebdriverIO `expect` (`expect-webdriverio`)                                                                                                                        | Validates app behavior          |
| Design pattern           | Page Object Model + components                                                                                                                                     | Separates test logic from UI    |
| Test data                | JSON + TypeScript fixtures, schema-validated; Git-ignored local overrides; `@faker-js/faker` (opt-in synthetic fallback)                                                                                                                       | Manages test data               |
| API helpers              | Axios                                                                                                                                                              | Test-data setup and API checks  |
| Reporting                | Allure (`@wdio/allure-reporter`, `allure-commandline`) + `@wdio/spec-reporter` + `@wdio/junit-reporter` (`test-results/junit/`, read by Jenkins)                   | Execution reports               |
| Logging                  | Winston                                                                                                                                                            | Structured logs                 |
| Configuration            | dotenv + zod validation                                                                                                                                            | Environment-specific settings   |
| Code quality             | ESLint (flat config, `typescript-eslint`) + Prettier                                                                                                               | Coding standards                |
| CI/CD                    | `jenkins/Jenkinsfile.mobile` (+ `jenkins/Jenkinsfile.web` for a web framework) + GitHub Actions workflow                                                           | Automated execution             |
| Parallel execution       | WebdriverIO workers with isolated Appium ports                                                                                                                     | Faster runs                     |

WebdriverIO is the client and test-framework layer; Appium is the server. Add only the drivers of the target platforms, at the latest version whose `peerDependencies.appium` accepts the pinned Appium; a project-local Appium finds them in `node_modules` (`npx appium driver list --installed` shows `[installed (npm)]`), and `npm ci` in CI installs them too. Pin every dependency to the exact version resolved at install time (no `^`/`~` in `package.json`) and commit `package-lock.json`. Do not add Playwright, Selenium, Cucumber, Jest, or other large dependencies unless the application surface requires them. LLM/MCP integration is out of scope for the bootstrap.

## Mobile framework structure

`<MobileRoot>` is the mobile framework root: `<AutomationDir>` in the flat layout (Mobile), `<AutomationDir>/Mobile` in the split layout (Mobile + Web). In the split layout leave out `jenkins/`, `.github/workflows/`, `docs/`, `.gitignore` and `testcase/` here: they are the shared root files (see "Platform selection and layout"), and `README.md` becomes a short framework README that links to `../docs/`. Also in the split layout, `src/data/test-data.json` is replaced by the shared test data (`src/data/README.md` pointer + `test-data.schema.ts` built from the shared JSON Schema; see "Shared test data (Mobile + Web)"), and `test-data.service.ts` / `test-data.fixture.ts` / `types/test-data.types.ts` follow that section. Below, `<AutomationDir>/` stands for `<MobileRoot>/`. Create:

```text
<AutomationDir>/
|-- apps/
|   |-- android/            # local app binaries only, Git-ignored (.gitkeep)
|   `-- ios/                # local app binaries only, Git-ignored (.gitkeep)
|-- config/
|   |-- wdio.shared.conf.ts
|   |-- wdio.android.conf.ts
|   |-- wdio.ios.conf.ts
|   |-- wdio.local.conf.ts
|   |-- wdio.grid.conf.ts
|   |-- env.ts              # dotenv + zod: the one configuration layer
|   |-- devices/
|   |   |-- android.devices.ts
|   |   `-- ios.devices.ts
|   `-- environments/
|       |-- qa.config.ts
|       |-- uat.config.ts
|       `-- staging.config.ts
|-- src/
|   |-- tests/
|   |   |-- smoke/          # README only at bootstrap; later <WorkbookName>/<StoryId>.test.ts (Web: .smoke.json) and generated/<WorkbookName>/manifest.json
|   |   |-- regression/     # README only at bootstrap; later <WorkbookFolder>/<StoryLabel>. <Story title>.test.ts
|   |   `-- integration/    # README only at bootstrap
|   |-- pages/
|   |   |-- common/
|   |   |   `-- BasePage.ts
|   |   |-- android/        # .gitkeep
|   |   `-- ios/            # .gitkeep
|   |-- components/         # README only at bootstrap
|   |-- services/
|   |   |-- app.service.ts
|   |   |-- device.service.ts
|   |   |-- api.service.ts
|   |   |-- test-data.service.ts   # shared data + test-data.local.json overrides (references/test-data-sources.md)
|   |   |-- test-value.service.ts  # resolveTestValue: opt-in workbook Test Data cell / synthetic fallback
|   |   `-- session.service.ts
|   |-- fixtures/
|   |   `-- test-data.fixture.ts
|   |-- data/
|   |   |-- test-data.json  # empty structure, no real data
|   |   |-- test-data.local.example.json  # committed, empty structure; copy to test-data.local.json (Git-ignored)
|   |   |-- synthetic-data.ts  # explicit field -> label map and Faker generators (requirement formats)
|   |   `-- test-data.schema.ts
|   |-- reporting/
|   |   |-- statuses.ts     # Pass, Fail, Skip, Blocked, Not Executed
|   |   |-- BlockedError.ts
|   |   |-- testCase.ts     # testcase-ID helpers (see Traceability contract)
|   |   |-- ResultWriter.ts
|   |   `-- AllureEvidence.ts
|   |-- utils/
|   |   |-- WaitUtils.ts
|   |   |-- GestureUtils.ts
|   |   |-- ScreenshotUtils.ts
|   |   |-- PlatformUtils.ts
|   |   |-- RetryUtils.ts
|   |   |-- Locators.ts      # byRole -> byId -> byLabel -> byText -> byXPath
|   |   |-- ErrorUtils.ts    # describeError
|   |   |-- Logger.ts        # console + logs/automation.log (JSON) + logs/automation.txt + per-test buffer
|   |   |-- TestState.ts     # running test's name, log lines, screenshot count (on globalThis)
|   |   `-- Redactor.ts      # redact, maskValue
|   |-- assertions/
|   |   |-- mobile.assertions.ts
|   |   `-- api.assertions.ts
|   |-- constants/
|   |   |-- timeouts.ts
|   |   |-- platforms.ts
|   |   `-- endpoints.ts
|   `-- types/
|       |-- device.types.ts
|       |-- user.types.ts
|       `-- test-data.types.ts
|-- suites/
|   |-- templates/
|   |   `-- story-suite.template.json
|   `-- README.md
|-- testcase/
|   |-- Generated Testcases/
|   |-- Review Reports/
|   |-- Revised Testcases/
|   |-- Testcases/
|   |-- CSV Files/
|   `-- Output Testcases/
|-- automation-handoff/      # .gitkeep; written later by implement-testcases-v2
|-- evidence/                # locator evidence per screen; filled later by implement-testcases-v2
|   |-- README.md
|   |-- android/            # .gitkeep; <Screen>/<state>.xml|.png + locators.md
|   `-- ios/                # .gitkeep; only when iOS is targeted
|-- scripts/
|   |-- smoke/               # smoke:generate, smoke:check, smoke:run, smoke:record (TypeScript) + fixture tests
|   |-- report/              # build-share-report.mjs + __tests__/ (npm run report:share; see references/share-report.md)
|   |-- run/                 # cli.mjs: npm run smoke / npm run regression + __tests__/ (see references/workbook-commands.md)
|   |-- verify-environment.(ps1|sh)
|   |-- setup-android.(ps1|sh)
|   |-- setup-ios.sh         # only when iOS is targeted (macOS)
|   |-- start-appium.(ps1|sh)
|   |-- stop-appium.(ps1|sh)
|   |-- generate-allure-report.(ps1|sh)
|   |-- allure-extras.mjs    # after allure generate: allure-report/logger/ and allure-report/Screenshots/
|   |-- capture-evidence.(ps1|sh)  # UI hierarchy + screenshot of the current screen into evidence/<platform>/<Screen>/
|   |-- cleanup.(ps1|sh)
|   `-- testcase-output/
|       `-- README.md
|-- docs/
|   |-- framework-architecture.md
|   |-- setup-guide.md
|   |-- coding-standards.md
|   `-- troubleshooting.md
|-- .github/workflows/mobile-tests.yml
|-- .env.example
|-- .gitignore
|-- .prettierrc
|-- eslint.config.js
|-- package.json
|-- package-lock.json
|-- tsconfig.json
|-- wdio.conf.ts             # re-exports the platform config chosen by PLATFORM
|-- run.cmd                 # not created here; implement-testcases-v2 installs it with scripts/run.ps1 and run-tests.ps1
|                            # (.\run US001 US002 -Type full)
|-- Jira/                  # README.md + issues.json skeleton; filled later by smoke-bugs-to-jira (see "Jira records folder")
|-- report/                # generated (Git-ignored): index.html dashboard, runs/<RUN_ID>/ + <RUN_ID>.zip (npm run smoke / regression), snapshots/ (report:share)
|-- jenkins/
|   |-- Jenkinsfile.mobile   # always: Android + iOS (PLATFORM parameter)
|   `-- Jenkinsfile.web      # only when the project also has a web (Playwright) framework
`-- README.md
```

Generated at run time and Git-ignored: `test-results/`, `allure-results/`, `allure-report/`, `logs/`, `screenshots/`.

Scripts use the host OS shell: `.ps1` on Windows, `.sh` on macOS/Linux. Create both only when the README says the team uses both. Feature pages (`LoginPage.ts`), components (`Header.ts`), user fixtures and story specs are not created at bootstrap; implement-testcases-v2 adds them from the workbook. There is no accessibility test folder: accessibility is out of scope for the testcase generator.

## Build and dependency contract

`package.json` must provide these scripts (implement-testcases-v2 and the run scripts depend on the names):

| Script                    | Does                                                  |
| ------------------------- | ----------------------------------------------------- |
| `typecheck`               | `tsc --noEmit` - the "compile" step; no device needed |
| `lint` / `lint:fix`       | ESLint over `config/`, `src/`, `wdio.conf.ts`         |
| `format` / `format:check` | Prettier                                              |
| `test:android`            | `wdio run config/wdio.android.conf.ts`                |
| `test:ios`                | `wdio run config/wdio.ios.conf.ts`                    |
| `report`                  | generate `allure-report/` from `allure-results/`      |
| `report:share`            | build the shareable `report/` section from saved results (`references/share-report.md`) |
| `report:share:test`       | fixture tests of the report builder, no device         |
| `test:regression`         | labelled regression run + raw-results archive (iOS, direct runs) |
| `smoke`                   | `node scripts/run/cli.mjs smoke`: workbook P0 run (partial allowed, labelled) + per-run report (`references/workbook-commands.md`) |
| `regression`              | `node scripts/run/cli.mjs regression`: workbook regression run, optional story IDs + per-run report |
| `run-commands:test`       | device-free tests of `scripts/run/`                    |
| `clean`                   | remove generated run output                           |

`tsconfig.json`: `strict`, `module`/`moduleResolution` suitable for WebdriverIO's TypeScript loader, `types` including `node`, `mocha`, `@wdio/globals/types`, `@wdio/mocha-framework`, `expect-webdriverio`. Path aliases are optional; if used, configure them for both `tsc` and WebdriverIO.

## Method rules (all framework code, Mobile and Web)

These two rules apply to every method and function this skill writes, in every folder (`config/`, `src/pages/`, `src/utils/`, `src/services/`, `src/reporting/`, `src/fixtures/`, `src/tests/`, `scripts/*.ts`), and to every method a later skill (implement-testcases-v2) adds. Write them into `docs/coding-standards.md`.

1. **Never use the `private` keyword.** No `private` methods, fields or constructor parameter properties, and no `#private` fields or methods. A class member that callers must not use is `protected` (so a subclass, for example a platform page, can reuse and override it); everything else is public. A module-level helper that should stay internal is simply not exported.
2. **Every method logs.** Every method and function (public, `protected`, `static`, `async` or not, page actions, flows, `verify...` methods, `BasePage` helpers, utilities, services, reporters, wdio/Playwright hooks, smoke generator functions) follows this shape. **Spec files contain no logger and no functions**: every testcase step is a page-object flow / action / `verify...` method or a start-service method, so each step logs `started` / `finished` / `failed: <reason>` in the terminal and Jenkins console, and the `it()` only calls methods (implement-testcases-v2 `assets/testcase-method-template.md`):

   ```ts
   async enterPassword(password: string): Promise<void> {
       this.logger.info('Entering the password');
       try {
           await this.type(this.passwordField, password, 'the Password field', true);
           this.logger.info('Password entered');
       } catch (error) {
           this.logger.error(`Failed to enter the password: ${describeError(error)}`);
           throw error;
       }
   }
   ```

   - **Start, finish, failure.** Log what starts, then run the body in `try`, log what finished (and the returned value when it is not sensitive), and in `catch` log `describeError(error)` and rethrow. Never swallow an error or return a default instead.
   - **Which logger.** Classes use `this.logger` (`protected readonly logger = logger.child({ page|service|component: this.constructor.name })`). Module functions and static classes use one module-level child logger, `const log = logger.child({ module: '<FileName>' })`. wdio and Playwright hooks use `logger` from `src/utils/Logger.ts`; the `[TEST START]` / `[TEST RETRY]` / `[TEST END]` lines stay exactly as they are.
   - **Levels.** User actions, flows, `verify...` methods, services and hooks log at `info`. Small helpers that run many times per test (locator builders, `isServerHang`, `describeFailure`, `testCaseIdOf`, CSV quoting) log at `debug`, so `LOG_LEVEL=info` keeps the console readable while `LOG_LEVEL=debug` shows everything.
   - **Never log secrets or raw identifiers**: passwords, OTPs, PINs and tokens are never logged; Customer IDs, mobile numbers and user names go through `maskValue(...)`.
   - **Only exceptions** (state the reason in a one-line comment where it applies): the bodies of `src/utils/Logger.ts` and `src/utils/Redactor.ts` (the logger calls them, so logging there would recurse); constructors that only assign fields and locators; `abstract` declarations and type-only declarations (no body); and inline callbacks passed to another call (`waitUntil(() => ...)`, `.map(...)`, the `() => $(...)` locator lambdas), whose enclosing method does the logging.

**Enforce rule 1 in `eslint.config.js`** (both frameworks), so `npm run lint` fails on any `private`:

```js
{
    files: ['**/*.ts'],
    rules: {
        'no-restricted-syntax': [
            'error',
            { selector: "MethodDefinition[accessibility='private']", message: 'Do not use private: use protected or public (docs/coding-standards.md).' },
            { selector: "PropertyDefinition[accessibility='private']", message: 'Do not use private: use protected or public (docs/coding-standards.md).' },
            { selector: "TSParameterProperty[accessibility='private']", message: 'Do not use private: use protected or public (docs/coding-standards.md).' },
            { selector: "TSAbstractMethodDefinition[accessibility='private'], TSAbstractPropertyDefinition[accessibility='private']", message: 'Do not use private: use protected or public (docs/coding-standards.md).' },
            { selector: 'PrivateIdentifier', message: 'Do not use #private members: use protected or public (docs/coding-standards.md).' },
        ],
    },
},
```

Merge these entries into an existing `no-restricted-syntax` rule instead of replacing it. Rule 2 cannot be checked by ESLint; it is checked by review (bootstrap check 3a).

## Configuration contract

`config/env.ts` is the one configuration layer. It resolves values in this order: process environment (CI/CLI) → `.env` file (local, Git-ignored) → safe non-secret defaults, and validates them with a zod schema at startup with clear, non-secret error messages.

Support project-appropriate variables such as:

```text
PLATFORM=android|ios
TEST_ENV=qa|uat|staging
APPIUM_HOST, APPIUM_PORT
DEVICE_UDID, DEVICE_NAME, PLATFORM_VERSION
APP_PACKAGE, APP_ACTIVITY        # Android
BUNDLE_ID                        # iOS
APP_PATH                         # optional; empty = app already installed
NO_RESET
NEW_COMMAND_TIMEOUT
UIAUTOMATOR2_SYSTEM_PORT / WDA_LOCAL_PORT
MAX_INSTANCES
AUTOMATION_RESULTS_FILE          # default test-results/automation-results/automation-results.csv
TEST_DATA_DIR                    # split layout only: shared test data folder, default ../shared-contract/test-data
LOG_LEVEL
STEP_SCREENSHOTS                 # default true: screenshot before each submission and when a popup appears
```

Requirements:

- Never commit passwords, OTP seeds, API keys, customer data, tokens, or personal device identifiers.
- Commit only `.env.example`. Create the local `.env` yourself when it does not exist: copy the example and fill in every value derived during discovery (app package, launch activity or bundle ID, ports). Leave `DEVICE_UDID` empty, because this workflow does not connect to a device. Never overwrite an existing `.env`. Confirm it is Git-ignored.
- `config/environments/*.config.ts` hold per-environment non-secret values (API base URLs from the project, or empty when the project has none). `config/devices/*.devices.ts` hold capability presets that read device values from `env.ts`.
- Keep `NO_RESET` configurable and default to the safest project-appropriate behavior. Do not assume an app must be installed.

## Session lifecycle

`config/wdio.shared.conf.ts` and the platform configs must:

- build Appium capabilities from `env.ts` and the device presets (`appium:` prefixed);
- use `@wdio/appium-service` only when `APPIUM_HOST` is local; `wdio.grid.conf.ts` points at a remote Appium/grid instead;
- create a session only when a spec runs, never during type-checking or config loading;
- default to `maxInstances: 1`; parallel runs need one device and one set of ports (`systemPort`/`wdaLocalPort`) per worker;
- set `mochaOpts.timeout` and `mochaOpts.retries` (default `2`, so a failed test runs up to 3 attempts) from configuration;
- capture sanitized session-creation errors in the log.

## Page-object and wait foundation

`BasePage` and the utilities must:

- follow "Method rules" above: no `private` anywhere (every `BasePage` helper is `protected` or public), and every method and function logs start, finish and `describeError` on failure, then rethrows;
- export `type ElementLocator = () => ChainablePromiseElement` and protected builders that return one lazily, so page objects assign locators in their constructor before a session exists;
- provide the builders in priority order (implemented in `src/utils/Locators.ts`, platform-aware): `byRole(role, name)` (≈ getByRole: Android class + content-desc, iOS type + label), `byId(id)` (≈ getById: Android resource-id, iOS accessibility identifier), `byLabel(label)` (`~label`), `byText(text)`, `byXPath(xpath)` last; plus `byAria(name)` and `byCss(selector)` for web view contexts;
- give every page a child logger, `protected readonly logger = logger.child({ page: this.constructor.name })`, and export `describeError(error)` (one redacted line) from `src/utils/Logger.ts`;
- provide atomic actions that take a human description and log it: `tap(locator, description)`, `type(locator, value, description, secret = false)` (a secret is never logged and is registered with the Redactor), `clear`, `textOf`, `scrollTo`; each logs `describeError` on failure and rethrows;
- capture step screenshots automatically (see "Result and evidence foundation"): export `SUBMIT_ACTION` (a regex over the tap description: login/log in, logout, save, submit, continue, confirm, proceed, next, send, resend, sign up, register, ok, yes, done, apply, update, reset, unlock, verify, try again, change password) and `POPUP` (popup, dialog, alert, toast, snackbar, bottom sheet, message, error); `tap` captures the screen after the element is displayed and before the click when its description matches `SUBMIT_ACTION`, and `expectDisplayed` captures it once shown when its description matches `POPUP`; provide `protected captureScreen(label)` for a submission or popup a page reads another way (for example a "read the popup's message" method); descriptions therefore name the control or popup (`'the Login button'`, `'the "Login Failed" message'`);
- provide polling check helpers with an explicit wait for `verify...` methods: `expectDisplayed`, `expectText`, `expectAttribute`, `expectEnabled` (expect-webdriverio with `wait` and `interval`), `expectAbsent` (one check, after a positive anchor) and the boolean `isShown(ms)` / `isDisplayedWithin(locator, ms)`;
- provide `maskValue(value)` in `src/utils/Redactor.ts` for logging identifiers;
- provide bounded, polling waits for displayed, present, enabled, clickable, text and absence (`waitForDisplayed`, `waitUntil`), with defaults in `constants/timeouts.ts` (15 s standard, 20 s back-end response);
- never use fixed sleeps as synchronization;
- centralize tap, type, clear, scroll/swipe (`GestureUtils`), hide keyboard, and element-state reads;
- produce actionable timeout messages without logging credentials or sensitive field values (`Redactor`);
- let platform-specific pages extend common pages (`pages/android`, `pages/ios`) without branching inside test bodies.

## Test traceability contract

These conventions are what implement-testcases-v2 and its run scripts rely on. Document them in `src/tests/regression/README.md` and `docs/framework-architecture.md`.

- One spec file per implemented user story, inside a folder named after the approved workbook: `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts` (Web: `.spec.ts`). `<WorkbookFolder>` is the workbook's file name without `.xlsx`, exactly (spaces and version kept); `<StoryLabel>. <Story title>` is the story as the workbook names it (`US-002. Login Screen - Customer ID & Password Authentication.test.ts`), with `< > : " / \ | ? *` and control characters removed. Naming, moving flat specs and pending stories: implement-testcases-v2 `references/regression-layout.md`.
- A folder or file proves nothing: a story's file is created with its first `it()`, pending stories get none, and implementation is read only from `it()` titles. Runners get spec paths as separate arguments (no shell), so spaces and `&` are safe. Testcase-to-`it()` mapping for a workbook searches that workbook's folder (the whole `src/tests/regression/` only when the folder does not exist yet).
- One top-level `describe('<StoryId> <story name>')` per spec.
- One `it()` per testcase ID. The title starts with the exact ID, a colon and the workbook title: `it('TC_US003_001: Verify ...', async () => { ... })`. One ID maps to exactly one `it()`, and a test body never branches on the platform.
- `src/reporting/testCase.ts` exports `testCaseIdOf(title)` (the regex `^(TC_[A-Za-z0-9_]+):`), and adds the ID as an Allure `tms`/label in a `beforeTest` hook.
- A test that cannot prove its expected result throws `BlockedError(reason)`; it is recorded as `Blocked`, never `Fail`.
- Selection runs use `--spec <file>` plus one grep argument built as `(?:^|\s)(?:<ID1>|<ID2>):`. Mocha (and Playwright) match the grep against the **full title**: the enclosing `describe()` names, a space, then the `it()` title (`Customer ID and Password TC_US002_025: Switch tab`), so a pattern anchored only at the start (`^(?:...):`) matches nothing inside a suite. The ID must follow the start or whitespace; the `:` keeps `TC_US002_025` from matching `TC_US002_0250`. Validate every ID against `^TC_[A-Za-z0-9_]+$` before it goes into the regex, pass the pattern as one argument, and start the runner without a shell (Node `spawn(cmd, args, { shell: false })`, PowerShell `& node <wdio.js> @args`): through `cmd.exe` (npm/npx `.cmd` shims, Jenkins `bat`) `|` is a pipe and `^` an escape.
- `config/wdio.shared.conf.ts` (and `playwright.config.ts`) read an optional `TEST_IDS` (comma-separated): every ID is validated, then `mochaOpts.grep` (Playwright: `grep`) is set in-process to `new RegExp('(?:^|\\s)(?:' + ids.join('|') + '):')`; an invalid ID stops the run before a session. Jenkins and any other shell-based caller pass `TEST_IDS` instead of a grep argument.
- `testCaseIdOf(title)` keeps `^(TC_[A-Za-z0-9_]+):` because it reads the `it()` title alone (`test.title`), never the full title.

Do not create story specs during bootstrap.

## Result and evidence foundation

`ResultWriter.ts`, wired from the `afterTest` hook in `wdio.shared.conf.ts`, writes one CSV row per testcase attempt that finishes (the last attempt wins) to `AUTOMATION_RESULTS_FILE`, with this exact header:

```text
Test Case ID,Execution Status,Actual Result,Automation Remark,Spec File,Test Title,Duration (ms),Timestamp
```

- `Execution Status` uses `statuses.ts`: passed → `Pass`, `BlockedError` → `Blocked`, other failure → `Fail`, pending/skipped → `Skip`. `Not Executed` exists in the vocabulary but the writer never assigns it.
- `Actual Result` is the sanitized assertion or error message; `Automation Remark` is optional notes from the test.
- Quote fields per RFC 4180, write UTF-8, flush after each row, and create the folder when missing.
- `AllureEvidence.ts` attaches a screenshot, page source and redacted diagnostic text on failure, skip or block, with unique filesystem-safe names under `screenshots/`.
- **Step screenshots.** `AllureEvidence.step(label)` saves `screenshots/steps/<TestCaseID>/<NN>_<label>_<time>.png` (NN numbered per test from 01) and attaches it as `Screenshot <NN>_<label>`. `BasePage` calls it before every submission tap and when a popup or message is shown (Page-object foundation). It is evidence only: a failed capture is logged as a warning and never fails the test. `STEP_SCREENSHOTS=false` turns it off for faster runs.
- **Per-test log.** `Logger.ts` writes every line to four outputs: the console (terminal and Jenkins console), `logs/automation.log` (JSON lines), `logs/automation.txt` (the console lines) and a per-test buffer. `beforeTest` calls `startTestLog()` and `afterTest` attaches `takeTestLog()` as the `Logger` attachment of every attempt, so each test in Allure carries its own step-by-step log, redacted like every other output.
- **One shared test state.** WebdriverIO loads `wdio.shared.conf.ts` and the spec files through separate module loaders, so a module-level variable set in a hook is a different variable from the one page objects see. The running test's name, its log lines and its screenshot count live on `globalThis` (`src/utils/TestState.ts`, keyed by `Symbol.for(...)`); `beforeTest` sets them (`setCurrentTest`, `startTestLog`, `AllureEvidence.startTest`).
- `Redactor.redact` keeps the quotes of a quoted value (`password="***"`), so a redacted page-source attachment stays well-formed XML; otherwise `allure generate` fails to parse it and prints a stack trace for every such file.

The bootstrap must not assign any status to a real testcase.

## Allure foundation

- `@wdio/allure-reporter` writes to `allure-results/` (`disableWebdriverStepsReporting: true`, `disableWebdriverScreenshotsReporting: true`: every screenshot is attached by name through `AllureEvidence`, and the reporter's automatic copy would only add unnamed duplicates).
- `@wdio/junit-reporter` writes `test-results/junit/*.xml` (`outputDir: 'test-results/junit'`), the path `Jenkinsfile.mobile` publishes.
- `npm run report` is `allure generate allure-results --clean -o allure-report && node scripts/allure-extras.mjs`; it and `scripts/generate-allure-report.*` generate `allure-report/` and work even when tests failed.
- `scripts/allure-extras.mjs` adds two folders to the generated report, each with an `index.html` linking back to the report, limited to the current run (files and log lines not older than the oldest file in `allure-results/`, minus 2 minutes, so output kept from earlier local runs is left out):
  - `allure-report/logger/`: `automation.log` (from `logs/automation.txt`), `appium.log`, `console.log` (the run script's terminal output, when the run script wrote one) and the wdio worker logs from `logs/wdio/`;
  - `allure-report/Screenshots/`: every screenshot of the run, step screenshots under `steps/<TestCaseID>/`, shown as a thumbnail grid.
- A run script that runs wdio (implement-testcases-v2's `run-tests.ps1`) tees the terminal output it prints into `logs/console.log`.
- Do not claim an Allure report is valid until a real run supplies results.

### Workbook run commands (all platforms)

Build `npm run smoke -- "<Workbook>.xlsx" [--dry-run]` and `npm run regression -- "<Workbook>.xlsx" [US002 US003] [--dry-run]` exactly to `references/workbook-commands.md`: explicit approved workbook (names with spaces, unsafe paths rejected), ID + exact title matching within the workbook, separate candidate / implemented / missing / excluded / selected counts, partial smoke allowed and labelled, Android preflight (process env > `.env`, auto-detected single device, app installed, awake, unlocked, app in the foreground, free ports, no install / unlock / clear / kill), retries 0 and one worker, live INFO terminal logging with quiet WebDriver logs, a unique run folder `test-results/runs/<RUN_ID>/` with configurable reporter outputs (`ALLURE_RESULTS_DIR`, `JUNIT_DIR`, `AUTOMATION_RESULTS_FILE`, `LOG_DIR`; old defaults kept), a run lock, the documented exit codes, and the automatic per-run report under `report/runs/<RUN_ID>/` with `report/<RUN_ID>.zip` and the refreshed `report/index.html`. They never write the workbook unless `--update-workbook` is given and leave `.\run`, `smoke:run` and `report:share` unchanged. Document them in `docs/run-commands.md` and at the top of `README.md`, and add the device-free tests (`npm run run-commands:test`). At bootstrap no workbook exists: validate with the tests only.

### Shareable report foundation (all platforms)

Every framework (Mobile, Web, and each framework of Mobile + Web) gets the shareable report section of `references/share-report.md`: build it at bootstrap exactly to that contract.

- **Run metadata on every result:** Allure labels `executionType` (`smoke` / `regression` from `EXECUTION_TYPE`, else `unknown`), `runId`, `specFile`, `storyId`, `storyName`, `testCaseId`, `platform`, `environment`, `workbook` (from `WORKBOOK` or the spec's workbook folder), `epic` (= `<WorkbookFolder>`) and `feature` (= `<StoryId> <story name>`), added in `beforeTest` (Mobile) or the base fixture (Web). Execution type is never inferred from a testcase ID.
- **Raw results kept per run:** regression runs archive `allure-results/` + `run.json` in `test-results/allure-archive/<RunId>/` (`scripts/run.ps1` does it for Android; `npm run test:regression` = `scripts/report/run-regression.mjs` does it for Web, iOS and any direct run); smoke runs keep theirs in `reports/smoke/<WorkbookName>/<BuildId>/` with the same `run.json`.
- **`npm run report:share`** (`scripts/report/build-share-report.mjs`) writes `report/` (`index.html` dashboard, `smoke/index.html`, `regression/index.html` listing every epic, `regression/<WorkbookFolder>/index.html` = one Allure report per epic with all its user stories, `README.md`, `report-scope.json`, `<Application>-Allure-Reports-<YYYY-MM-DD>.zip`) from sanitized copies, with the local Allure CLI and `--single-file` when the installed version supports it. It refuses ambiguous classification and foreign or out-of-tree destinations, never edits raw results or generated Allure HTML, and labels the category **Regression** (never "Normal").
- **Fixture tests** (`npm run report:share:test`) as listed in `references/share-report.md`, section 5. No real report is generated at bootstrap.

## Suite foundation

- `suites/templates/story-suite.template.json` shows the shape implement-testcases-v2 and the run scripts use:

```json
{
  "story": "{{StoryId}}",
  "platform": "{{android|ios|web}}",
  "spec": "src/tests/regression/{{WorkbookFolder}}/{{StoryLabel}}. {{Story title}}.test.ts",
  "ids": ["{{TC_ID_1}}", "{{TC_ID_2}}"]
}
```

- `suites/README.md` documents normal, diagnostic, isolated-rerun and status-filtered suites, and that `suites/<Workbook>/<platform>/passed/` and `.../failed/` are created later from real results, not during bootstrap.

## Workbook extension points

Create only the directories and documented contracts later workbook-driven workflows need:

- `testcase/Generated Testcases/`, `testcase/Review Reports/` and `testcase/Revised Testcases/` for the workbook lifecycle (first generation, reviews, revised versions; see "Testcase folder");
- `testcase/Testcases/` for unchanged input workbooks (the QA-approved version);
- `testcase/CSV Files/<Feature Name>/` for approved result CSVs (`CSV Files/<Platform>/<Feature Name>/` in the shared Mobile + Web folder);
- `testcase/Output Testcases/` for canonical updated workbooks (one per platform: `Android-`, `iOS-`, `Web-`, `PWA-<name>.xlsx`);
- where `testcase/` is: see "Testcase folder" (with Mobile + Web it is the one shared `<AutomationDir>/testcase/`);
- `scripts/testcase-output/` for later workbook utilities;
- `automation-handoff/` for handoff files.
- `evidence/<platform>/<Screen>/` for locator evidence: the UI dumps and screenshots each page object's locators were taken from, and a `locators.md` per screen (one row per locator: strategy, value, evidence node, verified Yes/No). `scripts/capture-evidence.*` writes the dump and screenshot and replaces `.env` test-account values with `{{NAME}}`. The folder is committed, not Git-ignored.

Do not create workbook-specific scripts, mappings or output files before a workbook is supplied. Document that later workflows must preserve the input workbook, match by exact testcase ID, and keep one canonical output workbook per platform.

## Web framework (Playwright)

Built when the platform is Web or Mobile + Web, always at `<AutomationDir>/Web` (`<WebRoot>`). With Web only, `<WebRoot>` is self-contained: it also holds `jenkins/Jenkinsfile.web`, `.github/workflows/web-tests.yml`, `docs/` (the four docs, web only), a full `README.md` and `.gitignore`, and nothing else is created in `<AutomationDir>`. With Mobile + Web those files are the shared root files at `<AutomationDir>` instead. It follows the same contracts as the mobile framework (traceability, result CSV, Blocked status, logging, redaction, step screenshots, Allure with `logger/` and `Screenshots/`, suites, workbook folders), implemented with Playwright Test instead of WebdriverIO + Appium.

### Web technology baseline

| Component                        | Technology                                                                                                                                                                            | Purpose                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Language                         | TypeScript (`strict: true`)                                                                                                                                                           | Type safety and maintainability                       |
| Browser automation + test runner | Playwright Test (`@playwright/test`)                                                                                                                                                  | Runs tests in Chromium, Firefox, WebKit; auto-waiting |
| Assertions                       | Playwright `expect` (web-first, auto-retrying)                                                                                                                                        | Validates app behavior                                |
| Design pattern                   | Page Object Model + components, page objects provided through Playwright fixtures                                                                                                     | Separates test logic from UI                          |
| Test data                        | JSON + TypeScript fixtures, schema-validated                                                                                                                                          | Manages test data                                     |
| API helpers                      | Playwright `APIRequestContext` (`request` fixture)                                                                                                                                    | Test-data setup and API checks (no Axios)             |
| Reporting                        | `allure-playwright` + `allure-commandline`, Playwright `html` (`playwright-report/`) and `junit` (`test-results/junit.xml`, read by Jenkins) reporters, plus the results CSV reporter | Execution reports                                     |
| Logging                          | Winston                                                                                                                                                                               | Structured logs                                       |
| Configuration                    | dotenv + zod validation                                                                                                                                                               | Environment-specific settings                         |
| Code quality                     | ESLint (flat config, `typescript-eslint`, `eslint-plugin-playwright`) + Prettier                                                                                                      | Coding standards                                      |
| CI/CD                            | `jenkins/Jenkinsfile.web` + `.github/workflows/web-tests.yml`                                                                                                                         | Automated execution                                   |
| Parallel execution               | Playwright workers (`WORKERS`), `fullyParallel` per file                                                                                                                              | Faster runs                                           |

Do not add WebdriverIO, Appium, Selenium, Cypress, Cucumber or Jest to the web framework. Pin every dependency to the exact version resolved at install time and commit `package-lock.json`.

### Web framework structure

```text
<WebRoot>/
|-- config/
|   |-- env.ts              # dotenv + zod: the one configuration layer
|   |-- browsers.ts         # Playwright projects: chromium (default), firefox, webkit; desktop/mobile viewport presets
|   `-- environments/
|       |-- qa.config.ts    # BASE_URL / API base URL per environment; empty when not known (deferred)
|       |-- uat.config.ts
|       `-- staging.config.ts
|-- src/
|   |-- tests/
|   |   |-- smoke/          # README only at bootstrap; later <WorkbookName>/<StoryId>.test.ts (Web: .smoke.json) and generated/<WorkbookName>/manifest.json
|   |   |-- regression/     # README only at bootstrap; later <WorkbookFolder>/<StoryLabel>. <Story title>.test.ts
|   |   `-- integration/    # README only at bootstrap
|   |-- pages/
|   |   `-- common/
|   |       `-- BasePage.ts # feature pages go in src/pages/ later
|   |-- components/         # README only at bootstrap
|   |-- fixtures/
|   |   |-- base.fixture.ts # test = base.extend<{...}>: page objects, logger, evidence; specs import test/expect from here
|   |   `-- test-data.fixture.ts
|   |-- services/
|   |   |-- api.service.ts  # wraps the request fixture
|   |   |-- auth.service.ts # storage-state login helpers (no credentials in code)
|   |   |-- test-data.service.ts   # shared data + test-data.local.json overrides
|   |   `-- test-value.service.ts  # resolveTestValue: opt-in workbook Test Data cell / synthetic fallback
|   |-- data/
|   |   |-- README.md       # points to the shared test data (see "Shared test data")
|   |   |-- synthetic-data.ts  # explicit field -> label map and Faker generators
|   |   `-- test-data.schema.ts  # zod validator built from <TEST_DATA_DIR>/test-data.schema.json
|   |-- reporting/
|   |   |-- statuses.ts     # Pass, Fail, Skip, Blocked, Not Executed
|   |   |-- BlockedError.ts
|   |   |-- testCase.ts     # testCaseIdOf(title); adds the ID as an Allure tms/label
|   |   |-- ResultReporter.ts  # Playwright custom reporter: the results CSV
|   |   `-- AllureEvidence.ts  # step screenshots + failure attachments via testInfo.attach
|   |-- utils/
|   |   |-- Locators.ts     # getByRole -> getByTestId -> getByLabel -> getByText -> css -> xpath
|   |   |-- ErrorUtils.ts   # describeError
|   |   |-- Logger.ts       # console + logs/automation.log (JSON) + logs/automation.txt + per-test buffer
|   |   `-- Redactor.ts     # redact, maskValue
|   |-- assertions/
|   |   |-- web.assertions.ts
|   |   `-- api.assertions.ts
|   |-- constants/
|   |   |-- timeouts.ts
|   |   `-- endpoints.ts
|   `-- types/
|       |-- user.types.ts
|       `-- test-data.types.ts
|-- suites/                 # same as the mobile framework ("platform": "web")
|   |-- templates/story-suite.template.json
|   `-- README.md
|-- test-data/             # Web only: qa.json, uat.json, staging.json, test-data.schema.json (shared format);
|                           #   with Mobile + Web this folder is ../shared-contract/test-data/ instead
|-- testcase/               # Web only; with Mobile + Web the shared ../testcase/ is used instead
|   |-- Generated Testcases/
|   |-- Review Reports/
|   |-- Revised Testcases/
|   |-- Testcases/
|   |-- CSV Files/
|   `-- Output Testcases/
|-- automation-handoff/      # .gitkeep
|-- evidence/
|   |-- README.md
|   `-- web/                # .gitkeep; <Page>/<state>.html|.png + locators.md
|-- Jira/                   # Web only; with Mobile + Web the shared <AutomationDir>/Jira/ is used instead
|-- report/                 # generated (Git-ignored): same layout as mobile (runs/, snapshots/, dashboard)
|-- scripts/
|   |-- smoke/               # same smoke tooling as mobile, Playwright selection
|   |-- report/              # same share-report tooling as mobile (allure-playwright labels)
|   |-- run/                 # same npm run smoke / regression commands (Playwright runner, no device preflight)
|   |-- verify-environment.(ps1|sh)   # Node, npm, Playwright browsers, Allure, BASE_URL set
|   |-- generate-allure-report.(ps1|sh)
|   |-- allure-extras.mjs    # same as mobile: allure-report/logger/ and allure-report/Screenshots/
|   |-- capture-evidence.(ps1|sh)     # DOM snapshot + screenshot of a URL into evidence/web/<Page>/ (headless)
|   |-- cleanup.(ps1|sh)
|   `-- testcase-output/
|       `-- README.md
|-- .env.example
|-- .prettierrc
|-- eslint.config.js
|-- package.json
|-- package-lock.json
|-- playwright.config.ts
|-- tsconfig.json
`-- README.md               # Mobile + Web: short, links to ../docs/; Web only: the full README
                            # Web only, also here: jenkins/Jenkinsfile.web, .github/workflows/web-tests.yml, docs/, .gitignore
```

Generated at run time and Git-ignored: `test-results/`, `playwright-report/`, `allure-results/`, `allure-report/`, `logs/`, `screenshots/`, `.auth/` (storage state).

### Web build, configuration and runner contract

`package.json` scripts (the names match the mobile framework where the job is the same; `Jenkinsfile.web` calls `typecheck`, `lint` and `report`):

| Script                    | Does                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `typecheck`               | `tsc --noEmit`                                                                              |
| `lint` / `lint:fix`       | ESLint over `config/`, `src/`, `playwright.config.ts`                                       |
| `format` / `format:check` | Prettier                                                                                    |
| `test`                    | `playwright test`                                                                           |
| `test:headed`             | `playwright test --headed`                                                                  |
| `test:list`               | `playwright test --list --pass-with-no-tests` (no browser launched)                         |
| `report`                  | `allure generate allure-results --clean -o allure-report && node scripts/allure-extras.mjs` |
| `report:share`            | build the shareable `report/` section from saved results (`references/share-report.md`)     |
| `report:share:test`       | fixture tests of the report builder, no browser                                             |
| `test:regression`         | labelled `npx playwright test` run + raw-results archive (`scripts/report/run-regression.mjs`) |
| `smoke`                   | `node scripts/run/cli.mjs smoke`: workbook P0 run (partial allowed, labelled) + per-run report (`references/workbook-commands.md`) |
| `regression`              | `node scripts/run/cli.mjs regression`: workbook regression run, optional story IDs + per-run report |
| `run-commands:test`       | device-free tests of `scripts/run/`                    |
| `report:playwright`       | `playwright show-report`                                                                    |
| `clean`                   | remove generated run output                                                                 |

`config/env.ts` resolves process environment → `.env` → safe defaults and validates with zod. Variables:

```text
TEST_ENV=qa|uat|staging
BASE_URL                         # overrides the environment's URL (Jenkins parameter BASE_URL)
BROWSER=chromium|firefox|webkit
HEADLESS                         # default true
WORKERS, RETRIES                 # RETRIES default 2
ACTION_TIMEOUT, NAVIGATION_TIMEOUT, EXPECT_TIMEOUT
STORAGE_STATE                    # optional .auth/<user>.json
TEST_DATA_DIR                    # default ../shared-contract/test-data (Mobile + Web) or test-data (Web only)
AUTOMATION_RESULTS_FILE          # default test-results/automation-results/automation-results.csv
LOG_LEVEL
STEP_SCREENSHOTS                 # default true
```

`playwright.config.ts` must:

- read every value from `env.ts`; `use.baseURL` from `BASE_URL` or the environment config; never hardcode a URL;
- define the projects `chromium`, `firefox`, `webkit` (the names `Jenkinsfile.web` passes to `--project`);
- set `retries` (default `2`), `workers`, `timeout`, `expect.timeout`, `use.actionTimeout`, `use.navigationTimeout`, `use.trace: 'retain-on-failure'`, `use.screenshot: 'only-on-failure'`, `use.video: 'retain-on-failure'`;
- register the reporters `['list']`, `['html', { outputFolder: 'playwright-report', open: 'never' }]`, `['junit', { outputFile: 'test-results/junit.xml' }]`, `['allure-playwright', { resultsDir: 'allure-results' }]` and `['./src/reporting/ResultReporter.ts']`;
- not start a web server or open a browser during type-checking or `--list`.

### Web page-object and traceability contract

- `BasePage` takes the Playwright `Page` in its constructor; page objects declare their elements as `readonly` `Locator` fields assigned in the constructor, built in priority order: `getByRole(role, { name })` → `getByTestId(id)` → `getByLabel(label)` → `getByText(text)` → `locator(css)` → `locator('xpath=...')` last (every XPath gets a handoff Note).
- Atomic actions take a human description and log it: `click(locator, description)`, `fill(locator, value, description, secret = false)` (a secret is never logged and is registered with the Redactor), `select`, `check`, `textOf`, `goto(path)` (relative to `baseURL`); each logs `describeError` on failure and rethrows.
- Step screenshots use the same `SUBMIT_ACTION` and `POPUP` rules as the mobile `BasePage`: before a matching click and when a matching popup/dialog/toast is visible, attached as `Screenshot <NN>_<label>`; `STEP_SCREENSHOTS=false` turns them off; a failed capture never fails the test.
- `verify...` methods use web-first assertions (`expect(locator).toBeVisible()`, `toHaveText`, `toHaveAttribute`, `toBeEnabled`, `toHaveURL`). Never use `page.waitForTimeout` as synchronization.
- Every page gets a child logger (`logger.child({ page: this.constructor.name })`).
- "Method rules" apply unchanged: no `private` anywhere, every method, fixture and helper logs start, finish and `describeError` on failure, then rethrows; the same `no-restricted-syntax` entries go into the web `eslint.config.js`.
- Traceability: one spec per implemented user story in the workbook folder, `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.spec.ts` (same naming rules as the mobile traceability contract); one `test.describe('<StoryId> <story name>')`; one `test()` per testcase ID whose title starts with the exact ID, a colon and the workbook title, with tags at the end: `test('TC_US003_001: Verify ... @regression', async ({ loginPage }) => { ... })`. Selection runs use the grep rule of the traceability contract (`(?:^|\s)(?:TC_A|TC_B):`, or `TEST_IDS` read by `playwright.config.ts`); tags `@smoke`, `@sanity`, `@regression`, `@cross-browser` are what `Jenkinsfile.web` filters on.
- `ResultReporter.ts` writes the same CSV header as the mobile `ResultWriter` (`Test Case ID,Execution Status,Actual Result,Automation Remark,Spec File,Test Title,Duration (ms),Timestamp`) on `onTestEnd`, the last retry wins: passed → `Pass`, a `BlockedError` → `Blocked`, other failure/timeout → `Fail`, skipped → `Skip`; RFC 4180 quoting, UTF-8, flush per row.
- The per-test log is attached as `Logger` through `testInfo.attach` in the base fixture, redacted like every other output.
- The base fixture adds the shareable-report labels (`executionType`, `runId`, `specFile`, `storyId`, `storyName`, `testCaseId`, `platform` = Playwright project, `environment`, `workbook`, `epic`, `feature`) with `allure.label(...)`; `report:share` works the same as on mobile ("Shareable report foundation").

Do not create feature pages, story specs, `login.spec.ts` or any sample business test at bootstrap.

### Web validation (in addition to the shared checks in "Bootstrap validation")

- `npm run typecheck`, `npm run lint`, `npm run format:check` pass in `<WebRoot>`.
- `npm run test:list` exits 0 with no browser launched.
- Playwright browsers: report "installed" only if the approved `npx playwright install chromium` finished and `npx playwright --version` ran; otherwise "not run (download not approved)".
- No URL, user or credential in `playwright.config.ts` or `src/`; `.env` holds `BASE_URL` only when it came from the user or a project file.

### Shared test-data validation (Mobile + Web)

- Every `shared-contract/test-data/<env>.json` parses and passes `test-data.schema.json` through zod `fromJSONSchema` in both frameworks.
- Neither framework has a `src/data/test-data.json`; both `test-data.service.ts` resolve `TEST_DATA_DIR` to the same folder.
- A loader check with a temporary data folder (`TEST_DATA_DIR` pointing at it, never the real files) shows: Web gets `common` + `overrides.web`, Mobile gets `common` + `overrides.android`; a missing `passwordEnv` variable and a schema violation each stop with a message naming the variable or field.

## Jira records folder

Every framework gets a `Jira/` folder at bootstrap, so every ticket raised later from automation is listed in one place:

| Layout | Folder |
| --- | --- |
| Mobile (flat) | `<AutomationDir>/Jira/` |
| Web only | `<AutomationDir>/Web/Jira/` |
| Mobile + Web | one shared `<AutomationDir>/Jira/` (each bug's `applicationImpacted` says Mobile or Web); never one inside `Mobile/` or `Web/` |

Create two files, never overwriting existing ones:

- `issues.json` from `assets/jira/issues.template.json`, with `{{APPLICATION_NAME}}` replaced by the confirmed application name and everything else left empty (`epic: null`, `bugs: []`). Bootstrap never contacts Jira and never invents a project key, URL, assignee or issue.
- `README.md` from `../smoke-bugs-to-jira/assets/jira-folder-README.md`, with the application name and platform filled in, the Records table empty, and "No CI job creates Jira issues." stated.

Later, `smoke-bugs-to-jira` fills `issues.json` only through `jira_bugs.py record`, after each issue was re-opened and verified in Jira. The layout it keeps:

```json
{
  "application": "<Application>",
  "projectKey": "<KEY>",
  "baseUrl": "https://<site>.atlassian.net",
  "recordedOn": "YYYY-MM-DD",
  "assigneeDisplayName": "<verified display name>",
  "epic": { "key": "<KEY>-<n>", "summary": "<Application> Smoke bugs automation", "url": "https://<site>/browse/<KEY>-<n>" },
  "bugs": [
    {
      "key": "<KEY>-<n>",
      "parentKey": "<epic key>",
      "summary": "[<Application>][<Platform>][<TC_ID>] <observed problem>",
      "url": "https://<site>/browse/<KEY>-<n>",
      "testCaseIds": ["<TC_ID>"],
      "priority": "<evidence-based>",
      "environment": "<QA | UAT | ...>",
      "applicationImpacted": "<Mobile | Web>",
      "layer": "<Front End | Back End | ...>",
      "impact": "<impact>",
      "classification": "<triage category>",
      "workbook": "<approved workbook file>",
      "worksheet": "<sheet>",
      "worksheetRow": 0,
      "businessRule": "<rule / requirement ID>",
      "observedAt": "<ISO timestamp>",
      "attachment": { "filename": "<file>", "localPathRelativeToJiraFolder": "../screenshots/failures/<file>.png", "persistedAndOpenedInJira": true },
      "verifiedAt": "<ISO timestamp>"
    }
  ],
  "notes": []
}
```

`Jira/` is committed (it holds no secrets: no token, email or test-account value; screenshots stay where the run saved them and are referenced by relative path).

## Scripts, CI and documentation

Mobile scripts must:

- check Node.js, npm, Java, Android SDK/ADB, Appium and its drivers, and Allure (`verify-environment`);
- check whether the configured Appium endpoint is reachable;
- start Appium without an unnecessary visible window and stop only the process they started;
- generate the Allure report;
- remove generated run output only (`cleanup`), never source, `.env`, workbooks or handoff files;
- print the resolved configuration with secrets redacted;
- support `-DryRun`/`--dry-run` or `-Help`/`--help`.

Web scripts do the same for the web framework (Node, npm, Playwright browsers, Allure, configured `BASE_URL`; report generation; cleanup; redacted configuration; dry-run/help) and have no Appium, device or ADB part.

Scripts must not install software, drivers, browsers, apps or global packages, and must not kill unrelated Appium, browser or Node processes.

CI:

- Jenkins pipelines live in `<AutomationDir>/jenkins/` and are generated from the universal templates in this skill (`assets/jenkins/`), never written from scratch and never copied from another project. See "Jenkins pipelines" below.
- `.github/workflows/mobile-tests.yml`: on pull request run `npm ci`, `typecheck`, `lint`, `format:check`; device tests only on `workflow_dispatch` with an Android emulator runner. Secrets only from the CI secret store.
- `.github/workflows/web-tests.yml` (Web): the same checks on pull request; on `workflow_dispatch` run `npx playwright install --with-deps chromium` and `npx playwright test --project=chromium`, upload `playwright-report/` and `allure-results/`.
- In the split layout (Mobile + Web) both workflows sit in `<AutomationDir>/.github/workflows/` and set `defaults.run.working-directory` to their framework root (`Automation/Mobile`, `Automation/Web`). With Web only, `web-tests.yml` sits in `Automation/Web/.github/workflows/` with working directory `Automation/Web`.

The README and `docs/` (Mobile + Web: the shared ones at `<AutomationDir>`, with a Mobile and a Web section, plus a short README in each framework root; Web only: the ones in `Web/`) must explain: where the framework sits in the workspace (`.github/_requirements/` input, `.github/skills/`, `orchestration/`, and the workbook lifecycle in `testcase/`: `Generated Testcases/` → `Review Reports/` → `Revised Testcases/` → `Testcases/` → `Output Testcases/`) and the pipeline flow, as a "Workspace and QA pipeline" section at the top of `docs/framework-architecture.md` with a tool-stack table; prerequisites and versions; configuration precedence and local `.env`; folder responsibilities; how to type-check and lint without a device; how a story spec is run (`npm run test:android -- --spec <file>`, and, once implement-testcases-v2 has installed the run scripts, `.\run <stories> -Type first|pass|fail|full`); where results, screenshots, logs and Allure output appear; how implement-testcases-v2 extends the framework; and common failures (Appium not reachable, unauthorized device, package mismatch, missing Allure results, port in use).

## Jenkins pipelines

Create `<AutomationDir>/jenkins/` with one file per pipeline confirmed in the discovery summary:

| File                         | When                                                                                           | Template                                     | Runs                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `jenkins/Jenkinsfile.mobile` | Mobile or Mobile + Web                                                                         | `assets/jenkins/Jenkinsfile.mobile.template` | the WebdriverIO framework on Android or iOS |
| `jenkins/Jenkinsfile.web`    | Web or Mobile + Web (or, with Mobile only, an existing web framework confirmed in the summary) | `assets/jenkins/Jenkinsfile.web.template`    | the Playwright web framework                |

Copy the template and replace only its `{{placeholders}}`; keep everything else as it is:

| Placeholder               | Value                                                                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{{AUTOMATION_DIR}}`      | the mobile framework root relative to the repository root, forward slashes (`Automation` flat, `Automation/Mobile` split, or `.` at the root)                                                                                                            |
| `{{WEB_AUTOMATION_DIR}}`  | the web framework root relative to the repository root (`Automation/Web`)                                                                                                                                                                                |
| `{{JENKINSFILE_PATH}}`    | the file's own path relative to the repository root (`Automation/jenkins/Jenkinsfile.mobile` and `Automation/jenkins/Jenkinsfile.web` for Mobile and Mobile + Web; `Automation/Web/jenkins/Jenkinsfile.web` for Web only), the Jenkins job's Script Path |
| `{{JENKINS_NODEJS_TOOL}}` | the Jenkins NodeJS tool name confirmed in the summary                                                                                                                                                                                                    |

The templates are universal and must stay that way in the generated files: no application name, package or bundle ID, URL, device ID, user or credential. Every run-time value is a build parameter (`PLATFORM`, `TEST_ENV`, `TEST_SUITE`, `SMOKE_WORKBOOK`, `SMOKE_PARTIAL`, `TEST_ID`, `SPEC`, `DEVICE_UDID`, `ANDROID_HOME`, `APP_PATH`, `APP_PACKAGE`, `APP_ACTIVITY`, `BUNDLE_ID` - exported only when filled in, so an empty parameter never hides the agent's own value; web: `TEST_SUITE`, `SMOKE_WORKBOOK`, `SMOKE_PARTIAL`, `TEST_ID`, `TEST_ENV`, `BASE_URL`, `HEADLESS`, `ALL_BROWSERS`) or comes from `.env`/Jenkins credentials. The mobile pipeline:

- runs every command through `run()` (`sh` on Linux/macOS agents, `bat` on Windows agents) inside `dir(AUTOMATION_DIR)`, because `checkout scm` checks out the whole repository;
- test types through `TEST_SUITE`: `smoke` (`npm run smoke -- "<WORKBOOK>"`, or the `smoke:run` gate with `SMOKE_GATE`), `regression` (`npm run regression -- "<WORKBOOK>" [STORIES]`), `integration` (`src/tests/integration/`, skipped with a message while it has no specs), `all` (regression + integration); `TEST_ID` / `SPEC` run directly; `WORKBOOK` empty = the only approved workbook (`scripts/ci/workbook.mjs`);
- device parameters `ANDROID_HOME` and `DEVICE_UDID`, and a **Device check** stage that runs `npm run ci:device` (`scripts/ci/device-info.mjs`: masked serial, manufacturer and model, Android version / SDK, screen awake / locked, installed app version; fails with the fix when not ready; `--launch-app` with `LAUNCH_APP` brings the app to the foreground); `scripts/ci/count-specs.mjs` lets an empty suite folder be skipped;
- credentials only by ID: `ENV_FILE_CREDENTIALS_ID` (Secret file copied to `.env` for the build and deleted in `post`) and `NORMAL_USER_CREDENTIALS_ID` (Username with password -> `LOGIN_NORMAL_USERNAME` / `LOGIN_NORMAL_PASSWORD`);
- stages: Checkout (+ `npm run clean`) → Install (`npm ci`) → Type-check and lint → Appium driver (`uiautomator2` or `xcuitest`, installed through the project's own Appium only when missing) → Device check (`adb devices` with the `ANDROID_HOME` parameter or agent variable; iOS needs a macOS agent) → Mobile tests (`npm run test:<platform>`, with `--spec` for `SPEC` or the `TEST_SUITE` folder under `src/tests/`, and, for `TEST_ID`, the validated IDs passed as `TEST_IDS` so the wdio config builds the grep in-process (never a grep argument through `sh`/`bat`), matching the traceability contract; `TEST_SUITE=smoke` without `SPEC`/`TEST_ID` instead runs the P0 build gate, `npm run smoke:run -- --workbook "<SMOKE_WORKBOOK>" --platform <PLATFORM> --build-id "$BUILD_TAG"` (`--partial` when `SMOKE_PARTIAL`), and the web pipeline does the same with `--platform web`);
- post, always: JUnit from `test-results/junit/*.xml`, `npm run report` (allowed to fail), the Allure HTML published with `publishHTML` with three tabs (`index.html`, `logger/index.html`, `Screenshots/index.html`, titled Allure, Logger, Screenshots), and `test-results/**`, `screenshots/**`, `logs/**`, `reports/smoke/**` (the smoke run records) archived. Each Allure test also carries its own `Logger` attachment and step screenshots.

The scripts it calls (`clean`, `typecheck`, `lint`, `test:android`, `test:ios`, `smoke:run`, `report`) are the ones in the build contract; keep the names in step. The web pipeline calls `typecheck`, `lint` and `report` from the web build contract, and `npx playwright test` with the `chromium`/`firefox`/`webkit` projects and the `test-results/junit.xml` path that `playwright.config.ts` writes. Document in the README how to create the Jenkins jobs (Pipeline from SCM, Script Path `{{JENKINSFILE_PATH}}`), the plugins they need (NodeJS, JUnit, HTML Publisher, Timestamper) and that the mobile job's agent must be the machine the device is attached to.

## Repository hygiene and safety

- `.gitignore`: `node_modules/`, `test-results/`, `allure-results/`, `allure-report/`, `logs/`, `screenshots/`, `reports/smoke/` (archived by CI instead), `report/` (generated shareable reports), `.env`, `apps/**` binaries (keep `.gitkeep`), IDE files, temporary device dumps; with Web also `playwright-report/`, `blob-report/`, `.auth/`. With Web only it sits in `Web/`. In the split layout (Mobile + Web) it is one file at `<AutomationDir>` written with patterns that match in `Mobile/` and `Web/` (`**/node_modules/`, `**/.env`, `Mobile/apps/**`, ...).
- Preserve unrelated files and existing user changes. Never delete an existing framework; back it up only after the user chooses that in the discovery gate.
- Do not commit app binaries, reports, screenshots, credentials, or local machine paths.
- Do not hardcode organization names, application names, story IDs, package IDs, device IDs, usernames, or passwords in reusable code. Use placeholders only in templates.

## Bootstrap validation

### Mandatory workbook-driven smoke foundation

Build this capability into every selected framework (Mobile and/or Web); do not defer it to a manual run-time priority filter:

The full logic (selection, file layout, manifest schema, coverage checks, decision rule, run record) is `../implement-testcases-v2/references/p0-smoke.md`; build the tooling to that contract. In short:

- **Commands** (npm scripts, all taking `--workbook "<approved file name>"`; the code lives in `scripts/smoke/*.ts` and follows "Method rules"):
  - `smoke:generate` - writes the per-story smoke files and the manifest;
  - `smoke:check` - read-only coverage check, exits non-zero on a missing, duplicated, stale or mismatched case; `--with-project-checks` also runs typecheck, lint and the smoke fixture tests;
  - `smoke:run` - `smoke:check`, then the complete P0 run (`--platform android|ios`, optional `--build-id`), or with `--partial` a run of only the implemented cases labelled `PARTIAL - INCONCLUSIVE`; without `--partial`, incomplete coverage stops it before any session;
  - `smoke:record` - computes the decision from the manifest and the results CSV and writes the build's run record (called by `smoke:run`, runnable alone on an existing build folder).
  Document the actual names in the framework README and `src/tests/smoke/README.md`.
- **Inputs.** Resolve approved workbooks from the layout's `testcase/Testcases/` folder (the shared one in Mobile + Web). The user's confirmed version is selected explicitly when earlier versions are kept; never merge versions or choose one silently.
- **Selection.** Every story worksheet; only rows with **Automation Candidate = Yes**, **Priority = P0**, not `deleted`/`invalidated`, with a valid unique `TC_` ID (and `IOS Testcase = Yes` for iOS). Stories are discovered from the workbook, never hardcoded. No other criterion.
- **Layout.** `src/tests/smoke/<WorkbookName>/<StoryId>.test.ts` (one per story with implemented P0 cases: **the P0 tests themselves, hand-written, the only copy**; P1/P2 cases live only in `src/tests/regression/<WorkbookFolder>/`) and `src/tests/smoke/generated/<WorkbookName>/manifest.json` (all eligible cases, implemented and missing). `<WorkbookName>` drops `.xlsx`, the version suffix and a trailing `_TestCases`: `01_Biller_MDM_TestCases_v1_1.xlsx` → `01_Biller_MDM`.
- **P0 tests live in the smoke specs.** Mobile: the story's P0 `it()` blocks are written directly in `src/tests/smoke/<WorkbookName>/<StoryId>.test.ts` (no generated marker, no import of a regression spec); P1/P2 `it()` blocks only in the regression spec. `smoke:check` reports a P0 case in a regression spec or a P1/P2 case in a smoke spec as `MISPLACED`. `smoke:run` passes the smoke specs and `--mochaOpts.grep` built from the manifest's implemented IDs. Web: the same rule with `<StoryId>.spec.ts`.
- **One copy, both folders scanned.** Each case exists once, so the default wdio `specs` (smoke, regression and integration), `test:android`/`test:ios`, `npm run regression` and `.\run` include both folders and never run a case twice; Jenkins `TEST_SUITE=regression` runs `src/tests/regression/**` (P1/P2) and `TEST_SUITE=smoke` the P0 gate. Testcase-to-`it()` mapping (`scripts/lib/specs.mjs`, `scripts/testrun/common.py`) scans the workbook's regression folder and its smoke folder; a legacy `// @generated workbook-smoke` file is ignored by the mapping and reported `STALE`.
- **Ownership.** `smoke:generate` writes only `src/tests/smoke/generated/<WorkbookName>/manifest.json` (repeatable, byte-identical for unchanged inputs); it never writes a spec or an approved workbook.
- **Decision.** `INCONCLUSIVE` when coverage is incomplete, the run is partial, a selected ID has no result, or any result is Skip (environment) or Blocked; else `REJECT` when any P0 test failed; else `ACCEPT`.
- **Run record.** Each `smoke:run` writes `reports/smoke/<WorkbookName>/<BuildId>/` (`run-record.json`, `results.csv`, `allure-results/` when produced, `summary.md`) under a unique build ID (`--build-id`, else CI `BUILD_TAG`/`BUILD_ID`/`GITHUB_RUN_ID`, else `<platform>-<appVersion>-<yyyyMMdd-HHmmss>`), never overwriting an existing folder, with the app version read from the installed app. It then updates the separate output workbook by testcase ID through `scripts/testrun/testrun.py update --csv ...` when the run scripts are installed; the approved workbook is never written. Everything written goes through the `Redactor`; no credentials, device serials or test-account values.
- **Fixture tests (device/browser-free)** with small generated `.xlsx` fixtures: the exact eligible ID/title set across several story worksheets; exclusions (P1/P2, Automation Candidate No, deleted, invalidated, invalid ID); a duplicate ID failing; two stories producing two smoke files and one manifest; a story with only missing cases producing no smoke file; a workbook with no eligible rows; idempotent regeneration; refusing to overwrite an unmarked file; every `smoke:check` failure kind (missing, duplicate, title mismatch, stale, mismatch); the decision table (complete all-pass → ACCEPT, one Fail → REJECT, incomplete, partial, Skip, Blocked or no result → INCONCLUSIVE); a unique build folder; and unchanged non-smoke selection. Run them with typecheck, lint and format during bootstrap.
- **Bootstrap boundary.** Bootstrap creates the tooling, documentation and fixture tests only: do not read real testcase workbooks or generate business smoke specs here. `implement-testcases-v2` applies the gate during story implementation; a missing tool is a framework gap to fix, never permission to skip smoke.

Before declaring the foundation complete, run these checks in each framework root that was built or completed (the mobile checks below, and for Web also "Web validation"), and report them per framework:

1. `npm install` completed (only after the user approved it) and `package-lock.json` exists; every dependency version is pinned.
   1a. `npx appium driver list --installed` lists the driver of every target platform (`uiautomator2` / `xcuitest`) as installed, and `scripts/verify-environment` reports it OK; when it is missing, its hint is "run npm install", never a manual `appium driver install`.
2. `npm run typecheck` passes.
3. `npm run lint` and `npm run format:check` pass.
   3a. "Method rules": `eslint.config.js` has the `no-restricted-syntax` entries against `private`; a search of `config/`, `src/` and `scripts/` for `private ` and `#` members finds none; every method and function you wrote logs start, finish and failure (list any you left out under the allowed exceptions, with the reason).
   3b. `Jira/` exists at the layout's location with `issues.json` (valid JSON, application filled in, `epic` null, `bugs` empty) and `README.md`; no `Jira/` inside `Mobile/` or `Web/` in the split layout.
4. Every JSON file parses; `wdio.conf.ts` and each platform config load without starting a session (type-check covers this; do not run `wdio`).
5. Required directories and files exist.
   5a. The workbook folder exists at the layout's location (`<AutomationDir>/testcase/` for Mobile and Mobile + Web, `<AutomationDir>/Web/testcase/` for Web only) with all six sub-folders, `Generated Testcases/`, `Review Reports/`, `Revised Testcases/`, `Testcases/`, `CSV Files/`, `Output Testcases/`, each with a `.gitkeep`; no `testcase/` exists anywhere else (not inside `Mobile/`, and not inside `Web/` unless the layout is Web only); `.gitignore` does not exclude any of them.
6. `.env.example` contains no live secrets or personal identifiers; `.env` exists, is Git-ignored, and holds the derived app values (in framework-only mode the app values are empty and reported as deferred).
7. `.gitignore` excludes generated and local-only artifacts, including `test-data.local.json` (`git check-ignore` confirms it, when the folder is a Git work tree); `test-data.local.example.json` is not ignored and holds the empty structure only.
8. Reporting, config, page, utility and service modules type-check together.
9. Scripts run in dry-run/help mode without touching a device or app.
10. Documentation commands use the actual generated paths and script names.
    10a. `smoke:generate`, `smoke:check`, `smoke:run` and `smoke:record` exist, and their device/browser-free fixture tests pass the P0 smoke contract above (per-story smoke files, manifest, every coverage failure kind, the ACCEPT/REJECT/INCONCLUSIVE table, unique build folder); default runs exclude `src/tests/smoke/**`; no real business smoke specs were created at bootstrap.
    10b. Shareable report: the Allure labels of `references/share-report.md` section 2 are added in the shared hooks / base fixture; `scripts/report/build-share-report.mjs`, `scripts/report/run-regression.mjs`, `report:share`, `report:share:test` and `test:regression` exist; the fixture tests pass; `report/` is Git-ignored; `npx allure --version` and whether `--single-file` is supported are reported. No real report was generated.
    10d. Test data sources (`references/test-data-sources.md`): `test-data.service.ts` applies `test-data.local.json` field by field when present and works without it; `test-value.service.ts` and `src/data/synthetic-data.ts` exist with an empty field map; `@faker-js/faker` is pinned; `npm run test-data:test` passes. No real data, workbook value or generated value was written.
    10c. Workbook run commands: `smoke`, `regression` and `run-commands:test` exist; `npm run run-commands:test` passes; the configs read `ALLURE_RESULTS_DIR`, `JUNIT_DIR`, `AUTOMATION_RESULTS_FILE` and `LOG_DIR` with the old defaults; `docs/run-commands.md` exists; `npm run smoke -- "missing.xlsx" --dry-run` exits 2 with the usage text (no workbook exists yet).
11. Search all generated files for placeholder or invented identifiers (`com.example`, `com.mobile`, `com.company`, `myapp`, `MyApp`, `TODO`). Templates may keep `{{placeholder}}` tokens; the generated `jenkins/Jenkinsfile.*` may not (every token replaced). Check each Jenkinsfile only calls npm scripts that exist in `package.json` and publishes the JUnit path the reporter writes. Jenkins itself is not run. Fix anything else, and check every package, ID and activity matches the confirmed discovery summary.
12. Report any check that could not run because a download or local prerequisite was unavailable.

13. Split layout (Mobile + Web): `<AutomationDir>` has no `package.json`, `src/` or `node_modules/`; the shared root files (including `shared-contract/test-data/` and `testcase/` with `Generated Testcases/`, `Review Reports/`, `Revised Testcases/`, `Testcases/`, `CSV Files/`, `Output Testcases/`) exist; neither `Mobile/` nor `Web/` has a `testcase/` folder; neither framework imports a file from the other; the shared test-data validation passed. Web only: `<AutomationDir>` holds only `Web/`. Mobile: no `Mobile/` or `Web/` folder was created.

Report each check as passed, failed, or not run, with the reason for any check that did not run. Never report a check as passed unless you saw it pass. Do not run device or browser tests as part of bootstrap validation.

## Completion condition

The bootstrap is complete only when:

- the layout matches the chosen platform (flat for Mobile; only a self-contained `Web/` for Web; `Mobile/` + `Web/` with the shared root files for Mobile + Web);
- every framework skeleton that was chosen exists, type-checks and lints;
- no `private` keyword or `#private` member exists in the framework code and every method logs, as "Method rules" says (bootstrap check 3a);
- the workbook folder `testcase/` exists at the layout's location with all six lifecycle sub-folders (`Generated Testcases/`, `Review Reports/`, `Revised Testcases/`, `Testcases/`, `CSV Files/`, `Output Testcases/`), passing bootstrap check 5a;
- the `Jira/` records folder exists with its `issues.json` skeleton and `README.md` (bootstrap check 3b);
- local test-data overrides and the opt-in workbook / synthetic fallback exist and their device-free tests pass (bootstrap check 10d), and `test-data.local.json` is Git-ignored;
- configuration and secret-handling boundaries are documented;
- session, page, wait, reporting, result-writer, suite-template, CI (`jenkins/` pipelines for the confirmed project selection) and Allure foundations exist;
- the traceability and result contracts above are implemented and documented;
- `npm run smoke` / `npm run regression` with preflight, run isolation, lock and per-run reports exist and their device-free tests pass (bootstrap check 10c);
- the shareable report tooling (`report:share`, labels, run archive, fixture tests) exists for every framework built (bootstrap check 10b);
- the P0 smoke tooling (per-story generation, manifest, coverage check, complete/partial run, ACCEPT/REJECT/INCONCLUSIVE decision and per-build run record) is implemented, documented and fixture-tested, with no dependence on a manual run-time filter;
- no testcase workbook or feature implementation was required, and no sample business tests were created;
- no device, browser or application state was changed;
- the three intake questions were answered and the discovery summary was confirmed;
- every project-specific value traces to a project file or a user answer.

## Final handoff

Report:

- detected project type and repository root;
- the chosen platform, the layout, and each framework root with its npm package name;
- technology and pinned versions;
- files and directories created or completed, and any framework backed up (with its backup path);
- configuration variables and where developers set them, including the `.env` created and the values written to it;
- typecheck, lint and format results;
- commands for environment verification and for type-check/lint;
- the Jenkins pipelines created (`jenkins/Jenkinsfile.mobile`, and `jenkins/Jenkinsfile.web` when chosen), each with its Script Path for the Jenkins job;
- deferred values that still require project input;
- confirmation that no workbook was processed and no device or browser test was run;
- the source of each project-specific value (a file and line, or "user-provided");
- each validation as passed, failed, or not run, exactly as observed.

Report only what you did and observed in this session.

## Example request

```text
Bootstrap a reusable automation framework. Ask me only three questions, one at a time: the application project path, the automation directory path, then the target platform (Mobile, Web, or Mobile + Web; for Mobile also Android, iOS, or Android + iOS). Mobile is TypeScript + WebdriverIO + Appium + Mocha + Allure directly in Automation/; Web is TypeScript + Playwright + Allure in Automation/Web/; Mobile + Web puts them in Automation/Mobile/ and Automation/Web/ with jenkins/, CI workflows, docs, README and .gitignore shared at Automation/. Discover everything else from the project files and show it in one summary for me to confirm. Do not process a testcase workbook, create feature or sample tests, connect to a device, open a browser, or run Appium. Type-check and lint each skeleton, document configuration and extension points, and report the generated structure. Never guess any value; ask me instead.
```

Result for Mobile + Web:

```text
Automation/
|-- Jira/               README.md + issues.json: the raised smoke bugs of both frameworks
|   (Mobile/report/ and Web/report/: each framework's own shareable report section, generated)
|-- jenkins/            Jenkinsfile.mobile (runs in Automation/Mobile), Jenkinsfile.web (runs in Automation/Web)
|-- .github/workflows/  mobile-tests.yml, web-tests.yml
|-- docs/, README.md, .gitignore
|-- Mobile/             own package.json: WebdriverIO + Appium + Mocha + Allure
`-- Web/                own package.json: Playwright + Allure
```
