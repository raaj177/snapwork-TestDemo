---
name: test-cases-generator
description: >-
  Generate and validate QA test cases against a BRD (Business Requirements Document), user story, or acceptance criteria, using a governed test-design process instead of free-form prompting. The skill enforces traceability, prevents invented requirements, and produces a quality score.
---

# QA Test Design & Validation (test-cases-generator)

# Purpose
Turns a BRD / user story / AC into **traceable, non-duplicated, risk-prioritized test cases** adhering strictly to the **Requirement-to-Test Case Comparison & Traceability Standard (QA Governance & Test Design Standard)** with Greenfield/Brownfield awareness and selective iOS execution coverage, or audits cases someone already wrote. Governing rule: **AI proposes, evidence decides, human approves.** Governing principle: **Requirement ID matching alone does not establish requirement coverage; semantic requirement comparison across business intent, functional behaviour, acceptance criteria, execution conditions, and verifiable expected results is mandatory.** Every case traces to the source — never to what "usually" happens.

# Trigger Conditions
Use this skill when:
- A QA engineer, QA lead, or tester asks to "generate test cases"
- User asks to "create test scenarios from the user story"
- User asks to "review/validate existing test cases"
- User asks to "check AC coverage"
- User asks to "find duplicate or weak test cases"
- User asks to "do a regression impact analysis"
- User asks to "review API/security/compliance test coverage"
- User asks to "review/recover gaps against story/workbook"
- User pastes a user story and asks for tests
- User pastes an existing test suite and asks if it's good enough

# Inputs
Before executing, confirm all seven COPILOT elements are present: **C** Context, **O** Objective, **P** Persona, **I** Input, **L** Logic Boundaries, **O** Output Format, **T** Traceability Hook.

**INPUT COLLECTION MUST BE STRICTLY SEQUENTIAL:**
Prompt the user for inputs one by one in the following exact order. Do NOT ask all questions at once. Do NOT infer Project Mode. Do NOT proceed until the current required input is provided.

**STEP 1:** Ask for **Test Case Generation Mode** (Project Mode, Required):
- **GREENFIELD** (Mode A) — New app; create test cases from scratch.
- **BROWNFIELD** (Mode B) — Existing app; update existing test cases.
- **GREENFIELD With Updated User Story** (Mode C) — New app with existing test cases; update them based on the changed user story.
- **Brownfield — Existing App, From Scratch** (Mode D) — Existing app; generate test cases from scratch based on the updated user story.
- **Delete User story - Delete absolute or not required user story from test bank (Mode E)** — Existing app; delete absolute or not required user story from test bank (e.g., US-001 Login Authentication).

Supported values are ONLY these five. `AUTO` does not exist. Do not attempt auto-detection.

**IF MODE E IS SELECTED (Delete User story):**
- **STEP 2 (in Mode E):** Ask for **Test Bank** (Required) — Path to the existing `.xlsx` test bank workbook. Pause and wait for this input.
- **STEP 3 (in Mode E):** Ask for **User Story to delete from the test bank** (Required, Mandatory) — Target user story identifier or sheet name to delete (e.g. `US-001 Login Authentication`). Pause for this input. Multiple user story tabs can be deleted by comma-separated entries like `US001-login, US002-signup`.
*(Skip Steps 4 through 7 below — no BRD requirement extraction or test generation is needed).*
Post replication of the test bank in the output copy, entered user story tab(s) are removed, remaining sheets and test cases are preserved intact, and totals on Dashboard, Automation Dashboard, and iOS Dashboard are dynamically recalculated for the remaining sheets.

**FOR GENERATION MODES (Modes A, B, C, D):**
- **STEP 2:** First resolve the user story source with `../qa-automation-orchestrator/references/user-story-source.md` (skip it when the orchestrator already did it in Phase 0 of this run): use the local files in `.github/_requirements/user_stories/` when they are present and `user_stories/jira-source.md` is empty; download from Jira into that folder when it has no story file and `jira-source.md` is filled in; when both are empty, ask for the Jira details, create `jira-source.md` and download; when both are present, ask the user which source to use. Never write a test case before this is settled, and never offer `jira-source.md`, `README.md` or `.gitkeep` as a story. Then ask for **User Story** (Required). Supports single or multiple input documents (file paths, markdown, docx, pdf, or comma-separated doc paths). **Multiple Input User Story Docs Mandate:** When multiple input user story docs are provided in the user story user input section, the number of output Excel workbooks generated must be exactly the same as per the input docs. Every input doc must generate a separate test case Excel workbook (1:1 Document-to-Workbook mapping).
- **STEP 3:** Ask for **Scope** (Required: `full document`, `US-004`, or `US-004, US-013`).
- **STEP 4:** IF Mode B, C, or D, ask for **Test Bank** (Required). If Mode A, skip.
- **STEP 5:** IF Mode B, C, or D, ask for **Constitution** (Optional). If Mode A, skip.
- **STEP 6:** IF Mode B, C, or D, ask for **ADR** (Required). If Mode A, skip.
- **STEP 7:** IF Mode B, C, or D, ask for **Context / History** (Optional). If Mode A, skip.
- **STEP 8: Ask for Platform (Required):**
  Do NOT perform platform autodetection. Directly give the platform detection prompt with the 7 options configured in skill no recommendation to be provided:
  "Select the project platform for which test-cases needs to be created:
  1. Mobile App
  2. Web
  3. Mobile Web
  4. Mobile App + Web
  5. Mobile App + Mobile Web
  6. Web + Mobile Web
  7. Mobile App + Web + Mobile Web"
  You MUST block execution and wait for the user to respond.

  **IF 'Mobile App' (Option 1) is selected:**
  Immediately present another prompt asking:
  "Select the required platform:
  1. Both Android and iOS (Recommended)
  2. Android
  3. iOS"
  You MUST block execution and wait until the user responds.

  **Platform Behavior Rules:**
  - **If user selects Option 1 (Both Android and iOS):**
    Proceed with logic as is currently working for mobile app. The `IOS Testcase` column is present in every user story tab sheet with selective Yes/No execution flags, and the `iOS Dashboard` tab IS created in the Excel workbook. In test steps with divergent platform behaviors (e.g. Back navigation, biometrics, gestures), combine both behaviors into the shared test case using format `"Android: [action/behavior]. iOS: [action/behavior]."` (e.g. `2. Trigger Back navigation:\n   - Android: Tap the in-app back arrow or press the device hardware back button.\n   - iOS: Tap the back arrow or perform a swipe-from-left-edge gesture.`).
  - **If user selects Option 2 (Android):**
    Remove the column `IOS Testcase` from every user story tab in the generated Excel workbook. The `iOS Dashboard` tab should NOT be created in the Excel workbook. In test steps, descriptions, and expected results, ONLY Android-specific behavior must be used (e.g. `2. Trigger Back navigation: Tap the in-app back arrow or press the device hardware back button.`). iOS-specific behaviors (such as swipe-from-left-edge gesture or iOS back arrow) must NOT be included.
  - **If user selects Option 3 (iOS):**
    The `IOS Testcase` column is present in every user story tab sheet, and EVERY entry in the `IOS Testcase` column MUST be `Yes` in every test case (`ios_testcase = "Yes"` across 100% of cases). The `iOS Dashboard` tab IS created in the Excel workbook. In test steps, descriptions, and expected results, ONLY iOS-specific behavior must be used (e.g. `2. Trigger Back navigation: Tap the back arrow or perform a swipe-from-left-edge gesture.`). Android-specific behaviors (such as hardware back button or Android back arrow) must NOT be included.
  - **For platforms Web, Mobile Web, Web + Mobile Web:**
    The `IOS Testcase` column should NOT be present in the user story tab sheet, and the `iOS Dashboard` tab should NOT be created in the Excel workbook.
  - **For multi-platform combinations with Mobile App (Mobile App + Web, Mobile App + Mobile Web, Mobile App + Web + Mobile Web):**
    The `IOS Testcase` column is present in user story tab sheets (selective Yes/No for mobile cases) and the `iOS Dashboard` tab IS created in the Excel workbook.

