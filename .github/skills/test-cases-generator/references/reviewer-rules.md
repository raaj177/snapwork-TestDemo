# Requirement-to-Test Case Comparison & Traceability Rules (QA Governance Standard)

**Document Type:** QA Governance & Test Design Standard  
**Purpose:** Define standardized rules for comparing BRD/User Stories/Requirements against existing and newly generated test cases to prevent coverage gaps, eliminate duplicate coverage, and ensure complete requirement traceability.  
**Governing Principle:** Requirement ID matching alone does not establish requirement coverage. A test case is considered a valid match only when its business intent, functional behaviour, applicable acceptance criteria, execution conditions and expected result align with the requirement. Semantic requirement comparison is mandatory before final test case classification and workbook generation.

## 1. Objective & Scope
Establish a consistent methodology for comparing requirements with test cases to ensure:
1. Complete requirement coverage.
2. Accurate requirement traceability.
3. Identification of missing test scenarios.
4. Identification of modified and obsolete test cases.
5. Prevention of duplicate test coverage.
6. Validation of functional behaviour against acceptance criteria.
7. Consistent classification of test cases.

These rules apply strictly to **Greenfield** and **Brownfield** test case generation.

## 2. Requirement Analysis Rules
- **Rule 1: Requirement Decomposition**  
  Before generating or comparing test cases, break down the requirement into 9 independently verifiable items:
  1. Business requirements
  2. Functional requirements
  3. Acceptance criteria
  4. Business rules
  5. Input validations
  6. User workflows
  7. Preconditions and dependencies
  8. Expected system behaviour
  9. Boundary conditions  
  *Each requirement or acceptance criterion should be independently traceable.*

- **Rule 2: Requirement Identification**  
  - Use the original requirement ID wherever available.
  - Do not invent requirement IDs.
  - Map every applicable test case to its corresponding requirement.
  - Maintain traceability when one requirement requires multiple test cases.
  - Allow one test case to cover multiple requirements ONLY when it genuinely verifies all mapped requirements.

- **Rule 3: Requirement Interpretation**  
  Compare the actual business intent rather than relying only on matching keywords. Consider:
  - Business objective
  - Functional behaviour
  - Input conditions
  - Expected outputs
  - Business constraints
  - Preconditions
  - Dependencies
  - Exception handling  
  *Do not introduce unsupported functionality or assumptions.*

## 3. Requirement-to-Test Case Comparison Rules
- **Rule 4: Functional Coverage**  
  Every requirement must be evaluated for applicable:
  - Positive scenarios
  - Negative scenarios
  - Edge cases
  - Field validations
  - Business rule validations
  - UI behaviour
  - Compatibility
  - Usability
  - Dependency scenarios  
  *A requirement is not fully covered simply because one test case references its ID.*

- **Rule 5: Semantic Comparison**  
  Compare existing test cases with requirements using the following 8 attributes:
  1. Requirement ID
  2. Acceptance criteria
  3. Business objective
  4. Functional behaviour
  5. Preconditions
  6. Test steps
  7. Test data
  8. Expected results  
  *Different wording does not automatically mean different functionality. Similarly, identical wording does not guarantee equivalent coverage.*

- **Rule 6: Existing Test Case Classification**  
  Every existing test case in an update exercise must be evaluated and classified:
  | Classification | Definition |
  |---|---|
  | `existing` | Requirement and expected behaviour remain unchanged. |
  | `modified` | Existing functionality or requirement behaviour has changed, requiring test case updates. |
  | `new` | A requirement or acceptance criterion introduces coverage not present in the existing test bank. |
  | `invalidated` | Existing functionality or requirement has been removed or superseded, making the test case no longer applicable. |

  **Additional Mandatory Controls:**
  - Do not modify test cases unnecessarily.
  - Preserve unchanged test cases.
  - Do not classify a test case as Modified only because its wording has changed.
  - Record the reason for every modification in Remarks.
  - Invalidated test cases must have a documented reason in Remarks.
  - Do not delete historical test cases during update operations.

- **Rule 7: Missing Requirement Coverage**  
  When a requirement or acceptance criterion has no matching test case:
  - Identify the coverage gap.
  - Create a new test scenario.
  - Generate appropriate test cases.
  - Map the new test cases to the correct requirement.
  - Include applicable positive, negative and edge cases.

