# Regression specs

Added by implement-testcases-v2; none exist at bootstrap.

**Only P1/P2 testcases live here.** Workbook rows with Automation Candidate = Yes and Priority = P0 are implemented only in `src/tests/smoke/<WorkbookName>/<StoryId>.test.ts`; `npm run smoke:check` reports a P0 case found here as `MISPLACED`.

- One spec per implemented story, in the approved workbook's folder: `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts` (`<WorkbookFolder>` = workbook file name without `.xlsx`, spaces and version kept; `< > : " / \ | ? *` removed from the story part).
- One top-level `describe('<StoryId> <story name>')`.
- One `it('<TC_ID>: <exact workbook title>', async () => { ... })` per testcase ID; the body calls page methods only and never branches on the platform.
- A testcase that cannot prove its expected result throws `BlockedError(reason)`.
- A file is created with its first `it()`; pending stories get no file. Implementation is read only from `it()` titles.

Run one spec: `npm run test:android -- --spec "src/tests/regression/<WorkbookFolder>/<file>.test.ts"`.
