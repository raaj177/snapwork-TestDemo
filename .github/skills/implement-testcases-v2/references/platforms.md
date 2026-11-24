# Platforms (Android and iOS)

Used by implement-testcases-v2 (the run scripts do not cover iOS). It says what changes when the target is iOS instead of Android. Anything not mentioned here is identical for both platforms.

## Choose the platform

Settle the platform once, at the start of every run, before the workbook, scope or run type is used. If the request already names it ("run the iOS regression", "automate US003 for Android"), do not ask again. Otherwise ask one question: "Android or iOS?"

- One run covers one platform. Never mix platforms in one run, one workbook, one handoff file or one suite.
- Results, handoff reasons and Blocked decisions never carry over from one platform to the other. A row can be Pass on Android and Fail or Blocked on iOS.

## Which rows are in scope

| Platform | A row is in scope when |
| --- | --- |
| Android | `Automation Candidate` = Yes |
| iOS | `Automation Candidate` = Yes **and** `IOS Testcase` = Yes |

- Find the `IOS Testcase` column by header text (ignore case). If an iOS run is requested and the workbook has no such column, stop and tell the user.
- A blank or any value other than Yes in `IOS Testcase` means the row is not an iOS testcase. For iOS it is treated exactly like an `Automation Candidate: No` row: not implemented, not executed, not flipped, and it stays `Not Executed` in the iOS workbook.
- A row with `Automation Candidate` = Yes and `IOS Testcase` = No stays in scope for Android only.

## Files per platform

`<name>` is the file name of the input testcase workbook without `.xlsx`; it is also the `<Workbook>` folder under `suites/`.

| Item | Android | iOS |
| --- | --- | --- |
| Canonical output workbook | `Output Testcases/Android-<name>.xlsx` | `Output Testcases/iOS-<name>.xlsx` |
| Handoff file | `automation-handoff/<story>.md` | `automation-handoff/<story>-ios.md` |
| Story suite | `suites/<name>/android/<Story>.json` (P1/P2 regression spec) and `<Story>.smoke.json` (P0 smoke spec) | `suites/<name>/ios/<Story>.json` / `<Story>.smoke.json` |
| Status suites | `suites/<name>/android/passed/`, `failed/`, ... | `suites/<name>/ios/passed/`, `failed/`, ... |
| Run config | `config/wdio.android.conf.ts` (`npm run test:android`), `PLATFORM=android`, UiAutomator2 | `config/wdio.ios.conf.ts` (`npm run test:ios`), `PLATFORM=ios`, XCUITest |
| Result CSV name | the project's usual name under `test-results/automation-results/` | the same name with `-ios` added, for example `<name>-ios-passed-rerun.csv` |

- There is exactly one canonical workbook **per platform**. The two workbooks never share results.
- Create the iOS workbook by copying the **input** workbook. Never copy the Android output workbook, because it carries Android results. The Android workbook is created the same way.
- If an Android output workbook already exists under the old un-prefixed name (`<name>.xlsx`), it is the Android canonical workbook and holds the existing Android results. Never create a new `Android-<name>.xlsx` from the input workbook beside it. Ask the user once to confirm renaming it to `Android-<name>.xlsx`, keeping the file's content, and never keep both. Until the rename is confirmed, keep using the un-prefixed file for every Android run.
- Existing Android handoff files made before iOS support stay valid as they are: a handoff file without a platform tag in the header is Android. Do not move or rewrite it.
- The iOS story suite lists only the IDs of in-scope iOS rows. The `it()` tests of Android-only rows are left out of the JSON `ids`, never switched off with an `if` in code.

## One code base for both platforms

- One story spec per story, one `it()` per testcase ID, shared by Android and iOS. Never create a second spec, a `...ios.test.ts` copy or a second `it()` for the same ID.
- A test body never branches on the platform. All platform differences live in the framework (wdio platform configs, device presets, `BasePage`, `PlatformUtils`, `config/env.ts`) and in page objects (`src/pages/android`, `src/pages/ios` extending `src/pages/common`).
- An existing `it()` written for Android is `Keep` for iOS when the workbook row is unchanged. The iOS work is then in the page objects (an iOS locator or step), not in the test.

## iOS framework readiness (implement-testcases)