- **Rule 8: Partial Requirement Coverage**  
  If an existing test case covers only some acceptance criteria:
  - Identify the uncovered acceptance criteria.
  - Determine whether the existing test case requires modification.
  - Create additional test cases where necessary.
  - **Do not mark the requirement fully covered until all applicable acceptance criteria have coverage.**

- **Rule 9: Duplicate Test Case Detection**  
  Check for duplicates based on:
  - Same business objective
  - Same functional behaviour
  - Same input conditions
  - Same execution steps
  - Same expected results  
  *Consider semantic equivalence, not just identical descriptions. Do not create redundant test cases to increase coverage numbers.*

- **Rule 10: Ambiguous Requirements**  
  When requirements are unclear:
  - Identify the missing information.
  - Avoid inventing expected behaviour.
  - Document the ambiguity.
  - Classify the impacted test case as `BLOCKED` where appropriate.
  - Use `TBD` in Expected Result and the required `RQ-...` reference in Remarks.
  - Request clarification before finalizing the expected behaviour.

## 4. Source Type Classification
Every test case must have a Source Type in its dedicated column:
| Source Type | Description |
|---|---|
| `SOURCE` | Directly supported by the requirement. |
| `DERIVED` | Logically derived from the requirement. |
| `ADVISORY` | Additional recommendation not explicitly required. |
| `BLOCKED` | Cannot be finalized because clarification or information is missing. |

**Source Type Rules:**
- Maintain Source Type in its dedicated column.
- Never embed Source Type in Remarks.
- SOURCE, DERIVED, and BLOCKED require Requirement Reference.
- ADVISORY coverage must not be presented as mandatory requirement coverage.

## 5. Test Case Quality Rules
Every test case must contain all 13 core attributes:
1. Module
2. Test Scenario ID
3. Test Scenario
4. Test Case ID
5. Test Description
6. Requirement Reference
7. Priority
8. Preconditions
9. Type
10. Test Steps
11. Test Data
12. Expected Result
13. Test Category

- Expected results must be specific, measurable and verifiable.
- Avoid vague statements such as:
  - `System should work correctly.`
  - `User should get proper response.`
  - `Application should behave as expected.`
- Negative is a Type, not a Test Category.
- **Descriptive Specification, Short Code Replacement & Simple Plain Language Standard:**
  In the 6 narrative/prose columns (`Test Scenario`, `Test Description`, `Preconditions`, `Test Steps`, `Expected Result`, `Remarks`), cryptic shorthand codes and bare generic references MUST NOT be used in the generated Excel test cases. All data must be written in simple, clear language understandable by any person:
  - **Short Code Replacement:** When short codes appear in the user story (screen codes `S1`, `S2`; error codes `E01`, `E02`, `ERR-01`; button/action codes `B1`, `B2`; page codes `P1`, `P2`; popup codes `POP-01`), check what the code represents and replace it with its proper description (e.g. if `S1` is "Login Basic screen", display strictly "Login Basic screen" instead of `S1`; for `E01`, display strictly the exact error message text from the error catalogue instead of `E01`). The short codes must NOT appear in the generated Excel columns.
  - **Generic Step Resolution (`step 1`, `step 2`):** Determine what the step actually is from the story and state its concrete action or description (e.g. if step 1 is "click on continue button", state "Click on continue button" instead of writing generic "step 1").
  - **Generic Page / Screen Resolution (`Page 1`, `Page 2`):** Check if the document has a proper referenced name/title (e.g. "Applicant Details" for Page 1); if found, use that descriptive name. If not found, only then use "Page 1".
  - **Simple Plain Language:** Write test steps, preconditions, expected results, descriptions, and scenarios in direct, straightforward phrasing easily understood by any stakeholder, avoiding technical jargon and cryptic codes.
  - **AC/Rule Codes:** Describe the actual observable behavior, validation, or business condition in plain descriptive prose; do not write "conforms to AC-01" or "as per BR-01". The `Requirement Reference` column retains canonical IDs for traceability.
  - **Preconditions & Steps:** Clearly state the actual screen name and user state in plain language (e.g. `User has launched the app and is on the Login Basic screen`), never bare `User is on S1`.
  - **Remarks:** Provide substantive contextual notes (e.g. gap recovery action or concrete automation feasibility explanation), never a bare code or reference string alone.

