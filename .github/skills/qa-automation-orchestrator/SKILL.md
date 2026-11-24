---
name: qa-automation-orchestrator
description: Run the full QA pipeline in strict sequence, one phase at a time - Phase 0 start (prepare folders, check requirements and the app build in .github/_requirements/), Phase 1 automation-setup (ask platform - Mobile, Web or Mobile + Web - check Automation/, build the framework structure only when it is missing: Mobile flat in Automation/, Web in Automation/Web/, Mobile + Web in Automation/Mobile/ and Automation/Web/ - no app build needed), Phase 2 test-cases-generator (BRD/user story from .github/_requirements/ to testcase workbook v1_0 in testcase/Generated Testcases/), Phase 3 testcase-review-cycle (mandatory, unattended, one generated workbook at a time - review into testcase/Review Reports/, and while full or risk-weighted coverage is below 90% regenerate v1_1, v1_2 … into testcase/Revised Testcases/ from the review and re-review, max 3 revisions; a passing version is copied to testcase/Testcases/ automatically), Phase 4 implement-testcases-v2 (fill the app values from the app build and write the automation code for the workbooks in testcase/Testcases/). Each phase starts only after the previous phase has completed and passed its exit gate, and takes the earlier phases' output as its input. Use when asked to "run the pipeline", "run the orchestration", "generate test cases and automate them", or "go from user story to automation code".
---

# QA Automation Orchestrator

Chains four existing skills into one sequential pipeline. The orchestrator does not re-implement them: in each phase it loads that phase's `SKILL.md` and follows it exactly, including its own questions, gates and rules. The orchestrator only adds what the skills do not do themselves: ordering, exit gates, handing the output of one phase to the next, and a state file so the pipeline can be resumed.

**One kit for every project.** Nothing in `.github/skills/` is tied to a product. A project's requirements are defined only by what the QA puts in `.github/_requirements/`: the BRD / user stories in `user_stories/`, plus optional ADRs, designs and API specs. `.github/_requirements/` holds documents only, never the app build. The framework structure is built in Phase 1 without the app, the test cases come from the user stories in Phase 2, and the app build is asked for only at the start of Phase 4, the first phase that needs it: it lives in the framework's Git-ignored `Automation/apps/<platform>/` folder, and its package and launch activity are read from it into `Automation/.env`. To start a new project, copy the clean `.github/` folder into an empty project folder, fill `.github/_requirements/`, and run this skill (see [`../../README.md`](../../README.md)).

**Paths below.** `Automation/` in the Phase 4 paths `apps/` and `.env` means the mobile framework root, `mobile_dir` from Phase 1: `Automation/` when the platform is Mobile, `Automation/Mobile/` when it is Mobile + Web. The Playwright framework of Web and Mobile + Web lives in `Automation/Web/`. The workbook folder `testcase/` (`testcase_dir`) is always `Automation/testcase/` for Mobile and for Mobile + Web (one folder shared by both frameworks, never inside `Mobile/` or `Web/`), and `Automation/Web/testcase/` for Web only.

**Workbook lifecycle folders** (all inside `testcase_dir`, created by automation-setup for every layout):

| Folder                  | Holds                                                                                                                  | Written by                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `Generated Testcases/`  | First generation, `<Doc>_TestCases_v1_0.xlsx`; never edited afterwards                                                 | Phase 2                                     |
| `Review Reports/`       | `<Doc>_TestCase_Review_v1_<n>.xlsx`, one per reviewed version                                                          | Phase 3 (and each re-review)                |
| `Revised Testcases/`    | Versions regenerated from a review, `<Doc>_TestCases_v1_1.xlsx`, `v1_2` …; the highest version is the latest           | Phase 3 revise loop (generator update mode) |
| `Testcases/`            | Automation input: an unchanged copy of the version that passed the review gate (full and risk-weighted coverage ≥ 90%) | Phase 3 (automatic copy)                    |
| `Output Testcases/`     | Run results per platform, `Android-` / `iOS-` / `Web-` / `PWA-<name>.xlsx`                                             | run scripts                                 |
| `CSV Files/<Platform>/` | Approved result CSVs                                                                                                   | run scripts                                 |

```text
Phase 0: Start ──► prepare .github/_requirements/, orchestration/; check user stories exist
                                     │
Phase 1: automation-setup  ◄── ask platform (Mobile | Web | Mobile + Web), check Automation/, build the structure (no app); skipped if the framework(s) already exist
                                     │
Phase 2: test-cases-generator ◄── .github/_requirements/user_stories/ ──► testcase/Generated Testcases/<Doc>_TestCases_v1_0.xlsx
                                     │
Phase 3: testcase-review-cycle, every file in Generated Testcases/ one at a time (01 → 02 → 03 …), unattended:
            │  reviewer on the file ──► testcase/Review Reports/<Doc>_TestCase_Review_v1_0.xlsx
            │  gate: full coverage ≥ 90% AND risk-weighted coverage ≥ 90%
            │  below gate (max 3 rounds): generator Mode C (review report + latest version + user story)
            │        ──► testcase/Revised Testcases/<Doc>_TestCases_v1_<n+1>.xlsx ──► re-review ──► Review Reports/<Doc>_TestCase_Review_v1_<n+1>.xlsx
            │  gate passed ──► automatic copy ──► testcase/Testcases/<Doc>_TestCases_v1_<n>.xlsx ──► next file
                                     │
Phase 4: implement-testcases-v2 ◄── app build (Automation/apps/<platform>/) → .env + the gate-passed versions in testcase/Testcases/
```

