# Requirements

Input for the QA pipeline (`qa-automation-orchestrator`). Only documents go here: the user stories and their supporting evidence. The app build does not: the pipeline asks for it in Phase 4 and keeps it in `Automation/apps/<platform>/` (`Automation/Mobile/apps/<platform>/` when the platform is Mobile + Web). Put the project's files in the folders below, then ask the agent to "run the pipeline". Test cases are generated from these files, reviewed against them, and automated in `<WorkspaceRoot>/Automation/`.

| Folder | Put here | Needed for |
| --- | --- | --- |
| `user_stories/` | BRD, epics, user stories (`.docx`, `.pdf`, `.md`, `.txt`), **or** `jira-source.md` with the Jira details to download them from | Every run (one of the two is required) |
| `adr/` | Architecture decision records | Brownfield modes B, C and D (required there) |
| `designs/figma/figma_links.md` | Table: Story, Screen, Figma link, Last updated | UI reference (optional) |
| `designs/figma/exports/` | Screen exports named by story, e.g. `US-001_Login.png` | UI reference (optional) |
| `designs/wireframes/` | Wireframes | UI reference (optional) |
| `api_specs/` | Swagger / OpenAPI files, Postman collections | API behaviour evidence (optional) |
| `archive/` | Older versions | Ignored by the skills |

Rules:

- **User story source.** Before any test case is written the pipeline checks `user_stories/`: story files present and `jira-source.md` empty → the files are used; no story file and `jira-source.md` filled in → the stories are downloaded from Jira into this folder (`<KEY>_<Summary>.md`); both empty → it asks for the Jira details and creates `jira-source.md`; both present → it asks which to use. Never put a Jira password or token in `jira-source.md`: set `JIRA_EMAIL` + `JIRA_API_TOKEN` (Cloud) or `JIRA_PAT` (Server / Data Center) as environment variables. See `.github/skills/qa-automation-orchestrator/references/user-story-source.md`.
- No real passwords, customer data or secrets in these documents. Test credentials go into the framework's test data after setup.
- Replace a changed document with its new version and move the old one to `archive/`, so only one version is offered.
- A new app version: replace the build in `Automation/apps/<platform>/`. The pipeline reads package and launch activity from the build; it never needs the app's source code.
- The pipeline asks for the mode (GREENFIELD, BROWNFIELD, ...), the user story file, the scope and the platform; it never guesses them.
