# Jira records for smoke failures

Created by `automation-setup` when the framework was built. It holds the **verified** Jira records raised from automation failures of **Universal kits (application name deferred until the app build is read in Phase 4)** (Mobile: Android + iOS): every epic and bug key, its URL, the testcase it came from and where its screenshot is.

```text
Jira/
  README.md        this file
  issues.json      verified epic and bugs (written by jira_bugs.py record, never by hand)
  evidence/        only masked copies of screenshots (created when needed); other attachments are referenced in place
```

## What is automated and what is not

- **Automated by `.github/skills/smoke-bugs-to-jira/scripts/jira_bugs.py`:** access check, duplicate search, creating the epic and bugs from a reviewed spec, attaching a reviewed screenshot, and re-opening each issue to verify key, parent, assignee, description and attachment before it is saved here.
- **Not automated:** deciding which failures are product bugs (triage), reviewing screenshots, and approving runs and Jira writes. A person does these every time. No CI job creates Jira issues.

## Workflow

1. Smoke run: `npm run smoke:run -- --workbook "<file>" --platform <platform>`; decision and evidence in `reports/smoke/<WorkbookName>/<BuildId>/`.
2. Triage every failure (`.github/skills/smoke-bugs-to-jira/references/triage.md`); fix automation defects and rerun first.
3. Jira (credentials in your terminal only: `JIRA_EMAIL` + `JIRA_API_TOKEN`, or `JIRA_PAT`):

Run from the workspace root (the folder that holds `.github/`):

```powershell
python .github/skills/smoke-bugs-to-jira/scripts/jira_bugs.py access --project <KEY> --assignee "<display name>"
python .github/skills/smoke-bugs-to-jira/scripts/jira_bugs.py find-epic --project <KEY> --name "<Application> Smoke bugs automation"
python .github/skills/smoke-bugs-to-jira/scripts/jira_bugs.py find-bugs --project <KEY> --testcase <TC_ID>
python .github/skills/smoke-bugs-to-jira/scripts/jira_bugs.py create --spec bug.json --dry-run
python .github/skills/smoke-bugs-to-jira/scripts/jira_bugs.py create --spec bug.json
python .github/skills/smoke-bugs-to-jira/scripts/jira_bugs.py attach --issue <BUG> --file <reviewed screenshot, e.g. screenshots/failures/<TC_ID>_....png> --reviewed
python .github/skills/smoke-bugs-to-jira/scripts/jira_bugs.py record --issue <BUG> --parent <EPIC> --assignee <account id> --attachment <attached file name> --jira-dir Automation/Jira --meta meta.json
```

## Records

| Type | Key | Testcase | Status at record time |
| --- | --- | --- | --- |

## Reliability fixes in this project

| File / method | Failure that showed it was needed | Fix | Rerun result |
| --- | --- | --- | --- |
