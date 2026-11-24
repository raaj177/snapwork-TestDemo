# Workbook Update (new workbook version, change request)

Used by implement-testcases-v2 when a new version of the testcase workbook replaces one that was already automated and run, for example `LoginAuthenticationV1.xlsx` followed by `LoginAuthenticationV2.xlsx` in which some testcases are updated, some are deleted, some are new and the rest are the same. The code, the handoff files and the suites are brought in line with the new version, and the run scripts create the new version's own output workbook. Load it only for a workbook update.

## When it is a workbook update

It is a workbook update when any of these is true for the input workbook the user chose:

- it has a column headed `Test Case Type` (found by header text, case ignored);
- `testcase/Output Testcases/` holds the output workbook of a **different** input workbook (an earlier version), and the project already has story specs or handoff files for the stories in scope;
- it no longer matches its own output workbook: the input workbook was replaced under the same file name (rows added, removed or reworded). The script `prepare` step stops with "no longer matches its output workbook" in this case.

Then ask **one** question, and wait for the answer: "This is an update of an earlier workbook version. Which output workbook holds the previous version's results?" Offer the `.xlsx` files in `testcase/Output Testcases/` (leave out `~$` lock files), including the chosen workbook's own output file when it was replaced under the same name, plus "None: start the new version fresh (every row runs again)". Never pick it yourself. The answer is the **previous output workbook** used below.

Recommend the scope "all stories": a new version replaces the workbook's suites as a whole. If the user keeps a story scope, change only the code of those stories, and list the other stories' Delete, Change and Add lines from the diff as left for a later run.

## Test Case Type values

Compared ignoring case and spaces.

| Test Case Type | Meaning | Code | Run |
| --- | --- | --- | --- |
| `new` | A testcase added in this version | Add an `it()` (if an `it()` already carries the ID: change it, and say so) | Runs in the first run |
| `modified` | The testcase changed | Change the existing `it()` in place, same ID at the start of its title (no `it()` yet: add one, and say so) | Runs in the first run |
| `existing` or blank | Unchanged | Keep the `it()` and its page objects untouched | Not run again; its previous result is carried over |
| `deleted` (older name: `invalidated`) | Removed from the suite of testcases | Delete the `it()` and everything only it used (below) | Never run |

Any other value: the scripts stop with "Unknown Test Case Type value(s)". Ask the user what the value means; never guess.

Without a `Test Case Type` column the diff compares every row with the previous output workbook instead: same title, pre-condition, steps, test data, expected result and Automation Candidate = unchanged; anything else = changed; an ID only in the new workbook = new.

## Steps

1. **Install the scripts first** (`run-scripts.md` section 1), because the next step uses them.
2. **Run the diff** from the automation project root, and read every line:

   ```powershell
   python scripts/testrun/testrun.py diff --workbook "<new input workbook>" --previous "<previous output workbook>"
   ```

   Add `--story <story ...>` for a story scope. Leave `--previous` out when the user chose "None". The table gives, per testcase ID: the Test Case Type, the text compared with the previous version (which fields changed), the test (spec file and line of its `it()`), the handoff state and the **Plan**: `Keep`, `Change`, `Add`, `Delete`, `Re-check Blocked`, `Blocked`, `Nothing`, or `Check: <question>`.
3. **Settle every `Check:` line with the user in one question** that lists them all, and wait for the answer:
   - `marked existing but its text changed`: treat it as modified (Change), or keep the code as it is? Its previous result is never carried over either way, so it runs again.
   - `not in the new workbook; delete the test?`: the row is gone from the new workbook without a `deleted` mark. Delete only on a yes; otherwise keep the `it()` and list it as having no workbook row.
   - `no longer an Automation Candidate; delete the test?`: same.
   - `<n> it() tests carry this ID`: which one to keep.
4. **Write the code**, story by story in workbook order, with the normal rules (device inspection before any locator, `typescript-wdio-standards.md`, `assets/testcase-method-template.md`):
   - `Keep`: touch nothing, not even formatting.
   - `Change`: compare the new row (title, pre-condition, steps, test data, expected result) with the `it()`, its page objects and, as reference only, the app source, and change only what differs. Dump every screen the changed steps touch. Keep the ID at the start of the `it()` title; update the rest of the title when the workbook title changed.
   - `Add`: a new `it()` in the story's existing spec (a new spec only for a story that has none).
   - Before writing any of these, move the regression folder of the previous version to the new workbook's name with `git mv` (`regression-layout.md`, section 3), so one workbook never has two regression folders.
   - `Re-check Blocked`: re-assess as in `fail-review.md` (Re-check Blocked rows).
   - `Delete`: see "Deleting a testcase" below.
