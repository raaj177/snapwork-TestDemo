// P1/P2 regression cases of US-005. Forgot Password & Account Unlock.
// Only workbook rows with Automation Candidate = Yes and Priority P1/P2 are implemented here; P0 cases of this story
// live only in src/tests/smoke/GFG_EPIC001_Login_Authentication_v5 3/. Specs only call page and start-service methods.
import allureReporter from '@wdio/allure-reporter';
import { createForgotPasswordPage, createLoginPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const loginPage = createLoginPage();
const forgotPasswordPage = createForgotPasswordPage();

describe('US005 Forgot Password & Account Unlock', () => {
    it('TC_US005_001: Perform the documented action for Forgot ID or Password- Link on the account unlock and password reset flow.', async () => {
        allureReporter.addStory('Forgot link opens the web page, Back returns');
        allureReporter.addSeverity('normal');
        await startService.openForgotPasswordPage();
        await forgotPasswordPage.verifyOpenInsideAppThenGoBack();
        await loginPage.verifyShownAfterReturningFromWebPage();
        recordActualResult('The link opened the Geojit page in the in-app browser; its Back returned to the FundsGenie login screen.');
    });

    it('TC_US005_002: Verify Forgot ID or Password- Link is visible and available on the account unlock and password reset flow.', async () => {
        allureReporter.addStory('Forgot link available');
        allureReporter.addSeverity('minor');
        await startService.openCustomerIdLogin();
        await loginPage.verifyForgotLinkAvailable();
        recordActualResult('"Forgot ID or Password?" was shown and tappable.');
    });

    it('TC_US005_003: Verify In-App Browser / Web View is shown on the account unlock and password reset flow.', async () => {
        allureReporter.addStory('Web page rendered in the app');
        allureReporter.addSeverity('normal');
        await startService.openForgotPasswordPage();
        await forgotPasswordPage.verifyWebPageRenderedInsideApp();
        recordActualResult('The Online Activation / Forgot Password page was rendered completely inside FundsGenie.');
    });

    it('TC_US005_007: Verify Reset Password Button is visible and available on the account unlock and password reset flow.', async () => {
        allureReporter.addStory('Reset Password button available');
        allureReporter.addSeverity('minor');
        await startService.openForgotPasswordPage();
        await forgotPasswordPage.verifyResetPasswordButtonAvailable();
        recordActualResult('The Reset Password button was shown and enabled (not tapped).');
    });

    it('TC_US005_011: Verify "Not registered yet- Open an Account" Link is visible and available on the account unlock and password reset flow.', async () => {
        allureReporter.addStory('Open an Account link available');
        allureReporter.addSeverity('minor');
        await startService.openForgotPasswordPage();
        await forgotPasswordPage.verifyOpenAccountLinkAvailable();
        recordActualResult('"Not registered yet? Open an Account" was shown in the page footer (not tapped).');
    });
});
