---
name: testcase-review-cycle
description: Run the review → revise → re-review cycle for EVERY generated test case workbook in Generated Testcases/, one file at a time (a file's whole cycle finishes before the next file starts), without stopping between steps. For each file - step 1 take the next <Doc>_TestCases_v1_0.xlsx (in file-name order) and its user story, step 2 test-cases-reviewer writes <Doc>_TestCase_Review_v1_0.xlsx to Review Reports/, review gate = full coverage ≥ 90% AND risk-weighted coverage ≥ 90%; below the gate, step 3 test-cases-generator (Mode C, review report + latest version + user story) writes <Doc>_TestCases_v1_1.xlsx to Revised Testcases/ and step 4 re-reviews it; steps 3–4 repeat until the gate passes (at most 3 revisions); step 5 the version that passed is copied automatically to Testcases/. Use when asked to "run the test case cycle", "review and revise the generated test cases", "auto review cycle", or "review generated test cases until they pass".
---

# Test case review cycle

Runs Phase 3 of [`qa-automation-orchestrator`](../qa-automation-orchestrator/SKILL.md) as one unattended run over **all** workbooks in `Generated Testcases/`, strictly **one file at a time**. For each file it reviews, revises and re-reviews on its own until the review gate passes, then copies the passing version to `Testcases/` automatically, and only then starts the next file. It does not generate `v1_0` (use `test-cases-generator` or orchestrator Phase 2), set up the framework (Phase 1) or write automation (Phase 4).

It does not re-implement anything: each step loads [`test-cases-reviewer`](../test-cases-reviewer/SKILL.md) or [`test-cases-generator`](../test-cases-generator/SKILL.md) and follows it, with that skill's questions answered from the table under "Answers carried into the skills". Their gates, schemas, file names and rules are unchanged.

```text
Start ──► list Generated Testcases/*_TestCases_v1_0.xlsx in file-name order (01 → 02 → 03 …); match each user story by name
For each file, in order (never two files at the same time):
  Step 1  take next file                     Generated Testcases/  <Doc>_TestCases_v1_0.xlsx
  Step 2  reviewer on v1_0               ──►  Review Reports/       <Doc>_TestCase_Review_v1_0.xlsx
          Review gate: full ≥ 90% AND risk-weighted ≥ 90%?  yes ──► step 5
                                                            no  ──► step 3
  Step 3  generator (Mode C: review report + latest version + user story)
                                         ──►  Revised Testcases/    <Doc>_TestCases_v1_<n+1>.xlsx
  Step 4  reviewer on v1_<n+1> (delta)   ──►  Review Reports/       <Doc>_TestCase_Review_v1_<n+1>.xlsx
          Review gate: yes ──► step 5 | no ──► step 3 again (max 3 revisions: v1_1, v1_2, v1_3)
  Step 5  gate passed: automatic copy    ──►  Testcases/            <Doc>_TestCases_v1_<n>.xlsx
          gate not passed: not copied; recorded with the reason
  ──► next file
Final report for all files
```

## Paths

- `<WorkspaceRoot>`: the folder that contains `.github/skills/`.
- User stories: `<WorkspaceRoot>/.github/_requirements/user_stories/` only (local files or Jira downloads; `jira-source.md` is configuration, never a story).
- `testcase_dir`: `<WorkspaceRoot>/Automation/testcase/` (Mobile, Mobile + Web) or `<WorkspaceRoot>/Automation/Web/testcase/` (Web only), whichever exists. Neither exists → stop and point to `qa-automation-orchestrator` (the framework is built in its Phase 1). A missing lifecycle folder (`Review Reports/`, `Revised Testcases/`, `Testcases/`) is created with a `.gitkeep`; say so in one line.
- `<Doc>`: the workbook name without `_TestCases_v1_0.xlsx`, for example `01_Biller_MDM`.

## Review gate

**The gate values live in [`review-gate.json`](review-gate.json)** (in this skill folder). Read it at the start of every run and use its values everywhere this file says "90%" or "3 revisions":

| Key | Meaning | Default |
| --- | --- | --- |
| `full_coverage_min_percent` | minimum full coverage % | 90 |
| `risk_weighted_coverage_min_percent` | minimum risk-weighted coverage % | 90 |
| `max_revisions_per_file` | automatic revisions per file per run | 3 |
| `copy_to_testcases_when_passed` | `automatic` | automatic |

If the file is missing or unreadable, use the defaults above and say so in one line. Show the values in the start message. "90%" and "3" below are those defaults.

A reviewed version **passes** only when **both** of the reviewer's coverage figures are **at least their minimum** (default 90%):

- **Full coverage %** = requirements classified `Covered` ÷ in-scope requirements (reviewer section 7.1), and
- **Risk-weighted coverage %** (reviewer section 7.3, High = 3, Medium = 2, Low = 1).

Both are always calculated in this cycle, never `N/A`. A review that produced no coverage figures (for example a material extraction failure) fails the gate. The reviewer's Quality score (Gate 9), verdict and findings are still recorded and reported next to the coverage, but they do not change the gate.

## Rules

1. **One file at a time.** Process the workbooks strictly sequentially in file-name order. A file's whole cycle (review, all revisions, re-reviews, copy) finishes before the next file starts. Never run two files, two reviews or two generations in parallel (no parallel subagents, background jobs or batch runs).
2. **Questions only at the start.** Everything the skills would ask between steps is answered from the table below. Ask anything else only when a step cannot continue without it (see "Stop conditions").
3. **Versions are never overwritten.** `v1_0` in `Generated Testcases/` is never changed or regenerated. Every review is a new file in `Review Reports/`; every revision is the next `v1_<n>` in `Revised Testcases/`. Never hand-edit a workbook.
4. **Only a passing version reaches `Testcases/`.** The copy is automatic once the gate passes (no approval question). Never copy a version whose review failed the gate, and never copy a review workbook.
5. **At most 3 automatic revisions** (`v1_1`–`v1_3`) per file per run. If the gate still has not passed, the file is recorded as "gate not passed" (not copied) and the cycle moves on to the next file.
6. **Never guess.** No invented requirements, ADRs or platform; missing input is recorded as a limitation or asked. Findings that need a BA answer stay `TBD` + `RQ-...`; they can keep a file below the gate until the BA answers.
7. **Open BA questions = manual intervention, stated clearly.** When a file does not pass the gate and open BA questions (`RQ-...`) are still holding coverage down, the file's result is **`NEEDS MANUAL INTERVENTION — open BA questions`**. Say so explicitly, in plain words, wherever the file's result appears (the per-file result line, `<Doc>_CYCLE.md`, `CYCLE_RUN.md`, the state file and the final report): "`<Doc>` needs manual intervention to move to `Testcases/`: <n> BA questions are still open", followed by the list of those questions (ID, one-line question, the requirement/test cases each one blocks). Never copy such a file, never present it as passed or simply as failed, and never invent an answer to close a question.
8. **Project-neutral.** No product names or project values in this file.

## Start

1. **Workbooks.** List every `*_TestCases_v1_0.xlsx` in `<testcase_dir>/Generated Testcases/` (ignore `~$` Excel lock files), sorted by file name. Show the order in one line (for example `01 → 02 → 03 → 05 → 06`); do not ask which one. None → stop: "No generated test cases in `Generated Testcases/`. Generate them first with `test-cases-generator`."
2. **User stories.** For each file select the file in `.github/_requirements/user_stories/` whose name without extension equals `<Doc>`; show the matches in one line. A file with no or several matches → ask which story (numbered list) for that file only.
3. **Scope.** Ask once: `full document` for all (default), or per file (`01: US-M3-01; 05: US-001, US-002`).

Then, per file, check existing files for `<Doc>` and continue from the first missing step:

| Found | Do |
| --- | --- |
| Latest version already in `Testcases/` with a passing review | File done; skip it (⏭️ "already passed") |
| No review | Start at step 2 |
| Latest version reviewed, gate failed | Start at step 3 from that version and review |
| Latest version reviewed, gate passed, not yet copied | Go straight to step 5 |
| Latest version in `Revised Testcases/` without a review | Start at step 4 for that version |

Show what was found in one line per file. Revisions written by an earlier run do not count toward this run's limit of 3.

Write `<WorkspaceRoot>/orchestration/cycles/<Doc>_CYCLE.md` per file (create the folders if missing): a checklist of the steps with `[ ]`, the answers above, the gate (`full ≥ 90% AND risk-weighted ≥ 90%`), and a `**Current:**` line. Add one line per reviewed version: workbook, review file, full %, risk-weighted %, gate pass/fail, Quality score, verdict. Also keep `<WorkspaceRoot>/orchestration/cycles/CYCLE_RUN.md` with one line per file in order (`01 ✔ → 02 ⏳ → 03 [ ] …`). Use the orchestrator's markers (`[x]`, ⏳, ⏸️, ⏭️, ❌ with the reason). An existing file for `<Doc>` from a finished cycle is moved to `orchestration/cycles/archive/` with its date in the name.

Tell the user in one line: "Running the cycle for <n> workbooks, one at a time (<order>), gate full ≥ 90% and risk-weighted ≥ 90%; passing versions are copied to Testcases/ automatically." Then start.

## Answers carried into the skills

| Skill question | Answer |
| --- | --- |
| Reviewer Steps 1–3 workbook / requirement / scope | The version to review / the user story / the scope |
| Reviewer Step 4 supporting evidence | Every file in `.github/_requirements/adr/`, `designs/`, `api_specs/` as the user decided at the start (or for the run); none → recorded as a limitation |
| Reviewer Step 5 previous review | Review of `v1_0`: none. Later versions: the review of the version before, as re-review delta |
| Reviewer Step 6 emphasis | Complete review, with full coverage %, risk-weighted coverage % and the Gate 9 Quality score always calculated |
| Generator Step 1 mode | Mode C (`GREENFIELD With Updated User Story`) |
| Generator Step 2 user story / Step 3 scope | From the start |
| Generator Step 4 Test Bank | The version just reviewed (the latest: highest `v1_<n>` in `Revised Testcases/`, else `v1_0` in `Generated Testcases/`) |
| Generator Step 5 Constitution | None, unless a constitution file is in `.github/_requirements/` |
| Generator Step 6 ADR (required) | Every file in `.github/_requirements/adr/`. Empty → "No ADR provided", recorded in the checklist and the generator summary as an evidence limitation; never invent one |
| Generator Step 7 Context / History | The review workbook of the version just reviewed (its findings and uncovered / partially covered requirements), plus any BA answers the user gave |
| Generator platform confirmation | Accept the autodetected platform without asking when it matches the platform of the Test Bank workbook and fits the framework in `Automation/` (Mobile layout: a mobile platform; Web layout: a web platform; Mobile + Web: any). Ask only when it does not fit or nothing was detected |

## Steps (per file)

For every review, use the reviewer's [hash-based incremental re-review protocol](../test-cases-reviewer/references/incremental-review.md). Keep a separate local cache per document. First reviews run in full; later reviews may reuse only fingerprint-matched case assessments from a verified previous report. Changed evidence, rules, scope, platform, schema, or prior report forces a full review. Record review mode, reason, and changed/removed/reused counts in the per-file checklist. Recompute all current-scope metrics and rerun global checks every time; this optimization does not change the review gate, revision limit, or required output. Commit the new cache only after Gate 10 succeeds, before advancing to the next revision or file.

**Step 1: Take the next file.** The next `v1_0` in file-name order. Not reviewed or changed here.

**Step 2: Review v1_0.** Follow the reviewer. Exit gate: `Review Reports/<Doc>_TestCase_Review_v1_0.xlsx` exists and passed the reviewer's Gate 10; `v1_0` unchanged. Record full %, risk-weighted %, Quality score, verdict and findings by severity, then apply the review gate:

- **Passed** → skip steps 3–4 (⏭️ "gate passed on v1_0") and go to step 5.
- **Failed** → step 3.

**Step 3: Revise.** Follow the generator in Mode C with the review report, the version just reviewed and the user story. It fixes only what the review findings support, starting with the requirements the review classified `Not Covered` or `Partially Covered` (highest risk first), with lifecycle `existing` / `modified` / `new` / `invalidated` and reasons in Remarks; findings that need a BA answer stay `TBD` + `RQ-...`, never invented. Exit gate (same as the orchestrator's Phase 2): `build.py` reports `"status": "success"`, `"total_errors": 0`, `"preflight.status": "success"`; `Revised Testcases/<Doc>_TestCases_v1_<n+1>.xlsx` exists.

**Step 4: Re-review.** Follow the reviewer on the new version with re-review delta against the previous review. Exit gate as step 2, for `Review Reports/<Doc>_TestCase_Review_v1_<n+1>.xlsx`. Apply the review gate:

- **Passed** → step 5.
- **Failed** and fewer than 3 revisions in this run → step 3 again for the next version.
- **Failed** after the 3rd revision → step 5 marked "gate not passed".
- **Coverage went down** (full or risk-weighted lower than the previous version) → stop this file's loop and go to step 5 marked "coverage dropped"; more rounds would not help without new input.
- **Only BA questions left:** every requirement still below `Covered` traces to an open BA question (no finding left that the generator can fix from the user story) → stop this file's loop now (another revision cannot help) and go to step 5 as `NEEDS MANUAL INTERVENTION — open BA questions`.

**Step 5: Copy or record, then next file.**

- Gate passed → copy (never move or edit) the passing version into `<testcase_dir>/Testcases/` automatically. A file with the same name already there → keep it, write nothing, and record "already in Testcases/" (never overwrite silently). An earlier approved version of `<Doc>` already there → leave it (the run scripts use it for `-Previous`) and say so.
- Gate not passed / coverage dropped → copy nothing; record the latest full %, risk-weighted % and the open BA questions that block it.
  - If open BA questions are holding coverage down (Rule 7), the result is **`NEEDS MANUAL INTERVENTION — open BA questions`**. Write this block in `<Doc>_CYCLE.md` and show it in chat:

    ```text
    ⚠️ MANUAL INTERVENTION NEEDED: <Doc> was NOT moved to Testcases/
    Reason : <n> BA questions are still open; coverage <full>% full / <rw>% risk-weighted (needs ≥ 90% both)
    Open BA questions:
      RQ-01 <question> → blocks <requirement IDs / test case IDs>
      RQ-02 …
    To continue: get the BA answers, give them to the cycle (they go to the generator as Context / History) and run the cycle again; it resumes from v1_<n>.
    ```

  - If no BA question is involved (the generator could not reach the gate in 3 rounds, or coverage dropped), the result is `GATE NOT PASSED` or `COVERAGE DROPPED`, with the remaining findings.

Tick the checklist, show one result line for the file:

```text
<Doc>: v1_0 <full>%/<rw>% → v1_1 <full>%/<rw>% … | <PASSED → Testcases/<file> | NEEDS MANUAL INTERVENTION — open BA questions (<n>) | GATE NOT PASSED | COVERAGE DROPPED> | Quality <score> | Open RQs <n>
```

and continue with the next file without asking.

## Stop conditions

Stop the whole run, mark the step ❌ with the reason in the checklist, and tell the user which file and step stopped and why when:

- a generator or reviewer exit gate fails (quote the error);
- the platform question had to be asked and is unanswered;
- a required input file cannot be read (`.docx` not extractable, workbook locked by Excel: ask the user to close it, then continue).

Files already written stay; the next run continues from the first missing step of the first unfinished file (see "Start").

## Final report

```text
Cycle run: <n> workbooks, one at a time | Gate: full ≥ 90% AND risk-weighted ≥ 90%
<Doc 1>: v1_0 <full>/<rw> → … | PASSED v1_<n> → Testcases/<file> | NEEDS MANUAL INTERVENTION — <n> open BA questions, not moved to Testcases/ | GATE NOT PASSED (<latest full>/<rw>)
<Doc 2>: …
Reviews   : Review Reports/<Doc>_TestCase_Review_v1_<n>.xlsx …
Revised   : Revised Testcases/<Doc>_TestCases_v1_<n>.xlsx …
In Testcases/: <files copied this run>
Checklists: orchestration/cycles/CYCLE_RUN.md, orchestration/cycles/<Doc>_CYCLE.md
```

Then one `⚠️ MANUAL INTERVENTION NEEDED` block (as in step 5) per file held by open BA questions, so the QA lead can see at a glance which files need BA answers before they can move to `Testcases/`. Files that did not pass the gate are listed with their open BA questions: answering those and running the cycle again (it resumes from the latest version) is what raises their coverage.

Next for a mobile story: `qa-automation-orchestrator` Phase 4 (automation) uses the copies in `Testcases/`.

## Example

**Request:** "Run the test case cycle."

1. `Generated Testcases/` holds `01_Login_TestCases_v1_0.xlsx` and `02_Payments_TestCases_v1_0.xlsx`; order `01 → 02`; stories matched by name; scope `full document`.
2. File 01: review v1_0 → full 84%, risk-weighted 81%: gate failed. Revise (Mode C) → v1_1; re-review → 93% / 91%: gate passed. v1_1 is copied to `Testcases/01_Login_TestCases_v1_1.xlsx`.
3. File 02 starts only now: review v1_0 → 95% / 94%: gate passed. v1_0 is copied to `Testcases/02_Payments_TestCases_v1_0.xlsx`.
4. The final report lists both files with their coverage history.
