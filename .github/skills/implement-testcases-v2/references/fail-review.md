# Fail Review and Blocked Re-check

Load only for a Fail review or a Blocked re-check.

## Review failing testcases

Use this when the user names testcases to fix, or asks to review the Fail rows. Read the Fail rows from the platform's canonical workbook (`Android-<name>.xlsx` or `iOS-<name>.xlsx`), using `Automation Status` when it holds a value, otherwise `Status`. A Fail on one platform says nothing about the other: review only the platform asked for, and record findings in that platform's handoff file. This is a review, not a way to turn a Fail into a Pass: the workbook decides what is correct.

For each testcase, compare three things:

1. **The workbook:** the steps and the expected result. This is the truth.
2. **The app source code,** as a reference for how the screen is built and what it does. Reading it is allowed here. Editing it is not, except adding a missing accessibility label when that is in scope.
3. **The test code:** the `it()` whose title starts with that ID, with its page objects and helpers.

Also gather the evidence that already exists: the row's Actual Result and Automation Remark in the workbook, and the screenshots, page source and logs saved by the earlier run (`screenshots/`, `allure-results/`, `logs/`, and the run's results CSV under `test-results/automation-results/`). A Fail remark starting `[NEEDS REVIEW ...]` means an element was not found or a wait timed out, so it needs exactly this review. You may also look at the current screen read-only. Do not run the test to get more evidence. Check whether the source matches the build installed on the device. If that cannot be confirmed, say so in the handoff and rely on the recorded device evidence.

Then decide:

| What you find | Finding | Action |
| --- | --- | --- |
| The test code does not do what the workbook steps or expected result say (wrong locator, assertion or step; stale flow) | Test wrong | Fix the TypeScript code to match the workbook, then `npm run typecheck` and `npm run lint`. The rerun with the printed command confirms it |
| The app code and the device evidence contradict the workbook expected result | Product defect | Leave the test and its Fail unchanged. Note the defect for developers |
| Test and app both look right, but data, device state or environment is off | Setup | Fix the setup if it lives in code. Otherwise state what is needed (data, account, environment) |
| The workbook is unclear or contradictory | Requirement unclear | Change nothing. Write the question for the user or the BA |

Guardrails:

- Never edit a test to match what the app does when the app contradicts the workbook. That hides a real defect (shared rule 5).
- Source code is a reference for understanding and locators. It is not evidence of correct behavior and never Pass evidence (shared rule 2).
- Do not write the workbook. Record each testcase under "Fail reviews" in the handoff, with Rerun needed = `Yes` when code or setup changed.

## Re-check Blocked rows

Use this when the user asks to re-check named Blocked rows, for example after a requirement was clarified or a test account became available. Re-assess each row against the same reasons it was blocked. If the device can now show the state and the expected result is defined, write the `it()`, type-check and lint, and change the row in the handoff from `Blocked` to `Implemented`. Do not run it: the first run with the printed command proves it. If not, keep it `Blocked` and update the reason.

## Closing the review

End by installing or checking the run scripts and printing the command (`references/run-scripts.md`):

- after a Fail review with any `Rerun needed = Yes`: `-Type fail` for the story. Rows with Finding `Product defect` are rerun only after developers deliver a fixed build, so say which rows will fail again until then;
- after re-checking Blocked rows: `-Type first` for the story;
- never run the command yourself.
