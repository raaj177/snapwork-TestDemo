# Locators - ChangePassword
- Page files: src/pages/common/ChangePasswordPage.ts
- Device: Android 16 phone (model and serial not recorded), app build com.geojit.fg.sit 1.4.0-sit (debug)
- Captured: 2026-11-23 with scripts/capture-evidence.ps1 (account values replaced by {{NAME}}, account data masked in the PNGs)

| Locator | Page (common/android/ios) | Strategy | Value | Evidence (file: node) | Verified |
| --- | --- | --- | --- | --- | --- |
| heading | common | byLabel | `Change Password` | default.xml: View [112,114][612,174] | Yes |
| currentPasswordLabel | common | byLabel | `Current Password` | default.xml: View [32,238][270,278] | Yes |
| newPasswordLabel | common | byLabel | `New Password` | default.xml: View [32,434][227,474] | Yes |
| retypePasswordLabel | common | byLabel | `Retype New Password` | default.xml: View [32,630][328,670] | Yes |
| expiryDaysLabel | common | byLabel | `Expiry Days` | default.xml: View [32,826][187,866] | Yes |
| expiryPill(90) | common | byLabel | `90 Days` | default.xml: View [32,890][180,942] | Yes |
| expiryPill(120) | common | byLabel | `120 Days` | default.xml: View [204,890][367,942] | Yes |
| expiryPill(180) | common | byLabel | `180 Days` | default.xml: View [391,890][554,942] | Yes |
| expiryDate | common | byXPath | `//*[starts-with(@content-desc, "Password Expiry Date:")] (90 days -> 21/2/2027 on 23/11/2026)` | expiry-90-days-selected.xml: View [32,974][416,1010] | Yes |
| cancelButton | common | byRole button | `Cancel` | default.xml: Button [32,1378][348,1482] | Yes |
| saveButton | common | byRole button | `Save` | default.xml: Button [372,1378][688,1482] | Yes |
