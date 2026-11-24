# Platform Detection & Test Case Platform Allocation Engine

Analyze and detect project-level platforms using an **evidence-based classification algorithm** and independently allocate platform values to every testcase using a **test-case-level platform applicability engine**.

**Do not blindly assign every detected project platform to every test case. Never assign `Mobile App, Web, Mobile Web` as a default value.**

## 1. Platform Classification

The system supports exactly these seven project-level classifications:
1. **Mobile App**
2. **Web**
3. **Mobile Web**
4. **Mobile App + Web**
5. **Mobile App + Mobile Web**
6. **Web + Mobile Web**
7. **Mobile App + Web + Mobile Web**

### Platform Definitions (Automation Types)
| Term | What is tested | Runs on |
|---|---|---|
| **Mobile / Mobile App** | Native apps installed from an `.apk` / `.ipa` | Real Android and iOS devices, emulators and simulators |
| **Web** | The website in a desktop browser | Chromium (Chrome, Edge), Firefox, WebKit (Safari engine) |
| **Mobile Web** | The web app as a phone user opens it: in the mobile browser, or installed to the home screen | Chrome on Android, Safari on iOS (real devices) |

- **Mobile App:** Tests **native apps installed from an `.apk` / `.ipa`**, running on **real Android and iOS devices, emulators and simulators**. Covers native device capabilities and mobile OS integrations: biometric authentication (Face ID, Touch ID, Android BiometricPrompt), camera, microphone, photo gallery picker, GPS/location, device permission dialogs, hardware back button, native edge-swipe gestures, OS application lifecycle backgrounding/resuming, and local persistent storage (SQLite/Room/CoreData/Keychain).
- **Web:** Tests **the website in a desktop browser**, running on **Chromium (Chrome, Edge), Firefox, WebKit (Safari engine)**. Covers desktop browser viewport (e.g. 1920x1080), browser DOM, standard browser URL navigation, browser tabs, forward/back buttons, browser refresh, HTTP cookies, web storage (`localStorage`, `sessionStorage`), desktop drag-and-drop, and keyboard navigation. Lacks direct OS-level hardware access.
- **Mobile Web:** Tests **the web app as a phone user opens it: in the mobile browser, or installed to the home screen**, running on **Chrome on Android, Safari on iOS (real devices)**. Explicitly implements: a Web App Manifest (`manifest.json` defining `display: standalone`, app name, icons), a registered Service Worker for request interception and offline caching (Cache API, IndexedDB), installability prompting ("Add to Home Screen" / A2HS), background synchronization, and Web Push Notifications.

**Important Axioms:**
- Mobile Web is an enhanced implementation of Web, not an independent replacement for Web. Every Mobile Web MUST have an underlying web implementation.
- Responsive design does NOT mean Mobile Web.
- Mobile browser support alone without manifest/service worker does NOT mean full Mobile Web.
- A website containing only `manifest.json` or a service worker reference does not automatically qualify as a fully implemented Mobile Web without validating actual implementation evidence.

## 2. Project-Level Platform Selection Workflow (Direct Prompts)

Platform autodetection is completely disabled. Do not scan text for keywords or architectural pillars to infer platforms. The agent directly gives platform selection prompts to the user and blocks until the user responds:

### Step 1: Initial Platform Selection Prompt
Directly present the platform prompt with the 7 supported options:
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
**Execution MUST block and wait for the user to respond before proceeding.**

### Step 2: Mobile App Sub-Selection Prompt
If the platform selected in Step 1 is **Mobile App** (Option 1), immediately present another prompt asking:
```text
Select the required platform:
1. Both Android and iOS (Recommended)
2. Android
3. iOS
```
**Execution MUST block and wait until the user responds.**

### Comprehensive Platform & Workbook Presentation Matrix:
| Selected Platform | Sub-Selection (if Mobile App) | `IOS Testcase` Column in User Story Tabs | `IOS Testcase` Values | `iOS Dashboard` Tab in Excel | User Story Tab Columns (Greenfield / Update) |
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