5. **Compile**: `npm run typecheck` and `npm run lint`. A type or lint error is fixed here.
6. **Update the handoff files** (`assets/handoff-format.md`): add the line `- Workbook update: <new input workbook> (previous: <previous output workbook>) | new: <n>, modified: <n>, deleted: <n>` under the title; start each changed row's Note with `Update new`, `Update modified` or `Update existing, text changed`; remove the deleted rows from the Testcases, Repairs needed and Fail reviews tables and list them under "Removed testcases" with their deleted `it()`. Every remaining in-scope row of the new workbook appears exactly once as `Implemented` or `Blocked`.
7. **Replace the suites** of the old version, after the type-check and lint:

   ```powershell
   python scripts/testrun/testrun.py reset-suites --workbook "<new input workbook>" --previous "<previous output workbook>" --dry-run
   python scripts/testrun/testrun.py reset-suites --workbook "<new input workbook>" --previous "<previous output workbook>"
   ```

   It deletes every generated suite (`first/`, `passed/`, `failed/`, `full/`, `cr/`) of the new workbook's folder `suites/<new name>/android/` and of the previous version's folder `suites/<previous name>/android/`, deletes the previous version's story suites, writes each story suite `suites/<new name>/android/<Story>.json` from the new workbook (the IDs of rows that are Automation Candidate = Yes, not deleted and with an `it()`, in workbook order; it lists the Blocked rows it left out), removes the story suite of a story with no `it()` left, and validates every file written. Hand-made suites in `diagnostics/` and `reruns/` are kept and listed, unless `--include-manual` is added.

   **Run the `--dry-run` first, show the user its full list (files to remove, story suites to write, hand-made suites kept) and ask before the real run**: "These old suites will be deleted and these story suites rewritten. Go ahead? Also delete the hand-made suites in `diagnostics/` and `reruns/`?" Wait for the answer. Run without `--dry-run` only on a yes, and add `--include-manual` only when the user said yes to the hand-made suites too. A warning that a row of an automated story has no `it()` and no Blocked entry means step 4 or 6 is incomplete: fix it and run it again. Never edit a suite by hand instead.
8. **Print the command** (`run-scripts.md` section 3, "Workbook update" row):

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 -Type first -Workbook "<new input workbook>" -Previous "<previous output workbook>"
   ```

   Then the optional follow-ups: `-Type pass -Workbook "<new input workbook>"` as a regression of the carried-over passes (recommended when a page object shared with unchanged rows was changed), or `-Type full -Workbook "<new input workbook>"` to run every row of the new version again.

## Deleting a testcase

For each `Delete` line (and each `Check` the user answered with yes):

- Remove the whole `it()` block: the comments directly above it and its body. Leave the order of the other `it()` blocks as it is.
- Remove a constant or helper of the story spec, and a page-object method or locator, **only** when nothing else in `src/` uses it any more (search for every reference first). Never remove anything from `BasePage`, the wdio configs, `config/env.ts`, the hooks, `src/reporting/`, `src/services/` or the shared utilities.
- When a story has no `it()` left, delete its spec file and its handoff file, and say so in the report. `reset-suites` removes its story suite.
- Never delete product code, the workbooks, results CSVs or Allure results.
- Type-check and lint after the deletions. A type error means something still used the removed code: restore that piece, do not delete further.

## What the run scripts do with the new version

`run-tests.ps1 ... -Workbook "<new>" -Previous "<previous output workbook>"` runs `prepare` before it selects any row:

- The new version's canonical output workbook is `Output Testcases/Android-<new input workbook name>.xlsx`. If it does not exist, it is created from the **new input workbook** (its sheets, formulas, validations and `Test Case Type` column are kept exactly), and for every Automation Candidate = Yes row that is unchanged (`existing` or blank, same text as before) the four result fields `Actual Result`, `Status`, `Automation Status`, `Automation Remark` are copied from the previous output workbook. The `Status` of every Test Data ID found in both workbooks is copied too. New, modified, changed and not-previously-present rows start `Not Executed`; deleted rows are never run. IDs only in the previous workbook are dropped and listed. The file is written to a temporary file, verified (structure unchanged, every carried value saved) and only then put in place.
- So `-Type first` runs exactly the new, modified and changed rows (and any row never run before). The status suites `passed/` and `failed/` are rebuilt from the new output workbook after the run, carried-over results included.
- The previous output workbook is left as it is, as the record of the old version. It is never written again.
- When the input workbook was replaced under the **same** file name, give its own output workbook as `-Previous`: `prepare` rebuilds that file in place the same way.
- When the output workbook already exists and matches its input workbook, `-Previous` is ignored; repeated runs (`-Type fail`, `pass`, `full`) need only `-Workbook`.
- A dry run (`-DryRun`) only prints what `prepare` would do and selects from that plan; it writes no workbook.

## iOS

The implement half above is the same for iOS (iOS handoff `<story>-ios.md`, story suites under `suites/<name>/ios/`), but the run scripts are Android only: `reset-suites` and `prepare` do not cover iOS. Finish the code and the handoff, print no run-script command, and tell the user to run the iOS spec directly with `npm run test:ios -- --spec <file>` (no iOS run script exists yet, so results are not written to the output workbook).
