# Governance Rules (constitution · COPILOT · readiness · categories · scoring)

Single source of truth for every mode. AI is a QA design assistant, not the final authority. Goal: better coverage + traceability + stronger assertions + lower duplication — not case count.

## Source Classification (every case carries exactly one)

- **SOURCE** — directly supported by Story/AC/rule/contract/design/compliance clause. Cite it (`US-001 | AC-03`).
- **DERIVED** — logical consequence of an explicit rule, no new behavior (max 10 MB → 9.99 / 10 / 10.01 MB).
- **ADVISORY** — industry-standard coverage not required by source (usability, performance, extra hardening, localization, compatibility). Label "ADVISORY — requirement confirmation required"; never present as an AC.
- **BLOCKED** — no reliable expected result (missing/contradictory info). Must carry a Requirement Question.

## Mandatory rules QA-R01–R72

| # | Rule |
|---|---|
| R01 | Story, AC, business rules, approved specs are the primary truth. |
| R02 | Never silently invent a requirement. |
| R03 | Every test traces to Story/AC/rule/contract/design/compliance or an explicit QA inference. |
| R04 | Missing info → Requirement Question / TBD, never an assumed expected result. |
| R05 | Contradictions flagged before baselining. |
| R06 | Scenarios before detailed cases. |
| R07 | Every AC: positive coverage, and negative where meaningful. |
| R08 | Defined limits → boundary tests (MIN, MIN±1, MAX, MAX±1 — only meaningful ones). |
| R09 | Mandatory fields → empty, valid, invalid coverage. |
| R10 | Significant business rule → enforcement case + violation case. |
| R11 | Role/permission rule → authorized + unauthorized coverage. |
| R12 | State change: before-state → action → resulting state → repeated action. |
| R13 | One primary behavior per case. |
| R14 | Expected results observable and measurable. |
| R15 | No vague results ("works correctly", "successful", "error displayed", "System should work correctly", "User should get proper response", "Application should behave as expected") without the observable outcome. |
| R16 | Tiny data variations → one data-driven case. |
| R17 | Do not add a redundant test case. Do not merge or fold distinct test cases. |
| R18 | Risk determines priority, not sequence or confidence. |
| R19 | Critical flows, integrations, permissions, defect-prone areas get deeper coverage. |
| R20 | Regression candidates chosen by impacted behavior, stability, criticality, defect history. |
| R21 | Not every generated test belongs in regression. |
| R22 | Automation Candidate Yes/No governed by strict feasibility, prerequisite vs implementation distinction, requirement clarity, and justified rationale (Rules 1–8). Missing scripts must not cause No. All reasons and prerequisites must be documented in the Remarks column ONLY (Automation Remark remains blank). When Automation Candidate is No, Remarks must append bold title '**No automation reason:** <reason>' with a concrete domain explanation (never generic boilerplate). |
| R23 | Never use production credentials, customer data, tokens, confidential records, private logs as test data. Realistic synthetic sample data conforming to requirement format rules (e.g. 'Adhi@23435g') is required, not a violation. |
| R24 | Compliance/security only from an identified applicable standard, else ADVISORY. |
| R25 | Human QA review before any output becomes an approved asset. |
| R26 | Every executable prompt enforces full COPILOT; missing element → BLOCKED, no execution. |
| R27 | Design traceability ≠ executable/automated/executed/passed/verified coverage; BLOCKED/ADVISORY count only toward design traceability. |
| R28 | ≥1 BLOCKED case caps verdict at REVIEW REQUIRED; pending human approval = DRAFT — NOT BASELINED. |
| R29 | AI-created AC IDs use `WAC-<story>-<n>`, labeled WORKING ID, exact source text retained, never presented as source-approved. |
| R30 | Expected results identify observable value/state, where observed, the source value to match, what must not occur, resulting state. |
| R31 | History-first lookup mandatory when a stable Story ID exists. |
| R32 | Existing Story ID → compare against last Human-QA-approved baseline before full generation. |
| R33 | Unchanged approved coverage stays Existing and is not rewritten. Change a case only when the requirement change alters it. Add a case only for new behavior. |
| R34 | History granularity: Story → AC/Rule → Scenario → TC. Story ID + count alone is insufficient. |
| R35 | Only Human-QA-approved artifacts update the baseline; drafts, working IDs, unresolved BLOCKED never overwrite history. |
| R36 | History unavailable/corrupt/unmatchable → declare `HISTORY UNAVAILABLE`, run full scan; never fake delta completeness. |
| R37 | Every scenario has a non-empty unique `Test Scenario ID`; every test has a non-empty unique `Test Case ID`. |
| R38 | Every SOURCE, DERIVED or BLOCKED case has a non-empty `Requirement Reference`; SOURCE/DERIVED references must point to a Story/AC/BR/rule/contract/design/compliance clause or explicit working ID. |
| R39 | Every BLOCKED case has `Expected Result` containing `TBD` and `Remarks` containing an `RQ-...` Requirement Question. A status-only blocker is not sufficient governance. |
| R40 | Workbook enum fields must use only the Config contract values. Design-stage manual and automation status default to `Not Executed`; `Not Started` is invalid. |
| R41 | Generic Cross-Cutting testcase generation is excluded from the workbook. Do not create a Generic Cross-Cutting module/sheet or shared generic testcase set. Cross-cutting behavior is tested only when explicitly required by the source and must then be written under the relevant story/module with source traceability. |
| R42 | Regression Candidate must be explicitly decided Yes/No per case using impact, criticality, stability, reuse value and defect history. No blanket default. Exactly ONE test case Excel workbook is generated per deliverable; regression candidate classification lives inside that workbook, and no separate regression test excel workbook is generated. |
| R43 | Preflight governance validation runs before workbook creation and fails the build on missing traceability, invalid enums, malformed BLOCKED governance, duplicate IDs or missing required testcase fields. |
| R44 | A workbook with preflight governance errors is not deliverable, regardless of Excel structural/formula success. |
| R45 | Greenfield projects generate complete governed coverage from scratch for approved in-scope requirements without a test bank. Modes other than Greenfield (Modes B, C, D) update the designated test bank: the test bank is copied as-is in the generated workbook, and only the user story given in the BRD is updated with the test cases. |
| R46 | Projects updating an existing test bank (Modes B, C, D) require evidence review before generation: existing test bank, user stories, regression suite, automation, APIs/contracts, code/context, and ADR. |
| R47 | Accessible project context in Claude Project Context, Codex, ChatGPT, Cursor, Cloud Agents, or similar environments is evidence and must be reviewed/reused before new case generation. Never claim unavailable context was reviewed. |
| R48 | When the same Story ID, feature/module, or semantically matching requirement exists in prior context, perform semantic delta classification. Wording-only differences are not automatically MODIFIED behavior. |
| R49 | When updating an existing test bank (Modes B, C, D — i.e. modes other than Greenfield), the designated test bank is copied AS IS in the generated Excel workbook: all existing module sheets and test data requirements are preserved/copied into the generated copy. ONLY the user story given in the BRD is updated with test cases (updating its sheet or adding it if new). All other sheets remain untouched with Existing cases. Previous totals match the original Dashboard. Updated totals are Existing + Modified + New and exclude Invalidated. |
| R50 | When the platform supports iOS (`Both Android and iOS`, `iOS`, or multi-platform combinations with Mobile App), every testcase explicitly sets `IOS Testcase` to Yes or No. If platform is `iOS`, every entry in `IOS Testcase` must be `Yes`. For platforms `Android`, `Web`, `Mobile Web`, and `Web + Mobile Web`, the `IOS Testcase` column is removed from every user story tab, and the `iOS Dashboard` tab is not created. |
| R51 | When platform is `Both Android and iOS` (or multi-platform combinations with Mobile App), `IOS Testcase = Yes` is selective (prioritize critical flows, platform-sensitive behavior). When platform is `iOS`, every testcase must be marked `Yes`. |
| R52 | For iOS-sensitive mobile flows, consider applicable iOS behavior such as Face ID/Touch ID, permissions, keyboard/input, app lifecycle, WebView/Safari/SDK handoff, deep links, notifications, file/photo/camera picker, native navigation/dismissal, secure storage/session, and supported iOS/device compatibility; only assert behavior supported by source/context. |
| R53 | Translate implementation/system-style requirement prose into clear user-observable testcase wording without changing semantics. Preserve every material condition; place internal setup/state in Pre-condition or Test Data when clearer; retain source traceability. |
| R54 | Platform-Specific Behavior Governance: When `Both Android and iOS` is selected and any flow or interaction behaves differently on Android and iOS (e.g., native back navigation, file pickers, permissions, biometric prompts, webview containers), you MUST explicitly state both behaviors in the test steps and expected results using the format 'Android: [behavior]. iOS: [behavior]'. When `Android` is selected, ONLY Android-specific behavior must be used in test steps, descriptions, and expected results (e.g. press device hardware back button or in-app back arrow; iOS swipe-from-left-edge is excluded). When `iOS` is selected, ONLY iOS-specific behavior must be used in test steps, descriptions, and expected results (e.g. tap native back button or swipe-from-left-edge gesture; Android hardware back button is excluded). Do not use generic terms like 'use platform back' or 'use device biometrics'. This applies as an explicit exception to anti-invention rules for platform-native UX conventions. |
| R55 | Table Row Multi-Error Rule: If a specification table row or field specifies multiple distinct failure messages or validation constraints, generate exactly 1 test case per distinct quoted error message / validation rule. Never merge distinct error messages into a single test case; never split one error message into multiple cases. |
| R56 | Boundary Multiplier Rule: For any bounded field (min/max), generate exactly 1 Positive Case (covering valid values) and exactly 1 Negative Boundary Case (covering out-of-bounds values with error assertion). |
| R57 | Trigger Bundling Rule: Dual-state threshold triggers (< N vs ≥ N, e.g. <3 chars vs ≥3 chars debounce) MUST be verified in exactly 1 sequential multi-step test case. Never split threshold triggers across multiple cases. |
| R58 | Unstated Edge Cases & Dev Notes: If an edge case (e.g. whitespace in free-text, SQL injection) or dev note (e.g. "endpoints TBD") is not explicitly defined in the document, do NOT generate test case rows. Log them strictly as Requirement Questions (RQ) in the summary. |
| R59 | Test Data Column Standards: When a testcase requires input data, provide concrete, realistic sample data reflecting the exact combinations, formatting, and boundary rules specified in the requirements (e.g. PAN ID: 'PAN ID: AYNMH8765J'; password requiring uppercase, special char, number, min length -> 'Adhi@23435g'). Never use random data, generic placeholders ('Synthetic valid test data', 'Invalid test inputs', 'N/A'), or test data ID references ('TD1', 'TD2', 'TD-001'). Where no test data is possible or needed (e.g. navigation, viewing static screens, back button, screen orientation), keep the Test Data column completely empty. |
| R60 | Mode E (Delete User story): When user selects "Delete User story - Delete absolute or not required user story from test bank (Mode E)", ask for Test Bank in Step 2, and ask for User Story to delete in Step 3 (mandatory pause; supports comma-separated entries like 'US001-login, US002-signup'). Delete the matching user story sheet(s) from the replicated test bank copy, clean up exclusive test data requirements, preserve all remaining user story sheets and their test cases intact, and dynamically recalculate all totals across remaining modules in Dashboard, Automation Dashboard, and iOS Dashboard. |
| R61 | Requirement Decomposition (Reviewer Rule 1): Before generating or comparing test cases, decompose the requirement into 9 independently verifiable items: business requirements, functional requirements, acceptance criteria, business rules, input validations, user workflows, preconditions/dependencies, expected system behaviour, and boundary conditions. Each item must be independently traceable. |
| R62 | Requirement Identification & Multi-Mapping Control (Reviewer Rule 2): Use original requirement IDs wherever available; never invent requirement IDs. Map every applicable test case to its corresponding requirement. Maintain traceability when one requirement requires multiple cases. Allow one test case to cover multiple requirements ONLY when it genuinely verifies all mapped requirements. |
| R63 | Requirement Interpretation & Business Intent (Reviewer Rule 3): Compare actual business intent rather than relying only on matching keywords. Consider business objective, functional behaviour, input conditions, expected outputs, business constraints, preconditions, dependencies, and exception handling. Never introduce unsupported functionality or assumptions. |
| R64 | Functional Coverage Breadth (Reviewer Rule 4): Every requirement must be evaluated for applicable positive, negative, edge cases, field validations, business rules, UI behaviour, compatibility, usability, and dependency scenarios. A requirement is not fully covered merely because one test case references its ID. |
| R65 | Semantic Comparison Attributes (Reviewer Rule 5): Compare existing test cases with requirements using 8 attributes: Requirement ID, Acceptance criteria, Business objective, Functional behaviour, Preconditions, Test steps, Test data, Expected results. Different wording does not automatically mean different functionality; identical wording does not guarantee equivalent coverage. |
| R66 | Existing Test Case Classification & Modification Safeguard (Reviewer Rule 6): In update exercises, evaluate and classify every testcase as Existing, Modified, New, or Invalidated. Preserve unchanged test cases. NEVER classify a test case as Modified only because its wording has changed. Document the specific modification reason in Remarks for every Modified case; document the invalidation reason in Remarks for every Invalidated case. Do not delete historical test cases. |
| R67 | Missing & Partial Requirement Coverage (Reviewer Rules 7 & 8): When an AC/requirement has no matching case, identify the gap, create a scenario, generate positive/negative/edge cases, and map to the requirement. If an existing test case covers only some ACs, identify uncovered ACs and generate additional cases; NEVER mark the requirement fully covered until all applicable ACs have test coverage. |
| R68 | Duplicate Test Case Detection (Reviewer Rule 9): Check duplicates based on same business objective, functional behaviour, input conditions, execution steps, expected results (semantic equivalence across all 5 attributes). Do not create redundant test cases to artificially increase coverage numbers. |
| R69 | Ambiguous Requirements & BLOCKED Protocol (Reviewer Rule 10): When requirements are unclear, identify missing information, avoid inventing expected behaviour, document ambiguity, classify impacted case as BLOCKED with TBD in expected result and an RQ-... reference in Remarks, and request clarification before finalizing expected behaviour. |
| R70 | Source Type Governance & Dedication (Reviewer Section 4): Every test case must carry exactly one Source Type (SOURCE, DERIVED, ADVISORY, BLOCKED) in its dedicated column; never embed Source Type in Remarks. SOURCE, DERIVED, and BLOCKED require Requirement Reference. ADVISORY coverage must never be presented as mandatory requirement coverage. |
| R71 | Test Case Quality & Vague Results Prohibition (Reviewer Section 5): Every test case must contain all 13 core attributes: Module, Test Scenario ID, Test Scenario, Test Case ID, Test Description, Requirement Reference, Priority, Preconditions, Type, Test Steps, Test Data, Expected Result, Test Category. Expected results must be specific, measurable, verifiable. Vague statements such as 'System should work correctly', 'User should get proper response', 'Application should behave as expected' are strictly prohibited. Negative is a Type, not a Test Category. |
| R72 | Intermediate Requirement Coverage Matrix & 15-Step Comparison Workflow (Reviewer Sections 6, 7, 8, 10, 11): Prepare an internal Requirement Coverage Matrix (Requirement ID \| Acceptance Criteria \| Existing Test Case \| Comparison Result \| Gap / Action) before final workbook generation. Complete the 15-step comparison workflow, verify the 11-point requirement coverage validation, and pass the 15-point final acceptance checklist. Requirement ID matching alone never establishes coverage; semantic alignment across business intent, functional behaviour, ACs, execution conditions, and expected result is mandatory. |
| R78 | Direct Platform Selection & Sub-Selection Workflow: Platform autodetection is completely disabled. Prompt the user directly with the 7 configured options: 1. Mobile App, 2. Web, 3. Mobile Web, 4. Mobile App + Web, 5. Mobile App + Mobile Web, 6. Web + Mobile Web, 7. Mobile App + Web + Mobile Web. Block execution until user responds. If Mobile App is selected, immediately present another prompt asking: 'Select the required platform' with options: 1. Both Android and iOS (Recommended), 2. Android, 3. iOS, and block execution until user responds. If Both Android and iOS is selected, proceed as currently working for mobile app (IOS Testcase column present, selective Yes/No, iOS Dashboard created). If Android is selected, remove IOS Testcase column from every user story tab, and do not create iOS Dashboard. If iOS is selected, IOS Testcase column is present, every entry must be Yes, and iOS Dashboard is created. For Web, Mobile Web, and Web + Mobile Web, IOS Testcase column is not present and iOS Dashboard is not created. |
| R79 | Test-Case-Level Platform Applicability Engine: Every testcase sheet includes a dedicated `Platform` column immediately after `Test Category`. Allocate platforms strictly as the intersection of confirmed project platforms and required test scenario platforms across 5 categories: (A) Shared Business Logic (assign all confirmed platforms on which the feature is implemented), (B) Mobile-Specific (assign only `mobile app`), (C) Web-Specific (assign only `web`), (D) Mobile Web-Specific (assign only `mobile web` or `web, mobile web`), and (E) Platform-Neutral. Never assign `Mobile App, Web, Mobile Web` as a blind default. Never assign all project platforms to every test case. Never hallucinate unsupported platforms. |
| R80 | BA Comments Column in User Story Tabs: Every testcase sheet includes a dedicated `BA Comments` column immediately before `Developer Status` (following `Remarks`). Reserved for Business Analyst notes, clarification tracking, and requirement alignment. |
| R81 | Dynamic Platform Count Columns in Dashboards: The `Dashboard` and `Automation Dashboard` sheets dynamically generate dedicated columns matching the exact distinct platform values detected in the `Platform` column of the test cases (e.g. `Mobile App`, `Web`, `Mobile App+Web`). Multi-platform combination test cases form their own dedicated combination columns rather than double-counting across single platforms. Live formulas report platform-specific test case counts such that each test case belongs to exactly one platform column, guaranteeing that the sum of counts across the platform columns in every summary row equals exactly the Total Test Cases count. Platform count columns are omitted from the iOS Dashboard tab. |
| R82 | Descriptive Specification, Short Code Replacement, Generic Reference Resolution & Simple Plain Language Mandate (R85): In the 6 narrative/prose columns (Test Scenarios, Test Description, Pre-condition, Test Steps, Expected Result, Remarks), short codes (such as screen codes S1, S2; error codes E01, E02; requirement codes AC-01, BR-01; component codes) must NOT be displayed in the generated Excel test cases. Always check what the short code means and replace it with its proper description (e.g. if S1 is 'Login Basic screen', display strictly 'Login Basic screen' instead of 'S1'; exact error message text 'Enter a valid 10-digit mobile number' instead of 'E01'). Generic terms like 'step 1', 'step 2' must be resolved to their actual action/value from the story (e.g. 'Click on continue button' instead of 'step 1'). Generic terms like 'Page 1', 'Page 2' must use the referenced title/name if found in the document, falling back to 'Page 1' only if no reference exists. All narrative column data must be written in clear, simple language understandable by any person. Canonical IDs are maintained exclusively in the Requirement Reference column for traceability. |
| R86 | Full Sentence Titles, Module Data & Unclipped Tab Names Standard: The title of the user story in Row 0 and all cell data in the Module column must contain the complete, unclipped sentence of the user story name without arbitrary character limits. Worksheet tab names must be complete, meaningful phrases/sentences within Excel's 31-character limit, avoiding mid-word truncations. |