## Platform Selection & Test Case Platform Allocation Engine

Directly present project-level platform selection prompts to the user and independently allocate platform values to every testcase using a **test-case-level platform applicability engine**.

**Do not attempt platform autodetection. Do not blindly assign every project platform to every test case. Never assign `Mobile App, Web, Mobile Web` as a default value.**

### 1. Platform Classification & Definitions (Automation Types)
The system supports exactly these seven project-level classifications:
1. **Mobile App**
2. **Web**
3. **Mobile Web**
4. **Mobile App + Web**
5. **Mobile App + Mobile Web**
6. **Web + Mobile Web**
7. **Mobile App + Web + Mobile Web**

| Term | What is tested | Runs on |
|---|---|---|
| **Mobile / Mobile App** | Native apps installed from an `.apk` / `.ipa` | Real Android and iOS devices, emulators and simulators |
| **Web** | The website in a desktop browser | Chromium (Chrome, Edge), Firefox, WebKit (Safari engine) |
| **Mobile Web** | The web app as a phone user opens it: in the mobile browser, or installed to the home screen | Chrome on Android, Safari on iOS (real devices) |

- **Mobile App:** Tests **native apps installed from an `.apk` / `.ipa`**, running on **real Android and iOS devices, emulators and simulators**. Covers native device capabilities and mobile OS integrations: biometric authentication (Face ID, Touch ID, Android BiometricPrompt), camera, microphone, photo gallery picker, GPS/location, device permission dialogs, hardware back button, native edge-swipe gestures, OS application lifecycle backgrounding/resuming, and local persistent storage (SQLite/Room/CoreData/Keychain).
- **Web:** Tests **the website in a desktop browser**, running on **Chromium (Chrome, Edge), Firefox, WebKit (Safari engine)**. Covers desktop browser viewport (e.g. 1920x1080), browser DOM, standard browser URL navigation, browser tabs, forward/back buttons, browser refresh, HTTP cookies, web storage (`localStorage`, `sessionStorage`), desktop drag-and-drop, and keyboard navigation. Lacks direct OS-level hardware access.
- **Mobile Web (PWA):** Tests **the web app as a phone user opens it: in the mobile browser, or installed to the home screen**, running on **Chrome on Android, Safari on iOS (real devices)**. Explicitly implements: a Web App Manifest (`manifest.json` defining `display: standalone`, app name, icons), a registered Service Worker for request interception and offline caching (Cache API, IndexedDB), installability prompting ("Add to Home Screen" / A2HS), background synchronization, and Web Push Notifications.

**Important Axioms:**
- Mobile Web is an enhanced implementation of Web, not an independent replacement for Web. Every Mobile Web MUST have an underlying web implementation.
- Responsive design does NOT mean Mobile Web.
- Mobile browser support alone without manifest/service worker does NOT mean full Mobile Web.

### 2. Project-Level Platform Selection Workflow (Direct Prompts)
Platform autodetection is completely disabled. The agent directly prompts the user to select the platform and blocks until the user responds:

#### Step 1: Initial Platform Detection Prompt
Directly present the platform prompt with the 7 configured options:
```text
Select the project platform:
1. Mobile App
2. Web
3. Mobile Web
4. Mobile App + Web
5. Mobile App + Mobile Web
6. Web + Mobile Web
7. Mobile App + Web + Mobile Web
```
**Execution MUST block and wait for the user to respond before continuing.**

#### Step 2: Mobile App Sub-Selection Prompt
If the platform selected in Step 1 is **Mobile App** (Option 1), immediately give another prompt asking:
```text
Select the required platform:
1. Both Android and iOS (Recommended)
2. Android
3. iOS
```
**Execution MUST block and wait until the user responds.**

