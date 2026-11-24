# Locators - More
- Page files: src/pages/common/MorePage.ts
- Device: Android 16 phone (model and serial not recorded), app build com.geojit.fg.sit 1.4.0-sit (debug)
- Captured: 2026-11-23 with scripts/capture-evidence.ps1 (account values replaced by {{NAME}}, account data masked in the PNGs)

| Locator | Page (common/android/ios) | Strategy | Value | Evidence (file: node) | Verified |
| --- | --- | --- | --- | --- | --- |
| heading | common | byLabel | `More` | default.xml: View [32,108][128,168] | Yes |
| settingsRow | common | byLabel | `Settings` | default.xml: View [32,660][688,782] | Yes |
| logoutRow | common | byLabel | `Logout (after scroll)` | scrolled-logout-visible.xml: View [32,1186][688,1306] | Yes |