## COPILOT

| Element | Must state |
|---|---|
| C Context | System/domain/feature context and constraints; missing context is surfaced, not guessed |
| O Objective | One explicit QA outcome (not "test this") |
| P Persona | The QA role expected (Senior QA Analyst, Reviewer, API QA Engineer…) |
| I Input | Mandatory and optional artifacts; never substitute general knowledge for a missing source |
| L Logic Boundaries | Constitution inherited: no invention, source classification, BLOCKED/TBD, risk-based depth, scope |
| O Output Format | Deterministic sections/fields/schema |
| T Traceability Hook | Every artifact references Story/AC/rule/contract/design/compliance or is DERIVED/ADVISORY/BLOCKED |

Status: **PASS** (all seven present, mandatory inputs available) · **PASS WITH QUESTIONS** (structure complete, some requirement info missing — proceed only where expected behavior is verifiable) · **BLOCKED** (element absent or missing source prevents reliable expected results — do not execute). Context is evidence, persona never overrides source, inputs are authoritative, output matches the declared contract, no orphan artifacts. Do not expose chain-of-thought; the check records presence only.

## Project model and context reuse

The skill supports exactly five project modes. `AUTO` does not exist and is strictly prohibited.

- **Mode A: GREENFIELD (Standalone Greenfield):**
  Generate complete, governed coverage for all approved, in-scope requirements. Apply the original Greenfield test-design rules for scenario grouping, case splitting, traceability, and semantic deduplication. Do not perform historical Test Bank reconciliation. Do not generate unnecessary cases merely because the story contains many fields, validation rules, or acceptance criteria. Do not omit valid coverage to achieve a smaller test-case count. Uses the standalone 25-column workbook schema without `Test Case Type` or `baseline_cases`.

