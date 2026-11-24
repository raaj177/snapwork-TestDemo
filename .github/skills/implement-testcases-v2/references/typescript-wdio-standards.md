# TypeScript/WebdriverIO Standards

Coding standards for the story specs this skill writes. The test shape itself is in `../assets/testcase-method-template.md`. The framework contract (folders, scripts, result CSV, suite shape) is the one `automation-setup` creates.

## Reuse existing code first

Before writing anything for a story, scan the project, not only the story spec, for what already exists: the story's spec file, every `it()` whose title starts with a testcase ID (`it('TC_...:`), its page objects, components, services, `BasePage` helpers and the story suite JSON. Then work on what is there instead of starting fresh.

- A story spec that already exists is updated in place. Never create a second spec for the same story, and never regenerate or overwrite a spec, page object or suite file that already exists.
- Decide per in-scope row (`Automation Candidate: Yes`; for iOS also `IOS Testcase: Yes`):

| Decision | When | What to do |
| --- | --- | --- |
| **Keep** | An `it()` whose title starts with the exact ID and a colon exists, the title after the colon matches the workbook title, its steps follow the workbook's pre-condition, test steps and test data, and its assertions cover the expected result | Leave it untouched, including any hand edits |
| **Change** | The `it()` exists but the workbook row changed (title, pre-condition, steps, test data or expected result), or the user named the row for repair or Fail review | Edit only that `it()` and the page-object steps it needs |
| **Add** | No `it()` carries the ID | Add the `it()` to the existing story spec |
| **Blocked** | The device cannot show the state, the expected result is undefined, or showing it would change live data | List it in the handoff and write no `it()` |
| **Delete** | Workbook update only: the row's Test Case Type is `deleted`, or the user agreed to delete an `it()` whose row left the workbook | Remove the `it()` and the code only it used (`workbook-update.md`, "Deleting a testcase") |

- Compare every one of those fields, not only the title and expected result: a changed step or test data value with the same title is still a Change. In a workbook update the `testrun.py diff` table names the changed fields.
- If you cannot tell whether an existing `it()` still matches its workbook row, do not rewrite it. List it in the report as needing the user's decision.
- Reuse existing page objects, locators and helpers before adding new ones. Add a missing locator to the screen's existing page object instead of creating a second object for the same screen.
- Android and iOS share one story spec and one `it()` per ID. When iOS support is added to an Android test, change the page objects (`src/pages/common` plus a variant in `src/pages/android` or `src/pages/ios`), not the test, and never add a platform `if` to a test body. See `platforms.md`.
- Add new IDs to the existing story suite JSON instead of replacing the file. In a workbook update `testrun.py reset-suites` rewrites the Android story suites from the new workbook instead. The iOS story suite is a separate file under `suites/<Workbook>/ios/` that lists only the IDs of in-scope iOS rows.
- Outside a workbook update, never delete an `it()` whose ID is no longer in the workbook. List it in the report as having no matching workbook row. In a workbook update follow `workbook-update.md`.

## Smallest complete automation

- Reuse the repository's wdio configs and device presets, page objects, app/session services, hooks, suite format and `ResultWriter`.
- Use a readable testcase-per-`it()` structure as the required TypeScript/WebdriverIO format in every project. It provides direct testcase traceability, focused debugging, and clear terminal, spec-reporter and Allure reporting. Existing well-structured specs may be used as local examples, but the rule must not depend on a particular application's modules or domain.
- Keep every user story in its own spec file inside the approved workbook's folder, `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts` (for example `US-003. Mobile Number Login.test.ts`; naming, moves and pending stories in `regression-layout.md`), with one top-level `describe('<StoryId> <story name>')`, creating it only when the story has none yet. Keep only reusable setup, navigation and helper functions in page objects, components and services; never append another story to a combined multi-story spec.
- Represent every testcase as its own `it('<exact ID>: <workbook title>', async () => { ... })`, with a concise Allure story and an appropriate severity (`allureReporter.addStory`, `allureReporter.addSeverity`). Keep that testcase's actions, assertions and successful-result text together so the `it()` is understandable in isolation.
- Do not route many distinct testcase IDs through one generic function such as `run(id)` or `executeCandidate(...)`, an `it()` generated in a loop over IDs or a data table, or a `switch` statement. Several input variations of one testcase ID with one assertion flow may loop inside that ID's one `it()`; a loop must never replace separate `it()` blocks for separate testcase IDs.
- Format TypeScript for review, as the project's Prettier and ESLint configuration says: descriptive helper names, readable lines, `async`/`await` throughout. No compressed one-line specs, helpers, data tables or switch dispatchers.
- Create a matching story suite JSON for each story and platform from `suites/templates/story-suite.template.json` (`{story, platform, spec, ids}`; Android in `suites/<Workbook>/android/<Story>.json`, iOS in `suites/<Workbook>/ios/<Story>.json`), `<Workbook>` being the input workbook file name without `.xlsx`.
- Use the locator priority in `automation-playbook.md` ("Locator rules"): `byRole` → `byId` → `byLabel` → `byText` → `byXPath`.

## Page objects

Every page object follows `../assets/page-object-template.md`. In short:

- **Locators in the constructor**, as `readonly <name>: ElementLocator` fields built with `this.byRole(...)`, `this.byId(...)`, `this.byLabel(...)`, `this.byText(...)` or, last, `this.byXPath(...)`. One page object per screen; add a missing locator to the existing one.
- **`common` / `android` / `ios`.** Shared locators and every method in `src/pages/common/<Screen>Page.ts`; platform-specific locators (class-based XPath, `resource-id`, TalkBack wording) and platform actions (hardware Back) in `src/pages/android/<Screen>Page.ts` / `src/pages/ios/<Screen>Page.ts`, extending the common page, which declares them `abstract`. Specs create pages only through the factory in `src/pages/index.ts` (`createLoginPage()`).
- **Never use `private`**, in page objects or anywhere else (services, utils, components, spec helpers): internal helpers are `protected`, so platform pages can reuse and override them; no `private` constructor parameters and no `#private` members. `npm run lint` fails on it (automation-setup "Method rules"); if the project's `eslint.config.js` lacks those `no-restricted-syntax` entries, add them.
- **One small method per user action** (`enterCustomerId`, `enterPassword`, `tapLogin`, `tapOpenAnAccount`, `swipeToNextSlide`), built on `this.tap(locator, description)`, `this.type(locator, value, description, secret)` and `GestureUtils`.
- **Flow methods** combine small methods when the actions always run together (`login(customerId, password)` = enter + enter + tap). A flow used by one story only may stay a helper function in that story's spec, built from page methods.
- **`verify...` methods** for every expected result, built on the `BasePage` polling helpers with an explicit wait (`expectDisplayed`, `expectText`, `expectAttribute`, `expectEnabled`; `expectAbsent` once, after a positive anchor). `isShown(ms)` / `isDisplayedWithin(locator, ms)` return booleans for launch checks and for branching inside a flow.
- **Every method logs and rethrows**, public and `protected` alike, in page objects, platform pages, components, services, utils and helper functions inside spec files: `this.logger.info('<starts>')`, `try { ... this.logger.info('<finished>') } catch (error) { this.logger.error('<failed>: ' + describeError(error)); throw error; }`. Module functions use a module child logger (`const log = logger.child({ module: '<FileName>' })`). `describeError` is imported from `src/utils/Logger`. Never swallow an error or return a default instead. Only exceptions: constructors that only assign locators, `abstract` declarations, inline callbacks, and the bodies of `Logger.ts` / `Redactor.ts`. Helpers that run many times per test may log at `debug`.
- **No secrets or raw identifiers in logs:** passwords, OTPs and PINs are typed with `secret = true`; Customer IDs, mobile numbers and user names are logged through `maskValue(...)`.
- **Specs call page methods only**: no locator, `$()`, `browser.pause()` or bare `expect(...)` in a spec. A step without a page method gets one first.
- **Existing page objects in an older style** (string selectors, no logging) are extended in the new style for the methods you add; convert the rest only when a row you work on touches it, and never in a Keep row's code path during a workbook update.
- Use Appium/device assertions for live navigation, interactions and the current feed-backed state. Assert on what the device shows; a Pass must be possible only from device-UI evidence.
- If the device cannot show the required state, or showing it would add or delete live data or submit an order or payment, do not write an assertion for it. Leave the row without an `it()` and list it as `Blocked` in the handoff with the exact reason. A precondition that can only be found out at run time (for example the account has no holdings) throws `BlockedError(reason)` from `src/reporting/BlockedError.ts`; it is recorded as `Blocked`, never `Fail`.
- Write the test as the workbook states it. Never adjust it to what the app currently does: a product defect is found when the run script runs it, not here.
- Change product code only when a run demonstrates a product defect or a missing testability hook relevant to the testcase. Preserve requirements; do not alter expected behavior merely to make a test pass.
- Preserve a truly blocked in-scope row when requirements conflict or the expected behavior is undefined. List it in the handoff as `Blocked`.

