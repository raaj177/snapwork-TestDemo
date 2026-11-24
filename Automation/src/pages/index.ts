// Page factory: specs never `new` a page. Platform pages are chosen from PLATFORM (config/env.ts).
// iOS variants are not written yet (iOS automation deferred); asking for one stops the run with a clear message.
import { env } from '../../config/env';
import { describeError, logger } from '../utils/Logger';
import { AndroidDashboardPage } from './android/DashboardPage';
import { AndroidLoginPage } from './android/LoginPage';
import { AndroidReturningLoginPage } from './android/ReturningLoginPage';
import { ChangePasswordPage } from './common/ChangePasswordPage';
import type { DashboardPage } from './common/DashboardPage';
import { ForgotPasswordPage } from './common/ForgotPasswordPage';
import { KycPromptPage } from './common/KycPromptPage';
import type { LoginPage } from './common/LoginPage';
import { LogoutDialogPage } from './common/LogoutDialogPage';
import { MorePage } from './common/MorePage';
import type { ReturningLoginPage } from './common/ReturningLoginPage';
import { SecuritySettingsPage } from './common/SecuritySettingsPage';
import { SettingsPage } from './common/SettingsPage';

const log = logger.child({ module: 'pages' });

/** Stops when a platform page has no iOS variant yet. */
function requireAndroid(page: string): void {
    log.debug(`Resolving the ${page} for ${env.PLATFORM}`);
    try {
        if (env.PLATFORM !== 'android')
            throw new Error(`${page} has no iOS variant yet (iOS automation is not implemented for this workbook)`);
    } catch (error) {
        log.error(`Page factory failed: ${describeError(error)}`);
        throw error;
    }
}

export function createLoginPage(): LoginPage {
    requireAndroid('LoginPage');
    return new AndroidLoginPage();
}

export function createReturningLoginPage(): ReturningLoginPage {
    requireAndroid('ReturningLoginPage');
    return new AndroidReturningLoginPage();
}

export function createDashboardPage(): DashboardPage {
    requireAndroid('DashboardPage');
    return new AndroidDashboardPage();
}

export function createKycPromptPage(): KycPromptPage {
    log.debug('Creating KycPromptPage');
    return new KycPromptPage();
}

export function createMorePage(): MorePage {
    log.debug('Creating MorePage');
    return new MorePage();
}

export function createLogoutDialogPage(): LogoutDialogPage {
    log.debug('Creating LogoutDialogPage');
    return new LogoutDialogPage();
}

export function createSettingsPage(): SettingsPage {
    log.debug('Creating SettingsPage');
    return new SettingsPage();
}

export function createSecuritySettingsPage(): SecuritySettingsPage {
    log.debug('Creating SecuritySettingsPage');
    return new SecuritySettingsPage();
}

export function createChangePasswordPage(): ChangePasswordPage {
    log.debug('Creating ChangePasswordPage');
    return new ChangePasswordPage();
}

export function createForgotPasswordPage(): ForgotPasswordPage {
    log.debug('Creating ForgotPasswordPage');
    return new ForgotPasswordPage();
}