Before writing iOS code, check that the automation framework can start and drive an iOS session. If it cannot, add what is missing as the first step, report it as a framework change, and type-check and lint. Android behavior must stay unchanged: add the iOS path beside the Android one, never rewrite or reorder the Android path, and leave Android defaults (`PLATFORM` = android, `appium:automationName` = UiAutomator2) as they are. Because this skill cannot run a test, end the report by recommending an Android **Regression** run (`.un -Type pass`, see `run-tests`) to confirm Android still passes after the framework change.

- **Session config:** `config/wdio.ios.conf.ts` and `config/devices/ios.devices.ts` with XCUITest capabilities (`appium:automationName: 'XCUITest'`, `appium:bundleId` or `appium:app`, `appium:udid`, `appium:wdaLocalPort`, and for a real device the signing options `appium:xcodeOrgId`, `appium:xcodeSigningId`), all read from `config/env.ts`. Decide platform branches from `PLATFORM`, not from hard-coded values.
- **Config:** new keys for the iOS values (for example `BUNDLE_ID`, `WDA_LOCAL_PORT`, team ID) in the `env.ts` schema. Add them to `.env.example` with no real values. Never commit personal device IDs, team IDs or credentials.
- **Base page:** every Android-only helper (`android=new UiSelector()` selectors, `android.widget.*` class names, resource IDs, scrolling through `UiScrollable`, the hardware Back key `driver.back()`) needs an iOS counterpart or a platform switch inside `BasePage`/`PlatformUtils`.
- **Page objects:** where one element needs different locators per platform, keep the shared page in `src/pages/common` and put the platform locators in its `src/pages/android` and `src/pages/ios` variants for that screen.

## Locators on iOS

The same `BasePage` builders and priority as Android (`automation-playbook.md`, "Locator rules"); each builder produces the iOS form itself:

1. `this.byRole(role, name)`: predicate string on element type and label/name;
2. `this.byId(id)`: accessibility identifier (a Flutter `Semantics(identifier:)`);
3. `this.byLabel(label)`: accessibility label. In a Flutter app the `Semantics` label is exposed on both platforms through the same call;
4. `this.byText(text)`: predicate string on label or value;
5. `this.byXPath(xpath)`: only as a last resort (slow and fragile on iOS);
6. bounded visual or coordinate evidence only when no locator route exists.

When one element needs a different locator per platform, assign it in the platform page's constructor (`src/pages/ios/IOS<Screen>Page.ts` overriding the field), never with a platform `if` in a method.

Resource IDs and `UiSelector` exist only on Android. Do not assume the text an Android locator matches is the same text iOS exposes: check the iOS screen.

## Device and tooling on iOS

iOS automation runs on a Mac: the Appium server and the simulator or real iPhone are on that Mac. Use the repository's own scripts when they work there. Where a script is Windows-only (for example PowerShell), run the equivalent commands instead.

| Need | Android | iOS |
| --- | --- | --- |
| Is the device online? | `adb devices` shows `device` | simulator: `xcrun simctl list devices booted` shows `Booted`; real device: `xcrun xctrace list devices` or `idevice_id -l` lists it (trusted and unlocked) |
| Inspect the screen (mandatory before locators) | screenshot, UI hierarchy, `uiautomator dump` | screenshot, page source, Appium Inspector |
| Concurrent session port | UiAutomator2 system port | `wdaLocalPort` and a distinct device UDID |
| Which app build | package and activity | bundle ID; `.app` for a simulator, `.ipa` for a real device |
| Crash evidence | adb log | the iOS device or simulator log and crash report |

- A real device needs WebDriverAgent to be signed. If the session cannot be created because of signing, trust or a locked device, that is a setup problem for the user. Stop and report it; record no Fail or Skip for any row.
- Do not claim the connected app contains a source change unless that build was rebuilt and installed on that simulator or device.

## Behavior that usually needs an iOS repair

These are the usual reasons an Android-correct test needs an iOS fix. Fix them in `BasePage` or the page objects, never in the test body.

- there is no hardware Back key: the app's own back control must be tapped;
- system permission alerts (notifications, location, tracking) look and behave differently;
- the keyboard has no Back key and may need a Done or Return tap to close;
- date and option pickers are native wheels;
- scrolling and swiping use different gestures;
- text may differ because iOS exposes the Flutter semantic label, not the Android content description.
