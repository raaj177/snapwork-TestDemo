# Locators - ForgotPassword
- Page files: src/pages/common/ForgotPasswordPage.ts
- Device: Android 16 phone (model and serial not recorded), app build com.geojit.fg.sit 1.4.0-sit (debug)
- Captured: 2026-11-23 with scripts/capture-evidence.ps1 (account values replaced by {{NAME}}, account data masked in the PNGs)

| Locator | Page (common/android/ios) | Strategy | Value | Evidence (file: node) | Verified |
| --- | --- | --- | --- | --- | --- |
| backButton | common | byRole button | `Back` | default.xml: Button [8,90][104,186] | Yes |
| geojitLogo | common | byLabel | `Application Logo` | default.xml: Image [220,258][520,354] | Yes |
| pageTitle | common | byRole text | `Online Activation / Forgot Password` | default.xml: TextView [124,422][640,462] | Yes |
| customerIdField | common | byId | `username` | default.xml: EditText [40,556][700,654] | Yes |
| panNumberField | common | byId | `panNumber` | default.xml: EditText [40,740][700,838] | Yes |
| emailRadio | common | byId | `emailRb` | default.xml: RadioButton [40,892][72,926] | Yes |
| mobileRadio | common | byId | `mobileRb` | default.xml: RadioButton [224,892][258,926] | Yes |
| emailField | common | byId | `emailID` | default.xml: EditText [40,1016][700,1114] | Yes |
| unlockButton | common | byId | `unlockButton` | default.xml: Button [40,1160][346,1252] | Yes |
| resetPasswordButton | common | byId | `resetPassword` | default.xml: Button [394,1160][700,1252] | Yes |
| notRegisteredText | common | byText | `Not registered yet? ` | default.xml: TextView [160,1414][382,1446] | Yes |
| openAnAccountLink | common | byLabel | `Open an Account` | default.xml: View [380,1414][580,1446] | Yes |
| faqLink | common | byXPath | `//*[starts-with(@content-desc, "FAQ")]` | default.xml: View [106,1482][170,1506] | Yes |
| privacyPolicyLink | common | byLabel | `Privacy Policy |` | default.xml: View [184,1482][346,1506] | Yes |
| termsLink | common | byLabel | `Terms of service |` | default.xml: View [360,1482][554,1506] | Yes |
| aboutLink | common | byLabel | `About` | default.xml: View [568,1482][634,1506] | Yes |