## 6. Requirement Coverage Matrix (Intermediate Validation Artifact)
Before final workbook generation, prepare an internal Requirement Coverage Matrix.
Recommended structure:
| Requirement ID | Acceptance Criteria | Existing Test Case | Comparison Result | Gap / Action |
|---|---|---|---|---|
| RQ-001 | Valid login | TC-001 | Existing | No action |
| RQ-001 | Invalid password | TC-002 | Existing | No action |
| RQ-002 | Account lock after 3 failures | TC-003 | Modified | Update expected behaviour |
| RQ-003 | Forgot password | None | New | Create test cases |
| RQ-004 | Old OTP workflow removed | TC-004 | Invalidated | Document removal reason |

*The matrix is an intermediate validation artifact. It does not replace the governed workbook structure.*

## 7. Mandatory Comparison Workflow
Follow this exact 15-step sequence before generating the final workbook:
1. Read and understand the requirement file.
2. Extract all requirements and acceptance criteria.
3. Identify business rules and functional dependencies.
4. Review the existing test bank, when applicable.
5. Map existing test cases to requirements.
6. Compare functional behaviour and acceptance criteria.
7. Identify unchanged test cases.
8. Identify modified test cases.
9. Identify missing coverage and create new test cases.
10. Identify invalidated test cases.
11. Detect likely duplicates.
12. Validate positive, negative and edge-case coverage.
13. Validate expected results.
14. Validate requirement traceability.
15. Perform final coverage reconciliation.

## 8. Requirement Coverage Validation
Before workbook generation, verify:
1. Every in-scope requirement has been analyzed.
2. Every applicable acceptance criterion has test coverage.
3. Every SOURCE test case has valid requirement traceability.
4. Every DERIVED test case has a justified requirement reference.
5. Every BLOCKED test case has the required clarification reference.
6. No unsupported functionality has been introduced.
7. No important positive scenario is missing.
8. No important negative scenario is missing.
9. Applicable edge cases have been considered.
10. No unintended duplicate test cases exist.
11. All existing test cases have the correct update classification.  
*Hard Rule: A requirement must not be marked fully covered if any applicable acceptance criterion remains uncovered.*

## 9. Greenfield and Brownfield Application
- **Greenfield:**
  - Generate full approved-scope test coverage from scratch.
  - Do not assume an existing test bank.
  - Cover all applicable requirements and acceptance criteria.
  - Maintain requirement traceability.
- **Brownfield:**
  - Preserve the designated test bank AS IS.
  - Compare only the user story provided in the updated BRD.
  - Retain all unrelated modules and sheets.
  - Classify the impacted story's test cases as Existing, Modified, New or Invalidated.
  - Do not unnecessarily change unrelated test cases.
  - Generate a separate output workbook.

## 10. Final Acceptance Checklist
Before building the final Excel workbook, confirm:
1. All requirements have been extracted.
2. All acceptance criteria have been analyzed.
3. Requirement-to-test case mapping is complete.
4. Semantic comparison has been performed.
5. Existing test cases have been classified.
6. Modified test cases have documented changes.
7. New test cases cover missing functionality.
8. Invalidated test cases have documented reasons.
9. Duplicate coverage has been reviewed.
10. Positive, negative and edge scenarios have been reviewed.
11. Expected results are specific and verifiable.
12. Source Type is correctly classified.
13. Requirement references are valid.
14. No unsupported assumptions have been introduced.
15. All preflight governance validations pass.

## 11. Governing Principle
Requirement ID matching alone does not establish requirement coverage. A test case is considered a valid match only when its business intent, functional behaviour, applicable acceptance criteria, execution conditions and expected result align with the requirement. Semantic requirement comparison is mandatory before final test case classification and workbook generation.