## Required terminal testcase progress logs

When creating or completing the automation framework, ensure the shared hooks in `config/wdio.shared.conf.ts` log every testcase to the terminal. Add this once in the shared config rather than in story specs:

- `beforeTest` prints `[TEST START] <testcase ID> | <test title>` immediately before each testcase.
- `afterTest` prints `[TEST END] <testcase ID> | <test title> | <PASS|FAIL|SKIP|BLOCKED>` after the testcase. Put the ending log in a `finally` block so assertion failures, blocks or failure-evidence capture problems do not suppress it.
- An attempt that the test retry (see "Retries" below) discards prints `[TEST RETRY] <testcase ID> | <test title> | attempt <n>/<max> failed (<reason>); rerunning from the start` instead of `[TEST END]`. Decide it in `afterTest` from `{ passed, error, retries }`: not passed, not a `BlockedError`, and `retries.attempts < retries.limit`. Never print `[TEST END]` for a discarded attempt: the run script counts every `[TEST END]` line as a finished row.
- Resolve the ID with `testCaseIdOf(test.title)` from `src/reporting/testCase.ts` and the display name from the rest of the title. If one testcase loops over input variations, log the active variation inside the `it()` without printing another `[TEST START]` or `[TEST END]`.
- Preserve failure screenshots and page-source capture (`AllureEvidence`) before printing the ending line. The ending line should be the final shared per-test terminal message.
- Type-check and lint the framework after adding or changing the logger. A logging change is verified by `npm run typecheck` and `npm run lint` only; any device run is done by the user with the printed run command.

