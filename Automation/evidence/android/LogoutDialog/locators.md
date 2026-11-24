# Locators - LogoutDialog
- Page files: src/pages/common/LogoutDialogPage.ts
- Device: Android 16 phone (model and serial not recorded), app build com.geojit.fg.sit 1.4.0-sit (debug)
- Captured: 2026-11-23 with scripts/capture-evidence.ps1 (account values replaced by {{NAME}}, account data masked in the PNGs)

| Locator | Page (common/android/ios) | Strategy | Value | Evidence (file: node) | Verified |
| --- | --- | --- | --- | --- | --- |
| question | common | byLabel | `Are you sure you want to logout?` | default.xml: View [139,1306][581,1346] | Yes |
| cancelButton | common | byRole button | `Cancel` | default.xml: Button [32,1378][348,1482] | Yes |
| logoutButton | common | byRole button | `Logout` | default.xml: Button [372,1378][688,1482] | Yes |
