# Flutter Reference

Load only when the app under test is a Flutter app.

## Discovery

- Search for the related Flutter widgets and Flutter tests together with the story ID, testcase IDs and visible labels.

## Locators

- If Flutter exposes an important control without semantics, add an accessibility label (for example a semantic label) in product code when in scope. Keep a structural fallback for the currently installed build.
- One `Semantics` label or identifier serves both platforms: Android exposes it as content description, iOS as accessibility label or identifier, and the WebdriverIO accessibility-ID selector (`$('~<label>')`) finds it on both. Prefer adding one label over writing two platform locators. Check the text on the iOS screen, because the two platforms may expose merged or split labels differently.
- Drive the app through UiAutomator2/XCUITest and accessibility IDs. Use `appium-flutter-driver` (Flutter finders, `flutter:` commands) only if the project already uses it; never add it for one story.
- A Flutter debug build for the iOS simulator cannot be installed on a real iPhone, and the reverse. Know which build is installed before judging a locator.

## Evidence

- Flutter tests may explain a product rule, but they are not device evidence. They are never Pass evidence.
- A Flutter fixture is never a substitute for a device assertion. When the device cannot show the state, list the row as `Blocked` in the handoff.

## Harness

- Fix stale Flutter widget-test harnesses when the production widget now requires additional providers or dependencies.