## 12. 8 Coverage Dimensions & Multi-Dimensional Depth (Gate 4a)
Every in-scope requirement must be evaluated across the 8 standard Coverage Dimensions:
1. **Positive / Happy Path:** Valid inputs, default flows, successful execution, expected user journeys.
2. **Negative / Invalid Input:** Missing fields, invalid formats, prohibited characters, unauthorized submissions, validation errors.
3. **Boundary / Limit:** Minimum/maximum lengths, edge dates, threshold amounts, numeric boundaries, buffer constraints.
4. **State / Transition:** Lifecycle transitions, session states, status updates, prerequisite sequences, back-navigation states.
5. **Role / Permission:** Authorization levels, authenticated vs unauthenticated access, role restrictions, session expiry.
6. **Error / Exception Handling:** Network failures, timeout handling, service errors, recovery flows, retry mechanisms.
7. **Platform Variant:** Mobile app variants (Android vs iOS gestures, hardware back, biometrics, permission dialogs, WebView).
8. **Integration / Data Dependency:** Backend sync, database state consistency, third-party handoffs, downstream event triggers.

**Coverage Classification Rules:**
- **Covered:** All applicable expected dimensions for the requirement have at least one valid, verifiable test case.
- **Partially Covered:** At least one dimension is covered, but one or more applicable expected dimensions have no test cases. *A requirement must NEVER be classified as Covered if any expected dimension is missing.*
- **Not Covered:** Zero test cases exist for the requirement.
- **Blocked / Needs Clarification:** Test design is blocked by an unresolved ambiguity, conflict, or open `RQ-...` item.

## 13. Requirement Traceability & Coverage Heatmap Verification (Internal Governance)
Traceability and coverage depth are evaluated internally during test design and preflight verification. **RTM and Heatmap tabs must NOT be present in the generated Excel workbook**, ensuring that the deliverable spreadsheet strictly contains governed execution sheets.

### RTM Audit Structure (23 Columns Verified Internally)
The internal RTM audit evaluates bidirectional requirement traceability linking requirements, stories, and test cases across 23 standard audit columns:
1. `Requirement ID`: Stable source ID (`AC-01`, `BR-01`) or derived working ID (`WAC-...`).
2. `Requirement ID Type`: `SOURCE ID`, `WORKING ID`, or `DERIVED ID`.
3. `User Story ID`: Parent story ID (`US-001`).
4. `User Story / Module`: Sheet name and functional area.
5. `Requirement / Acceptance Criterion`: Exact requirement or AC description text.
6. `Requirement Kind`: `Functional`, `Business Rule`, `Field Validation`, `NFR`, `Integration`, `Security`.
7. `Risk Level`: `High`, `Medium`, or `Low` (Section 7.3).
8. `Source Document`: Source file name (`BRD`, `User Story DOCX`, `ADR`).
9. `Source Location`: Exact source section, paragraph, or table reference.
10. `Mapped Test Case IDs`: Comma-separated list of test case IDs (`TC-001, TC-002`).
11. `Mapped Scenario IDs`: Comma-separated list of scenario IDs.
12. `Valid Case Count`: Total number of valid mapped test cases.
13. `Expected Dimensions`: Applicable expected dimensions among the 8 dimensions.
14. `Dimensions Covered`: Dimensions with verified test cases.
15. `Missing Dimensions`: Expected dimensions lacking test coverage.
16. `Mapping Quality`: Assessment of mapping fidelity and semantic completeness.
17. `Coverage Status`: `Covered`, `Partially Covered`, `Not Covered`, `Blocked / Needs Clarification`.
18. `Platform Coverage`: Platform-specific execution coverage details.
19. `Automation Coverage`: Automatable coverage status.
20. `Gap / Risk`: Identified coverage deficiencies, missing conditions, or risks.
21. `Suggested Test Outline`: Actionable outline for missing coverage or remediation.
22. `Reviewer Recommendation`: Specific recommendation to achieve full coverage.
23. `Human Review Status`: Review sign-off status (`Pending Review`, `Approved`, `Flagged`).

### Coverage Heatmap Internal Analysis
The preflight coverage depth analysis evaluates:
- **User Story × Coverage Dimension Depth:** Distribution of the 8 Coverage Dimensions across user stories with covered vs expected counts per dimension and status totals.
- **Requirement Risk × Coverage Distribution:** Breakdown of requirements across Risk Tiers (`High`, `Medium`, `Low`) by coverage status (`Covered`, `Partially Covered`, `Not Covered`, `Blocked`).