#### Platform Behavior Rules for Test Steps:
- **Both Android and iOS (Option 1):** In test steps where interaction behaves differently on Android and iOS (e.g. Back navigation, biometrics), combine both behaviors into the shared test case using format `"Android: [behavior]. iOS: [behavior]"` (e.g. `2. Trigger Back navigation:\n   - Android: Tap the in-app back arrow or press the device hardware back button.\n   - iOS: Tap the back arrow or perform a swipe-from-left-edge gesture.`).
- **Android (Option 2):** In test steps, descriptions, and expected results, ONLY Android-specific behavior must be used (e.g. `2. Trigger Back navigation: Tap the in-app back arrow or press the device hardware back button.`). iOS-specific behaviors (such as swipe-from-left-edge gesture) must NOT be included.
- **iOS (Option 3):** In test steps, descriptions, and expected results, ONLY iOS-specific behavior must be used (e.g. `2. Trigger Back navigation: Tap the back arrow or perform a swipe-from-left-edge gesture.`). Android-specific behaviors (such as hardware back button) must NOT be included.

## 3. Test Case-Level Platform Applicability Engine

After detecting project-level platforms, independently analyze EVERY generated test case across its Test Case ID, Title, Scenario, Preconditions, Test Steps, Expected Results, Feature functionality, UI interaction, device capabilities, browser capabilities, and Mobile Web capabilities.

Platform assignments for test cases are governed strictly by the **Automation Types** definitions:

| Term | What is tested | Runs on |
|---|---|---|
| **Mobile** | Native apps installed from an `.apk` / `.ipa` | Real Android and iOS devices, emulators and simulators |
| **Web** | The website in a desktop browser | Chromium (Chrome, Edge), Firefox, WebKit (Safari engine) |
| **Mobile Web** | The web app as a phone user opens it: in the mobile browser, or installed to the home screen | Chrome on Android, Safari on iOS (real devices) |

Determine which platforms actually require that test case based on 5 classification categories:

**A. Shared Business Logic**
- *Definition:* Core business rules, calculation logic, and validation workflows that execute identically across platforms.
- *Examples:* API response validation, mandatory field validation, calculation rules (sharing ratio, tariffs), consumer number validation, email format, backend error handling.
- *Allocation:* Assign to every confirmed project platform on which the feature is implemented. Do NOT assign unconfirmed platforms.

**B. Mobile-Specific Test Cases**
- *Definition:* Tests **native apps installed from an `.apk` / `.ipa`**, running on **real Android and iOS devices, emulators and simulators**.
- *Examples:* Native biometric authentication (Face ID, Touch ID, Android BiometricPrompt), Android native permission handling, native camera integration, native file picker (`UIDocumentPicker`, `ACTION_GET_CONTENT`), app lifecycle handling (background/resume by OS), native deep linking, push notification tray, swipe gestures, hardware back button.
- *Allocation:* Assign only to `Mobile App`.

**C. Web-Specific Test Cases**
- *Definition:* Tests **the website in a desktop browser**, running on **Chromium (Chrome, Edge), Firefox, WebKit (Safari engine)**.
- *Examples:* Desktop browser compatibility (Chromium, Firefox, WebKit), browser-specific navigation (URL bar, tabs, refresh), browser session handling, desktop drag-and-drop file upload, browser download handling, keyboard navigation, desktop viewport layout (1920x1080).
- *Allocation:* Assign only to `Web`.

**D. Mobile Web-Specific Test Cases**
- *Definition:* Tests **the web app as a phone user opens it: in the mobile browser, or installed to the home screen**, running on **Chrome on Android, Safari on iOS (real devices)**.
- *Examples:* Add to Home Screen (A2HS), installability prompt, standalone display mode, Service Worker registration, offline resource caching (Cache API), background synchronization, web push notifications.
- *Allocation:* Assign only to `Mobile Web` (or `Web, Mobile Web` where browser caching is shared across desktop/mobile web, or `Mobile app, Mobile Web` where mobile web experience is shared with native mobile).

**E. Platform-Neutral Business Scenarios**
- *Definition:* Scenarios validating business behavior independent of the underlying execution target (native app, desktop browser, or Mobile Web).
- *Examples:* Calculation accuracy, data consistency, API contract validation, backend processing, business rule enforcement.
- *Allocation:* Assign to all confirmed platforms that expose the relevant functionality. Do not create unnecessary duplicate test cases simply because multiple platforms are supported.

## 4. Platform Applicability Decision Algorithm