| Phase | Skill                                                                                                  | Input                                                                                                                                                                                           | Output (handed to the later phases)                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | (orchestrator)                                                                                         | `<WorkspaceRoot>/.github/`                                                                                                                                                                      | Workspace folders, requirement files found, state file                                                                                                                                                                 |
| 1     | [`automation-setup`](../automation-setup/SKILL.md)                                                     | Automation dir, target platform (setup question 1 answered "no app yet")                                                                                                                        | Compiled framework structure at `<AutomationDir>` (or the existing one reused) with the lifecycle folders in `testcase_dir`, app values deferred; target platform                                                      |
| 2     | [`test-cases-generator`](../test-cases-generator/SKILL.md)                                             | BRD / user story from `<WorkspaceRoot>/.github/_requirements/user_stories/`, mode, scope (asked by the skill)                                                                                   | `<testcase_dir>/Generated Testcases/<Doc>_TestCases_v1_0.xlsx`, scope, platform type, automation-candidate count                                                                                                       |
| 3     | [`test-cases-reviewer`](../test-cases-reviewer/SKILL.md) (+ `test-cases-generator` in the revise loop) | Review: the Phase 2 `v1_0` from `Generated Testcases/`; re-review (revise loop only): the revised version from `Revised Testcases/`; the same user story, scope from Phase 2                    | `<testcase_dir>/Review Reports/<Doc>_TestCase_Review_v1_<n>.xlsx`, review verdict, coverage %, findings by severity; any revised versions in `<testcase_dir>/Revised Testcases/`; reviewed workbooks are never changed |
| 4     | [`implement-testcases-v2`](../implement-testcases-v2/SKILL.md)                                         | App build (in `Automation/apps/<platform>/` or a path the user gives), gate-passed workbook versions in `Testcases/` from Phase 3, platform and automation dir from Phase 1, scope from Phase 2 | Story classes, `automation-handoff/<story>.md`, run command                                                                                                                                                            |

## Non-negotiable rules

1. **Strictly sequential.** Never start a phase until the previous phase has finished and its exit gate passed. Never run phases in parallel, and never start Phase 4 work (device inspection, code) while Phase 1, 2 or 3 is still open. The same applies inside a phase: when several user story documents are selected, test cases are generated **one document at a time** (see Phase 2 step 2), never in parallel.
2. **The phase skill is the authority.** Inside a phase, follow that skill's `SKILL.md` exactly: its intake questions, one-at-a-time rules, confirmation gates and prohibitions. The orchestrator never weakens or skips them.
3. **Carry outputs forward, don't re-ask.** A value already settled in an earlier phase (platform, automation directory, workbook path, user story path, scope) is passed to the next phase as an answer, and shown to the user for a one-line confirmation instead of a fresh question. Only ask what the earlier phases did not settle.
4. **Stop on failure.** If a phase fails its exit gate, stop the pipeline, record the reason in the state file, and tell the user which phase stopped and why. Do not continue with partial output.
5. **Never guess.** Values come from the user, a file you read, or the state file, the same rule every phase skill already has.
6. **Update the state file at every transition** (phase started, phase completed, phase skipped, phase failed).
7. **Update the progress checklist at every step** (see Progress checklist), so the user can watch the run.
8. **Review is mandatory.** Phase 3 always runs after Phase 2; it is never skipped. Phase 4 only starts on a workbook that has been reviewed, and every revised version is reviewed again before it can be handed over.
9. **The framework comes first, the workbook goes into it last.** Phase 1 never needs a workbook. The workbook is generated into `Generated Testcases/` (Phase 2), reviewed into `Review Reports/` and revised into `Revised Testcases/` (Phase 3), and only a version that passed the Phase 3 review gate is copied into `Testcases/` (automatically, at the end of its Phase 3 cycle). Never put an unreviewed workbook into `Testcases/`, and never put a test case workbook into `Output Testcases/` (run results only).
10. **Versions are never overwritten.** v1_0 stays in `Generated Testcases/`; each revision is a new file with the next version (`v1_1`, `v1_2` …) in `Revised Testcases/`; each review is a new file in `Review Reports/` with the version of the workbook it reviewed. Corrections always go through the generator, never by hand-editing a workbook.
11. **Project-neutral.** Never write a product name, package, URL, account or other project value into `.github/skills/`. Project values live only in `.github/_requirements/`, the workbooks in `testcase_dir`, and the framework's configuration (`Automation/.env`, `config/`).

## Progress checklist

Keep a human-readable checklist in `<WorkspaceRoot>/orchestration/PIPELINE_PROGRESS.md`, next to the state file. Create it in Phase 0 with every phase and its steps:

