# Testcase Test Template

Base for every new testcase `it()`. Replace each placeholder; do not write a test from scratch when this template applies. Page objects and their methods follow `page-object-template.md`.

## The test file only calls methods

A spec (`*.test.ts`, regression or smoke) contains **no logger and no functions**: no `logger.child(...)`, no `log.info(...)`, no `async function ...`, no `try`/`catch`. Every step of a testcase is a **method** that already logs its start, its result and its failure:

| Step | Where the method lives |
| --- | --- |
| Reaching the start state (relaunch, Switch Account, log in, log out, open a screen several screens deep) | the start service (`src/services/start.service.ts`), for example `startService.openMobileNumberLogin()` |
| One user action or one check on one screen | a small action or `verify...` method of that screen's page object |
| A sequence of actions and checks on one screen that the testcase performs (the testcase's flow) | a **flow method** of that page object, for example `loginPage.verifyLoginActivatesAfterCustomerIdThenPassword(customerId, password)` |
| A check across screens or the device (relaunch, Back, app in the foreground) | the start service or the page where the flow starts |

**Start states reuse what is on screen (speed).** A start-service method first checks the current screen (`currentStartScreen()`, a short probe, no relaunch) and relaunches only when the state is unknown or cannot be verified clean: a login screen is reset in place (fields cleared, password masked, default tab) and verified empty before it is reused; the returning-user screen goes on with Switch Account; a live session is reused (Dashboard tab) with no logout and no new login. `REUSE_APP_STATE=false` forces a relaunch before every test, and `APP_START_SETTLE_MS` sets the pause after a (re)start. Relaunch inside a test only when relaunching is the behaviour under test (for example "after logout, a relaunch shows the login screen").

Each of those methods follows automation-setup "Method rules": `this.logger.info('<what starts>')`, the body in `try`, `this.logger.info('<what finished>')`, and in `catch` `this.logger.error(\`<what failed>: ${describeError(error)}\`)` and rethrow. Because the logging is in the methods, the Jenkins console and the per-test `Logger` attachment show every step of every test as `started → finished` or `failed: <reason>`, and a failure points at the exact method. No step is left as a bare statement in the spec.

## Template

```ts
it('<exact workbook Test Case ID>: <workbook test title>', async () => {
    allureReporter.addStory('<short Allure story name>');
    allureReporter.addSeverity('<blocker|critical|normal|minor>');
    <optional: const values from fixtures, never a credential literal>
    <start-state method: await startService.<openSomething>();>
    <page flow / action / verify... method calls for the workbook steps and the expected result>
    recordActualResult('<screen and observed value shown on the connected device>');
});
```

It goes inside the story spec's one `describe('<StoryId> <story name>', () => { ... })` **chosen by the row's Priority**: P0 → the smoke spec `src/tests/smoke/<WorkbookName>/<StoryId>.test.ts` (`../references/p0-smoke.md`, section 2); P1/P2 → the regression spec `src/tests/regression/<WorkbookFolder>/<StoryLabel>. <Story title>.test.ts` (`../references/regression-layout.md`). Never both. Page objects are created once at the top of the spec through the factory in `src/pages/index.ts` (`const loginPage = createLoginPage();`), never with `new`; their locators are lazy, so this is safe before the session starts. The top of the spec holds only imports and these page constants.

## Filled example

The spec:

```ts
it('TC_US001_001: Verify valid credentials open the home screen', async () => {
    allureReporter.addStory('Valid authentication');
    allureReporter.addSeverity('blocker');
    const user = fixtures.user('activeCustomer');
    await startService.openCustomerIdLogin();
    await loginPage.loginWithCustomerId(user.username, user.password ?? '');
    await homePage.verifyVisible();
    recordActualResult('Valid credentials opened the home screen on the connected device.');
});
```

The page flow method it calls (in `src/pages/common/LoginPage.ts`):

```ts
/** Customer ID login: enter both fields and tap Login. */
async loginWithCustomerId(customerId: string, password: string): Promise<void> {
    this.logger.info(`Customer ID login started for "${maskValue(customerId)}"`);
    try {
        await this.enterCustomerId(customerId);
        await this.enterPassword(password);
        await this.tapLogin();
        this.logger.info('Customer ID login submitted');
    } catch (error) {
        this.logger.error(`Customer ID login failed for "${maskValue(customerId)}": ${describeError(error)}`);
        throw error;
    }
}
```

## Placeholder rules

- The title is the exact workbook ID, a colon, a space and the workbook title. The run scripts select the test by `<ID>:` and the framework reads the ID with `testCaseIdOf(title)`; the rest is the human-readable name in terminal and report output.
- One `it()` maps to exactly one ID, and one ID to exactly one `it()`.
- The test body never branches on the platform; platform differences live in the page objects.
- **The spec only calls methods.** Start states come from the start service; steps use page flow methods or small action methods; the expected result uses `verify...` methods. No locator, `$()`, `browser.pause()`, bare `expect(...)`, `expectTrue(...)`, logger or spec-level function in a spec. A step or check that has no method yet gets one first: in the page object (`page-object-template.md`) or, for a start state, in the start service. When a testcase runs three or more steps on one screen, add a flow method for them instead of listing the small methods in the spec.
- Each `verify...` method polls with an explicit bounded wait (`expectDisplayed`, `expectText`, `expectAttribute`, `expectEnabled` in `BasePage`). Where a boolean is clearer (launch checks, a state read inside a flow), `expectTrue(await this.isShown(SCREEN_WAIT), '<message>')` from `src/assertions/mobile.assertions.ts` is used **inside the page or service method**, never in the spec. Never assert on a value read once right after an action. An absence check comes only after a positive anchor. See `../references/typescript-wdio-standards.md`, "Every expected check waits".
- The successful-result text names the screen and the observed value, because it becomes the start of the Automation Remark in the workbook. `recordActualResult` is in `src/reporting/ResultNotes.ts` (`typescript-wdio-standards.md`, "Using what the project already has").
- Test data comes from `fixtures` (users reference environment variables); never put a credential in a spec. Private QA values of one machine go in the Git-ignored `test-data.local.json`, which overrides single fields of the shared data. Only a testcase that needs it calls `resolveTestValue({ testCaseId, title, field, specFile })` for one named field: the workbook Test Data cell when it holds exactly one explicitly mapped value, a seeded Faker value only when that cell is blank, `BlockedError` for an ambiguous cell (`../../automation-setup/references/test-data-sources.md`). New users, messages and values go where the framework's `test-data.service.ts` reads them: with Mobile + Web, `Automation/shared-contract/test-data/<env>.json` (`common`, or `overrides.android` / `overrides.ios` for platform differences and for per-platform accounts of data-changing tests); with Mobile only, `src/data/test-data.json`.
- A state the device cannot show at run time throws `new BlockedError('<exact reason>')` (`src/reporting/BlockedError.ts`); never turn it into a Fail or a Pass.
- **P0 tests are written in the smoke spec, and only there.** A P0 `it()` in a regression spec, or a P1/P2 `it()` in a smoke spec, is reported `MISPLACED` by `smoke:check`. `npm run smoke:generate` writes only the manifest; it never copies or generates tests.
