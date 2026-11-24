# Automation Playbook

Use this reference while inspecting the app and writing locators. This skill never runs tests.

## Discovery

- Search with `rg`/`rg --files` for the story ID, testcase IDs (`it('TC_...:` titles in `src/tests/`), visible labels, suite JSON, result CSV and page objects.
- Inspect repository instructions before edits. Preserve unrelated working-tree changes.
- Identify the build/package (iOS: bundle ID), device identifier, automation server URL, driver/ports, authentication state and configured search/test data from existing project files (`.env`, `config/env.ts`, `config/devices/`, `src/data/`) rather than hardcoding them into the skill.
- Read `platforms.md` for the platform being worked on. It lists the Android and iOS differences in tooling, locators and framework support.

## What a test may assert

Choose the strongest layer the connected device can show:

| Test state | What the test asserts |
|---|---|
| Navigation, tap, bottom sheet, live text | A connected-device Appium assertion |
| Current backend/feed value | A connected-device assertion that names the selected entity in the successful-result text |
| Visual position derived from a formula | The position or marker as shown on the device |
| Image-backed provider identity | The label and image shown on the device; note absent image semantics |
| Boundary map, mutually exclusive input, or missing data the live screen cannot show | Nothing: do not write an assertion. List the row as `Blocked` in the handoff. A fixture is never a substitute |
| Something is **absent** ("not pre-filled", "not shown", "not displayed") | First assert that the target screen is on the device **and shows readable content** (a heading, field label or control seen in its dump). Only then assert the absence. An absence check on an empty or unreadable screen passes for any screen and proves nothing |
| A screen whose UI hierarchy has no text, descriptions or hints (a web view or SDK that exposes no accessibility tree, a black screen) | Nothing the hierarchy can prove. List the rows that depend on its content as `Blocked`, quoting the dump ("only empty View nodes") |
| Two screens are "the same" | Compare a named element seen in the dump of each (a title, a first field label). Never compare two whole-screen value sets: two empty or unreadable screens compare equal |

Every check that something appears or changes state (element, page, keyboard, banner, message, selected tab, enabled button, masked or plain text) polls with a bounded wait: 15 s, or 20 s for a back-end response. It is never checked once right after the action. An absence check comes after a positive anchor instead of a wait. See `typescript-wdio-standards.md`, "Every expected check waits".

The decision about Pass, Fail and Blocked in the workbook belongs to the run scripts (`scripts/run-tests.ps1`). This skill only makes sure every written assertion can be proven on the device.

## Locator rules

Locators are built in the page object's constructor with the `BasePage` builders (`src/utils/Locators.ts`), in this priority order. Take the first one that matches exactly one element in the device dump:

| Priority | Builder | Playwright equivalent | Android (UiAutomator2) | iOS (XCUITest) |
| --- | --- | --- | --- | --- |
| 1 | `this.byRole(role, name)` | `getByRole` | element class + `content-desc` (`UiSelector().className(...).description(...)`) | element type + label/name (predicate string) |
| 2 | `this.byId(id)` | `getById` / `getByTestId` | `resource-id` (a Flutter `Semantics(identifier:)` shows here) | accessibility identifier |
| 3 | `this.byLabel(label)` | `getByLabel` | `content-desc` (`~label`) | accessibility label (`~label`) |
| 4 | `this.byText(text)` | `getByText` | `text` | label / value |
| 5 | `this.byXPath(xpath)` | `locator('xpath=...')` | last resort | last resort |

- Roles available to `byRole`: `button`, `textbox`, `checkbox`, `switch`, `image`, `text`, `link`, `tab`. Read the element's `class` in the dump to choose the role; if the class does not map to a role, go to priority 2.
- Inside a web view context (SDK or in-app browser pages), use `this.byAria(name)` (WebdriverIO `aria/`) and then `this.byCss('#id')` before XPath.
- Use `{ exact: false }` (contains) only when the dump shows the label carries extra text (for example a count); scope it so it still matches one element.
- Every XPath, and every coordinate or visual fallback, gets a handoff Note saying which higher-priority builders were tried and why they did not match.
- Bounded visual/coordinate evidence only when no locator route exists at all.

Never put a backslash in a UiSelector regex (`descriptionMatches`, `textMatches` in an `android=new UiSelector()...` selector). The selector is sent to the device as a Java-like string inside a TypeScript string, and a page-object helper that escapes it doubles every backslash: `account\??` reached the device as `account\\??`, never matched "Don't have an account?", and failed a row whose footer was on screen (US001 TC_US001_007). Use `.` in place of a special character instead (`account.?`, `don.t`).

