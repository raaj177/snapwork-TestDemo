# QA Pipeline Progress — run 2026-11-23T00-00

**Current:** Phase 4 — waiting for the user's device run ⏸️ (68 of 358 implemented; P0 smoke coverage incomplete: 23 of 145)

## Phase 0: Start
- [x] Workspace root: `Universal kits/`
- [x] Folders: `.github/_requirements/` and `orchestration/` already present (nothing created)
- [x] Old layout check: no root `_requirements/`; `reports/` holds no workbooks
- [x] User story source: LOCAL — `GFG_EPIC001_Login_Authentication_v5 3.docx`
- [x] Previous run: none
- [x] State file and checklist created

## Phase 1: Automation setup
- [x] Platform asked: **Mobile**, mobile platform **Android + iOS**; layout flat, `mobile_dir` = `Automation/`
- [x] Framework check: `Automation/` not present (folder deleted earlier)
- [x] Setup intake: Q1 "no app yet", Q2 `<WorkspaceRoot>/Automation` (confirmed), Q3 Mobile / Android + iOS
- [x] Discovery summary confirmed; `npm install` approved; Jenkins NodeJS tool `NodeJS-24`; pipelines: Mobile only
- [x] Framework files created: `Automation/` (flat Mobile) — config, src, scripts (smoke/run/report tooling), docs, Jira/, jenkins/Jenkinsfile.mobile, .github/workflows/mobile-tests.yml, testcase/ with 6 lifecycle folders
- [x] `npm install`: done, every version pinned exactly, package-lock.json written; uiautomator2@10.0.0 + xcuitest@13.6.1 `[installed (npm)]`
- [x] Bootstrap validations: typecheck ✔, lint ✔, format:check ✔, JSON ✔, config load w/o session ✔, .gitignore ✔ (temp git repo), placeholder scan ✔, scripts dry-run/help ✔, smoke:test 12/12 ✔, run-commands:test 13/13 ✔, report:share:test 11/11 ✔, test-data:test 10/10 ✔
- [x] Deferred values: APP_PACKAGE, APP_ACTIVITY, BUNDLE_ID, APP_PATH, app display name (Phase 4, from the app build)
- [x] Exit gate: passed (typecheck + lint passed)

## Phase 2: Test case generation
- [x] Step 1 Mode: **GREENFIELD (Mode A)**
- [x] Step 2 User story: `GFG_EPIC001_Login_Authentication_v5 3.docx` (only file, auto-selected); source LOCAL
- [x] Step 3 Scope: **full document**
- [x] Steps 4–7: not applicable (Mode A)
- [x] Step 8 Platform: **Mobile App → Both Android and iOS** (Phase 1: Mobile, Android + iOS — consistent)
- [x] Step A extract_source (765 lines) · A.1 skeleton: 13 stories, 226 deterministic cases · A.2 decomposition
- [x] Gate 0 Greenfield (27-col schema) · Gate 1 Readiness: READY WITH QUESTIONS (16 RQs) · Gates 2–4 scenarios, coverage, cases written (226)
- [x] Gate 5 build.py: status success, total_errors 0, preflight success (0 warnings), structural success; recalc skipped (LibreOffice not available)
- [x] Gate 5.1 gap recovery: 24 gaps — 18 RECOVERED (new cases), 6 UNRECOVERABLE (RQs); controls G01–G14 14/14 PASS
- [x] Gates 6–7: no RTM/Heatmap tabs; DRAFT — NOT BASELINED
- [x] Exit gate PASSED: build success, 0 errors, preflight success, exactly one v1_0 in Generated Testcases/, readiness not BLOCKED (244 cases, 224 automation candidates, 92 iOS, 13 BLOCKED)
- [x] Handover to Phase 3

## Phase 3: Test case review
- [x] Files and order: 01 `GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_0.xlsx`; story matched by name; scope full document; evidence none (limitation); gate full ≥ 90% AND risk-weighted ≥ 90% — confirmed by user ("proceed")
- [x] Review v1_0 → `Review Reports/GFG_EPIC001_Login_Authentication_v5 3_TestCase_Review_v1_0.xlsx` (FULL review, Gate 10 PASS): full 82.7% (139/168), risk-weighted 94.1%, gate **FAILED**, Quality 83/100, verdict REVIEW REQUIRED, findings C0 H3 M31 L13 I9
- [ ] ⏸️ Revisions (v1_1…) — stopped by user after first review report
- [ ] ⏸️ Result — not copied to Testcases/; open RQs: RQ-01, RQ-02, RQ-03, RQ-04, RQ-05, RQ-06, RQ-07, RQ-08, RQ-09, RQ-13, RQ-15, RQ-17, RQ-18, RQ-R01, RQ-R02
- Run: 01 ⏸️
- Note: `Testcases/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_1.xlsx` (dated 2026-11-16) exists but was not written by this cycle; left untouched.