#### Platform-Specific Workbook & Column Rules:
| Platform Selected | Sub-Selection (if Mobile App) | `IOS Testcase` Column in User Story Tabs | `IOS Testcase` Values | `iOS Dashboard` Tab in Excel | User Story Tab Columns (Greenfield / Update) |
|---|---|---|---|---|---|
| **Mobile App** | **Both Android and iOS** | **Present** | Selective Yes / No | **Created** | 27 cols / 28 cols |
| **Mobile App** | **Android** | **Removed** (Not present) | N/A (Column omitted) | **Not Created** | 26 cols / 27 cols |
| **Mobile App** | **iOS** | **Present** | **Every entry must be Yes** (100% Yes) | **Created** | 27 cols / 28 cols |
| **Web** | N/A | **Removed** (Not present) | N/A (Column omitted) | **Not Created** | 26 cols / 27 cols |
| **Mobile Web** | N/A | **Removed** (Not present) | N/A (Column omitted) | **Not Created** | 26 cols / 27 cols |
| **Web + Mobile Web** | N/A | **Removed** (Not present) | N/A (Column omitted) | **Not Created** | 26 cols / 27 cols |
| **Mobile App + Web** | N/A | **Present** | Selective Yes / No | **Created** | 27 cols / 28 cols |
| **Mobile App + Mobile Web** | N/A | **Present** | Selective Yes / No | **Created** | 27 cols / 28 cols |
| **Mobile App + Web + Mobile Web** | N/A | **Present** | Selective Yes / No | **Created** | 27 cols / 28 cols |

### 3. Test Case-Level Platform Applicability Engine
After detecting project-level platforms, independently analyze EVERY generated test case across its Title, Scenario, Preconditions, Steps, Expected Results, Feature functionality, and device/browser capabilities.

Determine platform allocation based on 5 classification categories:
- **A. Shared Business Logic:** Core rules, API validation, calculations. Assign to every confirmed project platform implementing the feature.
- **B. Mobile-Specific Test Cases:** Native biometrics (Face ID/Touch ID/BiometricPrompt), camera, native file picker, hardware back, push notification tray, backgrounding by OS. Assign only to `Mobile App`.
- **C. Web-Specific Test Cases:** Desktop browser navigation, 1920x1080 layout, cookies, tabs, desktop drag-and-drop. Assign only to `Web`.
- **D. Mobile Web-Specific Test Cases:** A2HS prompt, standalone display, Service Worker offline caching, background sync. Assign only to `Mobile Web`.
- **E. Platform-Neutral Business Scenarios:** Assign strictly to the intersection of confirmed project platforms and required scenario capabilities.

### 4. Platform Combination Truth Table
| Mobile App| Web | Mobile Web | Project Classification |
|---|---|---|---|
| Yes | No | No | Mobile App|
| No | Yes | No | Web |
| No | Yes | Yes | Web + Mobile Web |
| Yes | No | Yes | Mobile App + Mobile Web |
| Yes | Yes | No | Mobile App + Web |
| Yes | Yes | Yes | Mobile App + Web + Mobile Web |

*Mobile Web = Yes must also imply Web = Yes. If Mobile Web is detected without web application evidence, flag classification as inconsistent.*

### 5. Workbook Platform Presentation & Dynamic Dashboards
- **Test Case Platform Column:** In every user story tab, the `Platform` column (positioned immediately after `Test Category`, before `Actual Result`) records the actual platform(s) on which that specific case runs (`Mobile App`, `Web`, `Mobile Web`, or combinations e.g. `Mobile app, Mobile Web`, `Mobile App, Web`, `Web, Mobile Web`, `Mobile App, Web, Mobile Web`). Never display unapplicable platforms (if runnable on Mobile and Mobile Web, Web is omitted). Never assign all platforms as a blind default.
- **Dynamic Platform Count Columns:** `Dashboard` and `Automation Dashboard` dynamically generate columns matching the exact distinct platforms detected in the `Platform` column of test cases (e.g. `"Mobile App"`, `"Web"`, `"Mobile App+Web"`). Multi-platform test cases form their own dedicated combination columns, ensuring zero double counting and that the sum of platform columns in every row equals exactly the Total Test Cases count. Live formulas calculate counts (`COUNTIF` / `COUNTIFS`). Platform columns are omitted from the iOS Dashboard tab.

# References
Load references only when required. Never open `scripts/common.py`.
| Situation | Load |
|---|---|
| Any mode | [`references/rules.md`](./references/rules.md) (constitution, readiness, categories, scoring — one file) |
| Platform detection, truth table, applicability rules | [`references/platform-engine.md`](./references/platform-engine.md) (7 combinations, algorithm, definitions) |
| Requirement comparison, traceability audit, or update review | [`references/reviewer-rules.md`](./references/reviewer-rules.md) (decomposition, semantic matching, matrix, 15-step workflow) |
| Independent QA Review, gap recovery & G01–G14 controls | [`references/gap-recovery.md`](./references/gap-recovery.md) (recoverable/unrecoverable flow, remarks, review report) |
| Mode other than Generate (Validate, Regression, API, Compliance, Suite Optimization, Readiness-only, Scenario-only) | [`references/prompts-library.md`](./references/prompts-library.md) — the prompt block you need |
| Story ID supplied AND [`assets/story_history_registry.json`](./assets/story_history_registry.json) has that ID, except Mode D | [`references/story-history.md`](./references/story-history.md) |
| User asks about workbook format, or reference workbook conventions conflict | [`references/workbook-contract.md`](./references/workbook-contract.md) |