- Phase 0: workspace root, folders created or already present, old-layout check, requirement files found, previous run (resumed / archived / none), state file and checklist created.
- Phase 1: platform asked (Mobile / Web / Mobile + Web, and the mobile platform), layout and framework root(s), each framework's check (present / not present, with what was found), any backup of a non-TypeScript framework (path and file count), setup intake (question 1 "no app yet", automation directory), discovery summary confirmed with the `npm install` approval, framework files created, `npm install` done (package count, versions pinned), each bootstrap validation (typecheck, lint, format, JSON, scripts dry-run, `.gitignore`, placeholder scan; Web also `test:list` and browsers) per framework as passed / failed / not run, values left deferred, exit gate. When Phase 1 is skipped, only the check, the platform and the skip reason.
- Phase 2: Steps 1–7 of the generator's intake (only the steps that apply to the chosen mode), platform confirmation (with the Phase 1 platform shown), Gates 0–7, exit gate, handover to Phase 3.
- Phase 3: files and order, stories, scope and evidence confirmed once; then per file, one at a time: each review (full %, risk-weighted %, gate pass/fail, Quality score, verdict, findings by severity), each revision in `Revised Testcases/`, the result (PASSED → copied to `Testcases/` automatically | GATE NOT PASSED | COVERAGE DROPPED) and open RQs; a run line `01 ✔ → 02 ⏳ → 03 [ ]`.
- Phase 4: app build found in `apps/<platform>/` (or path asked) and its values written to `.env` (package, activity, `APP_PATH`), open prerequisites (adb/ANDROID_HOME, Java, platform driver installed by setup, device + `DEVICE_UDID`), workbook copied, platform/workbook/scope confirmed, device inspection, code written (Keep / Change / Add / Blocked counts), `npm run typecheck` + `npm run lint`, handoff, run scripts installed, run command printed.
- An Outputs table (automation directory, platform, user story, generated workbook, review workbook(s), revised workbook(s), approved workbook, handoff, run command).

`pipeline-state.json` holds the same facts as data: each phase's `status`, its `inputs` (the user's answers) and its `output` (paths, counts, validation results, deferred values), plus `reason` for a skipped or failed phase.

Markers: `[x]` done, `[ ]` pending, ⏳ in progress, ⏸️ waiting for the user, ⏭️ skipped, ❌ failed (with the reason on the same line). Tick a step as soon as it finishes, write the user's answer on the step's line, and keep the header line `**Current:**` pointing at the active step. Never tick a step that did not happen.

## State file

Keep the pipeline state in `<WorkspaceRoot>/orchestration/pipeline-state.json`. Create it at the start of a run; it is how outputs move between phases and how an interrupted run resumes.

```json
{
  "run_id": "2026-10-27T10-30",
  "layout": "setup-first-v1",
  "current_phase": 1,
  "phases": {
    "1_automation_setup": { "status": "pending", "inputs": {}, "output": {} },
    "2_test_case_generation": {
      "status": "pending",
      "inputs": {},
      "output": {}
    },
    "3_test_case_review": { "status": "pending", "inputs": {}, "output": {} },
    "4_implement_testcases": { "status": "pending", "inputs": {}, "output": {} }
  }
}
```

`status` is one of `pending`, `in_progress`, `completed`, `skipped`, `failed`. A `failed` or `skipped` phase also records `"reason"`.

**Resume:** at the start, if the state file exists and its last phase is not `completed`/`skipped`, show the user its state and ask whether to resume from the first unfinished phase or start a new run. Never re-run a `completed` phase unless the user asks. When a new run is started, move the old `pipeline-state.json` and `PIPELINE_PROGRESS.md` to `orchestration/archive/` with the old `run_id` in the file name; never delete them.

**Older layouts.** A state file without `"layout": "setup-first-v1"` comes from an earlier kit:

- Three-phase layout (keys `2_automation_setup`, `3_implement_testcases`): a finished run; start a new run.
- Generation-first four-phase layout (keys `1_test_case_generation`, `2_test_case_review`, `3_automation_setup`, `4_implement_testcases`): show its state and ask whether to migrate it or start a new run. Migrating renames the keys to this layout (`3_automation_setup` → `1_automation_setup`, `1_test_case_generation` → `2_test_case_generation`, `2_test_case_review` → `3_test_case_review`), keeps every status, input and output unchanged, and adds `"layout": "setup-first-v1"`. A migrated run whose generation or review is already done still runs any unfinished automation setup before Phase 4.

## Phase 0: Start

`.github/` is the whole kit: a team copies only this folder into any project and the pipeline creates the rest. The project's inputs travel inside it, in `.github/_requirements/`.

1. Identify `<WorkspaceRoot>`: the folder that contains `.github/skills/`.
2. **Prepare the workspace.** Create whatever is missing, never overwrite what exists, and tell the user in one line what was created:
   - `.github/_requirements/` with `user_stories/`, `adr/`, `api_specs/`, `designs/figma/exports/`, `designs/wireframes/`, `archive/`, and a `README.md` saying what goes in each folder (copy [`assets/requirements-README.md`](assets/requirements-README.md));
   - `<WorkspaceRoot>/orchestration/`.

   `Automation/` (and with it `testcase_dir` and its lifecycle folders) is not created here; Phase 1 decides that. If an older run, or a generator / reviewer run before any framework existed, left test case workbooks in `<WorkspaceRoot>/reports/` (directly or in its `Generated Testcases/`, `Review Reports/`, `Revised Testcases/` subfolders), tell the user in one line and offer to copy them into the matching lifecycle folder once Phase 1 has created `testcase_dir` (`*_TestCases_v1_0` → `Generated Testcases/`, higher versions → `Revised Testcases/`, `*_TestCase_Review_*` → `Review Reports/`); never move or delete them without a yes.