Execute this decision sequence for every test case:
1. **Step 1:** Identify the functionality being tested.
2. **Step 2:** Identify whether the scenario validates Business logic, API behaviour, UI behaviour, Native device capability, Browser capability, or Mobile Web capability.
3. **Step 3:** Identify actual platform dependencies required by the scenario.
4. **Step 4:** Compare those dependencies with confirmed project-level platforms.
5. **Step 5:** Assign strictly the **intersection** of:
   - Confirmed project platforms.
   - Platforms required by the test scenario.
6. **Step 6:** If the scenario cannot be mapped confidently (e.g. scenario requires Web/Mobile Web but project is Mobile-only), mark it for manual review (`Review Required = Yes`) and document the mismatch in `review_remarks`.
7. **Step 7:** Validate that no unsupported or hallucinated platform has been assigned.

### Mandatory Restrictions
- Never assign `Mobile App, Web, Mobile Web` as a default value.
- Never assign Mobile Web merely because Web is detected.
- Never assign Mobile merely because the application is responsive.
- Never assign Web merely because an API is involved.
- Never assign all project platforms to every test case.
- Never infer native functionality without evidence.
- Never change test case functionality just to justify a platform assignment.

## 5. Platform Allocation Output

For every test case, generate the following internal classification attributes:
| Field | Description |
|---|---|
| Project Platforms | Confirmed project-level platforms |
| Test Case Platform | Platform assigned to the test case |
| Platform Type | Shared / Mobile-specific / Web-specific / Mobile Web-specific / Platform-Neutral |
| Platform Evidence | Reason supporting the assignment |
| Confidence | High / Medium / Low |
| Review Required | Yes / No |
| Review Remarks | Explanation when evidence is insufficient or scope mismatch exists |

The final Excel **Platform** column contains only the assigned platforms. Do not add extra columns to the Excel workbook; preserve all standard workbook schema, columns, and formatting intact.

### Test Case-Level Platform Values (Automation Types Definition)

Every test case's **Platform** column records the actual execution target platform(s) on which that specific test case can be executed, governed strictly by the **Automation Types** definitions:

| Term | What is tested | Runs on |
|---|---|---|
| **Mobile** | Native apps installed from an `.apk` / `.ipa` | Real Android and iOS devices, emulators and simulators |
| **Web** | The website in a desktop browser | Chromium (Chrome, Edge), Firefox, WebKit (Safari engine) |
| **Mobile Web** | The web app as a phone user opens it: in the mobile browser, or installed to the home screen | Chrome on Android, Safari on iOS (real devices) |

**Test Case-Level Permissible Values & Execution Targets:**
1. **`Mobile App`**:
   - *What is tested:* Native apps installed from an `.apk` / `.ipa`
   - *Runs on:* Real Android and iOS devices, emulators and simulators
   - *Allocation rule:* Assigned when a test case is runnable on mobile app alone (e.g. native OS features, biometrics, hardware back, camera, mobile-specific flows).
2. **`Web`**:
   - *What is tested:* The website in a desktop browser
   - *Runs on:* Chromium (Chrome, Edge), Firefox, WebKit (Safari engine)
   - *Allocation rule:* Assigned when a test case can only be tested on Web (e.g. desktop browser navigation, 1920x1080 viewport, browser cookies/tabs, desktop file upload).
3. **`Mobile Web`**:
   - *What is tested:* The web app as a phone user opens it: in the mobile browser, or installed to the home screen
   - *Runs on:* Chrome on Android, Safari on iOS (real devices)
   - *Allocation rule:* Assigned when a test case can only be tested on Mobile Web (e.g. Service Worker offline caching, Add to Home Screen / A2HS prompt, standalone display mode).
4. **`Mobile app, Mobile Web`** (or **`Mobile App, Mobile Web`**):
   - *What is tested:* Native apps installed from an `.apk` / `.ipa` AND the web app as a phone user opens it: in the mobile browser, or installed to the home screen
   - *Runs on:* Real Android and iOS devices, emulators and simulators; and Chrome on Android, Safari on iOS (real devices)
   - *Allocation rule:* Assigned when a test case will run on both Mobile App and Mobile Web. **Web will NOT be shown in this column.**
5. **`Mobile App, Web`**:
   - *What is tested:* Native apps installed from an `.apk` / `.ipa` AND the website in a desktop browser
   - *Runs on:* Real Android/iOS devices, emulators/simulators; and Chromium (Chrome, Edge), Firefox, WebKit (Safari engine)
   - *Allocation rule:* Assigned when a test case will run on mobile app and Web, but Mobile Web is not applicable or not supported.