# Assets & Scripts
- [`assets/cases.example.json`](./assets/cases.example.json): Example shape of `cases.json`.
- [`assets/story_history_registry.json`](./assets/story_history_registry.json): Registry for story history lookups.
- [`scripts/extract_source.py`](./scripts/extract_source.py): Extracts source from documents.
- [`scripts/extract_matrix.py`](./scripts/extract_matrix.py): Generates deterministic test case skeleton and expected count.
- [`scripts/history_registry.py`](./scripts/history_registry.py): Looks up story history.
- [`scripts/build.py`](./scripts/build.py): Validates, builds workbook, and verifies structure.
- [`scripts/gap_recovery.py`](./scripts/gap_recovery.py): Independent QA Review, gap recovery engine, and G01–G14 review controls.

# Execution Steps
## Token discipline & Comprehensiveness
The deliverable is strictly ONE final Excel workbook per input user story document. When multiple input user story docs are provided in the user story user input section, the number of output Excel workbooks generated must be exactly the same as per the input docs: every input doc must generate its own separate test case Excel workbook (e.g. `<WorkspaceRoot>/Automation/testcase/Testcases/<Doc1>_TestCases_v1_0.xlsx`, `<WorkspaceRoot>/Automation/testcase/Testcases/<Doc2>_TestCases_v1_0.xlsx`). For any single input document, do not output two different excel files (uncorrected vs corrected); only the single final consolidated excel workbook should be the output per input doc. Do not narrate gates in chat; do not print test-case tables in chat. Write cases into `cases_<doc>.json`, run `build.py`, and report the compact final summary for each generated workbook.
- **CRITICAL — RUNTIME FILE INTEGRITY:** The generated files should NOT be edited during runtime of skill. Never manually modify, mutate, or edit generated script files, JSON data, or output Excel workbooks during runtime execution. Everything must be generated deterministically through `cases.json` and `scripts/build.py`.
- **CRITICAL:** For large requirements, generate a fully comprehensive set covering all field validations, error messages, password rules, and edge cases for EVERY story. Never generate an abbreviated sample.

## Modes
| User asks for… | Mode |
|---|---|
| Test cases from a user story | **Generate** (workflow below) |
| "Is this user story ready for test design?" | Readiness only → `QA-REQ-001` |
| Scenario ideas, no steps | Scenario discovery → `QA-SCN-001` |
| "Review/validate my existing tests" | Validate → `QA-VAL-001` |
| "Review/recover gaps against story/workbook" | Review & Gap Recovery → `QA-REV-001` (gap-recovery.md) |
| "What regression do I need for this change?" | Regression impact → `QA-REG-001` |
| API tests from a contract | API → `QA-API-001` |
| Security/compliance coverage | Compliance → `QA-SEC-001` |
| "Suite too big / duplicates" | Suite optimization → `QA-OPT-001` |
| Known Story ID re-supplied with changes | Delta → `QA-DELTA-001` (story-history.md) |
| "Delete user story tab" / remove retired story | **Delete user story tab (Mode E)** (workflow below) |

## Generate Workflow
Run the gates in order in reasoning; emit only what each gate specifies. When multiple input user story docs are provided, execute the generation workflow independently for each input document `doc_i` (for `i` = 1..N) to produce its separate Excel workbook:

**Step A — Extract source.** Run `python scripts/extract_source.py <file>` for every supplied requirement file.
**Step A.1 — Generate Deterministic Skeleton Matrix.** Run `python scripts/extract_matrix.py --source <file> --out /tmp/skeleton_<doc_id>.json --platform "<Platform>"`. This generates an immutable skeleton with pre-allocated IDs, References, Types, and Categories adhering to Rules R55–R58. Total test count is fixed by code. In Gate 4, write `cases.json` (or `cases_<doc_id>.json` when processing multiple docs) strictly matching this skeleton.
**Step A.2 — Requirement Decomposition & Identification (Reviewer Rules 1–3).** Decompose into 9 verifiable items (business, functional, ACs, rules, inputs, workflows, preconditions, behaviour, boundaries). Use original IDs; never invent IDs. Map every test case to its corresponding requirement. Evaluate actual business intent across 8 attributes.

**Gate 0 — Project context + History/Delta (before generation).**
- **Mode A (GREENFIELD):** Full approved-scope coverage from scratch without test bank. Strict 27-column schema when iOS column is present; strict 26-column schema when iOS column is omitted (Android, Web, Mobile Web, Web + Mobile Web) (omitting `Test Case Type`).
- **Mode B (BROWNFIELD):** Treat designated test bank as baseline. Copy test bank as-is; update only the story in the BRD. Output to separate workbook copy. Strict 28-column schema when iOS column is present; strict 27-column schema when iOS column is omitted (including `Test Case Type`).
- **Mode C (GREENFIELD With Updated User Story):** Use previous suite as baseline; update cases for changed story (`existing`, `modified`, `new`, `invalidated`). Copy test bank as-is; output to separate workbook copy. Strict 28-column schema when iOS column is present; strict 27-column schema when iOS column is omitted (including `Test Case Type`).
- **Mode D (Brownfield — Existing App, From Scratch):** Generate from scratch for updated story without baseline case reuse; copy remainder of test bank as-is. Output to separate workbook copy. Strict 28-column schema when iOS column is present; strict 27-column schema when iOS column is omitted.
- **Mode E (Delete user story tab):** Load test bank, remove targeted user story tab(s) (`--delete-story "US001-login, US002-signup"`), prune exclusive test data prerequisites in `Test Data Requirements`, preserve remaining sheets intact, and dynamically recalculate dashboards (`Dashboard`, `Automation Dashboard`, and `iOS Dashboard` if present).
- **Update Modes Comparison Workflow:** Execute the 15-step sequence in [`references/reviewer-rules.md`](./references/reviewer-rules.md) §7. Assign exactly one `Test Case Type` (`existing`, `modified`, `new`, `invalidated`). Never modify cases for wording changes alone; document specific modification reasons in `Remarks`. Document invalidation evidence in `Remarks`. Never delete historical cases. Uncovered ACs receive new cases.

