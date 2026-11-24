# Handoff File Format

Template for `automation-handoff/<story>.md`. Used by implement-testcases-v2 and the run scripts.

## Location

`automation-handoff/<story>.md` at the automation project root, next to `suites/`, for Android. `automation-handoff/<story>-ios.md` for iOS. `<story>` is the Story ID, for example `US003`. There is one file per story per platform, and the two never share rows or states. Testcases outside the platform's scope (Automation Candidate = No; for iOS also IOS Testcase not Yes) are not listed.

## Template

```markdown
# Handoff - <Story ID> <story name> (<Android|iOS>)
- Story spec: <path> | Story suite: <path>
- Compiled: yes - `npm run typecheck` + `npm run lint` | Date: <date>
- Workbook update: <new input workbook> (previous: <previous output workbook>) | new: <n>, modified: <n>, deleted: <n>   (only after a workbook update; see `../references/workbook-update.md`)

## Testcases (written by implement-testcases)
| Test Case ID | State | Test | Note |
| --- | --- | --- | --- |
| TC_US003_001 | Implemented | Verify valid credentials open the home screen | |
| TC_US003_004 | Blocked | - | Exact reason, quoting what the device showed and what was missing |
| TC_US003_007 | Implemented | Verify the order summary shows the updated total | Update modified: expected result changed |

## Repairs needed (written by the run scripts with -HandoffRepairs, closed by implement-testcases)
| Test Case ID | What the device showed | Suspected cause | State |
| --- | --- | --- | --- |
| TC_US003_002 | Login button not found; login screen visible | locator | Open |

## Fail reviews (written by implement-testcases)
| Test Case ID | Finding | Action | Rerun needed |
| --- | --- | --- | --- |
| TC_US003_005 | Test wrong | Assertion corrected to match the workbook expected result | Yes |
| TC_US003_006 | Product defect | Test left as written; defect noted for developers | No |

## Removed testcases (written by implement-testcases in a workbook update)
| Test Case ID | Why | Code removed | Workbook | Date |
| --- | --- | --- | --- | --- |
| TC_US003_008 | Test Case Type `deleted` | it('TC_US003_008: Verify Login stays inactive until mobile and password are filled'); LoginPage.tapLoginWhileDisabled | LoginAuthenticationV2.xlsx | 2026-10-26 |
```

## Field values

- After a workbook update, a changed row's Note starts with `Update new`, `Update modified` or `Update existing, text changed`. Unchanged rows keep their entries as they are. A deleted row leaves the Testcases, Repairs needed and Fail reviews tables and is listed under "Removed testcases" instead (Why: `Test Case Type deleted`, `Not in the new workbook (user agreed)` or `No longer an Automation Candidate (user agreed)`). Leave the section out when nothing was removed.
- Test: the `it()` title after the ID and colon (`-` for a `Blocked` row, which has no `it()`).
- State of a testcase: `Implemented` or `Blocked`. A `Blocked` row becomes `Implemented` only when implement-testcases re-checks it and writes its `it()`.
- Suspected cause of a repair: `locator`, `wait`, `setup` or `harness`.
- Repair State goes `Open` to `Fixed (<date>)`. Only implement-testcases closes a repair.
- Finding of a Fail review: `Test wrong`, `Product defect`, `Setup` or `Requirement unclear`. Rerun needed is `Yes` when code or setup changed.