- **Mode B: BROWNFIELD (Existing App with Test Bank):**
  Treat the existing Test Bank as the baseline. Perform requirement and existing-test reconciliation. Preserve existing identifiers according to current lifecycle rules. Classify cases using the lifecycle values: `existing`, `modified`, `new`, and `invalidated`. The designated test bank is copied as-is in the generated Excel workbook, and only the user story given in the BRD is updated with test cases. Uses the 26-column workbook schema with lifecycle dashboard counts.

- **Mode C: GREENFIELD With Updated User Story:**
  Use the previously generated Greenfield suite / designated Test Bank as the baseline. Compare the updated User Story with the previous approved input and generated test cases. Identify cases that remain valid, require modification, are genuinely new, or are invalidated by changed requirements with documented reasons. The designated test bank is copied as-is in the generated Excel workbook, and only the user story given in the BRD is updated with test cases. Uses the 26-column workbook schema.

- **Mode D: Brownfield — Existing App, From Scratch:**
  Existing app with designated Test Bank. The designated test bank is copied as-is in the generated Excel workbook for all other modules/stories. For the user story given in the BRD, generate a comprehensive suite from scratch based on the updated user story requirements without assuming that historical cases for this specific story must be individually reconciled. Uses the 26-column workbook schema.

- **Mode E: Delete user story tab (Mode E):**
  Delete user story test cases that are no longer part of application (eg: US002-Profile Management). Load designated test bank (`--source-workbook`), identify matching sheet via user input (`--delete-story` CLI argument or `"delete_story"` in `cases.json`), remove the sheet and its test cases, clean up `Test Data Requirements` (pruning entries exclusive to the deleted story and removing its ID from shared requirements), preserve all remaining module sheets as-is, and dynamically recalculate all counts in `Dashboard`, `Automation Dashboard`, and `iOS Dashboard`. Output to a separate copy specified by `--out`. Original test bank is never modified.

In Claude Projects, **Project Context / project knowledge** is a first-class evidence source. In Codex, ChatGPT, Cursor, Cloud Agents, or similar tools, use equivalent accessible project/workspace/conversation context. This context review applies to update modes (Modes B, C, and D).

