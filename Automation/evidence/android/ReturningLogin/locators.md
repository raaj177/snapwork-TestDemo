# Locators - ReturningLogin
- Page files: src/pages/common/ReturningLoginPage.ts, src/pages/android/ReturningLoginPage.ts
- Device: Android 16 phone (model and serial not recorded), app build com.geojit.fg.sit 1.4.0-sit (debug)
- Captured: 2026-11-23 with scripts/capture-evidence.ps1 (account values replaced by {{NAME}}, account data masked in the PNGs)

| Locator | Page (common/android/ios) | Strategy | Value | Evidence (file: node) | Verified |
| --- | --- | --- | --- | --- | --- |
| welcomeBackHeading | common | byLabel | `WELCOME BACK!` | default.xml: View [274,570][446,592] | Yes |
| (user code) | common | byLabel | `<LOGIN_NORMAL_USERNAME from .env>` | default.xml: View [307,712][413,752] | Yes |
| passwordLabel | common | byLabel | `Password` | default.xml: View [32,965][160,1005] | Yes |
| forgotIdOrPasswordLink | common | byRole button | `Forgot ID or Password?` | default.xml: Button [32,1161][296,1190] | Yes |
| switchAccountLink | common | byRole button | `Switch Account` | default.xml: Button [512,1161][688,1190] | Yes |
| loginButton | common | byRole button | `Login` | default.xml: Button [32,1270][688,1374] | Yes |
| signUpNowLink | common | byRole button | `Sign up now` | default.xml: Button [430,1426][569,1454] | Yes |
| passwordInput | android | byXPath | `//android.widget.EditText[@password="true"]` | default.xml: EditText [32,1017][688,1113] | Yes |
