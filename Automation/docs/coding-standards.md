# Coding Standards

## Method rules (all framework code)

1. **Never use the `private` keyword.** No `private` methods, fields or constructor parameter properties, and no `#private` members. Use `protected` (subclasses such as platform pages can reuse/override) or public. A module helper that should stay internal is simply not exported. Enforced by `eslint.config.js` (`no-restricted-syntax`): `npm run lint` fails on any `private`.
2. **Every method logs.** Start, then the body in `try`, then what finished; in `catch` log `describeError(error)` and rethrow. Never swallow an error or return a default instead.
3. **Specs only call methods.** A `*.test.ts` file (regression or smoke) holds imports, page constants and `it()` blocks only: no logger, no functions, no `try`/`catch`, no `expectTrue`. Each testcase step is a page-object flow / action / `verify...` method or a `startService` method, and those methods log `started` / `finished` / `failed: <reason>`, so the terminal and the Jenkins console show every step. Placement follows the workbook Priority: P0 tests are written only in `src/tests/smoke/<WorkbookName>/<StoryId>.test.ts`, P1/P2 tests only in `src/tests/regression/<WorkbookFolder>/`; `npm run smoke:check` reports anything else as `MISPLACED`.

```ts
async enterPassword(password: string): Promise<void> {
    this.logger.info('Entering the password');
    try {
        await this.type(this.passwordField, password, 'the Password field', true);
        this.logger.info('Password entered');
    } catch (error) {
        this.logger.error(`Failed to enter the password: ${describeError(error)}`);
        throw error;
    }
}
```

- Classes: `protected readonly logger = logger.child({ page|service|component: this.constructor.name })`. Module functions: `const log = logger.child({ module: '<FileName>' })`. Plain-Node scripts (`scripts/**/*.mjs`): `log.child('<name>')` from `scripts/lib/log.mjs`.
- Levels: actions, flows, `verify...`, services, hooks at `info`; small helpers that run many times (locator builders, CSV quoting, `testCaseIdOf`) at `debug`.
- Never log passwords, OTPs, PINs or tokens; identifiers go through `maskValue(...)`. `type(..., secret = true)` registers the value with the Redactor.
- Exceptions (with a one-line comment where they apply): the bodies of `src/utils/Logger.ts`, `src/utils/Redactor.ts`, `src/utils/TestState.ts` and `scripts/lib/log.mjs` (the logger calls them); constructors that only assign fields and locators; abstract and type-only declarations; inline callbacks (`waitUntil(() => ...)`, `.map(...)`, locator lambdas); tiny pure formatting helpers inside the report/workbook tooling that run once per cell or per row (`norm`, `labelOf`, `esc`, `crc32`), whose callers log.

## Page objects

- Locators are assigned in the constructor with the `BasePage` builders, in priority order: `byRole` → `byId` → `byLabel` → `byText` → `byXPath` (last; every XPath gets a handoff note). Web views: `byAria`, `byCss`.
- Actions take a human description naming the control: `tap(this.loginButton, 'the Login button')`. Submission taps (`SUBMIT_ACTION`) and popups/messages (`POPUP`) get a step screenshot automatically.
- `verify...` methods use the polling checks: `expectDisplayed`, `expectText`, `expectAttribute`, `expectEnabled`, `expectAbsent` (after a positive anchor), `isShown` / `isDisplayedWithin`.
- No fixed sleeps. Waits are bounded and polling (`constants/timeouts.ts`: 15 s standard, 20 s back-end).
- Platform differences live in `src/pages/android` / `src/pages/ios`; tests never branch on the platform.

## Specs

- One `it('<TC_ID>: <exact workbook title>')` per testcase; the `it()` calls page methods only.
- `BlockedError(reason)` when the expected result cannot be proven.
- Credentials only from the environment (`fixtures.user(key)`), never in source.

## Formatting

Prettier (`.prettierrc`: 4 spaces, single quotes, width 140). `npm run format` / `npm run format:check`.