Matching order for update modes: stable Story ID → feature/module identity → acceptance-criteria/business-rule semantics. If a previous requirement is semantically the same, classify the case `existing` even if prose or layout changed. A user-story update that revises an existing test bank follows R49. If context cannot be accessed, say so and do not fabricate a history review.

## Shared Quality Rules (All Four Modes)

1. **Priority 1: Restore Original Greenfield Generation Rules:**
   - Standalone `GREENFIELD` strictly uses the original generator's test-design rules.
   - Preserve complete coverage of all approved, in-scope requirements.
   - Preserve the original readiness gate, traceability, governance, and approval rules.
   - Do not use the original test-case count as a target or limit.
   - Preserve all four project modes in complete isolation without leaking update/lifecycle semantics.

2. **Priority 2: Restore Original Test-Case Granularity & Deterministic Mapping:**
   - Do not create a separate case for every field, validation, error message, or boundary value by default.
   - Enforce Rules R55–R58 deterministically: exactly 1 negative case per quoted error message; exactly 1 positive case per distinct control/action; exactly 1 case per Excluded Data table row; bundle dual-state triggers (<N vs >=N) into 1 multi-step case.
   - Combine related checks when they can be executed and verified together without losing clarity or defect isolation (e.g. verifying empty fields validation on the same form/screen).
   - Keep separate cases for materially different behaviors, preconditions, state transitions, or expected outcomes.
   - Use parameterized cases for equivalent input variations where appropriate.
   - Run `scripts/extract_matrix.py` to pre-generate the immutable test case skeleton and guarantee identical case counts across runs.

3. **Priority 3: Improve Semantic Duplicate Detection:**
   - Compare cases by requirement, preconditions, actions, expected results, and state transitions.
   - Detect duplicate coverage even when the descriptions use different wording.
   - Do not merge genuinely distinct scenarios (e.g. success path vs validation error vs account lock).
   - Check for duplicate coverage across modules and tickets.

4. **Priority 4: Enforce Authoritative Story Requirements:**
   - Validate every test case against the latest approved User Story, BRD, and applicable requirements.
   - Modify or invalidate cases whose expected behavior contradicts the revised requirements.
   - Preserve cases whose behavior remains valid.
   - Do not interpret every wording change as a new requirement.

5. **Priority 5: Prevent Unsupported Test Cases:**
   - Do not invent expected results, error messages, validation limits, timeouts, or navigation behavior.
   - Use the existing `TBD` and `RQ-*` clarification convention when expected behavior is unspecified.
   - Distinguish confirmed requirements from assumptions and test-design recommendations.

6. **Priority 6: Improve Changed-Rule Impact Assessment:**
   - Assess the impact of every added, modified, or removed requirement.
   - Add cases only for genuinely new requirements or demonstrable coverage gaps.
   - Modify affected cases rather than creating duplicates.
   - Invalidate cases only when the behavior is removed, contradicted, or no longer applicable.
   - Record the evidence supporting each invalidation in Remarks.

7. **Priority 7: Separate Blocked Cases from Executable Coverage:**
   - Require a specific reason and clarification reference (`RQ-*`) for every blocked case.
   - Report blocked and executable cases separately.
   - Do not count unresolved expected results as fully executable coverage.
   - Do not remove blocked cases simply to improve coverage metrics.

8. **Priority 8: Calibrate Priority and Severity:**
   - Preserve the existing priority definitions (P0/P1/P2) and severity rules.
   - Assign P0 only when the defined business-criticality and impact criteria are met (authentication, funds/payments, sensitive data, security, regulatory, irreversible actions).
   - Do not promote cases merely because they test negative paths, edge cases, or changed requirements.
   - Validate and explain substantial changes in priority distribution.

9. **Priority 9: Validate Boundary and Edge Cases:**
   - Derive boundary values directly from authoritative requirements.
   - Test valid and invalid boundaries where supported by the specification.
   - Remove or correct cases that contradict documented limits.
   - Do not invent limits merely to increase edge-case coverage.
   - *Example:* If the revised story sets a duration maximum of 999, a case expecting 9999 to be accepted must be corrected or invalidated.

10. **Priority 10: Add a Coverage-versus-Count Audit:**
    Before delivering the suite, report the complete audit:
    - Total test cases.
    - Requirements covered and uncovered.
    - Justified additions.
    - Cases split or combined.
    - Duplicates removed.
    - Modified and invalidated cases, where applicable.
    - Blocked versus executable cases.
    - Priority distribution.
    - Any unresolved coverage gaps.
    Explain significant count changes using evidence. Do not force the output to match the original count.

11. **Priority 11: Preserve Workbook Schema and Mode Isolation:**
    - Keep the original Greenfield workbook schema unchanged (strict 25 columns).
    - Do not introduce Brownfield-only lifecycle columns (`Test Case Type`) or dashboard metrics into standalone Greenfield output.
    - Preserve IDs, formulas, dropdowns, formatting, and required sheets according to each mode's contract.
    - Keep Greenfield generation separate from Brownfield reconciliation. Exactly ONE test case Excel workbook is generated per deliverable. No separate regression test excel workbook.

## Greenfield-Only Parity Rule (Mode A: GREENFIELD Only)

Apply this section **only when the selected mode is standalone `GREENFIELD`**:
- Follow the original generator's test-design granularity, scenario grouping, splitting, coverage-generation, and semantic deduplication rules.
- Preserve complete coverage of all approved, in-scope requirements.
- Do not create one test case for every field or sentence by default.
- Group related checks when they can be executed and verified together without reducing clarity or defect isolation.
- Keep distinct behaviors separate when their preconditions, business rules, state transitions, or observable outcomes materially differ.
- Do not use the historical test-case count as a hard limit or target.
- Do not remove valid cases to imitate a previous count.
- If the output differs substantially from an established reference output, explain the differences using evidence: coverage additions, justified splitting, duplicate removal, requirement interpretation, and unresolved requirements.
- Preserve the original readiness gate, governance checks, traceability requirements, no-invention rules, mandatory approval stages, and 25-column workbook schema.
- Do not apply Greenfield-only parity rules to the other three modes unless their existing contracts explicitly require them.
- If the exact original rule cannot be verified from the available skill implementation, do not invent its wording or claim exact parity; report the unresolved rule explicitly.

## iOS execution selection

`IOS Testcase` is a controlled Yes/No column. It identifies a **focused iOS execution subset** so QA does not need to rerun every case on iOS. Note: This functionality and the corresponding iOS Dashboard are only applicable when the target Platform is iOS. Mark Yes for high-value cross-platform checks and iOS-sensitive cases; examples include P0/P1 critical journeys, Face ID/Touch ID, iOS permissions, keyboard/input differences, lifecycle/background-resume, WebView/Safari/SDK transitions, deep links, push notifications, camera/photos/files picker, native navigation/dismiss gestures, session/secure-storage behavior, and representative supported iOS/device compatibility. Mark No for redundant lower-risk variants unless the requirement makes them platform-sensitive. Do not infer unsupported platform behavior; when exact iOS behavior is undefined, use TBD/BLOCKED or ADVISORY as governed by source type.

## Prohibited assumptions

Never invent unless explicitly in the source: API URLs · HTTP methods · status codes · request params · response fields · headers · error codes · error messages · timeouts · OTP expiry · password length/complexity · retry limits · session expiry · lock limits · max/min values · DB behavior · role permissions · redirect destinations · notification behavior · audit requirements · encryption algorithms · regulatory standards · "2/3 second" performance targets.

Correct: `Exact error message: TBD` + `Requirement Question: What message appears when the OTP is invalid?`

## Readiness — 13-point check

Actor/Role · Trigger · Preconditions · Business rule · Input · Validation · Output · State change · Permission · Error behavior · Limits (min/max/length/count/size/time) · Dependency (API/service/device) · Acceptance Criteria objectively verifiable.

