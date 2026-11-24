# Independent QA Review & Gap Recovery Engine

Governed by QA Governance & Test Design Standard (Reviewer Rules Section 16 & Rule R83).

## Governing Rule
**Recover a gap only when sufficient evidence exists in the original source documents to create a valid test case.**
If the expected behaviour cannot be established from the available evidence, do not guess. Document the reason in the `Remarks` column and request clarification. A recovered test case must pass the same quality, traceability, semantic and coverage validations as every other test case.

## 7-Step Gap Recovery Workflow

1. **Identify Every Gap:**
   Compare the original User Story / BRD against the generated Test Case Excel workbook to identify all gaps (missing acceptance criteria, unverified business rules, missing positive/negative/boundary dimensions, inaccurate mappings, ADR contradictions, and vague expected results).

2. **Determine Recoverability:**
   For each identified gap, evaluate whether sufficient evidence exists in the source documents (original User Story, acceptance criteria, business rules, and ADR if provided) to formulate a valid test case without guessing.
   - If sufficient facts exist to establish verifiable preconditions, steps, test data, and assertions without guessing: mark as **Recoverable**.
   - If key behaviors, validation rules, or outcomes are missing or conflicting: mark as **Unrecoverable**.

3. **If Recoverable:**
   - Use the original User Story, acceptance criteria, business rules and ADR (if provided) as evidence.
   - Generate the missing or corrected test case without introducing unsupported assumptions.
   - Add the recovered test case to the appropriate Test Case sheet in the output workbook.
   - Populate all mandatory test-case fields (Module, Scenario ID, Scenario, Case ID, Description, Requirement Ref, Priority, Preconditions, Type, Steps, Test Data, Expected Result, Category, Platform, Actual Result, Status, Automation Candidate, Regression Candidate, IOS Testcase, Source Type, Remarks, BA Comments, Developer Status, Developer Comment, Automation Status, Actual Automation Result, Automation Remark, and Test Case Type in update modes).
   - Maintain correct Requirement Reference, Source Type (`SOURCE` or `DERIVED`), Priority, and Test Category.
   - Ensure the new test case does not duplicate existing coverage.
   - Record the recovery action in the `Remarks` column using the mandated format.
   - Recalculate applicable dashboard counts, coverage metrics, and formulas.

4. **If Unrecoverable:**
   - Do not invent expected behaviour, business rules, or test data.
   - Do not generate an assumed test case.
   - Keep the affected test case unchanged (or keep coverage honest without inventing cases).
   - Record the exact reason the gap cannot be recovered in the `Remarks` column.
   - Identify the missing information or clarification required (`RQ-...`).
   - Classify the affected test case as `BLOCKED` where applicable (with `TBD` in expected result).
   - Include the relevant Requirement Reference.

5. **Remark Column Requirements:**
   Every identified gap must have a clear explanation in the `Remarks` column:
   - **Recoverable:** Explain the identified gap, its source evidence, and the recovery performed:
     `[Gap Recovery - RECOVERED] Gap: <gap details>. Source Evidence: <document section/AC>. Action: <recovery action performed>.`
   - **Unrecoverable:** Explain why recovery is not possible and what clarification is required:
     `[Gap Recovery - UNRECOVERABLE] Reason: <reason recovery not possible>. Clarification required: <RQ-... details>.`
   - **ADR Contradiction:** Identify the conflicting ADR decision and explain the contradiction:
     `[Gap Recovery - ADR CONTRADICTION] Conflict: <conflicting ADR decision>. Contradiction: <contradiction explanation>. Clarification required: <RQ-... details>.`
   - **Incorrect Existing Test Case:** Explain the defect and the correction performed:
     `[Gap Recovery - DEFECT CORRECTED] Defect: <defect description>. Correction: <correction performed>.`

