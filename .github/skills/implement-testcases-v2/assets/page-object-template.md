# Page Object Template

Base for every new page object and for every method added to an existing one. Page objects live in `src/pages/common/<Screen>Page.ts` (platform variants in `src/pages/android/` and `src/pages/ios/` extend the common page) and extend `BasePage` from `src/pages/common/BasePage.ts`. Add `BasePage` support from `automation-setup` first when the project lacks `ElementLocator`, the `by...` builders, `this.logger`, `tap`/`type` with a description, or the `expect...` helpers.

## Rules

1. **Locators in the constructor.** Declare each element as a `readonly ...: ElementLocator` field and assign it in the constructor with a `this.by...()` builder. Locators are lazy (`() => $(...)`): nothing is looked up until a method calls them, so pages can be created at the top of a spec, before the session exists.
2. **Locator priority.** Take the first builder that matches a unique element in the device dump:

   | Priority | Builder | Playwright equivalent | Android | iOS |
   | --- | --- | --- | --- | --- |
   | 1 | `this.byRole(role, name)` | `getByRole` | element class + `content-desc` | element type + label/name |
   | 2 | `this.byId(id)` | `getById` / `getByTestId` | `resource-id` (Flutter `Semantics(identifier:)`) | accessibility identifier |
   | 3 | `this.byLabel(label)` | `getByLabel` | `content-desc` (`~label`) | accessibility label (`~label`) |
   | 4 | `this.byText(text)` | `getByText` | `text` | label / value |
   | 5 | `this.byXPath(xpath)` | `locator('xpath=...')` | last resort | last resort |

   Inside a web view context (SDK pages), use `this.byAria(name)` then `this.byCss('#id')` before XPath. Every XPath gets a handoff Note saying why nothing above matched.