Result: Clear / Ambiguous / Missing / Contradictions / Untestable ACs / Requirement Questions / Testability Status `READY` | `READY WITH QUESTIONS` | `BLOCKED`. Read every field-validation table row by row — a validation stated only in a table is binding. Apply equal depth from first module to last.

## Scenario categories (apply only where meaningful)

**Accessibility exclusion:** Accessibility/a11y/WCAG/screen-reader/assistive-technology test scenarios and test cases are out of scope for this skill output and must not be written to the Excel workbook. If the source contains accessibility-only requirements, exclude those requirements from testcase coverage denominators rather than creating BLOCKED/ADVISORY accessibility cases.

- **Functional Positive** — happy path, each AC, valid rule/role/state.
- **Functional Negative** — invalid/missing input, unsupported action, invalid state, rule violation.
- **Boundary** — MIN, MIN±1, MAX, MAX±1 where a limit exists.
- **Input/Data** — valid, invalid, empty, null, whitespace, min/max length, special chars, duplicates, malformed, localization, combinations. Parameterize.
- **Role & Authorization** — authorized, unauthorized, restricted, transition, expired/revoked, direct access. Only defined behavior.
- **State Transition** — initial → action → state → repeat action → response (temporary password → change → old one must fail).
- **Integration** — valid/invalid response, missing data, dependency down, timeout (if defined), auth failure, downstream rejection, duplicate request, retry (if specified), partial failure, consistency. Never invent dependency behavior.
- **API (contract supplied)** — request: fields, types, formats, boundaries, headers, authn/authz; response: status, schema, mandatory fields, business values, error structure. Undefined code → `Expected HTTP status: TBD — Contract clarification required.`
- **Security** — auto-consider for login/auth/password/OTP/token/session/payments/personal data/upload/download/recovery/privileged/sensitive: authn/authz enforcement, session, data exposure, audit, direct access, input validation, secrets. Unrequired → ADVISORY.
- **NFR** — performance, compatibility, reliability, usability, localization, fault tolerance. Measurable only with a defined SLA, else `ADVISORY — threshold: TBD`. **Accessibility is excluded from testcase generation.**
- **Compliance** — only with a regulated domain and explicit standard. Regulation → Requirement → Risk → Scenario → Evidence. Ask which standard applies (PCI DSS, GDPR, ISO 27001, SOC 2); never auto-declare. Accessibility/WCAG testcase generation is excluded.

## Generic Cross-Cutting exclusion

Do **not** generate a `Generic Cross-Cutting` module, sheet, or mandatory shared testcase set. Generic compatibility, network, session, layout, duplicate-action, navigation/relaunch, and unexpected-error cases must not be added merely as default coverage. Generate any such case only when the supplied requirement explicitly defines that behavior; place it in the relevant story/module, trace it to the source, and classify it normally. Accessibility remains separately excluded from testcase generation.

## Priority

Business Impact × Failure Likelihood × User Frequency × Change Risk.
P0 authentication, money movement, sensitive data, irreversible actions, regulatory, major flows · P1 common journeys, integrations, significant rules, defect-prone · P2 secondary, lower-frequency · P3 cosmetic/minor. Workbook uses P0/P1/P2; map P3 to P2 with a remark. AI proposes, QA decides.

Regression levels: Smoke, Critical Regression, Full Regression, Release-Specific, Exploratory/Manual, One-Time Validation, Not Regression. Reason: Critical flow, Shared dependency, Historical defect, Security risk, Integration risk, High usage.

## Automation Candidate Yes/No Decision Rules

### 1. Assess the Complete Test Case
Evaluate the test objective, preconditions, steps, expected results, test data, platform, dependencies, and verification method. Never decide using only the test title, category, keywords, or priority.

### 2. Verify Automation Feasibility
Check whether the required automation framework, platform support, APIs, SDK integrations, test hooks, and verification capabilities are available or can reasonably be implemented. Do not assume unsupported or unverified capabilities exist.

### 3. Distinguish Implementation from Prerequisites
- `SHOULD_BE_YES`: Automatable using available capabilities and normal implementation work.
- `CONDITIONAL_YES`: Automatable once a specific, practical prerequisite is provided.
- `CORRECT_NO`: Cannot be reliably automated through the supported approach, even after reasonable alternatives are considered.

Missing automation scripts or ordinary coding work must not automatically result in No.

### 4. Check Requirement Clarity
If the core expected behavior or pass/fail assertion is unresolved or contradictory, assign `BLOCKED_REQUIREMENT`. Do not invent expected behavior. Unrelated secondary TBDs must not automatically block an otherwise clear test.

### 5. Evaluate All Mandatory Actions and Assertions
Assess the complete scenario, including every required action and assertion. Consider reasonable supported alternatives, test hooks, controlled environments, and API-assisted setup before deciding No. Do not classify a test as fully automatable if a mandatory action or assertion still requires undocumented manual intervention.

### 6. Use Comparable Cases as Evidence
Compare existing automation cases by objective, actions, assertions, platform, framework, test data, and required capabilities. Similar titles or wording alone are insufficient evidence.

### 7. Require a Justified Decision
Every No must have a specific rationale explaining the automation limitation and affected action or assertion. For `CONDITIONAL_YES`, identify the prerequisite in `Remarks`. For `BLOCKED_REQUIREMENT`, identify the unresolved requirement and clarification needed in `Remarks`. For any testcase where Automation Candidate is `No`, update the `Remarks` column ONLY by appending the reason formatted with the bold title: `**No automation reason:** <reason>`. **Do NOT update or put the reason in `Automation Remark` — all remarks must reside in the `Remarks` column only; `Automation Remark` remains blank (`""`).** Generic boilerplate (e.g., `Requirement blocked pending clarification of RQ-01; automated assertions cannot be finalized.`) is strictly prohibited; properly explain the concrete fields, formatting, or boundaries being verified and why they cannot be automated without inventing requirements. If evidence is insufficient, flag the case for review rather than guessing.

### 8. Map the Verdict to Yes/No
- `SHOULD_BE_YES` → **Yes**
- `CONDITIONAL_YES` → **Yes**, with prerequisite documented in `Remarks` only
- `BLOCKED_REQUIREMENT` → **No**, pending requirement clarification; `Remarks` must contain both `RQ-...` and `**No automation reason:** <reason>` with concrete domain explanation (never generic boilerplate); `Automation Remark` remains blank
- `CORRECT_NO` → **No**, with feasibility limitation documented in `Remarks` appended with `**No automation reason:** <reason>`; `Automation Remark` remains blank

## Writing standards

**Requirement normalization:** Source wording can be technical or implementation-oriented (flags, routing logic, backend state, internal condition names). Testcases should read like executable user/business requirements, not like copied code logic. Preserve the full semantic condition. Prefer:
- Source: `If the credentials are valid and the first-login flag is cleared, the system routes to the Dashboard.`
- Test description: `Verify that a user with valid credentials can log in and navigate to the Dashboard.`
- Pre-condition/Test Data: `First-login condition/flag is cleared for the test user.`
- Expected result: `Login succeeds and the Dashboard is displayed.`

If the internal state is itself what must be validated, keep it explicitly in the testcase. Otherwise move it to Pre-condition/Test Data so the main description stays user-observable. Never drop a material branch condition, invent a state/value, alter the destination/outcome, or create extra behavior beyond the source. Requirement Reference must still point to the original US/AC/rule. This rule applies equally when the skill runs in Claude, ChatGPT, Codex, Cursor, Cloud Agents, or similar tools.


