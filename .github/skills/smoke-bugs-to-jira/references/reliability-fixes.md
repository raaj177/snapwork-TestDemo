# Automation Reliability Fixes

Apply a fix only when (a) the framework supports it and (b) the evidence of a failure shows it is needed. Every fix goes into the shared layer (`BasePage`, a page object, a fixture), never into a spec as a one-off, and follows automation-setup "Method rules": no `private`, every method logs start / finish / failure and rethrows. Run `npm run typecheck` and `npm run lint` after each change, and rerun the affected tests (with the user's approval) before using any result as product evidence.

## 1. Focus before typing

Some drivers (Flutter text fields on Android, iOS secure fields, custom web inputs) drop keystrokes unless the field is focused. When the evidence shows a typed value missing, make `BasePage.type` tap / click the element and wait until it is focused before `setValue`.

- Mobile: `await el.click()`, then wait for `focused="true"` (Android) or the keyboard (`driver.isKeyboardShown()`), then `setValue`.
- Web (Playwright): `locator.fill()` already focuses; use `locator.click()` first only for custom widgets that need it.

## 2. Prove that the input reached the app

A "typed" log line is not proof. After typing, read the value back (`getText()` / `getAttribute('text')` on Android, `value` on iOS, `inputValue()` on web) and compare it with what was typed (length only for a secret field, never the secret itself). On a mismatch, throw an error naming the field. Assertions that depend on input start from this check.

## 3. Detect screens by stable anchors

Identify a screen by its heading, title, accessibility identifier or a control that is always present, never by a placeholder or hint text that disappears once the user types. Update the page's `anchor` and its `verify...Shown()` method; record the new evidence in `evidence/<platform>/<Screen>/locators.md`.

## 4. Handle retained state deterministically

Apps keep state between tests (selected tab or login mode, typed text, password visibility, an open keyboard, a remembered user). At the start of each flow, set the state explicitly instead of assuming it:

- select the required mode (for example mobile-number vs customer-ID login) and verify it is selected;
- clear each field before typing and confirm it is empty;
- reset password visibility to the state the testcase expects;
- hide the keyboard when it covers the next control;
- relaunch with cleared data (`freshLaunch`) only where the testcase's precondition says so.

## 5. Derive fixture values from the exact testcase

Test data comes from the testcase row and the user story's rules: boundary lengths (min, max, max + 1), allowed characters and formats are computed from the requirement, not copied from another test. Valid account values come from `.env` / the test-data service (Git-ignored local overrides, then shared data; the workbook / Faker fallback only where `../../automation-setup/references/test-data-sources.md` allows it). Synthetic values only; never a real customer's data.

## 6. Keep the approved expectation

Never weaken an assertion, widen a wait beyond the budget, swap an exact text for a partial match, or remove a check to make a test pass. If the expectation looks wrong, it is a requirement question (`triage.md`), not a code change.

## 7. Driver-supported APIs, explicit errors

Use the documented API of the driver (`mobile: ` commands, WebdriverIO element methods, Playwright locators). No blind coordinate taps when an element exists, no swallowed errors, no `try { ... } catch {}` without a rethrow: every failure surfaces with the page, the element description and `describeError(error)`.

## Report

List every fix in the final report and in `<AutomationDir>/Jira/README.md` ("Reliability fixes in this project"): file, method, the failure that showed it was needed, and the rerun result.
