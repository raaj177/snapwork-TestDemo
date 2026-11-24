// Returning-user login screen ("WELCOME BACK!", the remembered name and user code, password only, Switch Account).
// Locators verified in evidence/android/ReturningLogin/default.xml.
import { SCREEN_WAIT } from '../../constants/timeouts';
import { describeError } from '../../utils/Logger';
import { maskValue } from '../../utils/Redactor';
import { BasePage, type ElementLocator } from './BasePage';

export abstract class ReturningLoginPage extends BasePage {
    readonly welcomeBackHeading: ElementLocator;
    readonly passwordLabel: ElementLocator;
    readonly forgotIdOrPasswordLink: ElementLocator;
    readonly switchAccountLink: ElementLocator;
    readonly loginButton: ElementLocator;
    readonly signUpNowLink: ElementLocator;
    abstract readonly passwordInput: ElementLocator;

    constructor() {
        super();
        this.welcomeBackHeading = this.byLabel('WELCOME BACK!');
        this.passwordLabel = this.byLabel('Password');
        this.forgotIdOrPasswordLink = this.byRole('button', 'Forgot ID or Password?');
        this.switchAccountLink = this.byRole('button', 'Switch Account');
        this.loginButton = this.byRole('button', 'Login');
        this.signUpNowLink = this.byRole('button', 'Sign up now');
    }

    protected anchor(): ElementLocator {
        return this.switchAccountLink;
    }

    // ---- small action methods ----

    async tapSwitchAccount(): Promise<void> {
        this.logger.info('Tapping Switch Account');
        try {
            await this.tap(this.switchAccountLink, 'the Switch Account link');
            this.logger.info('Switch Account tapped');
        } catch (error) {
            this.logger.error(`Failed to tap Switch Account: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- verify methods ----

    /** The returning-user screen shows the remembered user code (a Customer ID/Trade Code from .env). */
    /** timeout: the heading's wait; use TIMEOUTS.appLaunch right after a (re)start of the app (cold start of the debug build). */
    async verifyShownForUserCode(userCode: string, timeout: number = SCREEN_WAIT): Promise<void> {
        this.logger.info(`Verifying the returning-user login for "${maskValue(userCode)}"`);
        try {
            await this.expectDisplayed(this.welcomeBackHeading, 'the "WELCOME BACK!" heading', timeout);
            await this.expectDisplayed(this.byLabel(userCode), 'the remembered user code');
            this.logger.info('Returning-user login verified');
        } catch (error) {
            this.logger.error(`Returning-user login verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Switch Account and Forgot ID or Password? are shown with the Login button. */
    async verifyLinksBesideLogin(): Promise<void> {
        this.logger.info('Verifying Switch Account and Forgot links beside Login');
        try {
            await this.expectDisplayed(this.loginButton, 'the Login button');
            await this.expectDisplayed(this.switchAccountLink, 'the Switch Account link');
            await this.expectDisplayed(this.forgotIdOrPasswordLink, 'the "Forgot ID or Password?" link');
            this.logger.info('Links beside Login verified');
        } catch (error) {
            this.logger.error(`Links beside Login verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The password is never pre-filled: the field is empty (showing its hint) once the screen is shown. */
    async verifyPasswordNotPrefilled(): Promise<void> {
        this.logger.info('Verifying the password is not pre-filled');
        try {
            await this.expectDisplayed(this.passwordLabel, 'the Password label'); // positive anchor
            const text = (await this.passwordInput().getText()) ?? '';
            if (text !== '' && text !== 'Enter Password') {
                throw new Error(`the Password field is pre-filled (${text.length} characters)`);
            }
            this.logger.info('Password is not pre-filled');
        } catch (error) {
            this.logger.error(`Password pre-fill check failed: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- flow methods ----

    /** The returning-user screen shows the remembered user code while the Password field stays empty. */
    async verifyUserCodeShownAndPasswordEmpty(userCode: string): Promise<void> {
        this.logger.info(`Verifying user code "${maskValue(userCode)}" is shown and the password is not pre-filled`);
        try {
            await this.verifyShownForUserCode(userCode);
            await this.verifyPasswordNotPrefilled();
            this.logger.info('User code shown; Password field empty');
        } catch (error) {
            this.logger.error(`User code / empty password check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The returning-user screen shows the remembered user name directly above the remembered user code. */
    async verifyUserNameAndCodeShown(userCode: string): Promise<void> {
        this.logger.info(`Verifying the remembered user name and code "${maskValue(userCode)}"`);
        try {
            await this.verifyShownForUserCode(userCode);
            // The name is account data: only its presence is checked and it is never logged.
            const name = this.byXPath(`//*[@content-desc="${userCode}"]/preceding-sibling::*[1][string-length(@content-desc) > 0]`);
            await this.expectDisplayed(name, 'the remembered user name above the user code');
            this.logger.info('Remembered user name and user code shown');
        } catch (error) {
            this.logger.error(`Remembered user name/code check failed: ${describeError(error)}`);
            throw error;
        }
    }
}
