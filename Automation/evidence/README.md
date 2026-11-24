# Locator evidence

`evidence/<platform>/<Screen>/` holds the UI dumps (`<state>.xml`) and screenshots (`<state>.png`) each page object's locators were taken from, plus `locators.md`:

| Locator | Strategy | Value | Evidence node | Verified |
| --- | --- | --- | --- | --- |

Capture the current screen with `.\scripts\capture-evidence.ps1 -Screen <Screen> -State <state>` (test-account values from `.env` are replaced by `{{NAME}}`). This folder is committed; review screenshots for personal data before committing.
