# Locators - Login
- Page files: src/pages/common/LoginPage.ts, src/pages/android/LoginPage.ts
- Device: Android 16 phone (model and serial not recorded), app build com.geojit.fg.sit 1.4.0-sit (debug)
- Captured: 2026-11-23 with scripts/capture-evidence.ps1 (account values replaced by {{NAME}}, account data masked in the PNGs)

| Locator | Page (common/android/ios) | Strategy | Value | Evidence (file: node) | Verified |
| --- | --- | --- | --- | --- | --- |
| welcomeBack | common | byLabel | `Welcome back!` | customer-id-tab-default.xml: View [186,458][534,530] | Yes |
| customerIdLabel | common | byLabel | `Customer ID/Trade Code` | customer-id-tab-default.xml: View [32,769][364,809] | Yes |
| mobileNumberLabel | common | byLabel | `Mobile number` | mobile-tab-default.xml: View [32,769][233,809] | Yes |
| countryCode | common | byRole image | `+91` | mobile-tab-default.xml: ImageView [64,849][172,889] | Yes |
| passwordLabel | common | byLabel | `Password` | customer-id-tab-default.xml: View [32,965][160,1005] | Yes |
| showPasswordToggle | common | byRole button | `Show password` | customer-id-tab-default.xml: Button [592,1017][688,1113] | Yes |
| forgotIdOrPasswordLink | common | byRole button | `Forgot ID or Password?` | customer-id-tab-default.xml: Button [32,1161][296,1190] | Yes |
| loginButton | common | byRole button | `Login (enabled=false empty / true filled)` | fields-filled-login-enabled.xml: Button [32,770][688,874] | Yes |
| noAccountText | common | byLabel | `Don't have an account?` | customer-id-tab-default.xml: View [151,1422][422,1458] | Yes |
| signUpNowLink | common | byRole button | `Sign up now` | customer-id-tab-default.xml: Button [430,1426][569,1454] | Yes |
| customerIdTab | android | byLabel (TalkBack) | `Customer ID\nTab 1 of 2` | customer-id-tab-default.xml: View [32,598][360,713] | Yes |
| mobileNoTab | android | byLabel (TalkBack) | `Mobile No.\nTab 2 of 2` | mobile-tab-default.xml: View [360,598][688,713] | Yes |
| customerIdInput | android | byXPath | `//android.widget.EditText[@hint="Eg: AAN268"]` | customer-id-tab-default.xml: EditText [32,821][688,917] | Yes |
| mobileNumberInput | android | byXPath | `//android.widget.EditText[@hint="Eg: 9000000000"]` | mobile-tab-default.xml: EditText [32,821][688,917] | Yes |
| passwordInput | android | byXPath | `//android.widget.EditText[@password="true"]` | customer-id-tab-default.xml: EditText [32,1017][688,1113] | Yes |
