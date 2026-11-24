// Geojit "Online Activation / Forgot Password" page, opened in the app's in-app browser from "Forgot ID or Password?".
// The web view exposes its DOM ids as resource-ids after it loads (about 10 s on the inspected device).
// Locators verified in evidence/android/ForgotPassword/default.xml. Nothing is typed or submitted by these methods.
import { WEB_PAGE_WAIT } from '../../constants/timeouts';
import { describeError } from '../../utils/Logger';
import { expectTrue } from '../../assertions/mobile.assertions';
import { appService } from '../../services/app.service';
import { BasePage, type ElementLocator } from './BasePage';

export class ForgotPasswordPage extends BasePage {
    readonly backButton: ElementLocator;
    readonly geojitLogo: ElementLocator;
    readonly pageTitle: ElementLocator;
    readonly customerIdField: ElementLocator;
    readonly panNumberField: ElementLocator;
    readonly emailRadio: ElementLocator;
    readonly mobileRadio: ElementLocator;
    readonly emailField: ElementLocator;
    readonly unlockButton: ElementLocator;
    readonly resetPasswordButton: ElementLocator;
    readonly notRegisteredText: ElementLocator;
    readonly openAnAccountLink: ElementLocator;
    readonly faqLink: ElementLocator;
    readonly privacyPolicyLink: ElementLocator;
    readonly termsLink: ElementLocator;
    readonly aboutLink: ElementLocator;

    constructor() {
        super();
        this.backButton = this.byRole('button', 'Back');
        this.geojitLogo = this.byLabel('Application Logo');
        this.pageTitle = this.byRole('text', 'Online Activation / Forgot Password');
        this.customerIdField = this.byId('username');
        this.panNumberField = this.byId('panNumber');
        this.emailRadio = this.byId('emailRb');
        this.mobileRadio = this.byId('mobileRb');
        this.emailField = this.byId('emailID');
        this.unlockButton = this.byId('unlockButton');
        this.resetPasswordButton = this.byId('resetPassword');
        this.notRegisteredText = this.byText('Not registered yet? ');
        this.openAnAccountLink = this.byLabel('Open an Account');
        // "FAQ" is followed by non-breaking spaces and "|" in the page; no exact label is stable, so XPath (handoff Note).
        this.faqLink = this.byXPath('//*[starts-with(@content-desc, "FAQ")]');
        this.privacyPolicyLink = this.byLabel('Privacy Policy |');
        this.termsLink = this.byLabel('Terms of service |');
        this.aboutLink = this.byLabel('About');
    }

    protected anchor(): ElementLocator {
        return this.pageTitle;
    }

    async tapBack(): Promise<void> {
        this.logger.info('Leaving the Forgot Password page with Back');
        try {
            await this.tap(this.backButton, 'the in-app browser Back button');
            this.logger.info('Back tapped');
        } catch (error) {
            this.logger.error(`Failed to tap Back: ${describeError(error)}`);
            throw error;
        }
    }