6. **Final Validation (Review Controls G01–G14):**
   Re-run all G01–G14 review controls after recovery:
   - **G01 (Requirement Traceability & Integrity):** Every test case carries a valid Requirement Reference (`AC-...`, `BR-...`, `WAC-...`, `RQ-...`); no invented IDs.
   - **G02 (Semantic Alignment Across 8 Attributes):** Objective, behaviour, inputs, steps, preconditions, expected results, test data, and ACs align with source.
   - **G03 (8 Coverage Dimensions & Multi-Dimensional Depth):** Positive, Negative, Boundary, State/Transition, Role/Permission, Error Handling, Platform Variant, and Integration dimensions evaluated.
   - **G04 (Verifiable Expected Result Quality, Descriptive & Simple Language Standard):** Specific, measurable, verifiable expected results; vague statements ("System should work correctly", "User should get proper response", "Application should behave as expected") strictly rejected. Zero cryptic shorthand codes in narrative columns (Test Scenarios, Test Description, Pre-condition, Test Steps, Expected Result, Remarks): screen codes (S1, S2) must be replaced with proper screen names (e.g. 'Login Basic screen'), error codes (E01, E02) with exact error messages, generic step references ('step 1', 'step 2') with concrete actions (e.g. 'Click on continue button'), and generic page references with their referenced titles. All prose columns must be written in simple, clear language understandable by any person.
   - **G05 (Mandatory Attributes & Schema Compliance):** All mandatory columns populated; `Negative` is a Type, not a Category; `Source Type` in dedicated column; `Requirement Reference` holds canonical IDs while narrative prose remains self-contained and descriptive.
   - **G06 (Test Data Realism & Format Compliance):** Concrete, realistic sample data adhering to specification rules (e.g. `PAN ID: AYNMH8765J`, `Adhi@23435g`) or completely empty (`""`) when no test data is applicable. No placeholders (`N/A`) or ID references (`TD1`, `TD2`).
   - **G07 (Platform Applicability & Integrity):** Platform values conform strictly to Automation Types specification (`Mobile App`, `Web`, `Mobile Web`, or valid combinations). Zero unapplicable platforms shown.
   - **G08 (Automation Candidate Decision Governance):** Governed by Rules 1–8. `No` candidates must have substantive explanation in `Remarks` only formatted with bold title `**No automation reason:** <reason>`. `Automation Remark` remains blank.
   - **G09 (Duplicate & Redundancy Prevention):** Zero semantic duplicates across 5 core attributes (objective, behaviour, inputs, steps, expected results).
   - **G10 (Lifecycle Classification & Historical Preservation):** Valid assignment of `existing`, `modified`, `new`, `invalidated`. Modification reasons documented in `Remarks`. Zero deleted historical cases.
   - **G11 (Partial & Missing Coverage Resolution):** No requirement marked covered if any applicable AC remains uncovered. All recoverable gaps resolved.
   - **G12 (ADR & Contradiction Governance):** Contradictions between ADR and test cases/requirements explicitly documented in `Remarks`. No conflicting assumptions introduced.
   - **G13 (Dashboard, Formula & Reconciliation Integrity):** All dashboard formulas live (`COUNTIF`/`COUNTIFS`), platform count columns dynamically rendered, total cases match module sums, zero formula errors (`#REF!`, `#DIV/0!`).
   - **G14 (Single Final Workbook Delivery & Integrity per Document):** Only the final Excel workbook is delivered per input document; no duplicate or uncorrected workbooks delivered for the same document; review report generated. When multiple input user story docs are provided, each input doc generates its own separate final Excel workbook, matching the input document count 1:1.
   - Verify that recovered test cases satisfy the original requirement.
   - Check for duplicate test cases.
   - Revalidate requirement traceability and coverage.
   - Verify dashboard formulas and workbook integrity.
   - Report recovered gaps and unrecoverable gaps separately.

7. **Output Requirements:**
   - **Single Final Workbook Output Per Document:** The skill must deliver strictly ONE final Excel workbook per input document (e.g. `Automation/testcase/Testcases/<Name>_TestCases_v1_0.xlsx`). Two different Excel files must NOT be output for the same document.
   - **Multi-Document Input & 1:1 Workbook Generation:** When multiple input user story docs are provided in the user story user input section, the number of output Excel workbooks generated must be exactly the same as the number of input docs. Every input doc must generate its own separate test case Excel workbook.
   - **Consolidate Gaps Into Final Output:** When gap recovery is performed, missing/corrected test cases and unrecoverable gap notes are incorporated directly into the single final deliverable workbook for that document.
   - **Do Not Silently Modify:** Never silently alter or omit existing valid test cases.
   - **Review Report Table:** Output a review report containing:
     `| Gap ID | Requirement ID | Test Case ID | Gap Description | Recovery Status | Recovery Action | Remarks |`
   - Run via script (in-place update ensuring only the final workbook is delivered per document):
     ```bash
     python <SkillDirectory>/scripts/gap_recovery.py --data /tmp/cases_<doc_i>.json --workbook <WorkspaceRoot>/Automation/testcase/Testcases/<Name_i>_TestCases_v1_0.xlsx --out <WorkspaceRoot>/Automation/testcase/Testcases/<Name_i>_TestCases_v1_0.xlsx [--gaps /tmp/gaps.json]
     ```