**Title:** Action + Condition + Expected Behavior. `Verify login is rejected when the password is incorrect`, not `Test Login`.
**Steps:** executable, sequential, repeatable. `1. Navigate to Login. 2. Enter registered user ID. 3. Enter valid password. 4. Select Login.`
**Expected result:** what changed, where observable, what state/value exists, what must NOT happen; for state changes also persisted state, permission/status change, downstream effect. Reject on their own: "Page opens", "Button works", "API works", "Error appears", "Data saves successfully", "works correctly", "displayed correctly", "populated correctly", "processed successfully", "relevant state", "appropriate result", "functions as expected", "filter works correctly".
**Duplicates:** same condition + action + expected behavior with trivial data differences → one case with a data table. On a story update, do not fold existing cases together.
**Test Data Column Standards (Sample Data vs. Empty):**
The `Test Data` column in the test case table must contain concrete, realistic sample data reflecting the exact combinations, rules, and boundaries specified in the user story, or remain empty when no data is possible/needed:
1. **Rule-Driven Concrete Sample Data:** When a test case requires data inputs (e.g. credentials, passwords, forms, phone, email, amounts, dates, search terms, dropdowns), provide realistic sample values that strictly satisfy or isolate the specification rules:
   - *Example (Password):* If a user story specifies that a password must have at least 1 uppercase letter, 1 special character, 1 number, and be minimum 8 characters long, the positive test case `Test Data` must be a concrete sample such as `Adhi@23435g` (or `User ID: user@example.com, Password: Adhi@23435g`).
   - *Negative Cases:* Directly isolate and exhibit the invalid condition under test. For example, for missing special char use `Adhi123435`; for missing uppercase use `adhi@23435g`; for missing number use `Adhi@bcdefg`; for length < 8 use `Adh@12`; for wrong password use `WrongPass@123`.
   - *Multi-Field Cases:* Format clearly with field identifiers, e.g., `User ID: testuser01, Password: Adhi@23435g` or `Date: 2026-11-15, Time: 10:30 AM`.
2. **Empty When No Test Data Is Possible:** Where a test case verifies an action or display that does not accept/require input data (e.g. navigation, opening a screen/tab, clicking a static back button, viewing a dashboard, dismiss gestures, orientation changes, zero-file optional uploads, static notices/disclaimers), keep the `Test Data` column **completely empty (`""` / blank cell)**. Never write "N/A", "None", or placeholder text.
3. **Prohibition of Random / Generic Placeholder Data:** Never use random gibberish or lazy generic placeholders such as `Synthetic valid test data`, `Invalid test inputs`, `Synthetic valid credentials`, `Random data`, `Valid user ID; incorrect password` (without actual values), `N/A`, `None`, or `Test data`.
4. **Distinction from Test Data Requirements Sheet:** The `Test Data Requirements` sheet tracks environment/account prerequisites across stories (e.g. `TD-001 Customer ID with password expired`), whereas the `Test Data` column on each story sheet provides the concrete sample values executed in that specific test case.
5. **Clarification on Production PII (R23):** R23 prohibits real production credentials, live customer data, and secret tokens. High-quality synthetic sample data conforming to required formats (e.g. `Adhi@23435g`) is required and does NOT violate R23.
**Workbook semantics:** Manual `Status`: Not Executed, Pass, Fail, Skip, NA, Blocked, On Hold, Deferred. `Automation Status`: Not Executed, Pass, Fail, Skip, NA, Blocked, Test Data Dependency. `Developer Status` and `Developer Comment`: recorded immediately after Remarks on every user story sheet for developer tracking (blank by default at design time), followed by `Automation Status`, `Actual Automation Result`, and `Automation Remark`. `Actual Automation Result` records the observed automation run output/assertions. `Automation Candidate (Yes/No)` is a design classification governed by the Automation Candidate Decision Rules (Rules 1–8): `SHOULD_BE_YES` and `CONDITIONAL_YES` map to `Yes`; `BLOCKED_REQUIREMENT` and `CORRECT_NO` map to `No`. `Automation Candidate = Yes` is a design classification only — never evidence of a script, run, or pass. `IOS Testcase = Yes` means selected for focused iOS execution only; it is independent from regression and automation classification. `Test Data Dependency` never counts as pass/executed. `Automation Remark` is reserved for execution/run notes and remains blank during test generation; all design remarks, prerequisites, requirement refs, `RQ-...` questions (mandatory for `BLOCKED` / `BLOCKED_REQUIREMENT`), blockers, and automation candidate rationales reside in `Remarks` ONLY. **Crucially, when `Automation Candidate` is `No`, the `Remarks` column MUST append the reason why automation is No, formatted with the bold title: `**No automation reason:** <reason>` (e.g., `<requirement refs / RQ-...> | **No automation reason:** <reason>` or `**No automation reason:** <reason>` if initially blank). Generic boilerplate (e.g. `Requirement blocked pending clarification of RQ-01; automated assertions cannot be finalized.`) is strictly prohibited; the explanation must explicitly detail what rules/fields are verified, how the unresolved question impacts them, and why automated assertions or input boundaries cannot be defined without inventing requirements (e.g. `The case verifies the exact allowed Customer ID / ACC / CIN / Trade Code characters and formatting. RQ-01 leaves those rules unresolved, so the test cannot define reliable input boundaries or expected validation behavior without inventing requirements.`).**

## Coverage layers (never collapse into one number)

1 Design traceability (AC → any case) · 2 Executable (AC → non-BLOCKED, non-ADVISORY case) · 3 Positive & negative · 4 Automation design (AC → automation candidate) · 5 Implemented automation (script exists/reviewed) · 6 Execution (run result exists) · 7 Verified pass (Passed + evidence). BLOCKED/ADVISORY contribute to layer 1 only.

## Scoring (100)

| Dimension | Wt |
|---|---:|
| Requirement Traceability | 15 |
| Requirement Fidelity / No Invention | 15 |
| Functional Coverage | 15 |
| Negative & Boundary Coverage | 10 |
| Test Design Quality | 10 |
| Expected Result Quality | 15 |
| Risk Coverage | 5 |
| Data Quality (realistic, safe, sufficient) | 5 |
| Maintainability / Duplication | 5 |
| Security/NFR/Compliance Applicability | 5 |

Bands: 90–100 `APPROVED ELIGIBLE` · 80–89 `REVIEW REQUIRED` · 70–79 `REWORK REQUIRED` · <70 `REJECT`. `APPROVED ELIGIBLE` → `APPROVED` only with zero BLOCKED, zero unresolved Critical/High questions, zero Hard Fails, and human approval.

**Overrides (score never wins):** ≥1 BLOCKED → max REVIEW REQUIRED · unresolved contradiction → max REWORK REQUIRED · any Hard Fail → REJECT · human approval pending → `DRAFT — NOT BASELINED`. >5 % of executable cases with vague results → Expected Result Quality ≤ 10/15.

**Hard Fails:** no traceability for a case · invented expected behavior · missing/unmeasurable expected result · test contradicts an AC · impossible precondition · secret/credential/PII in test data · fabricated API code/field/message · unresolved contradiction · duplicate adding no coverage · non-executable test presented as READY/approved (BLOCKED is permitted only with the question recorded and excluded from executable coverage) · compliance asserted without an identified standard · updating history from an unapproved draft · silently deleting coverage for a removed requirement (mark it Invalidated and keep the original workbook unchanged) · rewriting an Existing case or adding a second case for unchanged approved coverage · classifying a testcase as Modified without substantive requirement/behavioral change (wording-only change) · failing to document the modification reason in Remarks for a modified case · marking a requirement fully covered when applicable acceptance criteria remain uncovered · vague expected results ("System should work correctly", "User should get proper response", "Application should behave as expected") · deleting historical test cases during update operations.

Every final report shows: numeric score, override checks, governance (COPILOT) status, testability status, execution readiness, final verdict, baseline status. State explicitly whether any Hard Fail applies.

---

## Requirement-to-Test Case Comparison & Traceability Rules (QA Governance Standard)