## Waits and driver settings

- Android Flutter apps animate constantly (carousels, loaders). The Android capabilities (`config/devices/android.devices.ts`) must set `'appium:settings[waitForIdleTimeout]': 0` and raise `'appium:uiautomator2ServerLaunchTimeout'` and `'appium:uiautomator2ServerInstallTimeout'` to about 90000 ms. This alone does not stop the freezes: also follow "Freezes and hangs" below. Add them to the Android preset when missing; if the capability type rejects a key, widen the preset's type rather than dropping the key.
- Keep waits bounded and chosen on purpose: a screen that normally appears in seconds gets 15 s, not 30 s; waits that follow one another share one deadline instead of each getting the full timeout. Use the constants in `src/constants/timeouts.ts`. Write the waits into the handoff Note when a row depends on a long one (for example an SDK start of 45 s).

### Every expected check waits (mandatory)

The device needs time after every action: a keyboard slides up, a tab underline moves, a button enables after typing, a toggle redraws, a banner or message arrives from the back end. A check made once, immediately after the action, fails while the app is still correct. On US002 TC_US002_010 checked `isKeyboardShown()` right after tapping the Password field. The keyboard was still sliding up, so all 3 attempts failed on a correct screen.

- **Anything expected to appear or change state is polled with a bounded wait, never checked once.** This covers:
  - elements, pages, dialogs, bottom sheets, banners, toasts and messages;
  - the soft keyboard;
  - state attributes: selected, checked, enabled or disabled, masked or plain text (`password` attribute and field text), toggle and icon labels, field values after typing.
- **Default budget:**

  | Check | Wait |
  | --- | --- |
  | An element, or a state change after a tap or typing | 15 s |
  | A back-end response (login result, validation message from the API) | 20 s |
  | A slow screen (SDK, web view) | the time measured during device inspection, plus margin |

  Poll every 300-500 ms (`interval`) and return as soon as the expected state shows, so a passing test is not slowed.
- **The wait lives in the page object, never in the test body:**
  - for a presence check, a method such as `isXShown(within: number)` or `xShownWithin(ms)` built on `waitForDisplayed({ timeout, interval })` (or `BasePage`/`WaitUtils`), returning `true` or `false` instead of throwing;
  - for a state check, a method such as `waitUntilSelected(ms)`, `waitUntilEnabled(ms)`, `waitUntilMasked(ms)` or `waitForText(text, ms)` built on `browser.waitUntil(..., { timeout, interval })` or `waitForEnabled`, which returns `true` or `false`.

  The standard form is a page `verify...` method built on the `BasePage` helpers (`expectDisplayed`, `expectText`, `expectAttribute`, `expectEnabled`), which poll with an explicit `wait` and throw a message naming the element and the wait. A boolean method may instead be asserted in the test with a failure message (`expectTrue(value, message)` from `src/assertions/mobile.assertions.ts`; add it there once when missing). An expect-webdriverio matcher that polls (`await expect(el).toBeDisplayed({ wait, interval, message })`) is also a polling wait when the page object exposes the element; a matcher with `wait: 0`, or a single `isDisplayed()`/`getAttribute()` read, is not. A page-object getter that a test asserts on must not read the state only once.