3. **Old layout.** If `<WorkspaceRoot>/_requirements/` (at the root, from an older kit) exists, tell the user and ask whether to move its contents into `.github/_requirements/`. Never read requirements from both places.
4. **User story source (before any test case is written).** Follow [`references/user-story-source.md`](references/user-story-source.md): run `python .github/skills/qa-automation-orchestrator/scripts/jira_stories.py status` and act on `SOURCE`:
   - `LOCAL` (story files in `user_stories/`, `user_stories/jira-source.md` missing or empty): use the files;
   - `JIRA` (no story file in the folder, `jira-source.md` filled in): download the stories from Jira into `user_stories/` (`check`, then `fetch`);
   - `NONE` (both empty): ask for the Jira details, create `jira-source.md` with `init`, tell the user to set `JIRA_EMAIL` + `JIRA_API_TOKEN` (Cloud) or `JIRA_PAT` (Server) in their own terminal, then download;
   - `BOTH` (hand-placed story files and a filled-in `jira-source.md`): ask the user which source to use for this run.

   If the user wants neither Jira nor files, or the download fails, stop before Phase 1: "Add the BRD / user story files to `.github/_requirements/user_stories/`, or the Jira details in `user_stories/jira-source.md` (and ADRs to `adr/` for Brownfield modes), then run the pipeline again." Do not create a state file for a run that cannot start. Record `inputs.story_source` (`local` or `jira`, with the Jira site and selection, never a token).
5. Create or read the state file (see Resume) and the progress checklist.
6. Tell the user the plan in four lines (Phases 1–4 above) and start Phase 1.

## Phase 1: Automation setup

**Same framework for every project mode.** `project_mode` (GREENFIELD, BROWNFIELD, GREENFIELD With Updated User Story, Brownfield From Scratch), chosen later in Phase 2, only changes how test cases are generated. It never changes Phase 1 or 4: in every mode, a missing framework is built by automation-setup as the framework that skill defines for the chosen platform (Mobile: TypeScript + WebdriverIO + Appium + Mocha + Allure; Web: TypeScript + Playwright + Allure), and an existing one is reused. A Brownfield project that has a framework of another kind (for example Java) gets the same framework too; the old one is backed up as automation-setup describes.

**Platform and layout** (automation-setup, "Platform selection and layout"):

| Platform                                | `Automation/` layout                                                                                                                    | `mobile_dir`                        | `web_dir`                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------- |
| Mobile (Android, iOS, or Android + iOS) | flat: the mobile framework directly in `Automation/`, unchanged (no `Mobile/` or `Web/` folder)                                         | `<WorkspaceRoot>/Automation`        | -                                |
| Web                                     | only `Automation/Web/`, self-contained (its own `jenkins/`, `.github/workflows/`, `docs/`, `README.md`, `.gitignore`)                   | -                                   | `<WorkspaceRoot>/Automation/Web` |
| Mobile + Web                            | `Automation/Mobile/` + `Automation/Web/` + shared `jenkins/`, `.github/workflows/`, `docs/`, `README.md`, `.gitignore` at `Automation/` | `<WorkspaceRoot>/Automation/Mobile` | `<WorkspaceRoot>/Automation/Web` |

```text
Ask platform ──► check the framework root(s) for that platform
   ├── all present  ──► Phase 1 skipped ──► Phase 2
   └── any missing  ──► run automation-setup (builds only what is missing) ──► exit gate ──► Phase 2
```

1. Set phase 1 `in_progress`.
2. **Ask the platform (always, once).** Ask the user: "Which platform: Mobile, Web, or Mobile + Web?" and wait for the answer. When it includes Mobile, ask next: "Mobile platform: Android, iOS, or Android + iOS?" These answers are used by automation-setup (its intake question 3 and follow-up), shown again in Phase 2's platform confirmation, and used by Phase 4; never ask them again. Record `platform` (`Mobile` | `Web` | `Mobile + Web`), `mobile_platform` (`Android` | `iOS` | `Android + iOS`, when Mobile), and `mobile_dir` / `web_dir` from the table above.
3. **Check whether each framework is present.**
   - Mobile framework at `mobile_dir` counts as present only when it holds all of: `package.json` listing `webdriverio` and `@wdio/cli`; `wdio.conf.ts`, `config/wdio.android.conf.ts` (or `config/wdio.ios.conf.ts`) and `tsconfig.json`; `src/reporting/ResultWriter.ts` and `src/pages/common/BasePage.ts`; and `Testcases/` in `testcase_dir`.
   - Web framework at `web_dir` counts as present only when it holds all of: `package.json` listing `@playwright/test`; `playwright.config.ts` and `tsconfig.json`; `src/reporting/ResultReporter.ts` and `src/pages/common/BasePage.ts`; and `Testcases/` in `testcase_dir`.

   A missing folder, an empty folder, or a framework of another kind (for example a Java `pom.xml`/`testng.xml`) counts as **not present**. A flat mobile framework in `Automation/` while the platform is Mobile + Web also counts as not present at `mobile_dir`; automation-setup asks whether to move it into `Automation/Mobile/`. With Web, automation-setup asks whether to switch to Mobile + Web or use another directory. Tell the user the result in one line per framework, with what was found.

4. **All present** → set phase 1 `skipped` with `"reason": "framework already present at <path(s)>"`. Do not run automation-setup. If `testcase_dir` lacks any lifecycle folder (`Generated Testcases/`, `Review Reports/`, `Revised Testcases/`, `Testcases/`, `Output Testcases/`, `CSV Files/`; frameworks built by an older kit), create the missing ones with a `.gitkeep` and say so in one line; never move existing files. If `Testcases/` already holds workbooks that were never approved through this pipeline, list them and ask whether to move them to `Generated Testcases/` (as `v1_0`) or leave them. Record the output and go to Phase 2:

```json
"output": {
  "automation_root": "<WorkspaceRoot>/Automation",
  "platform": "Mobile + Web",
  "mobile_platform": "Android",
  "mobile_dir": "<WorkspaceRoot>/Automation/Mobile",
  "web_dir": "<WorkspaceRoot>/Automation/Web",
  "testcase_dir": "<WorkspaceRoot>/Automation/testcase",
  "created": false
}
```

5. **Any not present** → load and follow [`../automation-setup/SKILL.md`](../automation-setup/SKILL.md) end to end, with these intake answers carried over instead of asked again:
   - question 3 (target platform) and its mobile follow-up: the answers from step 2;
   - question 2 (automation directory): offer `<WorkspaceRoot>/Automation` as the default for a one-line confirmation;
   - question 1 (application project path): answer **"no app yet"**. Phase 1 never asks for the app and never reads an app build or web URL; automation-setup builds the structure in its "Framework only" mode and leaves the app values (and the web base URL) deferred.

   The discovery summary, the confirmation gate and the `npm install` (and Playwright browser) approval still apply exactly as that skill says, and so does its creation order: first `Automation/`, then `Mobile/` and/or `Web/` inside it, then the shared root files (with Mobile + Web including `shared-contract/test-data/`, the one test-data source both frameworks read), then each framework. Tick each of these on the progress checklist as it is done. A framework that is already present is completed in place, not rebuilt.

6. **Exit gate** (only when setup ran): the skill's bootstrap validation reports `npm run typecheck` and `npm run lint` passed in every framework root it built or completed, and the required structure exists. Any validation `failed` → stop the pipeline. Validations `not run` → list them and ask the user whether to continue.
7. Record the output (`automation_root`, `platform`, `mobile_platform`, `mobile_dir`, `web_dir`, `"created": true`, validation results per framework, deferred values), set phase 1 `completed`, tell the user "Phase 1 complete. Framework(s): `<mobile_dir>` / `<web_dir>` | Platform: `<platform>` (`<mobile_platform>`). Starting Phase 2 test case generation." and continue to Phase 2.

`<automation_dir>` in Phase 4 and in the skills it loads always means `mobile_dir`. If the mobile platform is Android + iOS, Phase 4 runs once per platform, Android first.

## Phase 2: Test case generation

1. Set phase 2 `in_progress`.
2. Load and follow [`../test-cases-generator/SKILL.md`](../test-cases-generator/SKILL.md) end to end (its sequential intake, platform confirmation, Gates 0–7). Its user story always comes from `<WorkspaceRoot>/.github/_requirements/user_stories/` (local files, or the Jira download made by the Phase 0 source check, `references/user-story-source.md`; `jira-source.md` is configuration and never offered as a story), listed again at Step 2: one file is selected automatically (one information line, no question), several are offered as a numbered list to pick from, and no other path is accepted. Record the selected file in `inputs.user_stories` of the state file.

   **Several documents: always sequential, one by one.** When more than one user story document is selected, generate their workbooks strictly one after another, in the order listed (document order in `user_stories/`, unless the user gives another order). Never generate two documents at the same time: no parallel subagents, no background jobs running side by side, no batch run over all documents.
   - Start document _n+1_ only after document _n_'s workbook is built and has passed its own check (`build.py` reported `"status": "success"`, `"total_errors": 0`, `"preflight.status": "success"`, and gap recovery finished on that workbook).
   - After each document, show its compact final summary, tick it on the progress checklist (`01 ✔ → 02 ⏳ → 03 [ ]`), and record its output in the state file before starting the next one.
   - If a document fails its check, stop there: do not start the next document; record the reason and tell the user which document stopped and why.
   - The intake (mode, documents, scope, platform confirmation) is still asked once for all documents; only the generation runs one by one. The skeletons (`extract_matrix.py`) may be prepared up front, as they do not generate test cases.

3. **Platform consistency.** The generator still asks its own platform confirmation ("The autodetected platform is <platform> should I continue?"). Show the Phase 1 platform on the same line. Phase 1 Mobile matches `mobile app`, Web matches `web/pwa`, Mobile + Web matches either. If they disagree (Phase 1 Mobile but the generator detects `web/pwa`, or Phase 1 Web but the generator detects `mobile app`), stop and ask the user which is correct before Gate 0; if the answer changes the Phase 1 platform, record it, and run Phase 1 setup for the framework that is now missing after Phase 3 and before Phase 4.
4. **Exit gate**, all must hold:
   - `build.py` reported `"status": "success"`, `"total_errors": 0` and `"preflight.status": "success"`;
   - exactly one testcase workbook for this document exists under `<testcase_dir>/Generated Testcases/` (`<Doc>_TestCases_v1_0.xlsx`);
   - the readiness status is not `BLOCKED` overall.

   The generator writes Mode A output to `Generated Testcases/` (see its "Output location"). If a `v1_0` for this document already exists there, the generator asks before overwriting; for a changed story use an update mode instead, which writes the next version to `Revised Testcases/`.

5. Record the output:

```json
"output": {
  "workbook_path": "<testcase_dir>/Generated Testcases/<Doc>_TestCases_v1_0.xlsx",
  "user_story": "<WorkspaceRoot>/.github/_requirements/user_stories/<file>",
  "project_mode": "GREENFIELD | BROWNFIELD | ...",
  "scope": "full document | US-004, US-013",
  "story_ids": ["US001", "US003"],
  "platform_type": "mobile app | web/pwa",
  "automation_candidates": 42,
  "verdict": "REVIEW REQUIRED"
}
```