**Gate 1 — Readiness.** Check 13 elements in `rules.md` §Readiness. Missing element changing expected results → Requirement Question (`RQ-...`) + coverage `BLOCKED`.
**Gate 2 — Scenarios.** Decide scenarios per `rules.md` §Categories. **Accessibility testing is strictly out of scope.** Apply platform logic:
- If platform is **Both Android and iOS**: combine divergent Android/iOS behaviors into a single shared test case using format `"Android: [action/behavior]. iOS: [action/behavior]."`. Mark `IOS Testcase = Yes` selectively for important/platform-sensitive iOS scenarios. The `iOS Dashboard` tab IS created in the Excel workbook.
- If platform is **Android**: test cases reflect Android behavior only; only Android-specific behavior (e.g. device hardware back button, in-app back arrow) is used in test steps, descriptions, and expected results (iOS-specific behaviors like swipe-from-left-edge are excluded); `IOS Testcase` column is removed from every user story tab, and `iOS Dashboard` tab is NOT created.
- If platform is **iOS**: test cases reflect iOS behavior only; only iOS-specific behavior (e.g. swipe-from-left-edge gesture, native back navigation) is used in test steps, descriptions, and expected results (Android-specific behaviors like hardware back button are excluded); every entry in `IOS Testcase` column MUST be `Yes` across all test cases; `iOS Dashboard` tab IS created in the Excel workbook.
- If platform is **Web, Mobile Web, Web + Mobile Web**: `IOS Testcase` column is NOT present in any user story tab sheet, and `iOS Dashboard` tab is NOT created.
- If platform is **Mobile App + Web, Mobile App + Mobile Web, Mobile App + Web + Mobile Web**: `IOS Testcase` column is included for mobile test cases (selective Yes/No) and `iOS Dashboard` tab IS created.
**Gate 3 — Coverage & risk.** Every approved AC/rule receives coverage. For updates, retain prior cases as `existing`/`modified`/`invalidated`; add `new` only for novel behavior.
**Step 3.1 — Intermediate Requirement Coverage Matrix:** Validate internal matrix (`Requirement ID | Acceptance Criteria | Existing Test Case | Comparison Result | Gap / Action`) per `reviewer-rules.md` §6. Never mark a requirement fully covered if any applicable AC is uncovered.
**Gate 4a — 8 Coverage Dimensions & Multi-Dimensional Depth:** Evaluate requirements across Positive, Negative, Boundary, State/Transition, Role/Permission, Error Handling, Platform Variant, and Integration (`reviewer-rules.md` §12). Missing expected dimensions classify requirement as `Partially Covered`, never `Covered`. Calculate Risk-Weighted Coverage % (High=3, Med=2, Low=1) and surface High-Risk Unresolved Gaps.

**Gate 4 — Write cases once.** Write `cases.json` (or `cases_<doc_id>.json` when processing multiple docs) in the shape of `assets/cases.example.json`. Include selected `"platform"` at root level.
**Test Case Quality Rules:**
- Every test case must contain all core attributes: Module, Scenario ID, Scenario, Case ID, Description, Requirement Reference, Priority, Preconditions, Type (Positive/Negative/Edge Case), Steps, Test Data, Expected Result, Test Category (Functional, Field Validation, UI, Compatibility, Usability), Platform, Actual Result, Status (`Not Executed`), Automation Candidate (Yes/No), Regression Candidate (Yes/No), [IOS Testcase (Yes/No) — conditionally present if platform supports iOS], Source Type (`SOURCE`, `DERIVED`, `ADVISORY`, `BLOCKED`), Remarks, BA Comments, Developer Status, Developer Comment, Automation Status, Actual Automation Result, Automation Remark, and Test Case Type (in update modes).
- **Platform Column:** Placed immediately after `Test Category` (before `Actual Result`). Populated with actual executable platforms (`Mobile App`, `Web`, `Mobile Web`, or valid combinations). Never show unapplicable platforms.
- **BA Comments Column:** Placed immediately before `Developer Status` (following `Remarks`). Reserved for Business Analyst notes and clarifications.
- **Dynamic Platform Count Columns:** `Dashboard` and `Automation Dashboard` include columns matching the exact distinct platforms detected in the `Platform` column (e.g. `"Mobile App"`, `"Web"`, `"Mobile App+Web"`), calculated via live formulas (`COUNTIF`/`COUNTIFS`). Multi-platform combination cases form dedicated columns so the sum of platform columns equals exactly the Total Test Cases count. Platform columns are omitted from the iOS Dashboard tab.
- **Test Data Column Standards:** Concrete, realistic sample data reflecting exact rules (e.g. `PAN ID: AYNMH8765J`, `Adhi@23435g`). If no test data is needed (e.g. navigation, back button, viewing static screens), keep column completely empty (`""`). Never use random data or ID references (`TD1`, `TD2`).
- **Automation Candidate Governance:** Governed by Decision Rules 1–8 (`rules.md`). For every `No`, append bold title and domain explanation in `Remarks` only: `**No automation reason:** <reason>`. Generic boilerplate prohibited. `Automation Remark` remains blank.
- **Verifiable Expected Results:** Specific, measurable, observable. Reject vague statements ("System should work correctly").
- **Normalize technical requirement prose into user-observable testcase language** while preserving all material conditions.
- **Descriptive Specification, Short Code Replacement & Simple Plain Language Standard:** In all 6 narrative/prose columns (`Test Scenarios`, `Test Description`, `Pre-condition`, `Test Steps`, `Expected Result`, `Remarks`), cryptic shorthand codes and bare generic references MUST NOT be used in the generated Excel test cases. All content in these columns must be written in **clear, simple language understandable by any person** (business analysts, manual testers, non-technical stakeholders, and end users):
  - **Complete Replacement of Short Codes:**
    - When short codes are used in the user story (e.g. screen codes like `S1`, `S2`; error codes like `E01`, `E02`, `ERR-01`; button/action codes like `B1`, `B2`; page codes like `P1`, `P2`; section codes like `SEC-01`; popup codes like `POP-01`), they MUST NOT be displayed in the generated Excel test cases. Only their proper, full descriptive names must be displayed.
    - Check what the short code means in the user story and replace it with its proper, full description.
    - *Screen Codes (e.g. `S1`, `S2`):* Replace with the full descriptive screen name from the user story. For example, if `S1` is defined as "Login Basic screen", display strictly "Login Basic screen" instead of `S1`. The short code `S1` must NOT appear in the generated Excel columns.
    - *Error Codes (e.g. `E01`, `E02`):* Replace with the exact descriptive error message text from the user story Error Catalogue. For example, use exact error message `error message "Enter a valid 10-digit mobile number"` instead of `E01`. The short code `E01` must NOT appear in the generated Excel columns.
    - *Other Short Codes:* Replace buttons, popups, sections, and dialog codes with their actual names (e.g., "Submit Application button", "Duplicate Request popup", "Applicant Details section").
  - **Resolution of Generic Step References (`step 1`, `step 2`, etc.):**
    - When the user story uses generic references like "step 1", "step 2", or "stage 1", determine what that step actually represents from the context/definitions and state its concrete action, value, or description in the generated Excel.
    - *Example:* If `step 1` is "click on continue button", then instead of generic "step 1", display: "Click on Continue button" in the generated test steps.
  - **Resolution of Generic Page / Screen / Section Terms (`Page 1`, `Page 2`, etc.):**
    - If generic terms like "Page 1", "Page 2", "Screen 1", "Section 1", "Tab 1" are seen:
      - Inspect the user story to check if it has a proper referenced title or name (e.g. Page 1 is "Applicant Details", Step 1 is "Apply for Group Net Metering"). If found, use that meaningful descriptive name in the generated Excel.
      - If no proper reference can be found after checking the entire document, only then use the generic term (e.g. "Page 1").
      - Apply the same reference check and descriptive replacement to other generic terms (e.g. wizards, dialogs, tabs).
  - **Simple Plain Language Understandable by Any Person:**
    - All data across `Test Steps`, `Pre-condition`, `Expected Result`, `Test Description`, and `Test Scenarios` must be written in simple, plain language that is easily understood by any person.
    - Avoid dense technical jargon, internal engineering tokens, developer-only slang, and unexpanded acronyms.
    - Describe concrete, user-observable interactions (e.g. "Open the application", "Enter 10-digit mobile number", "Tap Continue", "Verify the success confirmation popup appears with the request number").
  - **Requirement / AC / Rule Codes (`AC-01`, `BR-01`, etc.):** Canonical IDs belong exclusively in the `Requirement Reference` column for traceability; all prose columns must describe the actual observable functional behavior, validation constraint, or business outcome rather than stating "as per AC-01" or "conforms to BR-01".
  - **Pre-condition Column:** State the actual screen and authentication context in simple, descriptive language (e.g. `User has launched the app and is on the Login Basic screen`), never bare `User is on S1`.
  - **Remarks Column:** Must contain meaningful explanations (e.g. gap recovery action, concrete automation feasibility reason, or clarification question), never a bare code or raw reference string alone.
