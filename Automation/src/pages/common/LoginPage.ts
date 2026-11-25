// Login screen (first-time / switched account): Customer ID and Mobile No. tabs.
// Locators verified in evidence/android/Login/ (customer-id-tab-default, mobile-tab-default, fields-filled-login-enabled).
import { expectTrue } from '../../assertions/mobile.assertions';
import { SCREEN_WAIT, STATE_WAIT, TIMEOUTS } from '../../constants/timeouts';
import { describeError } from '../../utils/Logger';
import { maskValue } from '../../utils/Redactor';
import { BasePage, type ElementLocator } from './BasePage';

/** The two login views: Customer ID/Trade Code + Password, or Mobile number + Password. */
export type LoginField = 'customerId' | 'mobileNumber';

// Values from the requirement (workbook), not account data.
export const CUSTOMER_ID_PLACEHOLDER = 'Eg: AAN268';
export const MOBILE_NUMBER_PLACEHOLDER = 'Eg: 9000000000';
export const PASSWORD_PLACEHOLDER = 'Enter Password';
export const MOBILE_NUMBER_ERROR = 'Please enter a valid 10-digit mobile number.';
export const PASSWORD_MIN_LENGTH = 8;
export const CUSTOMER_ID_MIN_LENGTH = 6;
const INVALID_SHORT_MOBILE = '51234';

export abstract class LoginPage extends BasePage {
    readonly welcomeBack: ElementLocator;
    readonly customerIdLabel: ElementLocator;
    readonly mobileNumberLabel: ElementLocator;
    readonly countryCode: ElementLocator;
    readonly passwordLabel: ElementLocator;
    readonly showPasswordToggle: ElementLocator;
    readonly hidePasswordToggle: ElementLocator;
    readonly mobileNumberError: ElementLocator;
    readonly mobileNumberErrorExact: ElementLocator;
    readonly forgotIdOrPasswordLink: ElementLocator;
    readonly loginButton: ElementLocator;
    readonly noAccountText: ElementLocator;
    readonly signUpNowLink: ElementLocator;
    /** Bottom sheet the back end returns when it cannot log in ("Login Failed" + "Something went wrong..."). */
    readonly loginFailedSheet: ElementLocator;
    /** "OTP" label of the failed-attempt recovery view (shown after 3 failed logins; the account locks at 5). */
    readonly otpLabel: ElementLocator;
    // Platform-specific (TalkBack tab wording, EditText class): assigned in src/pages/android|ios/LoginPage.ts
    abstract readonly customerIdTab: ElementLocator;
    abstract readonly mobileNoTab: ElementLocator;
    abstract readonly customerIdInput: ElementLocator;
    abstract readonly mobileNumberInput: ElementLocator;
    abstract readonly passwordInput: ElementLocator;

    constructor() {
        super();
        this.welcomeBack = this.byLabel('Welcome back!');
        this.customerIdLabel = this.byLabel('Customer ID/Trade Code');
        this.mobileNumberLabel = this.byLabel('Mobile number');
        this.countryCode = this.byRole('image', '+91');
        this.passwordLabel = this.byLabel('Password');
        this.showPasswordToggle = this.byRole('button', 'Show password');
        this.hidePasswordToggle = this.byRole('button', 'Hide password');
        // The app's wording differs from the workbook (device 2026-11-24: "Enter a valid 10-digit mobile number."), so the
        // boundary checks match the shared phrase and the text check (TC_US003_007) the workbook's exact text.
        this.mobileNumberError = this.byXPath('//*[contains(@content-desc, "valid 10-digit mobile number")]');
        this.mobileNumberErrorExact = this.byLabel(MOBILE_NUMBER_ERROR);
        this.forgotIdOrPasswordLink = this.byRole('button', 'Forgot ID or Password?');
        this.loginButton = this.byRole('button', 'Login');
        this.noAccountText = this.byLabel("Don't have an account?");
        this.signUpNowLink = this.byRole('button', 'Sign up now');
        this.otpLabel = this.byLabel('OTP');
        this.loginFailedSheet = this.byXPath('//*[contains(@content-desc, "Login Failed") or contains(@text, "Login Failed")]');
    }

    protected anchor(): ElementLocator {
        return this.customerIdLabel;
    }

    // ---- small action methods ----

    async tapMobileNoTab(): Promise<void> {
        this.logger.info('Tapping the Mobile No. tab');
        try {
            await this.tap(this.mobileNoTab, 'the Mobile No. tab');
            this.logger.info('Mobile No. tab tapped');
        } catch (error) {
            this.logger.error(`Failed to tap the Mobile No. tab: ${describeError(error)}`);
            throw error;
        }
    }

