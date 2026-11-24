# Regression Layout: Workbook Folder, One File per Story

Applies to every platform. Android and iOS share the same `.test.ts` files; Web uses `.spec.ts` in the same layout.

## 1. Layout

**Only P1/P2 cases live here.** P0 rows (Automation Candidate = Yes, Priority = P0) are implemented **only** in the story's smoke spec `src/tests/smoke/<WorkbookName>/<StoryId>.test.ts`; P1/P2 rows **only** in its regression spec `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts` (`p0-smoke.md`, section 2). A story whose in-scope cases are all P0 has no regression spec.

```text
src/tests/regression/
`-- <WorkbookFolder>/
    |-- <StoryLabel>. <Story title>.test.ts
    |-- <StoryLabel>. <Story title>.test.ts
    `-- ...
```

- **`<WorkbookFolder>`** is the approved workbook's file name without `.xlsx`, exactly as it is in `testcase/Testcases/` (spaces and version suffix kept). It ties every spec to the workbook it implements; `npm run regression`, `npm run smoke` and the test-data service (`../../automation-setup/references/test-data-sources.md`) find a workbook's implementations and its file from it. It is different from the smoke `<WorkbookName>`, which drops the version suffix (`p0-smoke.md`).
- **One file per implemented story**: `<StoryLabel>. <Story title>.test.ts`, where `<StoryLabel>` is the story label as the workbook writes it (`US-001`) and `<Story title>` the story's title from the workbook (story worksheet title or heading; the user story file when the worksheet only has the label). Example shape: `US-002. Login Screen - Customer ID & Password Authentication.test.ts`.
- **File-name cleanup:** remove `< > : " / \ | ? *` and control characters, collapse whitespace, trim trailing spaces and dots, keep the title part at most 100 characters, and keep the path from the framework root under 200 characters. Two stories that end up with the same name stop the work and are reported.
- Inside, nothing changes: one top-level `describe('<StoryId> <story name>')` (`US001`, the ID the reports and `storyId` label use), one `it('<exact ID>: <workbook title>')` per testcase. The file name is for people; selection always uses the ID + exact title, never the file name.
- Spaces and `&` in paths are safe because every runner gets paths as separate arguments without a shell (`--spec`, `<file>`); Jenkins quotes the `SPEC` parameter. Never build a shell string from a spec path.

## 2. What a folder or file does not mean

- A story's file is created when its **first** `it()` is written, never as an empty placeholder. Pending stories get no file.
- Whether a testcase is implemented comes only from an `it()` whose title is `<ID>: <exact workbook title>` and from the handoff. A folder or file existing proves nothing; the report lists pending stories as "not implemented" by ID, for example `US004-US013 pending (no it())`.

## 3. Moving existing specs into the layout

When the project still has flat specs (`src/tests/regression/<StoryId>.<kebab-name>.test.ts`) or another layout:

1. Map each spec to its workbook: its `describe` story ID **and** its `it()` IDs + exact titles must all be found in the confirmed approved workbook. A spec whose cases match more than one workbook, or none, is not moved; ask the user.
2. Move with `git mv` (keeps history) into `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts`. Never copy and leave the old file, and never merge two stories into one file.
3. Fix relative imports (one folder deeper: `../../pages/...` becomes `../../../pages/...`).
4. Update every reference in the same change: story suite JSONs (`suites/<Workbook>/<platform>/<Story>.json` `spec`), handoff files, `src/tests/regression/README.md`, docs and run examples. Regenerate the smoke files and manifest (`smoke:generate`), since they import the regression spec.
5. Prove discovery without a device: `npm run typecheck`, `npm run lint`, `smoke:check`, and `npm run regression -- "<approved workbook>" --dry-run`, which must show the same implemented IDs as before the move (same counts, no `MISPLACED`, no `AMBIGUOUS`). A pure move needs no device run; the report says no device run was performed for it.

A new workbook version that replaces the approved one (`workbook-update.md`) moves the folder to the new `<WorkbookFolder>` the same way, in the same change, so one workbook never has two regression folders.

## 4. Passes alone, blocked in workbook runs

Some cases depend on app state that a standalone run gets for free but a workbook run does not reliably reach, such as a first-launch screen (onboarding, first-run permission) or a way back to the start screen after earlier tests.

- The `it()` checks its precondition first with a bounded wait (`isShown(...)`). When the precondition is not there, it throws `BlockedError('<ID>: <precondition> not reachable in a workbook run: <reason>')`. It never fails for that, and never passes.
- The handoff row is `Blocked` with that reason and the note `passes standalone (<platform>, <date>)`. `npm run smoke` / `npm run regression` do not select it (Blocked in the handoff is never selected), and it is not counted as executable coverage.
- It stays Blocked until the setup is reliable: a precondition step the framework can perform safely (navigation, logout, app restart through the session service). Never fake the state by clearing app data, reinstalling, revoking permissions or bypassing security without the user's explicit approval for that project.
- A standalone pass is evidence for the handoff, never a workbook-run result: it is not written to the output workbook as `Pass`.

## 5. Report

The implement report states: the workbook folder; files moved (old → new path) and references updated; files created for newly implemented stories; stories still pending; cases blocked in workbook runs although they pass standalone; and the checks run (typecheck, lint, `smoke:check`, `--dry-run` counts, `npm run test-data:test` when test data changed), with any device run named explicitly or stated as not performed.