## 14. Risk-Weighted Coverage Model & Metrics (Section 7.3)
Test suites must measure coverage depth using risk weights to prevent low-risk tests from masking high-risk coverage gaps:
- **Risk Tiers & Weights:**
  - `High Risk`: Weight = 3 (Core financial calculations, authentication, data persistence, payment processing, regulatory compliance).
  - `Medium Risk`: Weight = 2 (Standard CRUD workflows, navigation, validation error messaging, secondary features).
  - `Low Risk`: Weight = 1 (Static text, cosmetic styling, informational notices, optional help links).
- **Formulas:**
  - `Dimension Coverage % = (Total Covered Dimensions across requirements / Total Expected Dimensions) * 100`
  - `Risk-Weighted Coverage % = Sum(Coverage Score * Risk Weight) / Sum(Risk Weight) * 100`  
    where Coverage Score = `1.0` for Covered, `0.5` for Partially Covered, `0.0` for Not Covered or Blocked.
- **High-Risk Gap Rule:** Any High-Risk requirement that is `Not Covered`, `Partially Covered`, or `Blocked` must be explicitly surfaced as a High-Risk Unresolved Gap and caps the suite readiness verdict to `REVIEW REQUIRED` or `REWORK REQUIRED`.

## 15. Story-Wise Test Data Requirements Schema (Gate 7)
The `Test Data Requirements` sheet must follow a 9-column traceability schema:
1. `Test Data ID`: Sequential identifier (`TD-001`, `TD-002`).
2. `User Story ID`: Owning user story (`US-001`).
3. `User Story / Module`: Story name or functional module.
4. `Test Data Description`: Concrete, actionable data prerequisite or account state description.
5. `Required For`: Target scenario ID or test case reference.
6. `Requirement Reference`: Authoritative AC or rule ID.
7. `Data Setup / Preparation Notes`: Specific setup procedure, initial state, or backend condition.
8. `Environment / Platform`: Applicable environment (`QA`, `Staging`, `UAT`, `Android/iOS`).
9. `Status`: Prerequisite readiness status (`Not Prepared`, `Requested`, `In Progress`, `Available`, `Blocked`).

*Security & Data Quality Rule:* Real customer passwords, live PII, production tokens, and live account numbers are strictly prohibited. Provide synthetic, realistic data attributes conforming to validation rules.

## 16. Auditor & Reviewer Governance Standards (Aligning with External Quality Audits)
To ensure that generated test case suites achieve maximum quality scores and zero findings when evaluated by external quality auditors (such as `SKILL 1.md` 13-gate audit):
1. **Zero-Invention Governance on Open Clarifications:**
   - When a requirement or edge case has unconfirmed outcomes (e.g. contradictory metadata precedence, UI presentation on checksum failure, or background session drops), NEVER invent frontend precedence or error dialogs.
   - Set `Source Type = BLOCKED` and `Status = Blocked`.
   - Set `Expected Result` to safe handling with specific UI behavior marked as `TBD pending clarification RQ-xx`.
   - Set `Remarks` to include the specific `RQ-xx` question and the mandatory bold header `**No automation reason:**`.
2. **Elimination of Unconfirmed Secondary Expectations:**
   - Do not append unverified UI assertions (such as "scroll position is preserved") unless explicitly mandated by the acceptance criteria. Focus expected results strictly on observable, specified behaviors.
3. **Atomic Clause-Level Traceability (WAC Decomposition Alignment):**
   - Acceptance criteria with compound clauses must be reflected across dedicated test cases or explicit steps/assertions so that atomic clause decomposition tools find 100% requirement coverage.
4. **Dashboard Cached Formula Values for Offline Verification:**
   - Every formula cell written by dashboard generators must supply `value=precomputed_value` so offline programmatic auditing scripts (`openpyxl` with `data_only=True`) read exact totals and percentages rather than zero.
5. **Schema Column Reconciliation:**
   - Greenfield workbooks must strictly output 27 columns (omitting `Test Case Type`).
   - Story update / Brownfield workbooks must output 28 columns (including `Test Case Type`).