6. Set phase 2 `completed`, then show the generator's final summary and one line: "Phase 2 complete. Workbook: `<path>` (DRAFT - NOT BASELINED). Starting Phase 3 review." Continue to Phase 3 without waiting for a go-ahead: the review is mandatory.

## Phase 3: Test case review

Phase 3 is the review → revise → re-review cycle of [`../testcase-review-cycle/SKILL.md`](../testcase-review-cycle/SKILL.md), run unattended over **every** workbook in `<testcase_dir>/Generated Testcases/`, **one file at a time** in file-name order (for example `01 → 02 → 03 → 05 → 06`). A file's whole cycle finishes before the next file starts; never review or revise two files in parallel.

1. Set phase 3 `in_progress`.
2. **Confirm once** (one line, then no further questions between steps): the files and their order, each matched user story, the scope (from Phase 2), and the supporting evidence for the reviewer (`.github/_requirements/adr/`, `designs/`, `api_specs/`; use or skip).
   > Files: `01 → 02 → 03` | Stories matched by name | Scope: `<phase 2 scope>` | Evidence: `<used / none>` | Gate: full ≥ 90% and risk-weighted ≥ 90%. Confirm or change?
3. Load and follow `testcase-review-cycle` for each file in order. Per file:
   1. **Review** the latest version with [`../test-cases-reviewer/SKILL.md`](../test-cases-reviewer/SKILL.md) → `Review Reports/<Doc>_TestCase_Review_v1_<n>.xlsx` (reviewer Gate 10 must pass; the reviewed workbook stays unchanged).
   2. **Review gate:** full coverage ≥ 90% **and** risk-weighted coverage ≥ 90% (defaults; the values, and the maximum revisions, are read from [`../testcase-review-cycle/review-gate.json`](../testcase-review-cycle/review-gate.json) — change them there). The Quality score, verdict and findings are recorded but do not decide the gate.
   3. **Below the gate → revise automatically:** [`../test-cases-generator/SKILL.md`](../test-cases-generator/SKILL.md) in **Mode C** with the review report + the version just reviewed + the user story (Context / History = that review; ADR = files in `adr/` or "No ADR provided") → `Revised Testcases/<Doc>_TestCases_v1_<n+1>.xlsx` (generator exit gate as Phase 2), then **re-review** it (re-review delta against the previous review). Repeat, at most 3 revisions per file per run; stop the file's loop early if coverage drops.
   4. **Gate passed → copy automatically** (copy, never move or edit) the passing version to `<testcase_dir>/Testcases/`; no approval question. Gate not passed after 3 revisions (or coverage dropped) → copy nothing, record the latest coverage and the open BA questions (`RQ-...`), and continue with the next file. When open BA questions are what holds the file below the gate, mark it **`NEEDS MANUAL INTERVENTION — open BA questions`** and say clearly, in chat, the progress checklist, the state file and the final report: "`<Doc>` needs manual intervention to move to `Testcases/`: <n> BA questions are still open", with the list of questions and what each blocks (see testcase-review-cycle Rule 7). Stop revising such a file as soon as only BA questions remain.
   5. Update the state file (`versions` per file) and the progress checklist (`01 ✔ → 02 ⏳ → 03 [ ]`) before starting the next file.
4. **Exit gate:** every file was processed; each review workbook exists and passed reviewer Gate 10; no reviewed workbook was changed. A reviewer or generator exit-gate failure stops the run (Non-negotiable rule 4).
5. Record the output per file:

```json
"output": {
  "files": {
    "<Doc>": {
      "versions": [
        { "workbook": "Generated Testcases/<Doc>_TestCases_v1_0.xlsx", "review": "Review Reports/<Doc>_TestCase_Review_v1_0.xlsx", "coverage": { "full": "82%", "risk_weighted": "78%" }, "gate": "failed", "quality_score": 84, "verdict": "REVIEW REQUIRED" },
        { "workbook": "Revised Testcases/<Doc>_TestCases_v1_1.xlsx", "review": "Review Reports/<Doc>_TestCase_Review_v1_1.xlsx", "coverage": { "full": "93%", "risk_weighted": "91%" }, "gate": "passed", "quality_score": 91, "verdict": "PASS WITH OBSERVATIONS" }
      ],
      "approved_workbook": "Testcases/<Doc>_TestCases_v1_1.xlsx",
      "result": "PASSED | NEEDS MANUAL INTERVENTION — open BA questions | GATE NOT PASSED | COVERAGE DROPPED",
      "open_questions": ["RQ-01"]
    }
  }
}
```

Set phase 3 `completed` and go to Phase 4 with the files whose `approved_workbook` is set. Files that did not pass are listed in the final report with their open BA questions; answering them and running the cycle again resumes from their latest version. 6. **Stop after Phase 3** (mark Phase 4 `skipped` with the reason, then give the final report) when:

- the platform is Web: Phase 4 writes mobile Appium automation only; the Playwright framework in `Automation/Web/` stays ready for web automation, which no skill implements yet;
- the workbook has no row with `Automation Candidate = Yes`: Phase 4 has nothing to automate;
- no file passed the review gate (nothing in `Testcases/` to automate);
- the user chose "stop".

## Phase 4: Implement testcases