- **Expected state: poll until it is reached.** A check that expects a particular state ("tab is selected", "Login is enabled", "password shows as plain text") polls until that state is reached or the deadline passes. It does not read the attribute once and compare.
- **Absence: anchor first, then check once.** Never wait 10-20 s for something not to appear. That costs the full wait on every passing run, and a check made too early passes before the thing would have appeared. Instead:
  1. Wait for a positive anchor that proves the action has finished: the expected message shown, the next screen's heading present, or the field holding the typed value.
  2. Then check the absence once (`(await $$(selector)).length === 0`, or `isDisplayed()` once).

  This applies to "2FA screen not shown", "no country picker opened", "login screen not shown first" and "a disabled button did nothing on tap". A fixed `browser.pause(...)` is never an anchor.
- **Also waits: state that must stay unchanged after a tap.** A state that must remain the same, for example Login still disabled after typing only one field, is read after the typed value is confirmed in the field. That confirmation is the anchor.
- **Exempt: carousel and animated slides.** The carousel rules under "Freezes and hangs" still apply: one lookup per state, polled with a deadline, and no attribute reads.
- **Review before compiling.** Go through every assertion (`expectTrue`, `expect(...)`) in the story spec and the page-object method it calls. Each appear or state check must reach a polling wait. Each absence check must follow a positive anchor. Fix any that do not before running `npm run typecheck`.
- A test that needs the fresh-install state clears app data with `mobile: clearApp` (after `mobile: terminateApp`) and relaunches with `mobile: activateApp`, through the launch step below; do not rely on `NO_RESET` state.

## Freezes and hangs (UiAutomator2 on Flutter)

The UiAutomator2 server can freeze while it reads the UI tree of a Flutter screen that is animating (an auto-advancing carousel, a page transition), cold-starting, or replaced by an SDK that never draws (a black screen with an empty hierarchy). A frozen command never returns an error: it waits for the proxy timeout, and the session is dead afterwards (even ending it takes about 35 s). On US001 this cost 4-6 minutes per row and failed rows whose screen was correct. Every rule below is required.

### Test and page-object code

- Never poll `driver.getPageSource()` on an animating screen. Use it at most once, on a settled screen.
- Never read an attribute (`getAttribute`, `getText`) from an element that an animation can replace (a carousel slide). Ask whether a node with the wanted text exists instead (`(await $$(selector)).length > 0`), one lookup per state.
- Poll animating screens at most every 300-500 ms, and stop at a deadline. Every polling loop has a deadline.
- After every app start (`mobile: activateApp`, relaunch, fresh install) wait about 5 s before the first lookup. This settle pause lives only in the launch helpers; it is freeze avoidance, never synchronization. A lookup during the Flutter cold start can freeze the server. Some devices (ColorOS/realme) keep accessibility queries blocked for about 10 s after a launch (`AccessibilityManagerService: wait for adding window timeout` in logcat); the first-screen check belongs inside the launch step (next rule) so a freeze there is retried.
- A launch step is the app start **plus its first screen check** (fresh install + "onboarding is shown", relaunch + "login is shown"), run as one unit through the step retry in `src/utils/RetryUtils.ts` (`freshLaunch(firstScreenCheck)`, `closeAndRelaunch(firstScreenCheck)` in `src/services/app.service.ts`). When a command in it shows the server froze, reload the session (`browser.reloadSession()`) and redo the whole step, up to `STEP_MAX_ATTEMPTS` (default 2), then fail. Only freezes are retried at step level: an assertion failure or an ordinary error fails the step at once (the test retry below may still rerun the test). A step that ends before its first lookup cannot catch the freeze of that lookup, so never leave the first screen check outside the step.
- A loop that polls an animating screen fails the attempt at once on a freeze: the session is dead afterwards, and reading again on it only waits out another timeout. Other transient read errors are tolerated at most 3 in a row. The test retry reruns the test from the start.
- Never retry a single step in the middle of a flow on a new session (for example "press Back" after typing into a form): a new session starts at the app's start screen, so the step would act on the wrong screen. Mid-flow failures are handled only by the test retry, which reruns the whole test.

### Retries (test level and step level)

Two retry levels, both added once in the framework, never in story specs. Reference code: `../assets/retry-framework.md`.

| Level | What is retried | When | Limit (config, default) |
| --- | --- | --- | --- |
| Test | The whole `it()`, from the start | Any failure: assertion, element not found, timeout, frozen server. Never a Blocked test (`BlockedError`) | `mochaOpts.retries` from `env.ts`, 2 retries = 3 attempts in total |
| Step | A launch step (app start + first screen check) | Only a frozen server (`isServerHang`) | `STEP_MAX_ATTEMPTS`, 2 attempts |