    async tapCustomerIdTab(): Promise<void> {
        this.logger.info('Tapping the Customer ID tab');
        try {
            await this.tap(this.customerIdTab, 'the Customer ID tab');
            this.logger.info('Customer ID tab tapped');
        } catch (error) {
            this.logger.error(`Failed to tap the Customer ID tab: ${describeError(error)}`);
            throw error;
        }
    }

    async enterCustomerId(customerId: string): Promise<void> {
        this.logger.info(`Entering Customer ID "${maskValue(customerId)}"`);
        try {
            await this.type(this.customerIdInput, customerId, 'the Customer ID/Trade Code field');
            this.logger.info('Customer ID entered');
        } catch (error) {
            this.logger.error(`Failed to enter the Customer ID: ${describeError(error)}`);
            throw error;
        }
    }

    async enterMobileNumber(mobileNumber: string): Promise<void> {
        this.logger.info(`Entering mobile number "${maskValue(mobileNumber)}"`);
        try {
            await this.type(this.mobileNumberInput, mobileNumber, 'the Mobile number field');
            this.logger.info('Mobile number entered');
        } catch (error) {
            this.logger.error(`Failed to enter the mobile number: ${describeError(error)}`);
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
            await this.hideKeyboard();
            await this.tap(this.loginButton, 'the Login button');
            this.logger.info('Login tapped');
        } catch (error) {
            this.logger.error(`Failed to tap Login: ${describeError(error)}`);
            throw error;
        }
    }

    async tapForgotIdOrPassword(): Promise<void> {
        this.logger.info('Tapping "Forgot ID or Password?"');
        try {
            await this.tap(this.forgotIdOrPasswordLink, 'the "Forgot ID or Password?" link');
            this.logger.info('"Forgot ID or Password?" tapped');
        } catch (error) {
            this.logger.error(`Failed to tap "Forgot ID or Password?": ${describeError(error)}`);
            throw error;
        }
    }

    // ---- flow methods ----

    /**
     * Customer ID login: enter both fields, confirm both hold the typed values, then tap Login. Flutter can drop text
     * typed straight after the previous field, so an empty Password is typed once more; Login is never tapped with a
     * field that does not hold its value (no partial submission, no failed-attempt count).
     */
    async loginWithCustomerId(customerId: string, password: string): Promise<void> {
        this.logger.info(`Customer ID login started for "${maskValue(customerId)}"`);
        try {
            await this.enterCustomerId(customerId);
            await this.verifyCustomerIdValue(customerId);
            // Type, close the keyboard, then confirm the form exactly as Login will see it. Closing the keyboard can cost the
            // Flutter password field its text, so the form is checked AFTER the keyboard is closed and typed again once.
            for (let attempt = 1; attempt <= 2; attempt += 1) {
                if (attempt === 1) await this.enterPassword(password);
                else {
                    // Second attempt with real key presses: the first typing reached only the accessibility layer.
                    await this.typeWithKeys(this.customerIdInput, customerId, 'the Customer ID/Trade Code field');
                    await this.typeWithKeys(this.passwordInput, password, 'the Password field', true);
                }
                await this.hideKeyboard();
                const customerIdOk = ((await this.customerIdInput().getText()) ?? '') === customerId;
                const typed = ((await this.passwordInput().getText()) ?? '').length;
                // Right after a logout the app can rebuild the login screen and clear the form a moment later, so Login
                // must also be enabled (both fields really filled) before it is tapped.
                const enabled =
                    customerIdOk &&
                    typed === password.length &&
                    (await this.loginButton()
                        .waitForEnabled({ timeout: 3000, interval: 500 })
                        .then(() => true)
                        .catch(() => false));
                if (enabled) break;
                if (attempt === 2)
                    throw new Error(
                        `The login form did not keep its values (Customer ID kept: ${customerIdOk}, Password ${typed} of ${password.length} character(s), Login enabled: ${enabled}); Login was not tapped`,
                    );
                this.logger.warn(
                    `Login form not ready (Customer ID kept ${customerIdOk}, Password ${typed} of ${password.length} character(s), Login enabled ${enabled}): typing both fields again with key presses`,
                );
            }
            await this.verifyCustomerIdValue(customerId);
            await this.verifyPasswordLength(password.length);
            await this.verifyLoginEnabled();
            await this.tapLogin();
            this.logger.info('Customer ID login submitted');
        } catch (error) {
            this.logger.error(`Customer ID login failed for "${maskValue(customerId)}": ${describeError(error)}`);
            throw error;
        }
    }