6. **`Web, Mobile Web`**:
   - *What is tested:* The website in a desktop browser AND the web app as a phone user opens it: in the mobile browser, or installed to the home screen
   - *Runs on:* Chromium (Chrome, Edge), Firefox, WebKit (Safari engine); and Chrome on Android, Safari on iOS (real devices)
   - *Allocation rule:* Assigned when a test case will run on desktop Web and Mobile Web, but native mobile app is not applicable or supported.
7. **`Mobile App, Web, Mobile Web`**:
   - *What is tested:* Native apps installed from an `.apk` / `.ipa`, the website in a desktop browser, AND the web app as a phone user opens it: in the mobile browser, or installed to the home screen
   - *Runs on:* Real Android/iOS devices, emulators/simulators; Chromium, Firefox, WebKit; and Chrome on Android, Safari on iOS (real devices)
   - *Allocation rule:* Assigned when a test case will run across all three platforms.

**Critical Rules for Test Case Platform Values:**
- **Never show unapplicable platforms:** If a test case is runnable on Mobile App and Mobile Web, `Web` must NOT be shown.
- **Never assign `Mobile App, Web, Mobile Web` as a blind default:** Every platform assignment must reflect the actual scenario dependencies intersected with confirmed project scope.
- **Never hallucinate unsupported platforms.**

## 6. Platform Combination Truth Table
| Mobile | Web | Mobile Web | Project Classification |
|---|---|---|---|
| Yes | No | No | Mobile |
| No | Yes | No | Web |
| No | Yes | Yes | Web + Mobile Web |
| Yes | No | Yes | Mobile + Mobile Web |
| Yes | Yes | No | Mobile + Web |
| Yes | Yes | Yes | Mobile + Web + Mobile Web |

*Mobile Web = Yes must also imply Web = Yes. If Mobile Web is detected without web application evidence, flag classification as inconsistent.*

## 7. Validation & Quality Gates (Platform Allocation)
Before exporting the final test-case workbook, enforce these quality checks:
1. Every test case has a valid platform assignment or explicit review status.
2. No test case receives an unsupported or hallucinated platform token (GW310).
3. No Mobile Web assignment exists without confirmed Mobile Web scope (GW313).
4. Mobile-specific scenarios are not incorrectly assigned to Web (GW314).
5. Web-specific scenarios are not incorrectly assigned to Mobile (GW314).
6. Shared business scenarios are assigned to all confirmed platforms implementing the feature.
7. No project-level platform is automatically copied into every test case as a blanket assignment (GW311).
8. Platform assignment is supported by the actual test scenario.
9. Existing test case IDs, descriptions, steps, and expected results remain unchanged.
10. Existing workbook schema, formulas, formatting, and other columns remain unchanged.

## 8. Brownfield and Greenfield Compatibility
- **GREENFIELD:** Determine platforms strictly from approved project requirements, architecture, and design evidence. Do not assume platforms that are not specified.
- **BROWNFIELD:** Inspect existing application implementation and project documentation. Identify already implemented platforms and distinguish them from newly requested platform capabilities. Do not assume that a new feature exists on every platform merely because the overall application supports multiple platforms. When an updated user story introduces a feature for only one existing platform, allocate test cases strictly to that platform.

## 9. Dashboard Dynamic Platform Columns & Reconciliation
In the `Dashboard` and `Automation Dashboard` sheets, platform summary columns are generated dynamically based on the distinct platform values detected in the `Platform` column across test cases:
- Single-platform test cases (e.g. `Mobile App`, `Web`, `Mobile Web`) populate their respective platform columns.
- Multi-platform combination test cases (e.g. `Mobile App+Web`) form dedicated combination columns (e.g. `Mobile App+Web`).
- Each test case increments exactly one platform column via live formulas (`COUNTIF` / `COUNTIFS`).
- **Zero Double-Counting:** Because each test case belongs to exactly one platform column, the sum of counts across the platform columns in every summary row (Overall, Module-wise, Category-wise, Priority-wise) equals **exactly** the Total Test Cases count.
- Platform count columns are omitted from the iOS Dashboard tab.

