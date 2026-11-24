# Locators - SecuritySettings
- Page files: src/pages/common/SecuritySettingsPage.ts
- Device: Android 16 phone (model and serial not recorded), app build com.geojit.fg.sit 1.4.0-sit (debug)
- Captured: 2026-11-23 with scripts/capture-evidence.ps1 (account values replaced by {{NAME}}, account data masked in the PNGs)

| Locator | Page (common/android/ios) | Strategy | Value | Evidence (file: node) | Verified |
| --- | --- | --- | --- | --- | --- |
| biometricLoginSwitch | common | byRole switch | `Biometric Login` | default.xml: Switch [0,194][720,370] | Yes |
| changePasswordRow | common | byRole image | `Change Password` | default.xml: ImageView [0,372][720,500] | Yes |
| totpLoginRow | common | byRole image | `TOTP Login` | default.xml: ImageView [0,502][720,630] | Yes |
