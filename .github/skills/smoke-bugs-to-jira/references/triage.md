# Smoke Failure Triage

A failed test is a result to investigate, not proof of a product bug. Classify every failed, skipped and blocked smoke case before anything goes to Jira.

## 1. Gather the evidence per testcase

- The workbook row: sheet, row, ID, title, preconditions, steps, test data, expected result, requirement reference.
- The run: build ID, results CSV row (status, Actual Result, Automation Remark), every attempt (`[TEST RETRY]` lines and the attempt history in the remark), Allure step screenshots, failure screenshot, page source, the per-test log.
- The app: version installed on the device (from the run record), device / browser and OS.
- The code: the `it()` and the page-object methods it calls.

## 2. Consolidate

- **Retries of one test** are one failure. Use the final attempt's result; earlier attempts are evidence only.
- **Several tests failing at the same step for the same reason** (same screen, same element, same error) are one root cause. File one bug at most, listing every affected testcase ID.
- **A failure in shared setup** (launch, login, navigation) that stops later tests: classify the setup failure; the later tests are "not reached", not failures of their own.

## 3. Classify

| Category | Signs | Action |
| --- | --- | --- |
| **Product discrepancy** | The screenshot / UI state shows the app doing something other than the approved expected result, with correct input that demonstrably reached the app, on a reachable screen, and it repeats on a rerun after harness fixes | Candidate bug |
| **Automation (harness) defect** | Element not found but visible in the screenshot; wrong or placeholder-based locator; typed value not in the field; stale state from an earlier test; missing wait; wrong screen anchor | Fix (`reliability-fixes.md`), rerun, no bug |
| **Environment** | No session, UiAutomator2 / WDA froze, device lost or locked, network or back-end unavailable, app not installed or wrong build; recorded as `Skip` | Report; rerun when the environment is fixed; no bug |
| **Test data** | The account lacks the state (no bills, already linked, locked), expired or used OTP data, a value that breaks the testcase's own format rule | Report with the data needed; no bug |
| **Requirement** | The workbook's expected result is ambiguous, contradicts the user story, or the story does not define the behavior | Ask the requirement owner; no bug |
| **Not implemented / blocked / skipped** | No `it()`, `BlockedError`, a state the device cannot reach, a test skipped by design | Count separately; never a bug |

When the category is uncertain, it is not a product discrepancy. Say what evidence would settle it.

## 4. Before a candidate becomes a bug

All must hold:

1. The harness defects that could explain it were fixed and the test was rerun (with approval), and it still fails the same way.
2. The input reached the app (field value read back, or visible in the screenshot) and the screen is the one the test expected (stable anchor verified).
3. The expected result is quoted from the approved workbook, and the actual result is what the screenshot / UI state shows, not what a log line claims.
4. No sensitive data is needed to show it.
5. `find-bugs` shows no existing bug for it.

## 5. Priority from evidence

The testcase's P0 priority says the case belongs in the smoke suite. It is **not** the bug's severity. Propose a priority from the observed impact and let the user confirm:

| Observed impact | Suggested priority |
| --- | --- |
| Blocks a core journey with no workaround (cannot log in, cannot pay, crash, data loss or wrong amount) | Highest / Critical |
| Core journey works only with a workaround, or wrong information shown on a core screen | High |
| Secondary function wrong, validation or message wrong, no data at risk | Medium |
| Cosmetic, text or layout issue that does not mislead | Low |

Use the project's own priority names (from `access`). If the impact is not clear from the evidence, say so and leave the project default.

## 6. Triage table (shown to the user before any Jira write)

| Testcase ID(s) | Final status | Category | Evidence | Root cause (observed only) | Proposed action |
| --- | --- | --- | --- | --- | --- |
| TC_... | Fail | Product discrepancy | `screenshots/...png`, CSV row | "Pay button stays disabled after a valid amount" | Bug, priority High |
| TC_... | Fail | Automation | screenshot shows the element; locator used placeholder text | Placeholder disappears after typing | Locator fixed to heading, rerun passed |