Avoid generic text searches such as `Info` or `Read More` when a page contains multiple matching controls. Scope locators to the owning section. If the installed build lacks a semantic label, use a precise structural fallback and add the semantic label to source for future builds when authorized.

## Device inspection (mandatory before writing locators)

- Confirm the device is online before looking at its screen: Android in `device` state, not `offline` or `unauthorized`; an iOS simulator `Booted` or a real iPhone listed and trusted (commands in `platforms.md`). If none is online, stop and ask the user to connect one.
- Dump **every screen an in-scope row touches**, not only the first one. On Android: `adb shell uiautomator dump`, pull the file, plus `adb exec-out screencap -p`. Take each locator from these dumps; use app source only to understand behaviour or to find a label the dump does not show.
- Reaching a screen: launching the app, clearing its data (`pm clear`, which the tests do anyway), tapping navigation buttons and pressing Back are allowed. Typing into forms, submitting, ordering, paying, or any step that changes live data is not.
- Wait for a screen to settle before dumping it (about 5 s after an app start or a screen change). Dump a screen that loads slowly (an SDK, a web view) several times over 30-40 s and note how long it takes to appear; that time goes into the test's wait and the handoff Note.
- Record in the handoff Note, per row, the screens dumped and any locator that could not be verified on the device, with the reason. In the report, give the count of locators verified on the device.
- Do not run a test (`wdio run`) or a suite, and do not write a result anywhere. Whether the test passes is found out when the user runs the printed command, and any problem returns as a "Repairs needed" row in the handoff.
- Do not claim the connected app contains a source change unless that build was actually rebuilt and installed. Distinguish current-device evidence from source/test evidence.

## Locator evidence (`evidence/<platform>/<Screen>/`)

Every dump and screenshot the locators come from is kept in the project, one folder per page object:

```
evidence/
├── README.md
├── android/<Screen>/     <state>.xml, <state>.png, locators.md
└── ios/<Screen>/         same layout once iOS is automated
```

- `<Screen>` is the page object's name without `Page` (`LoginPage` -> `Login/`). `<state>` is lower case with dashes and names what the screen shows: `default`, `logging-in`, `login-failed-wrong-password`.
- Capture with `powershell -ExecutionPolicy Bypass -File scripts/capture-evidence.ps1 -Screen <Screen> -State <state>` once the screen is up. It saves the hierarchy and the screenshot and replaces `.env` test-account values (IDs, passwords, mobile numbers) with `{{NAME}}`. Never run it while a test run drives the same device. Appium page source saved during inspection is acceptable evidence too, after the same redaction.
- `locators.md` starts with the page files, device, app build and capture date, then one row per locator: `| Locator | Page (common/android/ios) | Strategy | Value | Evidence (file: node) | Verified |`. A locator with no dump (a screen not reached) is written only when a test must assert it, with `Verified` **No** and the reason; the handoff Note says the same.
- When a locator is repaired after an app change, capture the screen again, replace the old dump and update the row (date, build). Remove rows for deleted locators.

## Looking at a Flutter screen

- Flutter exposes `Text`/`Semantics` as `content-desc`, not `text`, which WebdriverIO's accessibility-ID selector (`~label`) matches exactly. Buttons (`AppButton`) are `android.widget.Button` nodes with the label as `content-desc`. Match case-insensitively with `android=new UiSelector().descriptionMatches("(?i)...")`; the app's casing (for example "Open An Account") often differs from the workbook's.
- A carousel page is one node whose `content-desc` is the title and the description joined by a newline (`&#10;` in the XML), with bounds covering the whole page. Identify a slide by asking whether a node with its keyword exists (`descriptionMatches("(?is).*keyword.*")`, one lookup per slide). Never read an attribute from a slide element: the carousel replaces the node and the read freezes the UI server.
- `EditText` nodes carry no `content-desc`. Address them by order (`className("android.widget.EditText").instance(n)`) and anchor on the label above. An empty field shows its placeholder in the `hint` attribute; check emptiness against that placeholder too.
- Tapping through screens changes app state (for example the stored "onboarding completed" flag). That is fine for inspection, because every test that needs the first-launch state clears the app data itself; say in the report that the state was changed.
- Workbook wording and app wording can differ (slide titles, button casing). Match on stable keywords from the workbook's test data, never on the app's exact text, and never weaken the expected result.

## Safe persistence

Automation code may change in-scope code, test assets and story suites. Do not delete unrelated reports or reset user changes.