Full standard specification, matrix formats, and detailed checklists are in [`references/reviewer-rules.md`](./reviewer-rules.md).
- **Governing Principle (R72):** Requirement ID matching alone does not establish requirement coverage; semantic alignment across business intent, functional behaviour, acceptance criteria, execution conditions, and verifiable expected results is mandatory.
- **Decomposition & Identification (R61–R63):** Decompose into 9 verifiable items (business, functional, ACs, rules, inputs, workflows, preconditions, behaviour, boundaries). Preserve original IDs. Evaluate actual business intent across 8 attributes. Allow multi-mapping only when genuinely verifying all mapped requirements.
- **Functional Breadth & Semantic Comparison (R64–R65):** Evaluate positive, negative, edge, validations, business rules, UI, compatibility, usability, and dependency scenarios. Compare using 8 attributes; wording differences do not equal different functionality.
- **Classification Controls (R66):** Classify existing cases as `existing`, `modified`, `new`, or `invalidated`. Do not classify as Modified for wording changes alone. Document modification reason in Remarks for every Modified case (GV228). Document invalidation evidence in Remarks. Never delete historical test cases.
- **Missing & Partial Coverage (R67–R68):** Uncovered ACs get new scenarios. Never mark a requirement fully covered until all applicable ACs have test coverage. Prevent semantic duplicates across 5 attributes without inflating count.
- **Quality Rules (R70–R71):** 13 core attributes mandatory. Specific measurable results required; vague results ("System should work correctly", "User should get proper response", "Application should behave as expected") prohibited. Dedicated Source Type column. Negative is a Type, not a Category.
- **Intermediate Matrix & Workflow:** Construct Requirement Coverage Matrix (`Requirement ID | Acceptance Criteria | Existing Test Case | Comparison Result | Gap / Action`), execute 15-step workflow, verify 11-point coverage validation, and confirm 15-point acceptance checklist before workbook build. Detail in [`references/reviewer-rules.md`](./reviewer-rules.md).
- **8 Coverage Dimensions & Multi-Dimensional Depth (R73):** Every in-scope requirement must be evaluated across 8 coverage dimensions: Positive/happy path, Negative/invalid input, Boundary/limit, State/transition, Role/permission, Error/exception handling, Platform variant (Android vs iOS), Integration/data dependency. If any expected dimension lacks test coverage, the requirement is classified as `Partially Covered`, NEVER `Covered`. A requirement is `Covered` strictly when all expected dimensions are tested. Missing tests = `Not Covered`. Blocked requirements = `Blocked / Needs Clarification`.
- **RTM as Internal Traceability Matrix & Exclusion from Workbook Tabs (R74):** Traceability is verified internally across the 23 standard audit attributes (Requirement ID, ID Type, Story ID, Module, Requirement / AC, Requirement Kind, Risk Level, Source Doc, Source Location, Mapped Test Cases, Mapped Scenarios, Valid Count, Expected Dimensions, Covered Dimensions, Missing Dimensions, Mapping Quality, Coverage Status, Platform Coverage, Automation Coverage, Gap/Risk, Test Outline, Recommendation, Human Status). **RTM and Heatmap tabs must NOT be present in the generated Excel workbook**; the deliverable Excel is strictly reserved for governed execution sheets (Dashboard, Automation Dashboard, iOS Dashboard, Config, Test Data Requirements, and module sheets).
- **Coverage Depth & Risk Distribution in Preflight Audit (R75):** User Story × Coverage Dimension Depth and Requirement Risk × Coverage Distribution are calculated internally during preflight audit and reported in the chat summary / audit report. They are not output as separate spreadsheet tabs.
- **Risk-Weighted Coverage Model & Metrics (R76):** Requirements are weighted by risk: High (weight 3), Medium (weight 2), Low (weight 1). The test suite audit must report `Dimension Coverage % = (Total Covered Dimensions / Total Expected Dimensions) * 100`, `Risk-Weighted Coverage % = Sum(Covered weight) / Sum(Total in-scope weight) * 100` (Fully Covered = 1.0, Partially Covered = 0.5, Not Covered = 0, Blocked = 0), and explicitly identify all High-Risk Unresolved Gaps.
- **Story-Wise Test Data Traceability Schema (R77):** The `Test Data Requirements` worksheet must follow the 9-column traceability schema: `Test Data ID`, `User Story ID`, `User Story / Module`, `Test Data Description`, `Required For`, `Requirement Reference`, `Data Setup / Preparation Notes`, `Environment / Platform`, `Status`. Real secrets, passwords, live PII, and production credentials are prohibited; concrete synthetic data descriptions and prerequisite environment states are required.
- **Platform Selection & Sub-Selection Workflow (R78):**
  Platform autodetection is completely disabled. The agent directly prompts the user to select from the 7 supported options:
  1. `Mobile App`
  2. `Web`
  3. `Mobile Web`
  4. `Mobile App + Web`
  5. `Mobile App + Mobile Web`
  6. `Web + Mobile Web`
  7. `Mobile App + Web + Mobile Web`
  Execution must block until the user responds.

  If `Mobile App` (Option 1) is selected, immediately present another prompt asking:
  *"Select the required platform"*
  1. `Both Android and iOS (Recommended)`
  2. `Android`
  3. `iOS`
  Execution must block until the user responds.

  - **Option 1: Both Android and iOS:** Proceed with logic as is currently working for mobile app (`IOS Testcase` column present with selective Yes/No, `iOS Dashboard` tab created in Excel). In test steps with divergent platform behaviors (e.g. Back navigation, biometrics), combine both behaviors into the shared test case using format `'Android: [behavior]. iOS: [behavior]'`.
  - **Option 2: Android:** Remove `IOS Testcase` column from every user story tab; `iOS Dashboard` tab should NOT be created in Excel. In test steps, descriptions, and expected results, ONLY Android-specific behavior must be used (e.g. press device hardware back button or in-app back arrow); iOS-specific behaviors (such as swipe-from-left-edge gesture) must NOT be included.
  - **Option 3: iOS:** `IOS Testcase` column is present and every entry must be `Yes` in every testcase; `iOS Dashboard` tab IS created in Excel. In test steps, descriptions, and expected results, ONLY iOS-specific behavior must be used (e.g. tap native back button or swipe-from-left-edge gesture); Android-specific behaviors (such as hardware back button) must NOT be included.
  - **Web, Mobile Web, Web + Mobile Web:** `IOS Testcase` column should NOT be present in user story tab sheets; `iOS Dashboard` tab should NOT be created in Excel.
  - **Mobile App + Web, Mobile App + Mobile Web, Mobile App + Web + Mobile Web:** `IOS Testcase` column is present (selective Yes/No) and `iOS Dashboard` tab IS created in Excel.
- **Platform Column in User Story Tabs & Test Case-Level Platform Values (R79):** Added immediately after `Test Category` (immediately before `Actual Result`). Must record the actual platform(s) on which that specific test case can be executed, governed by the Automation Types definitions:
  - **Mobile:** What is tested: *Native apps installed from an `.apk` / `.ipa`* | Runs on: *Real Android and iOS devices, emulators and simulators*.
  - **Web:** What is tested: *The website in a desktop browser* | Runs on: *Chromium (Chrome, Edge), Firefox, WebKit (Safari engine)*.
  - **Mobile Web:** What is tested: *The web app as a phone user opens it: in the mobile browser, or installed to the home screen* | Runs on: *Chrome on Android, Safari on iOS (real devices)*.
  Populated as `Mobile App`, `Web`, `Mobile Web`, or exact applicable combinations such as `Mobile app, Mobile Web`, `Mobile App, Web`, `Web, Mobile Web`, `Mobile App, Web, Mobile Web`. Never display unapplicable platforms (e.g. if runnable on Mobile App and Mobile Web, Web must not be shown). Never assign all platforms as a blind default. Never hallucinate unsupported platforms.
