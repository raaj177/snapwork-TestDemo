# Universal QA Automation Kit

This is a reusable starter bundle for creating a QA automation framework from project requirements. It includes the Copilot skills used by the `qa-automation-orchestrator`; it does not include this project's stories, design links, test reports, generated workbooks, app builds, or orchestration state.

## Use this kit for a new project

1. Copy the contents of `Universal kits/` into the root of the new project, including the hidden `.github/` and `.vscode/` folders. Alternatively, use `Universal kits/` itself as the project root.
2. Add the new project's BRD or user stories to `.github/_requirements/user_stories/`.
3. Optionally add architecture decisions to `.github/_requirements/adr/`, API specifications to `.github/_requirements/api_specs/`, and design evidence under `.github/_requirements/designs/`. See `.github/_requirements/README.md`.
4. Open the project root in VS Code with GitHub Copilot Chat and ask: **"run the QA pipeline"**. Follow the orchestrator's questions and use the `qa-automation-orchestrator` skill as the entry point.
5. The orchestrator creates `orchestration/` progress/state files and builds the requested framework under `Automation/` based on the chosen platform and supplied evidence. An app build is only needed later if the automation implementation phase requires one.

## Bundle contents

| Path | Purpose |
| --- | --- |
| `.github/skills/` | Orchestration, framework setup, test-case generation/review, implementation, and test-running workflows |
| `.github/_requirements/` | Empty input folders and guidance for the new project's requirements |
| `.vscode/` | Workspace editor settings |
| `reports/` | Empty location for reports intentionally shared with the project team |
| `orchestration/.gitignore` | Excludes the local incremental-review cache from version control; no previous project state is included |

Generated test-case workbooks and review reports belong to the pipeline's `Automation/.../testcase/` lifecycle, not this starter bundle. Copy only reports intended for the recipient into `reports/`; do not share customer data, credentials, app builds, or active orchestration state.

## Platform and workflow

The orchestrator asks whether the project is Mobile, Web, or Mobile + Web and checks the requirements before creating anything. Mobile automation uses the provided WebdriverIO + Appium setup workflow; Web framework setup is handled by the orchestrator according to its skill. Test cases are generated and independently reviewed before any approved cases are implemented.

### Incremental re-review

The reviewer and review-cycle skills include [hash-based incremental re-review](.github/skills/test-cases-reviewer/references/incremental-review.md). The first review is full. Later reviews can reuse documented assessments of unchanged cases when the evidence, rules, scope, platform, schema, and previous report fingerprints match. Global coverage, duplicate impacts, test-data dependencies, structural checks, and dashboard recounts remain mandatory.

Local fingerprints are stored under `orchestration/.review-cache/`, which is Git-ignored. Never distribute that cache with this kit. Changed inputs invalidate reuse; the full and risk-weighted coverage thresholds remain 90% each.

The skills are versioned with this kit. When updating them, copy the updated `.github/skills/` into each project that uses the kit and preserve the cache exclusion in `orchestration/.gitignore`.
