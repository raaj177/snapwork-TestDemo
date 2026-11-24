# Testcase output utilities

Reserved for later workbook utilities. Rules every later workflow keeps:

- The input workbook in `testcase/Testcases/` is never written.
- Rows are matched by **exact testcase ID**.
- One canonical output workbook per platform: `testcase/Output Testcases/Android-<name>.xlsx`, `iOS-<name>.xlsx`.
- Approved result CSVs go to `testcase/CSV Files/<Feature Name>/`.

The run scripts (`scripts/testrun/`) are installed by implement-testcases-v2.
