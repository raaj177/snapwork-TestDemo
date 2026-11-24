# Shared Rules

Rules for implement-testcases-v2 and the run scripts it installs (`scripts/run-tests.ps1`). Platform details (Android or iOS) are in `platforms.md`.

## Rules

1. Automate and execute only testcases whose Automation Candidate is "Yes". For an iOS run the row must also have `IOS Testcase` = Yes. Rows outside that selection stay untouched: do not implement, execute or flip them.
2. A testcase is Pass only when it ran on the connected device and the device UI showed the expected result. Source inspection, unit or widget tests and fixtures are never Pass evidence.
3. Keep exactly one canonical output workbook per platform and input workbook (`Android-<name>.xlsx`, `iOS-<name>.xlsx`). Never create timestamped, sidecar or "updated" copies, and never write one platform's results into the other platform's workbook. A new workbook version (`<name>` V2 after V1) gets its own output workbook, created by the run scripts; the earlier version's output workbook stays as the record of that version and is never written again.
4. Every implemented testcase is one `it()` whose title starts with its exact testcase ID and a colon (`it('TC_US003_001: <title>', ...)`), in the story's one spec file. One `it()` maps to exactly one testcase ID, and no ID maps to more than one `it()`, across both platforms. A test body never branches on the platform. A Blocked testcase has no `it()` and is listed in the handoff instead.
5. Never weaken or change an expected result to make a test pass. Preserve requirements.
6. The handoff file `automation-handoff/<story>.md` (iOS: `<story>-ios.md`) is the only channel between the two skills. Its format is in `../assets/handoff-format.md`.
7. Every run is for exactly one platform, Android or iOS, settled before anything else. Results, Blocked decisions and repairs never carry over from one platform to the other.
8. In a workbook update (`workbook-update.md`) only new and changed rows are implemented and executed; unchanged rows keep their code and their previous result. A row whose Test Case Type is `deleted` (older name `invalidated`) is never executed, and its `it()` is deleted. A row that only disappeared from the workbook loses its `it()` only after the user agrees.

## Who owns what

- implement-testcases-v2: writes and repairs code, type-checks and lints it, installs the scripts, prints the run command, never runs a test, never writes the workbook.
- the run scripts (`scripts/run-tests.ps1`, run by the user from the printed command): run the code on the device, write the workbook and status suites, never edit code.