    /** The page is open in the app (in-app browser): title shown inside the app's window with its Back button. */
    async verifyOpenInApp(): Promise<void> {
        this.logger.info('Verifying the Online Activation / Forgot Password page is open in the app');
        try {
            await this.expectDisplayed(this.pageTitle, 'the "Online Activation / Forgot Password" title', WEB_PAGE_WAIT);
            await this.expectDisplayed(this.backButton, 'the in-app browser Back button');
            this.logger.info('Forgot Password page open in the app');
        } catch (error) {
            this.logger.error(`Forgot Password page check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Logo, title, Customer ID, PAN, Email/Mobile radio, contact field, Unlock A/C and Reset Password. */
    async verifyFormElements(): Promise<void> {
        this.logger.info('Verifying the Forgot Password form');
        try {
            await this.expectDisplayed(this.pageTitle, 'the page title', WEB_PAGE_WAIT);
            await this.expectDisplayed(this.geojitLogo, 'the Geojit logo');
            await this.expectDisplayed(this.customerIdField, 'the Trade Code / Customer ID field');
            await this.expectDisplayed(this.panNumberField, 'the PAN Number field');
            await this.expectDisplayed(this.emailRadio, 'the Email ID option');
            await this.expectDisplayed(this.mobileRadio, 'the Mobile option');
            await this.expectDisplayed(this.emailField, 'the Email ID field');
            await this.expectDisplayed(this.unlockButton, 'the Unlock A/C button');
            await this.expectDisplayed(this.resetPasswordButton, 'the Reset Password button');
            await this.expectText(this.unlockButton, 'Unlock A/C', 'the Unlock A/C button');
            await this.expectText(this.resetPasswordButton, 'Reset Password', 'the Reset Password button');
            this.logger.info('Forgot Password form verified');
        } catch (error) {
            this.logger.error(`Forgot Password form verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Footer: "Not registered yet? Open an Account" and FAQ / Privacy Policy / Terms of service / About. */
    async verifyFooterLinks(): Promise<void> {
        this.logger.info('Verifying the Forgot Password page footer');
        try {
            await this.expectDisplayed(this.pageTitle, 'the page title', WEB_PAGE_WAIT);
            await this.expectDisplayed(this.notRegisteredText, 'the "Not registered yet?" text');
            await this.expectDisplayed(this.openAnAccountLink, 'the "Open an Account" link');
            await this.expectDisplayed(this.faqLink, 'the FAQ link');
            await this.expectDisplayed(this.privacyPolicyLink, 'the Privacy Policy link');
            await this.expectDisplayed(this.termsLink, 'the Terms of service link');
            await this.expectDisplayed(this.aboutLink, 'the About link');
            this.logger.info('Footer verified');
        } catch (error) {
            this.logger.error(`Footer verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- flow methods ----

    /** The Forgot Password page is shown inside FundsGenie (in-app browser), with the app still in the foreground. */
    async verifyOpenInsideApp(): Promise<void> {
        this.logger.info('Verifying the Forgot Password page is open inside the app');
        try {
            await this.verifyOpenInApp();
            expectTrue(
                await appService.isInForeground(),
                'FundsGenie was not in the foreground while the Forgot Password page was shown (the page did not open in an in-app browser).',
            );
            this.logger.info('Forgot Password page shown inside the app');
        } catch (error) {
            this.logger.error(`Forgot Password in-app check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Verifies the hosted form, then leaves the page with its Back button. */
    async verifyFormThenGoBack(): Promise<void> {
        this.logger.info('Verifying the hosted Forgot Password form, then going back');
        try {
            await this.verifyFormElements();
            await this.tapBack();
            this.logger.info('Hosted form verified; Back tapped');
        } catch (error) {
            this.logger.error(`Verifying the form and going back failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The Reset Password button of the hosted form is shown and enabled for the user. */
    async verifyResetPasswordButtonAvailable(): Promise<void> {
        this.logger.info('Verifying the Reset Password button is available');
        try {
            await this.expectDisplayed(this.resetPasswordButton, 'the Reset Password button', WEB_PAGE_WAIT);
            await this.expectAttribute(this.resetPasswordButton, 'enabled', 'true', 'the Reset Password button');
            this.logger.info('Reset Password button shown and enabled (not tapped)');
        } catch (error) {
            this.logger.error(`Reset Password button check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** "Not registered yet? Open an Account" is shown in the page footer. */
    async verifyOpenAccountLinkAvailable(): Promise<void> {
        this.logger.info('Verifying "Not registered yet? Open an Account" is available');
        try {
            await this.expectDisplayed(this.notRegisteredText, 'the "Not registered yet?" text', WEB_PAGE_WAIT);
            await this.expectDisplayed(this.openAnAccountLink, 'the "Open an Account" link');
            this.logger.info('"Not registered yet? Open an Account" shown (not tapped)');
        } catch (error) {
            this.logger.error(`"Open an Account" link check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The hosted Geojit page is rendered inside FundsGenie: in-app browser plus the complete form. */
    async verifyWebPageRenderedInsideApp(): Promise<void> {
        this.logger.info('Verifying the Geojit Forgot Password page is rendered inside the app');
        try {
            await this.verifyOpenInsideApp();
            await this.verifyFormElements();
            this.logger.info('Geojit Forgot Password page rendered inside the app');
        } catch (error) {
            this.logger.error(`In-app web page render check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Leaves the page with the in-app Back button. */
    async verifyOpenInsideAppThenGoBack(): Promise<void> {
        this.logger.info('Verifying the page opens inside the app, then going back with its Back button');
        try {
            await this.verifyOpenInsideApp();
            await this.tapBack();
            this.logger.info('Page shown inside the app; Back tapped');
        } catch (error) {
            this.logger.error(`Open-then-back check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Leaves the page with the Android system Back key. */
    async goBackWithAndroidBack(): Promise<void> {
        this.logger.info('Leaving the Forgot Password page with Android Back');
        try {
            await this.verifyOpenInApp();
            await appService.pressBack();
            this.logger.info('Android Back pressed on the Forgot Password page');
        } catch (error) {
            this.logger.error(`Android Back from the Forgot Password page failed: ${describeError(error)}`);
            throw error;
        }
    }
}