## Phase 4: Implement testcases
- [x] User override: implement the unreviewed `…_v1_1.xlsx` already in `Testcases/` (no version passed the Phase 3 gate)
- [x] App build `apps/android/app-debug.apk` (com.geojit.fg.sit, 1.4.0-sit, Flutter debug) → `.env` APP_PACKAGE / APP_ACTIVITY / APP_PATH; test accounts and Jira values added to `.env`; DEVICE_UDID set locally
- [x] Prerequisites: device online (Android 16), ANDROID_HOME set, Python + openpyxl, node_modules, Appium drivers project-local
- [x] Platform Android (iOS deferred) | Workbook v1_1 | Scope: P0 smoke (Automation Candidate = Yes, P0)
- [x] Device inspection: 10 screens dumped (Login, ReturningLogin, Dashboard, KycPrompt, More, LogoutDialog, Settings, SecuritySettings, ChangePassword, ForgotPassword) + LoginFailureRecovery; 68 of 68 locators verified; evidence masked
- [x] Framework: retry-on-hang launch step, Blocked never retried, run-script log format, Flutter capabilities, recordActualResult, page factory, start.service
- [x] Code: 6 story specs, 23 `it()` (Add 23, Keep 0, Change 0, Blocked 122)
- [x] `npm run typecheck` ✔ `npm run lint` ✔ `format:check` ✔; device-free suites pass
- [x] Handoffs `automation-handoff/US002…US013.md`; suites `suites/<workbook>/android/*.json`
- [x] Run scripts installed (`run.cmd`, `scripts/run.ps1`, `scripts/run-tests.ps1`, `scripts/testrun/`)
- [ ] ❌ Smoke gate: `smoke:check` → COVERAGE INCOMPLETE: 122 missing (all Blocked with reasons) — exit gate not met
- [x] Commands printed (`.
un -Type first`, `npm run smoke`, `npm run regression`, `smoke:run --partial`)

## Outputs
| Item | Value |
| --- | --- |
| Automation directory | `Automation/` (flat) |
| Platform | Mobile (Android + iOS) |
| User story | `.github/_requirements/user_stories/GFG_EPIC001_Login_Authentication_v5 3.docx` |
| Generated workbook | `Automation/testcase/Generated Testcases/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_0.xlsx` |
| Review workbook(s) | `Automation/testcase/Review Reports/GFG_EPIC001_Login_Authentication_v5 3_TestCase_Review_v1_0.xlsx` |
| Revised workbook(s) | |
| Approved workbook | none passed the gate; implemented by user override: `Testcases/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_1.xlsx` |
| Handoff | `Automation/automation-handoff/US002.md` … `US013.md` |
| Run command | `.
un -Type first` (from `Automation/`) |

### Phase 4 — all reachable cases (2026-11-24)
- [x] Placement: P0 only in `src/tests/smoke/GFG_EPIC001_Login_Authentication_v5 3/<Story>.test.ts`; P1/P2 only in `src/tests/regression/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_1/`
- [x] Implemented: 68 of 358 candidates (P0 23 of 145, P1/P2 45 of 213); 290 Blocked with reasons in `automation-handoff/` (user decisions: no wrong passwords, no OTP/2FA; unavailable account states; live submissions; biometrics; Sign up now opens a blank screen)
- [x] Device inspection with the normal account only (login fields, toggle, length rules, mobile validation, Sign up now, Forgot page); one inspection login returned "Login Failed - Something went wrong" (not retried)
- [x] Login field locators fixed (label-sibling XPath: fields lose their hint once filled)
- [x] typecheck / lint / format pass; device-free suites pass; smoke:check `COVERAGE INCOMPLETE: 122 missing` with no MISPLACED/MISMATCH/TITLE/DUPLICATE/STALE
- [x] Dry runs: smoke 23 selected; regression 68 selected; `.un -Type first -DryRun` 68 rows in 13 suites (`<Story>.json` + `<Story>.smoke.json`)
- [ ] ⏸️ Device run by the user (`.un -Type first`, `npm run smoke`, `npm run regression`)
- Known expectation mismatches (tests will fail until BA/app align): TC_US002_040, TC_US003_005, TC_US003_007, TC_US008_020