**Routing by platform.** The platform confirmed in Phase 4 step 4 decides which implementation logic is loaded. Load exactly the files in the matching row, in this order, before writing any code:

| Platform      | Skill                    | Logic loaded (in order)                                                                                                                                                                                                                                                                                                                                                                                              | Run command                                                                                                                                                                 |
| ------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android       | `implement-testcases-v2` | `SKILL.md` → `references/shared-rules.md`, `platforms.md`, `automation-playbook.md` (locator priority `byRole` → `byId` → `byLabel` → `byText` → `byXPath`), `typescript-wdio-standards.md` ("Page objects") → `assets/page-object-template.md` (constructor locators, small action methods, flow methods, `verify...` methods, logging) → `assets/testcase-method-template.md` (the `it()` calls page methods only) | printed: `.\run <stories> -Type <type>` (`run.cmd` → `scripts/run.ps1` → `scripts/run-tests.ps1`)                                                                           |
| iOS           | `implement-testcases-v2` | Same as Android, plus `platforms.md` iOS sections (framework readiness, iOS locators; platform locators assigned in `src/pages/ios/` constructors)                                                                                                                                                                                                                                                                   | none: tell the user to run the iOS spec directly with `npm run test:ios -- --spec <file>` (no iOS run script exists yet, so results are not written to the output workbook) |
| Android + iOS | `implement-testcases-v2` | Android row first, then the iOS row, as two passes                                                                                                                                                                                                                                                                                                                                                                   | Android command only                                                                                                                                                        |
| Web           | none yet                 | Not reached: the pipeline stops after Phase 3                                                                                                                                                                                                                                                                                                                                                                        | none                                                                                                                                                                        |
| Mobile + Web  | `implement-testcases-v2` | The mobile platform's row(s) above, in `mobile_dir` (`Automation/Mobile`). The web part is not implemented: record `"web": "not implemented (no web implementation skill yet)"` and leave `Automation/Web/` untouched                                                                                                                                                                                                | the mobile command                                                                                                                                                          |

The mobile platform is the Phase 1 `mobile_platform`; `<automation_dir>` is the Phase 1 `mobile_dir` (`Automation` flat, `Automation/Mobile` split). Never mix logic across rows. For example, never use web/Playwright rules on a mobile platform, and never write mobile code into `Automation/Web/`. Never pick the platform yourself: it comes from the Phase 1 answer and is confirmed in step 4.

1. **Framework ready?** Phase 1 must be `completed` or `skipped` because the framework is present, with a mobile framework at `mobile_dir`. If it is not (a migrated run, or a Phase 1 Web that turned out to be mobile in Phase 2), run Phase 1 now and pass its exit gate first.
2. **App build → app values.** This is the first step that needs the app; nothing earlier asks for it, and it is never placed in `.github/_requirements/`.
   - Look in `<automation_dir>/apps/<platform>/` for the build of the confirmed platform (`.apk` for Android, `.ipa`/`.app` for iOS). One → use it. Several → ask which one (one question, offering the files).
   - None there → ask the user once: "Path to the app build (`.apk` for Android, `.ipa`/`.app` for iOS)?" Validate that the file exists and matches the platform, then copy (never move) it into `<automation_dir>/apps/<platform>/` (Git-ignored).
   - The user has no build → stop: set phase 4 `skipped` with `"reason": "no app build"`, and tell the user to put it in `<automation_dir>/apps/<platform>/` (or have its path ready) and resume the pipeline. The framework and the reviewed workbooks stay valid.
   - Read the values from the build: Android `aapt dump badging <apk>` (`package: name`, `launchable-activity: name`, `application-label`); iOS `CFBundleIdentifier` from `Info.plist`. If `aapt` is missing, say so and ask the user for the package and activity. Compare them with `<automation_dir>/.env`:
     - empty there (framework built without the app) → show the values with their source line and, after a one-line confirmation, write `APP_PACKAGE` + `APP_ACTIVITY` (or `BUNDLE_ID`) into `.env`;
     - different there (the framework was set up for another app) → show both and ask whether to update `.env` to this build or stop and use a fresh project folder.
   - Set `APP_PATH` in `.env` to the build in `apps/<platform>/`. Never write app values into `.env.example` or the framework code. Record `app_build`, `app_package`, `app_activity` / `bundle_id` in the state file.
3. **Workbook handed over by Phase 3.** The `approved_workbook` of each file was already copied into `<testcase_dir>/Testcases/` at the end of its Phase 3 cycle (`Automation/testcase/Testcases/`; with Mobile + Web this one copy serves both frameworks). Check it is there; if it is missing (for example a run from an older kit), copy it now (never move or edit). Never copy a review workbook or a version that did not pass the gate. When an approved earlier version of the same document is already in `Testcases/`, this is a workbook update for implement-testcases-v2 (`references/workbook-update.md`); leave the earlier copy there, because the run scripts use it for `-Previous`. Record `input_workbook` in the state file.
4. Set phase 4 `in_progress`. Load and follow [`../implement-testcases-v2/SKILL.md`](../implement-testcases-v2/SKILL.md) end to end. Its Step 1 asks for platform, workbook and scope. Answer them from the state file and show the user one confirmation line instead of three questions:

   > Platform: `<phase 1 mobile_platform>` | Framework: `<mobile_dir>` | Workbook: `<input_workbook file name>` | Scope: `<phase 2 story_ids, or "all stories" when scope was full document>`. Confirm or change?

   Start only after the user confirms. Then load the logic of the confirmed platform's row in "Routing by platform" above, and record it in the state file (`"logic": ["page-object-template.md", ...]`) and on the progress line. Everything after that (device inspection, Keep/Change/Add/Blocked, page objects, specs, compile, handoff, run scripts, printed command) follows the skill as written.