- **Full User Story Title, Module Column & Worksheet Tab Names Standard (Prohibition of Character Limiting):**
  - **Title of the User Story (Row 0):** In Row 0 of each user story worksheet, the title must be the complete, unclipped sentence / name of the user story (e.g. `US-043. Site Inspection – Dues Verification (section of Conclusion Details)`). Slicing or arbitrary character limits (such as 50 characters) are strictly prohibited.
  - **Module Column (`Module`):** All cell data in the `Module` column (Column A) across every test case row must contain the full, unclipped sentence / name of the user story without character limits.
  - **User Story Worksheet Tab Names:** Tab names must represent complete sentences/phrases (e.g. `US-035 Dashboard`, `US-041 Existing Premise Details`, `US-043 Dues Verification`, `US-046 Activity Page and Submit`) within Excel's 31-character limit. If a story name exceeds 31 characters, strip redundant module prefixes and secondary parenthetical notes, and truncate strictly at word boundaries so no word is ever sliced in half (e.g. never `Dashbo`, `Notifi`, `Activi`, or `Conclu`).
- Top-level `test_data_requirements` array populated with 9-column story-wise environment prerequisites.

**Gate 5 — Preflight validation + build + verify (one command per document).**
```bash
mkdir -p <WorkspaceRoot>/Automation/testcase/Testcases
# For Generation / Update modes (executed for each input document doc_i -> generates separate workbook for each):
python <SkillDirectory>/scripts/build.py --data /tmp/cases_<doc_i>.json --skeleton /tmp/skeleton_<doc_i>.json --out <WorkspaceRoot>/Automation/testcase/Testcases/<DocumentName_i>_TestCases_v1_0.xlsx

# For Mode E (Delete user story tab):
python <SkillDirectory>/scripts/build.py --source-workbook <TestBankPath.xlsx> --delete-story "US001-login, US002-signup" --out <WorkspaceRoot>/Automation/testcase/Testcases/<DocumentName>_Deleted_v1_1.xlsx
```
Requires `"status": "success"`, `"total_errors": 0`, and `"preflight.status": "success"`.

