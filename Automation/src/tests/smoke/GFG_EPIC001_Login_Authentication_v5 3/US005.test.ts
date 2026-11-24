// P0 smoke cases of US-005. Forgot Password & Account Unlock.
// Only workbook rows with Automation Candidate = Yes and Priority = P0 are implemented here; P1/P2 cases of this
// story go in src/tests/regression/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_1/. Write and change these tests here (this file is not generated).
import allureReporter from '@wdio/allure-reporter';
import { createForgotPasswordPage, createLoginPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const loginPage = createLoginPage();
const forgotPasswordPage = createForgotPasswordPage();

describe('US005 Forgot Password & Account Unlock', () => {
    it('TC_US005_014: Exercise the source requirement without adding behavior: Tapping "Forgot ID or Password?" on the FundsGenie login screen opens the Geojit Online Activation / Forgot Password web page in an in-app browser.', async () => {
        allureReporter.addStory('Forgot ID or Password? opens the web page in the app');
        allureReporter.addSeverity('critical');
        await startService.openForgotPasswordPage();
        await forgotPasswordPage.verifyOpenInsideApp();
        recordActualResult(
            '"Forgot ID or Password?" opened the "Online Activation / Forgot Password" page inside FundsGenie (in-app browser with a Back button).',
        );
    });

    it('TC_US005_015: Exercise the source requirement without adding behavior: The web page (gin.geojit.com) displays: Geojit logo, page title "Online Activation / Forgot Password", Trade Code / Customer ID field, PAN Number field, Email ID / Mobile radio toggle, corresponding contact input field, "Unlock A/C" button, and "Reset Password" button.', async () => {
        allureReporter.addStory('Forgot Password page content');
        allureReporter.addSeverity('critical');
        await startService.openForgotPasswordPage();
        await forgotPasswordPage.verifyFormElements();
        recordActualResult(
            'The page showed the Geojit logo, the title, Trade Code / Customer ID, PAN Number, the Email ID / Mobile options, the Email ID field, "Unlock A/C" and "Reset Password".',
        );
    });

    it('TC_US005_020: Exercise the source requirement without adding behavior: The page footer shows: "Not registered yet? Open an Account" link, and FAQ / Privacy Policy / Terms of Service / About links.', async () => {
        allureReporter.addStory('Forgot Password page footer');
        allureReporter.addSeverity('critical');
        await startService.openForgotPasswordPage();
        await forgotPasswordPage.verifyFooterLinks();
        recordActualResult(
            'The footer showed "Not registered yet? Open an Account" and the FAQ, Privacy Policy, Terms of service and About links.',
        );
    });

    it('TC_US005_022: Exercise the source requirement without adding behavior: The Forgot Password and Account Unlock flows are entirely hosted on the Geojit web platform — FundsGenie is responsible only for the redirect entry point and return navigation.', async () => {
        allureReporter.addStory('Web-hosted flow with return navigation');
        allureReporter.addSeverity('critical');
        await startService.openForgotPasswordPage();
        await forgotPasswordPage.verifyFormThenGoBack();
        await loginPage.verifyShownAfterReturningFromWebPage();
        recordActualResult(
            'The unlock/reset form was the Geojit web page in the in-app browser; its Back button returned to the FundsGenie login screen.',
        );
    });
});