3. **One small method per action.** `enterUsername`, `enterPassword`, `tapLogin`, `tapSignUpNow`, `swipeToNextSlide`: one user action each, named for the action, built on `this.tap` / `this.type` / `GestureUtils`.
4. **Flow methods combine the small ones.** When several actions always run together on one screen (`login` = enter username + enter password + tap Login), add a flow method that calls the small methods. A flow across several screens goes in the page where it starts, calling the other pages' methods, or in the start service (`src/services/start.service.ts`) when it brings the app to a start state; never in a helper function in the spec. Each testcase's own sequence of steps and checks on one screen is a flow method too (for example `verifyLoginActivatesAfterCustomerIdThenPassword(customerId, password)`), so the spec is a list of method calls and every step logs (`testcase-method-template.md`, "The test file only calls methods"). Specs call flow methods and small methods; they never call `$()` or a locator directly, and they hold no logger and no functions.
5. **`verify...` methods check what the device shows.** Built on the `BasePage` polling helpers (`expectDisplayed`, `expectText`, `expectAttribute`, `expectEnabled`), which always pass an explicit wait (`SCREEN_WAIT` 15 s, `STATE_WAIT` 15 s, `BACKEND_WAIT` 20 s). Never a bare `expect(...)` without `wait`, and never a shorter wait than the budget (no `timeout: 3000`). Absence (`expectAbsent`) is checked once, only after a positive anchor on the same screen was verified in the same method. Use `isShown(ms)` / `isDisplayedWithin` (boolean) for launch checks and for branching inside a flow.
5a. **Step screenshots come from the descriptions.** `tap` captures the screen before a submission and `expectDisplayed` captures a popup or message once shown, decided by the description (`SUBMIT_ACTION`, `POPUP` in `BasePage`). So name the control and the popup plainly: `'the Login button'`, `'the Save button'`, `'the "Login Failed" message'`, `'the OTP dialog'`. A submission or popup the page handles another way (a popup's text read with `getAttribute`, a submit by keyboard action) calls `this.captureScreen('<what is shown>')` itself. Never add a screenshot to a spec.
6. **Log and rethrow, in every method.** Every method you write or change, public and `protected` alike (actions, flows, `verify...` methods, helpers, platform-page overrides, readers such as `getMessageText`): `this.logger.info('<what starts>')` → body in `try` → `this.logger.info('<what finished>')`; `catch` → `this.logger.error('<what failed>: ' + describeError(error))` → `throw error`. Never swallow an error.
7. **Never log secrets or raw identifiers.** Passwords, OTPs and PINs go through `this.type(..., true)` (hidden and registered with the Redactor). Customer IDs, mobile numbers and user names are logged with `maskValue(value)` (`ab***yz`).
8. **Descriptions** name the element the way a tester would: `'the Login button'`, `'the Password field'`. They appear in logs and failure messages, which become the workbook's Automation Remark.
9. **One page per screen, in `common` / `android` / `ios`.** One page object per app screen (`OnboardingPage`, `LoginPage`, `ForgotPasswordPage`, `SignUpPage`, `LogoutPage`, ...), created when a row that touches that screen is automated and the screen has been dumped; never an empty page. The page in `src/pages/common/<Screen>Page.ts` holds the locators that are the same on both platforms (`byRole`, `byLabel`, `byText` on shared labels) and **every** action, flow and `verify...` method. Anything platform-specific (an XPath with `android.widget.*` / `XCUIElementType*` classes, an Android `resource-id`, TalkBack wording such as "Tab 1 of 2", hardware Back) goes in `src/pages/android/<Screen>Page.ts` (`Android<Screen>Page`) or `src/pages/ios/<Screen>Page.ts` (`IOS<Screen>Page`), which extends the common page: the common page declares those locators `abstract readonly` (and platform actions as `abstract` methods, for example `close()`), the platform page assigns them in its constructor. A screen with no platform-specific locator stays a plain common page. Specs never `new` a page: they call the factory in `src/pages/index.ts` (`createLoginPage()`), which picks the platform page from `PLATFORM` in `config/env.ts`; add a `create<Screen>Page()` there for every new page.
10. **Never use `private`.** Helper methods and fields that specs must not call are `protected` (so the platform pages can use and override them); everything a spec calls is public. Never use the `private` keyword, a `private` constructor parameter or a `#private` field or method, in `src/pages/` or anywhere else in the framework (`npm run lint` fails on it).
11. **Only exceptions to rule 6:** a constructor that only assigns locators, an `abstract` declaration (no body), and inline callbacks (`() => $(...)`, `waitUntil(() => ...)`), which the enclosing method logs for. A helper called many times per test may log at `debug` instead of `info`.

## Template

```ts
import { describeError } from '../../utils/Logger';
import { maskValue } from '../../utils/Redactor';
import { BACKEND_WAIT } from '../../constants/timeouts';
import { BasePage, type ElementLocator } from './BasePage';

export class <Screen>Page extends BasePage {
    protected readonly anchor: ElementLocator;
    readonly <element>: ElementLocator;

    constructor() {
        super();
        this.<element> = this.byRole('<role>', '<accessible name from the dump>');
        this.anchor = this.<element that proves the screen is shown>;
    }

    // ---- small action methods ----
    async <action>(<args>): Promise<void> {
        this.logger.info('<action starts>');
        try {
            await this.tap(this.<element>, 'the <element description>');
            this.logger.info('<action finished>');
        } catch (error) {
            this.logger.error(`<action> failed: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- flow methods ----
    async <flow>(<args>): Promise<void> { /* calls the small methods above, same logging shape */ }

    // ---- verify methods ----
    async verify<State>(): Promise<void> {
        this.logger.info('Verifying <state>');
        try {
            await this.expectDisplayed(this.<element>, 'the <element description>');
            this.logger.info('<state> verified');
        } catch (error) {
            this.logger.error(`<state> verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- protected helpers (never private), same logging shape ----
    protected async <helper>(<args>): Promise<string> {
        this.logger.debug('<helper starts>');
        try {
            const value = await this.textOf(this.<element>, 'the <element description>');
            this.logger.debug(`<helper finished>: "${value}"`);
            return value;
        } catch (error) {
            this.logger.error(`<helper> failed: ${describeError(error)}`);
            throw error;
        }
    }
}
```

## Filled example

The locators are illustrative: real ones come from the device dump of each screen.

```ts
import { BACKEND_WAIT } from '../../constants/timeouts';
import { describeError } from '../../utils/Logger';
import { maskValue } from '../../utils/Redactor';
import { BasePage, type ElementLocator } from './BasePage';

export class LoginPage extends BasePage {
    protected readonly anchor: ElementLocator;
    readonly title: ElementLocator;
    readonly customerIdInput: ElementLocator;
    readonly passwordInput: ElementLocator;
    readonly loginButton: ElementLocator;
    readonly customerIdError: ElementLocator;
    readonly signUpNowLink: ElementLocator;

    constructor() {
        super();
        this.title = this.byRole('text', 'Login');
        this.customerIdInput = this.byId('customerIdField');
        this.passwordInput = this.byId('passwordField');
        this.loginButton = this.byRole('button', 'Login');
        this.customerIdError = this.byId('customerIdError');
        this.signUpNowLink = this.byLabel("Don't have an account? Sign up now");
        this.anchor = this.loginButton;
    }

    // ---- small action methods ----

    async enterCustomerId(customerId: string): Promise<void> {
        this.logger.info(`Entering Customer ID "${maskValue(customerId)}"`);
        try {
            await this.type(this.customerIdInput, customerId, 'the Customer ID field');
            this.logger.info('Customer ID entered');
        } catch (error) {
            this.logger.error(`Failed to enter the Customer ID: ${describeError(error)}`);
            throw error;
        }
    }

    async enterPassword(password: string): Promise<void> {
        this.logger.info('Entering the password');
        try {
            await this.type(this.passwordInput, password, 'the Password field', true);
            this.logger.info('Password entered');
        } catch (error) {
            this.logger.error(`Failed to enter the password: ${describeError(error)}`);
            throw error;
        }
    }

    async tapLogin(): Promise<void> {
        this.logger.info('Tapping Login');
        try {
            await this.tap(this.loginButton, 'the Login button');
            this.logger.info('Login tapped');
        } catch (error) {
            this.logger.error(`Failed to tap Login: ${describeError(error)}`);
            throw error;
        }
    }

    async tapSignUpNow(): Promise<void> {
        this.logger.info('Tapping "Sign up now"');
        try {
            await this.tap(this.signUpNowLink, 'the "Sign up now" link');
            this.logger.info('"Sign up now" tapped');
        } catch (error) {
            this.logger.error(`Failed to tap "Sign up now": ${describeError(error)}`);
            throw error;
        }
    }

    // ---- flow methods ----

    async login(customerId: string, password: string): Promise<void> {
        this.logger.info(`Login started for Customer ID "${maskValue(customerId)}"`);
        try {
            if (customerId) await this.enterCustomerId(customerId);
            if (password) await this.enterPassword(password);
            await this.tapLogin();
            this.logger.info('Login submitted');
        } catch (error) {
            this.logger.error(`Login failed for Customer ID "${maskValue(customerId)}": ${describeError(error)}`);
            throw error;
        }
    }

    // ---- verify methods ----

    async verifyVisible(): Promise<void> {
        this.logger.info('Verifying the Login screen');
        try {
            await this.expectDisplayed(this.title, 'the Login title');
            await this.expectDisplayed(this.customerIdInput, 'the Customer ID field');
            await this.expectDisplayed(this.passwordInput, 'the Password field');
            await this.expectDisplayed(this.loginButton, 'the Login button');
            this.logger.info('Login screen verified');
        } catch (error) {
            this.logger.error(`Login screen verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyPasswordMasked(): Promise<void> {
        this.logger.info('Verifying that the password is masked');
        try {
            await this.expectAttribute(this.passwordInput, 'password', 'true', 'the Password field');
            this.logger.info('Password is masked');
        } catch (error) {
            this.logger.error(`Password masking verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyCustomerIdError(message: string): Promise<void> {
        this.logger.info(`Verifying the Customer ID error "${message}"`);
        try {
            await this.expectDisplayed(this.customerIdError, 'the Customer ID error', BACKEND_WAIT);
            await this.expectText(this.customerIdError, message, 'the Customer ID error');
            this.logger.info('Customer ID error verified');
        } catch (error) {
            this.logger.error(`Customer ID error verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyNoCustomerIdError(): Promise<void> {
        this.logger.info('Verifying no Customer ID error is shown');
        try {
            await this.expectDisplayed(this.loginButton, 'the Login button'); // positive anchor first
            await this.expectAbsent(this.customerIdError, 'the Customer ID error');
            this.logger.info('No Customer ID error is shown');
        } catch (error) {
            this.logger.error(`A Customer ID error is shown: ${describeError(error)}`);
            throw error;
        }
    }
}
```

## Using it in the spec

```ts
import { createLoginPage } from '../../pages';
import { fixtures } from '../../fixtures/test-data.fixture';
import { recordActualResult } from '../../reporting/ResultNotes';

const loginPage = createLoginPage(); // AndroidLoginPage or IOSLoginPage, chosen by PLATFORM

describe('US002 Login - Customer ID & Password', () => {
    it('TC_US002_004: Verify an error is shown for an unregistered Customer ID', async () => {
        const user = fixtures.user('unregisteredCustomer');
        await loginPage.verifyVisible();
        await loginPage.login(user.username, user.password ?? '');
        await loginPage.verifyCustomerIdError('<exact message from the workbook>');
        recordActualResult('Login screen showed the Customer ID error "<message>" for an unregistered Customer ID.');
    });
});
```

The spec reads as the workbook steps: flow and action methods for the steps, `verify...` methods for the expected result, then `recordActualResult`. No locator, `$()`, `browser.pause` or `expect(...)` in the spec.
