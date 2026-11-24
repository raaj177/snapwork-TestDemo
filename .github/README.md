# QA Automation Kit

One kit for every mobile and web project. It turns a BRD / user stories (and, for automation, an app build) into reviewed test cases and automation, one step at a time: TypeScript + WebdriverIO + Appium for mobile, TypeScript + Playwright for web.

## Start a new project

1. Create an empty project folder and copy this `.github/` folder into it.
2. Clear the previous project's inputs from `.github/_requirements/` (keep the folders and `README.md`).
3. Put the new project's inputs in `.github/_requirements/`:
   - `user_stories/`: the BRD / user stories, **or** `jira-source.md` with the Jira details (required: one of the two). When the folder has no story file the pipeline downloads the stories from Jira; when both are empty it asks for the Jira details and creates `jira-source.md`. Jira credentials are environment variables (`JIRA_EMAIL` + `JIRA_API_TOKEN`, or `JIRA_PAT`), never a file;
   - optional: `adr/`, `designs/`, `api_specs/` (see `_requirements/README.md`).
4. Open the project folder in your AI coding tool and ask: **"run the QA pipeline"** (skill `qa-automation-orchestrator`).
5. Answer its questions one at a time. Progress is shown in `orchestration/PIPELINE_PROGRESS.md`.

## What the pipeline does

| Phase | What happens | Output |
| --- | --- | --- |
| 0 Start | Prepares folders, checks user stories | `orchestration/` |
| 1 Automation setup | Asks the platform (Mobile, Web, or Mobile + Web), checks `Automation/`, builds the framework structure if missing (no app needed) | `Automation/` (see below) |
| 2 Test case generation | Generates test cases from the user story | `testcase/Generated Testcases/<Doc>_TestCases_v1_0.xlsx` |
| 3 Test case review | Independent review: RTM, coverage, findings (always runs). Optional revise loop: regenerate from the review, then review again | `testcase/Review Reports/<Doc>_TestCase_Review_v1_<n>.xlsx`; revised versions in `testcase/Revised Testcases/<Doc>_TestCases_v1_1.xlsx`, `v1_2` … |
| 4 Implement test cases | Takes the app build from `Automation/apps/<platform>/` (or asks for its path), reads it into `Automation/.env`, copies the QA-approved latest version into `testcase/Testcases/` and writes the automation | Specs, page objects, run command |

`testcase/` is `Automation/testcase/` (Mobile, and Mobile + Web where both frameworks share it) or `Automation/Web/testcase/` (Web only). Workbook lifecycle inside it:

```text
Step 1  Test case generation            ──►  Generated Testcases/  <Doc>_TestCases_v1_0.xlsx
Step 2  Review (on v1_0)                ──►  Review Reports/       <Doc>_TestCase_Review_v1_0.xlsx
Step 3  Revise from the review          ──►  Revised Testcases/    <Doc>_TestCases_v1_1.xlsx
Step 4  Re-review (on v1_1)             ──►  Review Reports/       <Doc>_TestCase_Review_v1_1.xlsx
        Issues left? repeat 3–4 (v1_2, v1_3 …)
Step 5  QA approves the latest version  ──►  copied to Testcases/ (automation input)
        Runs write results              ──►  Output Testcases/ (Android-/iOS-/Web-/PWA-<name>.xlsx), CSV Files/
```

No version is overwritten or hand-edited; every fix goes through the generator.

Framework layout by platform:

| Platform | `Automation/` |
| --- | --- |
| Mobile (Android, iOS, or Android + iOS) | the WebdriverIO + Appium framework directly in `Automation/` |
| Web | only `Automation/Web/` (Playwright), self-contained with its own `jenkins/`, `.github/workflows/`, `docs/`, `README.md`, `.gitignore` |
| Mobile + Web | `Automation/Mobile/` (WebdriverIO + Appium) + `Automation/Web/` (Playwright), each with its own `package.json`, + shared `jenkins/`, `.github/workflows/`, `docs/`, `README.md`, `.gitignore` at `Automation/` |

Phase 4 writes mobile automation only (in `Automation/` or `Automation/Mobile/`); for Web the pipeline stops after the Phase 3 review and `Automation/Web/` is ready for web tests.

The app build (`.apk` / `.ipa`) is not put in `_requirements/`: the pipeline asks for it at the start of Phase 4 and keeps it in `Automation/apps/<platform>/` (Git-ignored). Phases 1–3 do not need it. An interrupted run resumes from `orchestration/pipeline-state.json`.

## After the pipeline

Simplest way to run, from the framework folder: `npm run smoke -- "<Approved Workbook>.xlsx"` or `npm run regression -- "<Approved Workbook>.xlsx" [US002 US003]` (add `--dry-run` to preview). Each run gets its own report in `report/runs/<RUN_ID>/`, a ZIP to share and a line on the `report/index.html` dashboard (see `skills/automation-setup/references/workbook-commands.md`).

To share results across several runs, run `npm run report:share` in the framework folder: it builds `report/` with a dashboard, a smoke report, one regression report per executed user story and a ZIP to send (see `skills/automation-setup/references/share-report.md`).

Run the tests with the printed command, or ask "how do I run US001" (skill `run-tests`):

```powershell
cd Automation          # Automation\Mobile for Mobile + Web
.\run US001 -Type first
```

iOS has no run script yet: `npm run test:ios -- --spec <file>`.

## Skills

| Skill | Use |
| --- | --- |
| `qa-automation-orchestrator` | The whole pipeline, step by step (start here) |
| `automation-setup` | Build or complete the automation framework |
| `test-cases-generator` | Test cases from a user story |
| `test-cases-reviewer` | Review a test case workbook |
| `testcase-review-cycle` | One generated workbook: review → revise → re-review until the Quality score is above 92, then copy the QA-approved version to `Testcases/` |
| `implement-testcases-v2` | Automation code for a workbook |
| `run-tests` | Run commands for the automation |
| `smoke-bugs-to-jira` | Triage smoke failures by evidence and file verified, de-duplicated Jira bugs under the `<Application> Smoke bugs automation` epic; records them in `Automation/Jira/issues.json` (the folder `automation-setup` creates) |

Never put real passwords, customer data or tokens in `_requirements/` or the workbooks.