    /** Taps the Mobile No. tab and verifies it is selected and the mobile number login view is shown. */
    async switchToMobileNoTabAndVerify(): Promise<void> {
        this.logger.info('Switching to the Mobile No. tab and verifying the mobile number view');
        try {
            await this.tapMobileNoTab();
            await this.verifyMobileNoTabSelected();
            await this.verifyMobileNumberView();
            this.logger.info('Mobile No. tab selected; mobile number view shown');
        } catch (error) {
            this.logger.error(`Switching to the Mobile No. tab failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Verifies the Customer ID tab is selected by default, then switches to the Mobile No. tab. */
    async verifyCustomerIdDefaultThenSwitchToMobileNo(): Promise<void> {
        this.logger.info('Verifying the Customer ID tab is the default, then switching to Mobile No.');
        try {
            await this.verifyCustomerIdTabSelected();
            await this.verifyCustomerIdView();
            await this.switchToMobileNoTabAndVerify();
            this.logger.info('Customer ID tab was the default; Mobile No. view shown after switching');
        } catch (error) {
            this.logger.error(`Customer ID default / Mobile No. switch check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Login stays inactive while empty and with only the Customer ID, and becomes active when both fields hold values. */
    async verifyLoginActivatesAfterCustomerIdThenPassword(customerId: string, password: string): Promise<void> {
        this.logger.info(`Verifying Login activation: Customer ID "${maskValue(customerId)}" first, then the password`);
        try {
            await this.verifyLoginDisabled();
            await this.enterCustomerId(customerId);
            await this.verifyCustomerIdValue(customerId);
            await this.verifyLoginDisabled();
            await this.enterPassword(password);
            await this.verifyPasswordLength(password.length);
            await this.verifyLoginEnabled();
            this.logger.info('Login was inactive until both fields held values, then active (nothing submitted)');
        } catch (error) {
            this.logger.error(`Login activation check (Customer ID first) failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Login stays inactive with only the password, and becomes active once the Customer ID is filled too. */
    async verifyLoginActivatesAfterPasswordThenCustomerId(password: string, customerId: string): Promise<void> {
        this.logger.info(`Verifying Login activation: password first, then Customer ID "${maskValue(customerId)}"`);
        try {
            await this.verifyLoginDisabled();
            await this.enterPassword(password);
            await this.verifyPasswordLength(password.length);
            await this.verifyLoginDisabled();
            await this.enterCustomerId(customerId);
            await this.verifyCustomerIdValue(customerId);
            await this.verifyLoginEnabled();
            this.logger.info('Login was inactive with only the password, then active with both fields (nothing submitted)');
        } catch (error) {
            this.logger.error(`Login activation check (password first) failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Mobile number view: Login inactive while empty and with only the mobile number, active once both fields hold values. */
    async verifyLoginActivatesAfterMobileThenPassword(mobileNumber: string, password: string): Promise<void> {
        this.logger.info(`Verifying Login activation: mobile number "${maskValue(mobileNumber)}" first, then the password`);
        try {
            await this.verifyLoginDisabled();
            await this.enterMobileNumber(mobileNumber);
            await this.verifyMobileNumberValue(mobileNumber);
            await this.verifyLoginDisabled();
            await this.enterPassword(password);
            await this.verifyPasswordLength(password.length);
            await this.verifyLoginEnabled();
            this.logger.info('Login was inactive until both mobile fields held values, then active (nothing submitted)');
        } catch (error) {
            this.logger.error(`Login activation check (mobile number first) failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Mobile number view: Login inactive with only the password, active once the mobile number is filled too. */
    async verifyLoginActivatesAfterPasswordThenMobile(password: string, mobileNumber: string): Promise<void> {
        this.logger.info(`Verifying Login activation: password first, then mobile number "${maskValue(mobileNumber)}"`);
        try {
            await this.enterPassword(password);
            await this.verifyPasswordLength(password.length);
            await this.verifyLoginDisabled();
            await this.enterMobileNumber(mobileNumber);
            await this.verifyMobileNumberValue(mobileNumber);
            await this.verifyLoginEnabled();
            this.logger.info('Login was inactive with only the password, then active with the mobile number (nothing submitted)');
        } catch (error) {
            this.logger.error(`Login activation check (password first, mobile view) failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The mobile number view shows +91, the fields, the masked password and the common links and buttons. */
    async verifyMobileNumberViewContent(): Promise<void> {
        this.logger.info('Verifying the full content of the mobile number login view');
        try {
            await this.verifyCountryCodeSelector();
            await this.verifyMobileNumberView();
            await this.verifyPasswordMasked();
            await this.verifyCommonControls();
            this.logger.info('Mobile number login view content verified');
        } catch (error) {
            this.logger.error(`Mobile number login view content check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** After returning from an in-app web page, the FundsGenie Customer ID login screen is shown again. */
    async verifyShownAfterReturningFromWebPage(): Promise<void> {
        this.logger.info('Verifying the login screen is shown after returning from the web page');
        try {
            await this.verifyCustomerIdView();
            expectTrue(
                await this.isShown(TIMEOUTS.standard),
                'The FundsGenie login screen was not shown after returning from the web page.',
            );
            this.logger.info('Login screen shown after returning from the web page');
        } catch (error) {
            this.logger.error(`Login screen check after returning from the web page failed: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- verify methods ----

    /** The Customer ID login view is shown (label, field, password, Login). */
    async verifyCustomerIdView(): Promise<void> {
        this.logger.info('Verifying the Customer ID login view');
        try {
            await this.expectDisplayed(this.customerIdLabel, 'the "Customer ID/Trade Code" label', SCREEN_WAIT);
            await this.expectDisplayed(this.customerIdInput, 'the Customer ID/Trade Code field');
            await this.expectDisplayed(this.passwordInput, 'the Password field');
            await this.expectDisplayed(this.loginButton, 'the Login button');
            this.logger.info('Customer ID login view verified');
        } catch (error) {
            this.logger.error(`Customer ID login view verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The Mobile number login view is shown (label, +91, field, password, Login). */
    async verifyMobileNumberView(): Promise<void> {
        this.logger.info('Verifying the mobile number login view');
        try {
            await this.expectDisplayed(this.mobileNumberLabel, 'the "Mobile number" label', SCREEN_WAIT);
            await this.expectDisplayed(this.mobileNumberInput, 'the Mobile number field');
            await this.expectDisplayed(this.passwordInput, 'the Password field');
            await this.expectDisplayed(this.loginButton, 'the Login button');
            this.logger.info('Mobile number login view verified');
        } catch (error) {
            this.logger.error(`Mobile number login view verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyCustomerIdTabSelected(): Promise<void> {
        this.logger.info('Verifying the Customer ID tab is selected');
        try {
            await this.expectAttribute(this.customerIdTab, 'selected', 'true', 'the Customer ID tab', STATE_WAIT);
            await this.expectAttribute(this.mobileNoTab, 'selected', 'false', 'the Mobile No. tab', STATE_WAIT);
            this.logger.info('Customer ID tab is selected');
        } catch (error) {
            this.logger.error(`Customer ID tab selection check failed: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyMobileNoTabSelected(): Promise<void> {
        this.logger.info('Verifying the Mobile No. tab is selected');
        try {
            await this.expectAttribute(this.mobileNoTab, 'selected', 'true', 'the Mobile No. tab', STATE_WAIT);
            await this.expectAttribute(this.customerIdTab, 'selected', 'false', 'the Customer ID tab', STATE_WAIT);
            this.logger.info('Mobile No. tab is selected');
        } catch (error) {
            this.logger.error(`Mobile No. tab selection check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** +91 country code selector (the flag is drawn inside the same "+91" image node on Android). */
    async verifyCountryCodeSelector(): Promise<void> {
        this.logger.info('Verifying the +91 country code selector');
        try {
            await this.expectDisplayed(this.countryCode, 'the +91 country code selector');
            await this.expectAttribute(this.countryCode, 'content-desc', '+91', 'the country code selector');
            this.logger.info('+91 country code selector verified');
        } catch (error) {
            this.logger.error(`Country code selector verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Password field is masked (password attribute true). */
    async verifyPasswordMasked(): Promise<void> {
        this.logger.info('Verifying the Password field is masked');
        try {
            await this.expectAttribute(this.passwordInput, 'password', 'true', 'the Password field');
            this.logger.info('Password field is masked');
        } catch (error) {
            this.logger.error(`Password masking check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Show/hide toggle, Forgot link, Login button and the "Sign up now" footer are shown. */
    async verifyCommonControls(): Promise<void> {
        this.logger.info('Verifying the shared login controls');
        try {
            await this.expectDisplayed(this.showPasswordToggle, 'the show/hide password toggle');
            await this.expectDisplayed(this.forgotIdOrPasswordLink, 'the "Forgot ID or Password?" link');
            await this.expectDisplayed(this.loginButton, 'the Login button');
            await this.expectDisplayed(this.noAccountText, 'the "Don\'t have an account?" text');
            await this.expectDisplayed(this.signUpNowLink, 'the "Sign up now" link');
            this.logger.info('Shared login controls verified');
        } catch (error) {
            this.logger.error(`Shared login controls verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Login stays inactive: read after the anchor (typed value confirmed, or the empty form shown). */
    async verifyLoginDisabled(): Promise<void> {
        this.logger.info('Verifying the Login button is inactive');
        try {
            await this.expectAttribute(this.loginButton, 'enabled', 'false', 'the Login button', STATE_WAIT);
            this.logger.info('Login button is inactive');
        } catch (error) {
            this.logger.error(`Login inactive check failed: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyLoginEnabled(): Promise<void> {
        this.logger.info('Verifying the Login button is enabled');
        try {
            await this.expectEnabled(this.loginButton, 'the Login button', STATE_WAIT);
            this.logger.info('Login button is enabled');
        } catch (error) {
            this.logger.error(`Login enabled check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Anchor for "stays disabled" checks: the Customer ID field holds the typed value. */
    async verifyCustomerIdValue(customerId: string): Promise<void> {
        this.logger.info(`Verifying the Customer ID field holds "${maskValue(customerId)}"`);
        try {
            await this.expectText(this.customerIdInput, customerId, 'the Customer ID/Trade Code field', false, STATE_WAIT);
            this.logger.info('Customer ID value confirmed');
        } catch (error) {
            this.logger.error(`Customer ID value check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Anchor for "stays disabled" checks: the Mobile number field holds the typed value. */
    async verifyMobileNumberValue(mobileNumber: string): Promise<void> {
        this.logger.info(`Verifying the Mobile number field holds "${maskValue(mobileNumber)}"`);
        try {
            await this.expectText(this.mobileNumberInput, mobileNumber, 'the Mobile number field', false, STATE_WAIT);
            this.logger.info('Mobile number value confirmed');
        } catch (error) {
            this.logger.error(`Mobile number value check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Anchor for "stays disabled" checks: the masked Password field shows one bullet per typed character. */
    async verifyPasswordLength(length: number): Promise<void> {
        this.logger.info(`Verifying the Password field holds ${length} character(s)`);
        try {
            await driver.waitUntil(async () => ((await this.passwordInput().getText()) ?? '').length === length, {
                timeout: STATE_WAIT,
                interval: 500,
                timeoutMsg: `the Password field did not hold ${length} character(s) within ${STATE_WAIT / 1000} s`,
            });
            this.logger.info('Password length confirmed');
        } catch (error) {
            this.logger.error(`Password length check failed: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- P1/P2 login-screen methods (field rules observed on the device 2026-11-24, nothing is submitted) ----

    /** The identifier field of a login view: Customer ID/Trade Code or Mobile number. */
    identifierInput(field: LoginField): ElementLocator {
        this.logger.debug(`Identifier field locator for ${field}`);
        try {
            const locator = field === 'customerId' ? this.customerIdInput : this.mobileNumberInput;
            this.logger.debug('Identifier field locator resolved');
            return locator;
        } catch (error) {
            this.logger.error(`Failed to resolve the identifier field: ${describeError(error)}`);
            throw error;
        }
    }

    /** Types into the identifier field of the given view (Customer ID or Mobile number). */
    async enterIdentifier(field: LoginField, value: string): Promise<void> {
        this.logger.info(`Entering the ${field} identifier "${maskValue(value)}"`);
        try {
            if (field === 'customerId') await this.enterCustomerId(value);
            else await this.enterMobileNumber(value);
            this.logger.info(`${field} identifier entered`);
        } catch (error) {
            this.logger.error(`Failed to enter the ${field} identifier: ${describeError(error)}`);
            throw error;
        }
    }

    /** Clears the identifier field of the given view. */
    async clearIdentifier(field: LoginField): Promise<void> {
        this.logger.info(`Clearing the ${field} identifier field`);
        try {
            await this.clear(this.identifierInput(field), `the ${field} field`);
            this.logger.info(`${field} identifier field cleared`);
        } catch (error) {
            this.logger.error(`Failed to clear the ${field} identifier field: ${describeError(error)}`);
            throw error;
        }
    }

    /**
     * Resets the login screen the previous test left, without a relaunch: Mobile number and Customer ID fields cleared,
     * Password cleared and masked, Customer ID tab selected. Returns whether the screen is verifiably clean (both
     * fields empty, Password masked); false means the caller must relaunch instead.
     */
    async resetToCleanCustomerIdView(): Promise<boolean> {
        this.logger.info('Resetting the login screen in place (no relaunch)');
        try {
            await this.tapMobileNoTab();
            await this.clearIdentifier('mobileNumber');
            await this.tapCustomerIdTab();
            await this.clearIdentifier('customerId');
            await this.clearPassword();
            if (await this.isDisplayedWithin(this.hidePasswordToggle, 500, 'the Hide password button'))
                await this.tap(this.hidePasswordToggle, 'the Hide password button');
            const customerId = (await this.customerIdInput().getText()) ?? '';
            const password = (await this.passwordInput().getText()) ?? '';
            const masked = (await this.passwordInput().getAttribute('password')) === 'true';
            const clean = customerId === '' && password === '' && masked;
            this.logger.info(
                clean
                    ? 'Login screen reset in place: fields empty, Password masked, Customer ID tab selected'
                    : `Login screen not clean after reset (Customer ID empty: ${customerId === ''}, Password empty: ${password === ''}, masked: ${masked})`,
            );
            return clean;
        } catch (error) {
            this.logger.error(`Resetting the login screen in place failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Clears the Password field. */
    async clearPassword(): Promise<void> {
        this.logger.info('Clearing the Password field');
        try {
            await this.clear(this.passwordInput, 'the Password field');
            this.logger.info('Password field cleared');
        } catch (error) {
            this.logger.error(`Failed to clear the Password field: ${describeError(error)}`);
            throw error;
        }
    }

    /** "Welcome back!" is shown above the credential form. */
    async verifyWelcomeBackGreeting(): Promise<void> {
        this.logger.info('Verifying the "Welcome back!" greeting');
        try {
            await this.expectDisplayed(this.welcomeBack, 'the "Welcome back!" greeting', SCREEN_WAIT);
            await this.expectDisplayed(this.customerIdLabel, 'the Customer ID/Trade Code label below it');
            this.logger.info('"Welcome back!" greeting shown above the credential form');
        } catch (error) {
            this.logger.error(`"Welcome back!" greeting check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Customer ID is the selected tab when the login screen opens, with its fields shown. */
    async verifyCustomerIdTabIsDefault(): Promise<void> {
        this.logger.info('Verifying the Customer ID tab is the default');
        try {
            await this.verifyCustomerIdTabSelected();
            await this.verifyCustomerIdView();
            this.logger.info('Customer ID tab is selected by default with its fields');
        } catch (error) {
            this.logger.error(`Default Customer ID tab check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** From the mobile number view, taps the Customer ID tab and verifies the Customer ID view. */
    async switchToCustomerIdTabAndVerify(): Promise<void> {
        this.logger.info('Switching back to the Customer ID tab');
        try {
            await this.verifyMobileNoTabSelected();
            await this.tapCustomerIdTab();
            await this.verifyCustomerIdTabSelected();
            await this.verifyCustomerIdView();
            this.logger.info('Customer ID tab selected; Customer ID/Trade Code and Password fields shown');
        } catch (error) {
            this.logger.error(`Switching to the Customer ID tab failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The Mobile No. tab is shown and can be tapped. */
    async verifyMobileNoTabAvailable(): Promise<void> {
        this.logger.info('Verifying the Mobile No. tab is available');
        try {
            await this.expectDisplayed(this.mobileNoTab, 'the Mobile No. tab', SCREEN_WAIT);
            await this.expectAttribute(this.mobileNoTab, 'clickable', 'true', 'the Mobile No. tab');
            this.logger.info('Mobile No. tab shown and selectable');
        } catch (error) {
            this.logger.error(`Mobile No. tab availability check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The empty identifier field shows its example placeholder ("Eg: AAN268" / "Eg: 9000000000"). */
    async verifyIdentifierPlaceholder(field: LoginField): Promise<void> {
        const placeholder = field === 'customerId' ? CUSTOMER_ID_PLACEHOLDER : MOBILE_NUMBER_PLACEHOLDER;
        this.logger.info(`Verifying the ${field} placeholder "${placeholder}"`);
        try {
            await this.expectAttribute(this.identifierInput(field), 'hint', placeholder, `the empty ${field} field`);
            this.logger.info(`${field} field shows "${placeholder}"`);
        } catch (error) {
            this.logger.error(`${field} placeholder check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The show/hide password (eye) control is shown beside the Password field and can be tapped. */
    async verifyShowPasswordControl(): Promise<void> {
        this.logger.info('Verifying the show/hide password control');
        try {
            await this.expectDisplayed(this.showPasswordToggle, 'the show/hide password (eye) control', SCREEN_WAIT);
            await this.expectAttribute(this.showPasswordToggle, 'clickable', 'true', 'the show/hide password control');
            this.logger.info('Show/hide password control shown and tappable');
        } catch (error) {
            this.logger.error(`Show/hide password control check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** "Forgot ID or Password?" is shown and can be tapped. */
    async verifyForgotLinkAvailable(): Promise<void> {
        this.logger.info('Verifying the "Forgot ID or Password?" link is available');
        try {
            await this.expectDisplayed(this.forgotIdOrPasswordLink, 'the "Forgot ID or Password?" link', SCREEN_WAIT);
            await this.expectAttribute(this.forgotIdOrPasswordLink, 'clickable', 'true', 'the "Forgot ID or Password?" link');
            this.logger.info('"Forgot ID or Password?" link shown and tappable');
        } catch (error) {
            this.logger.error(`"Forgot ID or Password?" link check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** "Don't have an account? Sign up now" is shown and "Sign up now" can be tapped. */
    async verifySignUpLinkAvailable(): Promise<void> {
        this.logger.info('Verifying the "Don\'t have an account? Sign up now" link is available');
        try {
            await this.expectDisplayed(this.noAccountText, 'the "Don\'t have an account?" text', SCREEN_WAIT);
            await this.expectDisplayed(this.signUpNowLink, 'the "Sign up now" link');
            await this.expectAttribute(this.signUpNowLink, 'clickable', 'true', 'the "Sign up now" link');
            this.logger.info('"Don\'t have an account? Sign up now" shown and tappable');
        } catch (error) {
            this.logger.error(`"Sign up now" link check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The password is masked at first; each tap of the eye control alternates visible / masked. */
    async verifyPasswordVisibilityToggle(password: string): Promise<void> {
        this.logger.info('Verifying the password show/hide toggle');
        try {
            await this.enterPassword(password);
            await this.verifyPasswordMasked();
            await this.tap(this.showPasswordToggle, 'the show password (eye) control');
            await this.expectDisplayed(this.hidePasswordToggle, 'the hide password (eye) control', STATE_WAIT);
            await this.expectAttribute(this.passwordInput, 'password', 'false', 'the Password field (shown)');
            await this.tap(this.hidePasswordToggle, 'the hide password (eye) control');
            await this.expectDisplayed(this.showPasswordToggle, 'the show password (eye) control', STATE_WAIT);
            await this.verifyPasswordMasked();
            this.logger.info('Password masked, then visible, then masked again; the eye control label followed the state');
        } catch (error) {
            this.logger.error(`Password show/hide toggle check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Login stays inactive with the identifier filled and the Password field empty. */
    async verifyLoginDisabledWithEmptyPassword(field: LoginField, identifier: string): Promise<void> {
        this.logger.info(`Verifying Login stays inactive with an empty password (${field} view)`);
        try {
            await this.enterIdentifier(field, identifier);
            await this.expectText(this.identifierInput(field), identifier, `the ${field} field`, false, STATE_WAIT);
            await this.expectAttribute(this.passwordInput, 'hint', PASSWORD_PLACEHOLDER, 'the empty Password field');
            await this.verifyLoginDisabled();
            this.logger.info('Login stayed inactive while the Password field was empty (nothing submitted)');
        } catch (error) {
            this.logger.error(`Empty password check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Login stays inactive while either field is empty: identifier only, then password only. */
    async verifyLoginDisabledWhileEitherFieldEmpty(field: LoginField, identifier: string, password: string): Promise<void> {
        this.logger.info(`Verifying Login stays inactive while either field is empty (${field} view)`);
        try {
            await this.verifyLoginDisabled();
            await this.enterIdentifier(field, identifier);
            await this.verifyLoginDisabled();
            await this.clearIdentifier(field);
            await this.enterPassword(password);
            await this.verifyPasswordLength(password.length);
            await this.verifyLoginDisabled();
            this.logger.info('Login stayed inactive with only the identifier and with only the password (nothing submitted)');
        } catch (error) {
            this.logger.error(`Missing-credential Login state check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Password minimum 8: with a valid identifier, 7 characters keep Login inactive and 8 make it active. */
    async verifyPasswordMinimumLength(field: LoginField, identifier: string, password: string): Promise<void> {
        this.logger.info(`Verifying the 8-character password minimum (${field} view)`);
        try {
            if (password.length < PASSWORD_MIN_LENGTH)
                throw new Error(`The sample password must have at least ${PASSWORD_MIN_LENGTH} characters`);
            await this.enterIdentifier(field, identifier);
            await this.enterPassword(password.slice(0, PASSWORD_MIN_LENGTH - 1));
            await this.verifyPasswordLength(PASSWORD_MIN_LENGTH - 1);
            await this.verifyLoginDisabled();
            await this.clearPassword();
            await this.enterPassword(password.slice(0, PASSWORD_MIN_LENGTH));
            await this.verifyPasswordLength(PASSWORD_MIN_LENGTH);
            await this.verifyLoginEnabled();
            this.logger.info('7 password characters kept Login inactive; 8 made it active (nothing submitted)');
        } catch (error) {
            this.logger.error(`Password minimum length check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Password field: masked by default, "Enter Password" watermark, minimum 8 characters. */
    async verifyPasswordFieldRules(field: LoginField, identifier: string, password: string): Promise<void> {
        this.logger.info(`Verifying the Password field rules (${field} view)`);
        try {
            await this.expectAttribute(this.passwordInput, 'hint', PASSWORD_PLACEHOLDER, 'the empty Password field');
            await this.verifyPasswordMasked();
            await this.verifyPasswordMinimumLength(field, identifier, password);
            await this.verifyPasswordMasked();
            this.logger.info('Password field: masked, "Enter Password" watermark, minimum 8 characters');
        } catch (error) {
            this.logger.error(`Password field rules check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Customer ID minimum 6: with a valid password, 5 characters keep Login inactive and 6 make it active. */
    async verifyCustomerIdMinimumLength(customerId: string, password: string): Promise<void> {
        this.logger.info('Verifying the 6-character Customer ID minimum');
        try {
            if (customerId.length < CUSTOMER_ID_MIN_LENGTH)
                throw new Error(`The sample Customer ID must have at least ${CUSTOMER_ID_MIN_LENGTH} characters`);
            await this.enterPassword(password);
            await this.enterCustomerId(customerId.slice(0, CUSTOMER_ID_MIN_LENGTH - 1));
            await this.verifyCustomerIdValue(customerId.slice(0, CUSTOMER_ID_MIN_LENGTH - 1));
            await this.verifyLoginDisabled();
            await this.clearIdentifier('customerId');
            await this.enterCustomerId(customerId.slice(0, CUSTOMER_ID_MIN_LENGTH));
            await this.verifyCustomerIdValue(customerId.slice(0, CUSTOMER_ID_MIN_LENGTH));
            await this.verifyLoginEnabled();
            this.logger.info('5 Customer ID characters kept Login inactive; 6 alphanumeric characters made it active (nothing submitted)');
        } catch (error) {
            this.logger.error(`Customer ID minimum length check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The +91 prefix is a fixed image, not a selector: no country-code choice is offered in Phase 1. */
    async verifyNoCountryCodeSelector(): Promise<void> {
        this.logger.info('Verifying the +91 prefix is fixed (no country-code selector)');
        try {
            await this.verifyCountryCodeSelector();
            await this.expectAttribute(this.countryCode, 'clickable', 'false', 'the +91 prefix');
            this.logger.info('+91 prefix shown as a fixed, non-selectable image');
        } catch (error) {
            this.logger.error(`Country-code selector check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Types a mobile number into an empty field and checks the kept value and whether the validation error shows. */
    async checkMobileNumberInput(typed: string, kept: string, expectError: boolean): Promise<void> {
        this.logger.info(`Checking mobile input "${maskValue(typed)}" (error expected: ${expectError})`);
        try {
            await this.clearIdentifier('mobileNumber');
            await this.enterMobileNumber(typed);
            await this.verifyMobileNumberValue(kept);
            if (expectError) await this.expectDisplayed(this.mobileNumberError, 'the mobile number validation error', STATE_WAIT);
            else await this.expectAbsent(this.mobileNumberError, 'the mobile number validation error');
            this.logger.info(`Mobile input "${maskValue(typed)}" kept as "${maskValue(kept)}"; error shown: ${expectError}`);
        } catch (error) {
            this.logger.error(`Mobile input check failed for "${maskValue(typed)}": ${describeError(error)}`);
            throw error;
        }
    }

    /** Mobile number boundary: 10 digits starting 6-9 accepted; fewer digits or a first digit outside 6-9 rejected; more than 10 not kept. */
    async verifyMobileNumberBoundaries(validMobileNumber: string): Promise<void> {
        this.logger.info('Verifying the 10-digit Indian mobile number boundary');
        try {
            await this.checkMobileNumberInput(validMobileNumber, validMobileNumber, false);
            await this.checkMobileNumberInput(validMobileNumber.slice(0, 9), validMobileNumber.slice(0, 9), true);
            await this.checkMobileNumberInput(`5${validMobileNumber.slice(1)}`, `5${validMobileNumber.slice(1)}`, true);
            await this.checkMobileNumberInput(`${validMobileNumber}1`, validMobileNumber, false);
            this.logger.info('10 digits starting 6-9 accepted; 9 digits and a leading 5 rejected; an 11th digit not kept');
        } catch (error) {
            this.logger.error(`Mobile number boundary check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** An invalid mobile number shows the workbook's exact error text. */
    async verifyMobileNumberErrorText(): Promise<void> {
        this.logger.info(`Verifying the mobile number error text "${MOBILE_NUMBER_ERROR}"`);
        try {
            await this.enterMobileNumber(INVALID_SHORT_MOBILE);
            await this.expectDisplayed(this.mobileNumberErrorExact, `the error "${MOBILE_NUMBER_ERROR}"`, STATE_WAIT);
            this.logger.info(`"${MOBILE_NUMBER_ERROR}" shown for an invalid mobile number`);
        } catch (error) {
            this.logger.error(`Mobile number error text check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Mobile number field: placeholder, digits only, at most 10 digits, the documented error for an invalid number, none for a valid one. */
    async verifyMobileNumberFieldRules(validMobileNumber: string): Promise<void> {
        this.logger.info('Verifying the Mobile number field rules');
        try {
            await this.verifyIdentifierPlaceholder('mobileNumber');
            await this.checkMobileNumberInput(`abc${validMobileNumber.slice(0, 2)}`, validMobileNumber.slice(0, 2), true);
            await this.checkMobileNumberInput(`${validMobileNumber}1`, validMobileNumber, false);
            await this.clearIdentifier('mobileNumber');
            await this.verifyMobileNumberErrorText();
            this.logger.info('Mobile number field: placeholder, digits only, 10-digit limit, documented error for invalid input');
        } catch (error) {
            this.logger.error(`Mobile number field rules check failed: ${describeError(error)}`);
            throw error;
        }
    }
}
