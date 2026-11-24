// Start states shared by the login, forgot-password, settings and logout specs. The app keeps its data between runs
// (NO_RESET); a test reaches its start screen only through in-app navigation (Switch Account, in-app Logout), never
// by clearing app data. Every relaunch runs as one launch step (start + first screen check, retried on a freeze).
// Speed (REUSE_APP_STATE, default on): the screen the previous test left is reused when it is a known, verifiably
// clean start state (login screen reset in place, returning-user screen, live Dashboard session); anything else
// relaunches. A reused session skips logout + login.
import { env } from '../../config/env';
import { TIMEOUTS } from '../constants/timeouts';
import { fixtures } from '../fixtures/test-data.fixture';
import {
    createDashboardPage,
    createForgotPasswordPage,
    createKycPromptPage,
    createLoginPage,
    createLogoutDialogPage,
    createMorePage,
    createReturningLoginPage,
    createSettingsPage,
} from '../pages';
import { expectTrue } from '../assertions/mobile.assertions';
import { BlockedError } from '../reporting/BlockedError';
import { describeError, logger } from '../utils/Logger';
import { appService } from './app.service';

export type StartScreen = 'login' | 'returning' | 'dashboard' | 'kyc';
export type LoginOutcome = 'dashboard' | 'kyc' | 'failed';

export class StartService {
    protected readonly logger = logger.child({ service: 'StartService' });
    /** Set after the back end refused the normal account's login in this run: later logins are not attempted again. */
    protected loginUnavailable = '';
    protected readonly loginPage = createLoginPage();
    protected readonly returningLoginPage = createReturningLoginPage();
    protected readonly dashboardPage = createDashboardPage();
    protected readonly kycPromptPage = createKycPromptPage();
    protected readonly morePage = createMorePage();
    protected readonly logoutDialogPage = createLogoutDialogPage();
    protected readonly forgotPasswordPage = createForgotPasswordPage();
    protected readonly settingsPage = createSettingsPage();

    /** Polls (one lookup per screen per round) until one of the start screens is shown. */
    async waitForStartScreen(timeout: number = TIMEOUTS.appLaunch): Promise<StartScreen> {
        this.logger.info('Waiting for a start screen (login, returning login, Dashboard or KYC prompt)');
        try {
            let found: StartScreen | undefined;
            await driver.waitUntil(
                async () => {
                    if (await this.kycPromptPage.isDisplayedWithin(this.kycPromptPage.doItLaterButton, 1, 'the KYC prompt')) found = 'kyc';
                    else if (await this.loginPage.isDisplayedWithin(this.loginPage.customerIdTab, 1, 'the login tabs')) found = 'login';
                    else if (
                        await this.returningLoginPage.isDisplayedWithin(this.returningLoginPage.switchAccountLink, 1, 'Switch Account')
                    )
                        found = 'returning';
                    else if (await this.dashboardPage.isDisplayedWithin(this.dashboardPage.moreTab, 1, 'the Dashboard tab bar'))
                        found = 'dashboard';
                    return found !== undefined;
                },
                { timeout, interval: TIMEOUTS.pollInterval, timeoutMsg: `no start screen was shown within ${timeout / 1000} s` },
            );
            this.logger.info(`Start screen: ${String(found)}`);
            return found as StartScreen;
        } catch (error) {
            this.logger.error(`No start screen: ${describeError(error)}`);
            throw error;
        }
    }

    /** From the Dashboard: More > Logout > confirm. Ends on the returning-user login screen. */
    async logoutFromDashboard(): Promise<void> {
        this.logger.info('Logging out from the Dashboard');
        try {
            await this.dashboardPage.tapMoreTab();
            await this.morePage.tapLogout();
            await this.logoutDialogPage.verifyVisible();
            await this.logoutDialogPage.confirmLogout();
            this.logger.info('Logged out');
        } catch (error) {
            this.logger.error(`Logout from the Dashboard failed: ${describeError(error)}`);
            throw error;
        }
    }

