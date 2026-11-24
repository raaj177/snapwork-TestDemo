# Bug Description Template

Fill every section from evidence. Write "Not confirmed" for anything you could not verify; never invent a root cause, deadline, estimate or reproduction count. No credentials, OTPs, tokens or personal data: identifiers appear masked (`ab***yz`), secrets as `<from the test account>`. The script refuses a description that contains them.

Summary: `[<Application>][<Platform>] <TC_ID>: <short observed problem>`

```markdown
## Summary
<One sentence: what the app does wrong, on which screen.>

## Source
- **Workbook:** <file name> (version <v>)
- **Worksheet / row:** <sheet name> / <row number>
- **Testcase:** <TC_ID> - <exact workbook title>
- **Requirement:** <user story ID and acceptance criterion / rule reference>
- **Also affects:** <other testcase IDs with the same root cause, or "None">

## Environment
- **App / build:** <version name (version code)> - read from the installed app
- **Device / browser:** <model or browser and version>
- **OS:** <Android / iOS / OS version>
- **Environment:** <qa / uat / staging>
- **Smoke build ID:** <BuildId from reports/smoke/...>
- **Executed at:** <ISO timestamp, UTC>

## Preconditions
- <state required before step 1, as in the workbook>

## Test data (synthetic)
- <field>: <synthetic or masked value>

## Steps to reproduce
1. <step>
2. <step>
3. <step>

## Expected result
<Quoted from the approved workbook row.>

## Actual result
<What the screenshot / UI state shows. Not a log claim.>

## Evidence
- **Screenshot:** attached (<file name>)
- **Assertion (sanitized):** `<one-line message from the results CSV, redacted>`
- **Attempts:** <final status and attempt history from the run, e.g. "Failed on 3 of 3 attempts"; or "Not confirmed">

## Impact
<Who is affected and how, from the evidence.> **Suggested priority:** <value> - <reason from triage.md>. Testcase priority P0 is not used as severity.

## Triage notes
- Harness checks done: <input read back, screen anchor verified, state reset, rerun after fixes>
- Caveats: <what is not confirmed, e.g. "Not confirmed on iOS", "Root cause not investigated">

## Retest acceptance criteria
- <TC_ID> passes on a build containing the fix, with the expected result above shown on screen.
- <Any related testcase IDs> pass in the same run.
```