- **BA Comments Column in User Story Tabs (R80):** Added immediately before `Developer Status` (following `Remarks`). Reserved for Business Analyst notes, clarification tracking, and requirement alignment.
- **Platform Count Columns in Dashboards (R81):** Dedicated columns for `"Web"`, `"Mobile App"`, and `"Mobile Web"` in `Dashboard` and `Automation Dashboard` calculate platform-specific test case counts if and only if that platform exists (detected or inputted by user or present in test cases). If only Mobile Web exists, only 'Mobile Web' is generated. If mobile app and Mobile Web exist, then 'Mobile App' and 'Mobile Web' are generated (Web is omitted). Count is calculated dynamically via live formulas (`COUNTIF` / `COUNTIFS`). If a combination of platforms is specified for a test case, it is counted separately against every platform. Mobile App, Web, and Mobile Web columns should not be generated in the iOS Dashboard tab.
- **Runtime File Integrity Mandate (R82):** Most importantly, the generated files should not be edited during runtime of skill. Never open, mutate, patch, or manually rewrite generated scripts, json files, or excel workbooks during skill execution. Everything must be generated directly and deterministically by the skill execution pipeline via `cases.json` and `scripts/build.py`.
- **Independent QA Review & Gap Recovery Governance (R83):**
  - **Governing Rule:** Recover a gap only when sufficient evidence exists in the original source documents (User Story, acceptance criteria, business rules, ADR) to create a valid test case. If the expected behaviour cannot be established from the available evidence, do not guess. Document the reason in the `Remarks` column and request clarification. A recovered test case must pass the same quality, traceability, semantic and coverage validations as every other test case.
  - **Gap Identification & Recoverability:** Identify every gap by comparing the original User Story/BRD against the generated Test Case Excel workbook. Determine whether each gap can be recovered using the available source documents.
  - **Recoverable Gaps:** Generate missing or corrected test cases without introducing unsupported assumptions. Populate all mandatory fields, correct Requirement Reference, Source Type (`SOURCE` or `DERIVED`), Priority, Test Category, and Platform. Add to the appropriate sheet, ensure no duplicate coverage, record recovery action in `Remarks`, and recalculate dashboard counts and formulas.
  - **Unrecoverable Gaps:** Do not invent expected behaviour, business rules, or test data. Keep affected cases unchanged, record exact reason in `Remarks`, identify missing info (`RQ-...`), and classify as `BLOCKED` where applicable.
  - **Remarks Requirements:**
    - Recoverable: Explain identified gap, source evidence, and recovery performed (`[Gap Recovery - RECOVERED] ...`).
    - Unrecoverable: Explain why recovery is not possible and what clarification is required (`[Gap Recovery - UNRECOVERABLE] ...`).
    - ADR contradiction: Identify conflicting ADR decision and explain contradiction (`[Gap Recovery - ADR CONTRADICTION] ...`).
    - Incorrect existing test case: Explain defect and correction performed (`[Gap Recovery - DEFECT CORRECTED] ...`).
  - **Final Validation (G01–G14 Review Controls):** Re-run all review controls G01–G14 after recovery (G01 Traceability, G02 Semantic Alignment, G03 8 Coverage Dimensions, G04 Verifiable Expected Results, G05 Mandatory Attributes, G06 Test Data Quality, G07 Platform Applicability, G08 Automation Candidate Governance, G09 Duplicate Prevention, G10 Lifecycle Classification, G11 Coverage Resolution, G12 ADR Governance, G13 Formula Integrity, G14 Single Final Workbook Delivery & Integrity per Document). Report recovered gaps and unrecoverable gaps separately.
  - **Output Requirements:**
    - Deliver strictly ONE final Excel workbook per input user story document (e.g. `reports/<Name>_TestCases_v1_0.xlsx`). Do NOT output two different Excel files (such as an uncorrected draft and a corrected version) for the same document.
    - When multiple input user story docs are provided in the user story user input section, the number of output Excel workbooks generated must be exactly the same as the number of input docs: every input doc generates its own separate test case Excel workbook (1:1 Document-to-Workbook mapping).
    - All recovered test cases and unrecoverable gap notes are incorporated directly into each document's single final workbook.
    - Never silently modify existing test cases.
    - Provide a review report table containing `Gap ID | Requirement ID | Test Case ID | Gap Description | Recovery Status | Recovery Action | Remarks`.
- **Auditor & Reviewer Governance Alignment (R84):**
  Ensures that generated test case workbooks pass external quality auditors and reviewer skills (specifically aligning with the 13-gate model, 8-dimension coverage, and zero-invention standards of `SKILL 1.md`) with minimal or zero gap findings:
  1. *Atomic Requirement Decomposition:*
     Acceptance criteria, complex business rules, and field validations containing multiple behavioral clauses must be decomposed into atomic, verifiable sub-requirements. Test cases must explicitly test and cite the individual clauses, boundaries, and negative branches so that auditors performing atomic `WAC-` clause extraction find complete traceability.
  2. *8-Dimension Coverage Guarantee:*
     Every user story module must provide coverage across the 8 core testing dimensions:
     - Functional / Happy Path
     - Boundary Value Analysis
     - Negative / Error Handling
     - Field / Attribute Validation
     - State Transition / Navigation Lifecycle
     - Security, Session Integrity & PII Protection
     - Performance, Scalability & Volume (e.g. large record lists with vertical scrolling)
     - Edge Cases & Process Recovery
     Omission of any in-scope dimension is flagged by auditors as an unresolved high-risk gap.
  3. *Strict Zero-Invention on Unconfirmed Specifications:*
     Whenever a requirement is underspecified, contradictory, or pending architectural confirmation (e.g. conflicting field precedence such as `fdType` vs `schemeCode`, UI error presentation on payload checksum failure, recovery after background state eviction, or JSON schema variations for empty arrays):
     - Never invent UI precedence, specific error dialogs, or fallback behavior.
     - Classify `source_type = BLOCKED` and `status = Blocked`.
     - In `Expected Result`, describe safe error handling with exact UI details marked as `TBD pending clarification RQ-xx`.
     - In `Remarks`, formulate the explicit Requirement Question (`RQ-xx`) and supply the mandatory bold header `**No automation reason:**` explaining the missing specification.
     - Set `automation_candidate = No` and `regression_candidate = No`.
  4. *Parameterized Synthetic Test Data & Prerequisite Notes:*
     In the `Test Data Requirements` worksheet (Sheet 5), never use hardcoded sample literals (e.g. hardcoded PANs, real/sample account numbers) in `Data Setup / Preparation Notes` or `Test Data Description`. Always use parameterized descriptors such as `<CUSTOMER_WITH_LOAN_AND_FD>`, `<VALID_PAN_WITH_FD>`, `<CUSTOMER_WITH_15PLUS_FDS>`, `<TAMPERED_CHECKSUM_PAYLOAD>`. Setup notes must describe prerequisite environmental configurations, mock conditions, or core banking sandbox states without embedding PII.
  5. *Dashboard Live Formula & Offline Value Caching:*
     Every formula cell in `Dashboard`, `Automation Dashboard`, and `iOS Dashboard` (`ws.write_formula`) must write both the dynamic Excel formula string and the pre-calculated integer/float value (`value=precalc_val`). This ensures that offline programmatic auditors inspecting workbooks via `openpyxl.load_workbook(..., data_only=True)` read real calculated totals, platform breakdowns, and pass percentages rather than empty cells or zeros.
  6. *Explicit Schema & Project Mode Declaration:*
     Workbooks must clearly declare their operational mode (`Project Mode: GREENFIELD` or `BROWNFIELD`) in three places:
     - Workbook core metadata properties (`subject` and `comments`).
     - Sheet row 2 metadata header on every user story sheet.
     - The `Config` sheet in the `Project Mode` column.
     Schema column counts must strictly adhere to the specification: Greenfield = 27 columns; Update modes = 28 columns (inserting `Test Case Type`).
