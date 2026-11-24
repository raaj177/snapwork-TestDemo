# Locators - Dashboard
- Page files: src/pages/common/DashboardPage.ts, src/pages/android/DashboardPage.ts
- Device: Android 16 phone (model and serial not recorded), app build com.geojit.fg.sit 1.4.0-sit (debug)
- Captured: 2026-11-23 with scripts/capture-evidence.ps1 (account values replaced by {{NAME}}, account data masked in the PNGs)

| Locator | Page (common/android/ios) | Strategy | Value | Evidence (file: node) | Verified |
| --- | --- | --- | --- | --- | --- |
| title | common | byRole image | `Dashboard` | default.xml: ImageView [0,82][720,394] | Yes |
| searchButton | common | byRole button | `Search` | default.xml: Button [464,180][512,228] | Yes |
| dashboardTab | android | byRole image (TalkBack) | `Dashboard\nTab 1 of 4` | default.xml: ImageView [0,1390][180,1506] | Yes |
| moreTab | android | byRole image (TalkBack) | `More\nTab 4 of 4` | default.xml: ImageView [540,1390][720,1506] | Yes |