5. **Exit gate:** the skill's completion condition holds for every story in scope (every in-scope row is `Implemented` or `Blocked`, `npm run typecheck` and `npm run lint` pass, the handoff file is written, and for Android the run command was printed). The mandatory P0 smoke gate (`implement-testcases-v2/references/p0-smoke.md`) also passes for each workbook in scope: `smoke:generate` wrote one smoke spec per story with implemented Automation Candidate = Yes / Priority = P0 cases (`src/tests/smoke/<WorkbookName>/<StoryId>.test.ts`, reusing the regression tests by ID) and `src/tests/smoke/generated/<WorkbookName>/manifest.json`, and the read-only `smoke:check` printed `COVERAGE COMPLETE` (no missing, duplicated, stale or mismatched P0 case). Record each workbook's eligible P0 IDs by story, implemented and missing IDs, the manifest path and the check result. Missing tooling must be implemented, not skipped; a P0 case without an `it()`, including a `Blocked` one, leaves the gate incomplete. Do not advance or report Phase 4 completed with incomplete smoke coverage; give the user the `smoke:run` command (or the `--partial` one, labelled `PARTIAL - INCONCLUSIVE`) for the build decision.
6. Record:

```json
"output": {
  "platform": "Android",
  "stories": { "US001": { "implemented": 12, "blocked": 1, "handoff": "automation-handoff/US001.md" } },
  "compile": "passed",
  "run_command": ".\\run US001 -Type first"
}
```

7. Set phase 4 `completed`.

Phase 4 does not run tests. The user runs the printed command (see `run-tests`); for iOS, run the iOS spec directly with `npm run test:ios -- --spec <file>` (no iOS run script exists yet, so results are not written to the output workbook).

## Final report

When the pipeline stops or finishes, report one compact block:

```text
Pipeline: <run_id> | Result: COMPLETED | STOPPED AT PHASE <n>
Phase 1 automation-setup     : completed | skipped (framework present at <path>) | failed: <reason> | Platform: <Mobile | Web | Mobile + Web> (<mobile platform>) | Framework(s): <mobile_dir> <web_dir>
Phase 2 test-cases-generator : completed | Workbook: <Generated Testcases/ path> | Cases: <n> | Automation candidates: <n> | Verdict: <verdict> (DRAFT - NOT BASELINED)
Phase 3 test-cases-reviewer  : completed | failed: <reason> | Versions: v1_0 → v1_<n> (Revised Testcases/) | Last review: <Review Reports/ path> | Verdict: <verdict> | Coverage: <full %> full, <risk-weighted %> risk-weighted | Findings: C<n> H<n> M<n> | Approved: <version | none> | Decision: <continue | stop>
Phase 4 implement-testcases  : completed | skipped: <reason> | Platform: <p> | Implemented: <n> | Blocked: <n> | Compile: <result>
Handoff: <paths>
State file: <WorkspaceRoot>/orchestration/pipeline-state.json
```

Then the run command from Phase 4 in a fenced code block, with one line saying what it does.

## Example

**Request:** "Run the QA pipeline for the login BRD."

1. Phase 0: the QA copied a clean `.github/` into a new folder and added `user_stories/EPIC001_Login.docx`; the pipeline creates `orchestration/` and a new state file.
2. Phase 1: no `Automation/` folder → not present. The user picks Android. automation-setup runs with question 1 answered "no app yet", shows the discovery summary, and builds the framework structure (including `testcase/` with its lifecycle folders) after approval with the app values deferred; typecheck and lint pass.
3. Phase 2: the generator asks mode → user story (the only file in `.github/_requirements/user_stories/`, selected automatically) → scope, one at a time, confirms platform `mobile app` (Phase 1: Android), builds `Automation/testcase/Generated Testcases/EPIC001_Login_TestCases_v1_0.xlsx` (38 automation candidates).
4. Phase 3: confirmation line "Workbook: EPIC001_Login_TestCases_v1_0.xlsx | Requirement: EPIC001_Login.docx | Scope: full document". The reviewer builds `Automation/testcase/Review Reports/EPIC001_Login_TestCase_Review_v1_0.xlsx`: verdict REVIEW REQUIRED, full coverage 41/44 (93%), 2 High findings. The user chooses to revise: the generator (Mode C, test bank v1_0, context = that review) writes `Revised Testcases/EPIC001_Login_TestCases_v1_1.xlsx` (3 new, 2 modified); the re-review writes `Review Reports/EPIC001_Login_TestCase_Review_v1_1.xlsx`: PASS WITH OBSERVATIONS, 44/44. The user approves v1_1 and continues.
5. Phase 4: finds no build in `Automation/apps/android/`, asks for the APK path, copies `app-release.apk` there, reads it with `aapt dump badging`, writes the package and launch activity into `Automation/.env` after a one-line confirmation, then copies the approved v1_1 to `Automation/testcase/Testcases/`. Confirmation line: "Platform: Android | Workbook: EPIC001_Login_TestCases_v1_1.xlsx | Scope: all stories". The user confirms; implement-testcases-v2 runs and prints:

```powershell
.\run -Type first -Workbook "EPIC001_Login_TestCases_v1_1"
```