    /**
     * The start screen the app shows right now, without a relaunch: undefined when REUSE_APP_STATE is off, the app is
     * not in the foreground, or no known start screen appears within TIMEOUTS.stateProbe (the caller then relaunches).
     */
    async currentStartScreen(): Promise<StartScreen | undefined> {
        this.logger.info('Checking the current screen before deciding to relaunch');
        try {
            if (!env.REUSE_APP_STATE) {
                this.logger.info('REUSE_APP_STATE=false: relaunch required');
                return undefined;
            }
            if (!(await appService.isInForeground())) {
                this.logger.info('App not in the foreground: relaunch required');
                return undefined;
            }
            let screen: StartScreen | undefined;
            try {
                screen = await this.waitForStartScreen(TIMEOUTS.stateProbe);
            } catch (probeError) {
                // Not a failure: the app shows some other screen (web page, dialog, deep settings), so the caller relaunches.
                this.logger.warn(`No known start screen without a relaunch (${describeError(probeError)}): relaunch required`);
                return undefined;
            }
            this.logger.info(`Current start screen: ${screen}`);
            return screen;
        } catch (error) {
            this.logger.error(`Checking the current screen failed: ${describeError(error)}`);
            throw error;
        }
    }

    /**
     * Returning-user screen > Switch Account > the login screen. Right after a cold start the debug build can draw the
     * screen before it accepts taps, so when the login tabs do not appear within TIMEOUTS.short the tap is repeated once.
     */
    async switchAccountToLogin(): Promise<void> {
        this.logger.info('Switching account to the login screen');
        try {
            await this.returningLoginPage.tapSwitchAccount();
            if (!(await this.loginPage.isDisplayedWithin(this.loginPage.customerIdTab, TIMEOUTS.short, 'the login tabs'))) {
                this.logger.warn('The login screen did not open after Switch Account (tap not taken right after start): tapping again');
                await this.returningLoginPage.tapSwitchAccount();
            }
            await this.loginPage.verifyCustomerIdView();
            this.logger.info('Login screen open after Switch Account');
        } catch (error) {
            this.logger.error(`Switching account to the login screen failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** After Login is tapped: polls until the Dashboard, the KYC prompt or the back-end "Login Failed" sheet is shown. */
    async waitForLoginOutcome(timeout: number = TIMEOUTS.backendResponse): Promise<LoginOutcome> {
        this.logger.info('Waiting for the login result (Dashboard, KYC prompt or "Login Failed")');
        try {
            let outcome: LoginOutcome | undefined;
            await driver.waitUntil(
                async () => {
                    if (await this.loginPage.isDisplayedWithin(this.loginPage.loginFailedSheet, 1, 'the "Login Failed" sheet'))
                        outcome = 'failed';
                    else if (await this.kycPromptPage.isDisplayedWithin(this.kycPromptPage.doItLaterButton, 1, 'the KYC prompt'))
                        outcome = 'kyc';
                    else if (await this.dashboardPage.isDisplayedWithin(this.dashboardPage.moreTab, 1, 'the Dashboard tab bar'))
                        outcome = 'dashboard';
                    return outcome !== undefined;
                },
                { timeout, interval: TIMEOUTS.pollInterval, timeoutMsg: `no login result was shown within ${timeout / 1000} s` },
            );
            this.logger.info(`Login result: ${String(outcome)}`);
            return outcome as LoginOutcome;
        } catch (error) {
            this.logger.error(`Waiting for the login result failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Relaunches the app (a single, clean screen stack) and opens the Customer ID login view; never reuses the screen. */
    async openCustomerIdLoginByRelaunch(): Promise<void> {
        this.logger.info('Opening the Customer ID login view through a relaunch');
        try {
            let screen = await this.relaunchToStartScreen();
            if (screen === 'kyc') {
                await this.kycPromptPage.tapDoItLater();
                screen = 'dashboard';
            }
            if (screen === 'dashboard') {
                await this.logoutFromDashboard();
                screen = 'returning';
            }
            if (screen === 'returning') await this.switchAccountToLogin();
            await this.loginPage.verifyCustomerIdView();
            this.logger.info('Customer ID login view open after a relaunch');
        } catch (error) {
            this.logger.error(`Opening the login view through a relaunch failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The in-place reset of the login screen; false (caller relaunches) when it is not clean or a step of it fails. */
    async tryResetLoginInPlace(): Promise<boolean> {
        this.logger.info('Trying to reuse the login screen without a relaunch');
        try {
            try {
                return await this.loginPage.resetToCleanCustomerIdView();
            } catch (resetError) {
                // Not a test failure: the screen was mid-transition; a relaunch gives a known clean state instead.
                this.logger.warn(`Reusing the login screen failed (${describeError(resetError)}): relaunching instead`);
                return false;
            }
        } catch (error) {
            this.logger.error(`Trying to reuse the login screen failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Close and relaunch the app and return the start screen it shows. */
    async relaunchToStartScreen(): Promise<StartScreen> {
        this.logger.info('Relaunching the app to a start screen');
        try {
            // Assigned inside the launch step callback, so widen it explicitly.
            let screen = 'login' as StartScreen;
            await appService.closeAndRelaunch(async () => {
                screen = await this.waitForStartScreen();
            });
            this.logger.info(`Relaunched; start screen: ${screen}`);
            return screen;
        } catch (error) {
            this.logger.error(`Relaunch to a start screen failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Brings the app to the Customer ID login view (Customer ID tab, empty fields, Password masked); relaunches only when needed. */
    async openCustomerIdLogin(): Promise<void> {
        this.logger.info('Opening the Customer ID login view');
        try {
            let screen = await this.currentStartScreen();
            if (screen === 'login') {
                if (await this.tryResetLoginInPlace()) {
                    await this.loginPage.verifyCustomerIdView();
                    this.logger.info('Customer ID login view ready (reused, no relaunch)');
                    return;
                }
                this.logger.warn('The login screen could not be reset to a clean state: relaunching');
                screen = undefined;
            }
            if (screen === undefined) screen = await this.relaunchToStartScreen();
            if (screen === 'kyc') {
                await this.kycPromptPage.tapDoItLater();
                screen = 'dashboard';
            }
            if (screen === 'dashboard') {
                await this.logoutFromDashboard();
                screen = 'returning';
            }
            if (screen === 'returning') await this.switchAccountToLogin();
            await this.loginPage.verifyCustomerIdView();
            this.logger.info('Customer ID login view open');
        } catch (error) {
            this.logger.error(`Opening the Customer ID login view failed: ${describeError(error)}`);
            throw error;
        }
    }

    /**
     * Ends on the Dashboard of the configured normal account. A live session (the app already logged in, or a relaunch
     * that restores it) is reused: no logout and no new login. Otherwise logs in from the Customer ID login view.
     */
    async loginAsNormalUser(): Promise<void> {
        this.logger.info('Logging in with the normal test account');
        try {
            let screen = await this.currentStartScreen();
            if (screen === undefined) screen = await this.relaunchToStartScreen();
            if (screen === 'kyc') {
                await this.kycPromptPage.tapDoItLater();
                screen = 'dashboard';
            }
            if (screen === 'dashboard') {
                await this.dashboardPage.openDashboardTab();
                await this.kycPromptPage.dismissIfShown(TIMEOUTS.short);
                this.logger.info('Session reused; Dashboard shown (no new login)');
                return;
            }
            if (this.loginUnavailable) throw new BlockedError(this.loginUnavailable);
            const user = fixtures.user('normalUser');
            if (screen === 'returning') await this.switchAccountToLogin();
            else if (!(await this.tryResetLoginInPlace())) await this.openCustomerIdLogin();
            await this.loginPage.verifyCustomerIdView();
            try {
                await this.loginPage.loginWithCustomerId(user.username, user.password ?? '');
            } catch (formError) {
                // After a logout the app can keep two login screens stacked: the fields typed into are not the visible
                // ones and Login stays disabled. Login was NOT tapped (no failed attempt), so relaunch for a single clean
                // login screen and fill the form once more.
                if (!/Login was not tapped/.test(describeError(formError))) throw formError;
                this.logger.warn(`Login form not usable (${describeError(formError)}): relaunching for a clean login screen`);
                await this.openCustomerIdLoginByRelaunch();
                await this.loginPage.loginWithCustomerId(user.username, user.password ?? '');
            }
            const outcome = await this.waitForLoginOutcome();
            if (outcome === 'failed') {
                // Never tap "Try Again" (it would submit again): the next test relaunches, and no later test logs in.
                this.loginUnavailable =
                    'The back end refused the normal test account\'s login in this run ("Login Failed - Something went wrong. Please try again later."); no further login is attempted, to protect the account.';
                throw new BlockedError(this.loginUnavailable);
            }
            if (outcome === 'kyc') await this.kycPromptPage.tapDoItLater();
            await this.dashboardPage.verifyVisible();
            await this.kycPromptPage.dismissIfShown(TIMEOUTS.short);
            await this.dashboardPage.verifyVisible();
            this.logger.info('Logged in; Dashboard shown');
        } catch (error) {
            this.logger.error(`Login with the normal test account failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The mobile number login view: Customer ID login, then the Mobile No. tab. */
    async openMobileNumberLogin(): Promise<void> {
        this.logger.info('Opening the mobile number login view');
        try {
            await this.openCustomerIdLogin();
            await this.loginPage.tapMobileNoTab();
            await this.loginPage.verifyMobileNumberView();
            this.logger.info('Mobile number login view open');
        } catch (error) {
            this.logger.error(`Opening the mobile number login view failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The Forgot Password web page opened from the Customer ID login screen. */
    async openForgotPasswordPage(): Promise<void> {
        this.logger.info('Opening the Forgot Password page from the login screen');
        try {
            await this.openCustomerIdLogin();
            await this.loginPage.tapForgotIdOrPassword();
            await this.forgotPasswordPage.verifyOpenInApp();
            this.logger.info('Forgot Password page open');
        } catch (error) {
            this.logger.error(`Opening the Forgot Password page failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Logged in, then More > Settings > Security Settings. */
    async openSecuritySettings(): Promise<void> {
        this.logger.info('Opening Security Settings');
        try {
            await this.loginAsNormalUser();
            await this.dashboardPage.tapMoreTab();
            await this.morePage.verifyVisible();
            await this.morePage.tapSettings();
            await this.settingsPage.tapSecuritySettings();
            this.logger.info('Security Settings open');
        } catch (error) {
            this.logger.error(`Opening Security Settings failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The returning-user login screen of the normal account (log in, then log out in the app); returns the user code. */
    async openReturningLogin(): Promise<string> {
        this.logger.info('Opening the returning-user login screen');
        try {
            const user = fixtures.user('normalUser');
            await this.loginAsNormalUser();
            await this.logoutFromDashboard();
            await this.returningLoginPage.verifyShownForUserCode(user.username);
            this.logger.info('Returning-user login screen open');
            return user.username;
        } catch (error) {
            this.logger.error(`Opening the returning-user login screen failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Logs in, then logs out through More > Logout with confirmation; ends on the returning-user login. Returns the user code. */
    async loginThenLogout(): Promise<string> {
        this.logger.info('Logging in and logging out in the app');
        try {
            const user = fixtures.user('normalUser');
            await this.loginAsNormalUser();
            await this.dashboardPage.tapMoreTab();
            await this.morePage.tapLogout();
            await this.logoutDialogPage.verifyVisible();
            await this.logoutDialogPage.confirmLogout();
            await this.returningLoginPage.verifyShownForUserCode(user.username);
            this.logger.info('Logged out; returning-user login shown');
            return user.username;
        } catch (error) {
            this.logger.error(`Login then logout failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** After logout, a relaunch shows the login screen for the user code, never the authenticated Dashboard. */
    async relaunchAndVerifyLoginOnly(userCode: string): Promise<void> {
        this.logger.info('Relaunching the app after logout');
        try {
            await appService.closeAndRelaunch(async () => {
                // After Back the activity is closed: reopening is a cold start that can show a blank screen for a while.
                await this.returningLoginPage.verifyShownForUserCode(userCode, TIMEOUTS.appLaunch);
            });
            await this.dashboardPage.verifyNotShown();
            this.logger.info('Relaunch showed the login screen only');
        } catch (error) {
            this.logger.error(`Relaunch after logout check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** After logout, Android Back and returning to the app show the login screen, never the Dashboard. */
    async pressBackAndVerifyLoginOnly(userCode: string): Promise<void> {
        this.logger.info('Pressing Back after logout and returning to the app');
        try {
            await appService.pressBack();
            await appService.activateAndCheck(async () => {
                // After Back the activity is closed: reopening is a cold start that can show a blank screen for a while.
                await this.returningLoginPage.verifyShownForUserCode(userCode, TIMEOUTS.appLaunch);
            });
            await this.dashboardPage.verifyNotShown();
            expectTrue(
                await this.returningLoginPage.isShown(TIMEOUTS.standard),
                'The login screen was not shown after Back and returning to the app.',
            );
            this.logger.info('Back after logout kept the login screen');
        } catch (error) {
            this.logger.error(`Back after logout check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Logged in with the normal account, then the More tab. */
    async openMoreTab(): Promise<void> {
        this.logger.info('Opening the More tab');
        try {
            await this.loginAsNormalUser();
            await this.dashboardPage.tapMoreTab();
            await this.morePage.verifyVisible();
            this.logger.info('More tab open');
        } catch (error) {
            this.logger.error(`Opening the More tab failed: ${describeError(error)}`);
            throw error;
        }
    }
}

export const startService = new StartService();