**Gate 5.1 — Independent QA Review & Gap Recovery Phase.**
Following generation, execute gap recovery per [`references/gap-recovery.md`](./references/gap-recovery.md) for each generated workbook:
1. Identify gaps by comparing source document against generated workbook.
2. Determine recoverability based on available evidence in source documents without guessing.
3. If recoverable: generate missing/corrected cases, populate all mandatory fields, set correct Requirement Reference, Source Type, Priority, Category, Platform; ensure zero duplicates; record recovery action in `Remarks` (`[Gap Recovery - RECOVERED] ...` or `[Gap Recovery - DEFECT CORRECTED] ...`); recalculate dashboard counts.
4. If unrecoverable: do not invent behaviour, keep affected cases unchanged, document exact reason and clarification (`RQ-...`) in `Remarks` (`[Gap Recovery - UNRECOVERABLE] ...` or `[Gap Recovery - ADR CONTRADICTION] ...`), classify as `BLOCKED` where applicable.
5. Re-run Review Controls G01–G14.
6. Output: Deliver strictly ONE final Excel workbook per input document (e.g. `<WorkspaceRoot>/Automation/testcase/Testcases/<DocumentName_i>_TestCases_v1_0.xlsx`). For any single document, do not output two different excel files (uncorrected vs corrected); only the final consolidated excel should be the output. If gap recovery is run, update directly in-place to the final workbook path; output Review Report table (`Gap ID | Requirement ID | Test Case ID | Gap Description | Recovery Status | Recovery Action | Remarks`).
```bash
python <SkillDirectory>/scripts/gap_recovery.py --data /tmp/cases_<doc_i>.json --workbook <WorkspaceRoot>/Automation/testcase/Testcases/<DocumentName_i>_TestCases_v1_0.xlsx --out <WorkspaceRoot>/Automation/testcase/Testcases/<DocumentName_i>_TestCases_v1_0.xlsx [--gaps /tmp/gaps.json]
```

**Gate 6 — Traceability & Depth Verification (Internal Governance).** Verified internally across 23 audit attributes. **RTM and Heatmap tabs must NOT be present in the generated Excel workbook.**
**Gate 7 — Human QA.** Output remains DRAFT — NOT BASELINED until Human QA approval.
**Gate 8 — Cleanup.** Remove temporary scratch files. Deliver all final Excel workbooks in `Automation/testcase/Testcases/` (exactly one separate Excel workbook per input document).

# Rules
## Non-negotiables
1. **Never invent.** Not in source → `TBD` + `RQ-...`.
2. **Every case traces** to Story/AC/rule or explicit QA inference.
3. **Volume is not the goal.** Near-identical data variants = one data-driven case.
4. **Risk sets priority**, not confidence.
5. **Draft until human approves.**
6. **COPILOT is mandatory.**
7. **Greenfield creates complete approved-scope coverage from scratch.** Modes other than Greenfield update test bank copy as-is.
8. **Accessible Project Context is reviewed for update modes** (except Mode D).
9. **`IOS Testcase` platform governance:** For `Both Android and iOS` (and multi-platform combinations with Mobile App), `IOS Testcase` is selective Yes/No and `iOS Dashboard` is created. If platform is `iOS`, every entry in `IOS Testcase` must be `Yes` across all test cases and `iOS Dashboard` is created. If platform is `Android`, `Web`, `Mobile Web`, or `Web + Mobile Web`, the `IOS Testcase` column is removed from every user story tab, and `iOS Dashboard` tab is not created.
10. **One final workbook per input document (1:1 Document-to-Workbook Mapping).** Every input user story document must generate its own separate test case Excel workbook. When multiple input user story docs are provided in the user story user input section, the number of output Excel workbooks generated must be exactly the same as the number of input docs (N input docs = N separate output Excel workbooks). Within each document's execution, deliver strictly ONE final Excel workbook (no separate regression excel, no separate uncorrected intermediate excel; gap recovery consolidates directly in-place).
11. **Traceability is a hard gate.** Unique IDs mandatory.
12. **BLOCKED governance is mandatory.** `TBD` in expected result + `RQ-...` in Remarks.
13. **Enums are contract-bound.** Status default is `Not Executed`.
14. **Regression is reasoned Yes/No.**
15. **Accessibility testing is excluded.**
16. **Normalize technical prose into user-observable testcase language** in simple, clear language understandable by any person.
17. **Shared Quality Rules 1–11 apply across all modes.**
18. **Automation Candidate Yes/No governed by Rules 1–8.** No candidates require bold title reason in Remarks only.
19. **Test Data column requires concrete sample values or empty.** No placeholders or IDs.
20. **Semantic comparison across 8 attributes mandatory.**
21. **No wording-only modifications.** Modification reasons documented in Remarks.
22. **Partial coverage hard rule:** Never mark requirement covered if any AC uncovered.
23. **Historical test cases preserved.** Removed cases marked `invalidated`.
24. **Specific, measurable, verifiable expected results mandatory.**
25. **8 Coverage Dimensions evaluated per requirement.**
26. **Internal RTM verification; no RTM tab in Excel.**
27. **Internal Heatmap depth audit; no Heatmap tab in Excel.**
28. **Risk-weighted coverage metrics reported.**
29. **Story-wise test data traceability schema (9 cols).**
30. **Independent QA Review & Gap Recovery Governance (R83):** Recover gaps only with source evidence; no guessing. Re-run controls G01–G14. Deliver strictly the single final Excel workbook per input document; do not output two different excel files for the same doc.
31. **Auditor & Reviewer Governance Alignment (R84):** Adhere to the external auditor governance standards (`SKILL 1.md`): atomic requirement decomposition (`WAC-` alignment), 8-dimension coverage guarantee, strict zero-invention on unconfirmed specifications (mark `BLOCKED` with `TBD` in Expected Result, `RQ-xx`, and bold `**No automation reason:**`), parameterized synthetic test data notes in Sheet 5 (no hardcoded literal PANs or account numbers), live dashboard formulas with precalculated cached values (`value=precalc_value` for offline `openpyxl` with `data_only=True`), and explicit project mode declaration (`Project Mode: GREENFIELD`) across file properties, row 2 metadata, and Config sheet. Strict 27-column schema for Greenfield when iOS column is present (26 columns when iOS column is omitted); strict 28-column schema for Update modes when iOS column is present (27 columns when iOS column is omitted).
32. **Descriptive Prose, Short Code Replacement & Simple Plain Language (R85):** In all 6 narrative columns (`Test Scenarios`, `Test Description`, `Pre-condition`, `Test Steps`, `Expected Result`, `Remarks`), short codes (e.g. screen codes `S1`, `S2`, error codes `E01`, `E02`, button/popup/page codes) MUST NOT be displayed in the Excel test cases; they must be completely replaced with their proper descriptions from the user story (e.g. display 'Login Basic screen' instead of 'S1'). Generic terms like 'step 1' or 'page 1' must be resolved to their actual action or referenced description (e.g. 'Click on continue button' instead of 'step 1', or 'Applicant Details screen' instead of 'Page 1' if referenced in document). All narrative column data must be written in simple, plain language understandable by any person. No short codes or bare codes are permitted in the generated Excel test cases.
33. **Full Sentence Titles, Module Data & Unclipped Tab Names Standard (R86):** The title of the user story in Row 0 and all cell data in the `Module` column must contain the complete, unclipped sentence of the user story name without arbitrary character limits. Worksheet tab names must be complete, meaningful phrases/sentences within Excel's 31-character limit, avoiding mid-word truncations.