- Test level is Mocha's own retry, `mochaOpts.retries` in `config/wdio.shared.conf.ts`, so it applies to every `it()`. Never call `this.retries()` in a story spec. `afterTest` turns it off for a test that threw `BlockedError`, so a Blocked test is never rerun.
- `afterTest` keeps a one-line reason per failed attempt ("UiAutomator2 server froze" for a freeze, otherwise `<ErrorName>: <first message line>`, at most 160 characters). The reason text must never contain the script's freeze markers ("Could not proxy command", "instrumentation process is not running", "Appium session creation failed", "UiAutomator2 Server cannot start"), or a later real Fail would be written as Skip.
- WebdriverIO calls `afterTest` once per attempt, with `retries.attempts` (retries used so far) and `retries.limit`. So for an attempt that will be rerun:
  - it captures the attempt's screenshot for Allure (named `RETRY_attempt<n>_<id>`), except after a freeze, where it reloads the dead session instead;
  - it prints `[TEST RETRY]` (see progress logs) instead of `[TEST END]`.
- `ResultWriter` writes a row for every finished attempt and the last one wins, so only the final attempt reaches the workbook. When it needed more than one attempt, its Automation Remark gets the history **appended at the end**: `Attempt <n> of <max>. Earlier attempts failed: 1) <reason>; 2) <reason>.` This is written for a Pass too, so a defect that only shows up sometimes stays visible. Never prepend it: the test's own remark comes first.
- Cost: a frozen attempt costs about 65 s (30 s command timeout plus about 35 s ending the dead session); an ordinary failed attempt costs its wait budget. Worst case for a row that keeps freezing is about 6-7 minutes. Tell the user the expected time up front.
- A retry never changes what is asserted, and never turns Fail into Pass by itself: the final attempt has to pass on the device.

### Framework (add once, when missing; type-check and lint only)

- Android capabilities: `'appium:uiautomator2ServerReadTimeout': 30000` (default 240000), so a frozen command fails after 30 s.
- `config/wdio.shared.conf.ts`: `connectionRetryCount` of at least 1 and a `connectionRetryTimeout` that allows a retry after about 3 s, so session creation is retried once. A port left busy by an earlier run frees itself after the first failed attempt.
- `beforeTest`: probe the session with one cheap command and reload it when the server does not answer, so one freeze cannot fail every later test of the spec.
- `src/utils/RetryUtils.ts`: one `isServerHang(error)` check, walking the `cause` chain, for the freeze messages ("Could not proxy command", "instrumentation process is not running", "Appium session creation failed", "UiAutomator2 Server cannot start" - the same markers the run script uses), used by the items below.
- `src/utils/RetryUtils.ts`: a `retryOnHang(attempts, step)` helper; it retries only when `isServerHang` is true, reloading the session between attempts. `src/services/app.service.ts`: `freshLaunch(firstScreenCheck?)` and `closeAndRelaunch(firstScreenCheck?)` run start + settle + check through it with `STEP_MAX_ATTEMPTS`.
- Config: `mochaOpts.retries` (default 2) and `STEP_MAX_ATTEMPTS` (default 2) validated as integers in the `config/env.ts` zod schema, and in `.env.example` with a comment. Use the project's existing variable names when they exist.
- `afterTest`: no retry for `BlockedError`, the `[TEST RETRY]` log, the per-attempt reasons and the remark history exactly as in "Retries" above.
- `AllureEvidence`: when `isServerHang` is true for the failure, skip the page source and screenshot and reload the session. Both would wait out two more timeouts.
- Do not shorten Mocha's timeout for a single test (`this.timeout(...)`) to cut a freeze short: Mocha abandons the test, but the frozen command keeps the session busy and the next test inherits it.

## Using what the project already has

- The test template calls `recordActualResult(...)` for the successful-result text. Use whatever the project's reporting layer provides for it instead (look in `src/reporting/ResultWriter.ts` and the fixtures) and do not add a second helper.
- Write TypeScript files with the Write tool, not shell heredocs. Quotes, backticks and backslashes in TypeScript and regex strings break shell quoting and leave nothing written.

## Compile

- "Compile" means `npm run typecheck` (`tsc --noEmit`) and `npm run lint`, run in the automation project before handing over. Both need no device. A type or lint error is fixed here; it never reaches the run step.
- This skill never runs a test, never starts a test session (`wdio run`) and never records a result. Whether the locators work on the device is found out when the user runs the printed command. A locator, wait or setup problem comes back as a "Repairs needed" row in the handoff.