## Shared Quality Controls & Greenfield Parity
All modes enforce Shared Quality Rules 1–11, Automation Candidate Rules 1–8, and Greenfield-only parity rules in [`references/rules.md`](./references/rules.md).

# Output Format
## Final summary (the only chat output for Generate)
Present all generated files via `present_files` (e.g. `Automation/testcase/Testcases/<DocumentName_1>_TestCases_v1_0.xlsx`, `Automation/testcase/Testcases/<DocumentName_2>_TestCases_v1_0.xlsx`). For each generated workbook, emit a compact block:

```
COPILOT: PASS | Scope: <FULL DOCUMENT | Story IDs> | Project: <GREENFIELD | BROWNFIELD | GREENFIELD With Updated User Story | Brownfield — Existing App, From Scratch> | Project Context: <REVIEWED | UNAVAILABLE | NOT APPLICABLE> | History: <NEW | HISTORY UNAVAILABLE | delta summary>
Readiness: READY WITH QUESTIONS
Delta: <FULL GREENFIELD SCOPE | FULL FROM-SCRATCH SCOPE | added/modified/impacted summary | NO MEANINGFUL CHANGE>
Modules: 3 | Cases: 119 (SOURCE 91 / DERIVED 22 / ADVISORY 0 / BLOCKED 6) | iOS Selected: 24 | Automation Candidates: <Yes count> (No: <No count>)
Coverage — design: 24/24 AC | executable: 22/24 | positive/negative: ... | automation-design: ... | implemented-automation: n/a | execution: 0 | verified-pass: 0
Requirement Coverage Matrix: VERIFIED (0 gaps) | Final Acceptance Checklist: 15/15 PASS
Score: 88/100 | Hard Fail: none | Overrides: BLOCKED present → cap REVIEW REQUIRED
Verdict: REVIEW REQUIRED | Execution readiness: partial | Baseline: DRAFT — NOT BASELINED
Requirement Questions (6): RQ-01 <question> … 
High-risk areas: ...

Coverage-versus-Count Audit:
- Total test cases: <count>
- Requirements covered: <count/list> | Uncovered: <count/list>
- Justified additions: <count>
- Cases split or combined: split <count>, combined <count>
- Duplicates removed: <count>
- Modified cases: <count> | Invalidated cases: <count>
- Blocked cases: <count> | Executable cases: <count>
- Priority distribution: P0: <count>, P1: <count>, P2: <count>
- Unresolved coverage gaps: <none | list>

Coverage Depth & Risk Metrics:
- Dimension Coverage: <X>% (<covered>/<expected> dimensions across 8 dimensions)
- Risk-Weighted Coverage: <X>% (High wt=3, Med wt=2, Low wt=1)
- High-Risk Unresolved Gaps: <none | list of requirements>
- Governed Worksheets Delivered: Dashboard, Automation Dashboard, iOS Dashboard, Config, Test Data Requirements (9 cols), <Module sheets>

Independent QA Review & Gap Recovery Summary:
- Total Gaps Identified: <count>
- Recovered Gaps: <count>
- Unrecoverable Gaps: <count> (Clarification requested, marked BLOCKED)
- Final Workbook Delivered: <FinalWorkbookPath>
- Review Controls G01–G14 Status: 14/14 PASS

Review Report Table:
| Gap ID | Requirement ID | Test Case ID | Gap Description | Recovery Status | Recovery Action | Remarks |
|---|---|---|---|---|---|---|
| GAP-001 | <Requirement ID> | <Test Case ID> | <Gap Description> | <RECOVERED | UNRECOVERABLE> | <Recovery Action> | <Mandated Remarks Explanation> |
```

For **Brownfield** and **GREENFIELD With Updated User Story**, additionally include:
```
Project Mode: <BROWNFIELD | GREENFIELD With Updated User Story>

Existing: <count>
Modified: <count>
New: <count>
Invalidated: <count>
Previous: <Dashboard previous total> | Updated: <Existing + Modified + New>
Automation Previous: <Dashboard automation previous> | Automation Updated: <automation Existing + Modified + New>
iOS Previous: <Dashboard iOS previous> | iOS Updated: <iOS Existing + Modified + New>

Duplicates Prevented: <count>
Unsupported/Hallucinated Cases Prevented: <count>
```

For **Mode E: Delete user story tab (Mode E)**, report:
```
Project Mode: Delete user story tab (Mode E)
Deleted Story / Module: <Deleted Story Sheet Name>
Remaining Modules: <count>
Remaining Test Cases: <count>
Automation Candidates: <Yes count> (No: <No count>)
iOS Test Cases: <count>
Dashboards Recalculated: Dashboard, Automation Dashboard, iOS Dashboard
Output: <out_path>
```

# Example
## Recommendation
If the user asks "Generate test cases for US-123 using iOS", first verify the COPILOT gates (including Platform), extract source, check readiness, produce `cases.json`, then run `scripts/build.py`.
