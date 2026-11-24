// P1/P2 regression cases of US-002. Login Screen — Customer ID & Password Authentication.
// Only workbook rows with Automation Candidate = Yes and Priority P1/P2 are implemented here; P0 cases of this story
// live only in src/tests/smoke/GFG_EPIC001_Login_Authentication_v5 3/. Specs only call page and start-service methods.
import allureReporter from '@wdio/allure-reporter';
import { fixtures } from '../../../fixtures/test-data.fixture';
import { createForgotPasswordPage, createLoginPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const loginPage = createLoginPage();
const forgotPasswordPage = createForgotPasswordPage();

describe('US002 Login Screen — Customer ID & Password Authentication', () => {
    it('TC_US002_002: Check the greeting above the Customer ID credential fields.', async () => {
        allureReporter.addStory('Welcome back greeting');
        allureReporter.addSeverity('minor');
        await startService.openCustomerIdLogin();
        await loginPage.verifyWelcomeBackGreeting();
        recordActualResult('"Welcome back!" was shown above the Customer ID credential form.');
    });

    it('TC_US002_003: Switch from mobile login to the Customer ID tab.', async () => {
        allureReporter.addStory('Switch back to the Customer ID tab');
        allureReporter.addSeverity('normal');
        await startService.openMobileNumberLogin();
        await loginPage.switchToCustomerIdTabAndVerify();
        recordActualResult(
            'From the mobile view, tapping Customer ID selected it and showed the Customer ID/Trade Code and Password fields.',
        );
    });

    it('TC_US002_004: Verify Customer ID is the active login tab on first screen load.', async () => {
        allureReporter.addStory('Customer ID tab is the default');
        allureReporter.addSeverity('normal');
        await startService.openCustomerIdLogin();
        await loginPage.verifyCustomerIdTabIsDefault();
        recordActualResult('The login screen opened with the Customer ID tab selected and its fields shown.');
    });

    it('TC_US002_005: Select Mobile No. to open the mobile login view.', async () => {
        allureReporter.addStory('Mobile No. opens the mobile view');
        allureReporter.addSeverity('normal');
        await startService.openCustomerIdLogin();
        await loginPage.switchToMobileNoTabAndVerify();
        recordActualResult('Tapping Mobile No. selected it and showed the mobile number login view.');
    });

    it('TC_US002_006: Verify the Mobile No. tab is visible on the login screen.', async () => {
        allureReporter.addStory('Mobile No. tab available');
        allureReporter.addSeverity('normal');
        await startService.openCustomerIdLogin();
        await loginPage.verifyMobileNoTabAvailable();
        recordActualResult('The Mobile No. tab was shown and selectable.');
    });

    it('TC_US002_008: Verify the Customer ID field shows the documented example placeholder.', async () => {
        allureReporter.addStory('Customer ID placeholder');
        allureReporter.addSeverity('minor');
        await startService.openCustomerIdLogin();
        await loginPage.verifyIdentifierPlaceholder('customerId');
        recordActualResult('The empty Customer ID field showed "Eg: AAN268".');
    });

    it('TC_US002_010: Perform the documented action for Password Field on the Customer ID login screen. on the Customer ID login screen.', async () => {
        allureReporter.addStory('Password field rules');
        allureReporter.addSeverity('normal');
        const customerId = fixtures.value('sampleCustomerId');
        const password = fixtures.value('samplePassword');
        await startService.openCustomerIdLogin();
        await loginPage.verifyPasswordFieldRules('customerId', customerId, password);
        recordActualResult(
            'The Password field was masked with the "Enter Password" watermark; 7 characters kept Login inactive and 8 made it active (nothing submitted).',
        );
    });

    it('TC_US002_011: Leave Password Field empty and attempt to continue. on the Customer ID login screen.', async () => {
        allureReporter.addStory('Empty password not accepted');
        allureReporter.addSeverity('normal');
        const customerId = fixtures.value('sampleCustomerId');
        await startService.openCustomerIdLogin();
        await loginPage.verifyLoginDisabledWithEmptyPassword('customerId', customerId);
        recordActualResult('With the Customer ID filled and the Password empty, Login stayed inactive (nothing submitted).');
    });

    it('TC_US002_012: Check the documented boundary for Password Field on the Customer ID login screen. on the Customer ID login screen.', async () => {
        allureReporter.addStory('Password minimum 8 characters');
        allureReporter.addSeverity('normal');
        const customerId = fixtures.value('sampleCustomerId');
        const password = fixtures.value('samplePassword');
        await startService.openCustomerIdLogin();
        await loginPage.verifyPasswordMinimumLength('customerId', customerId, password);
        recordActualResult('7 password characters kept Login inactive; 8 made it active (nothing submitted).');
    });

    it('TC_US002_013: Toggle password visibility on the Customer ID login screen.', async () => {
        allureReporter.addStory('Password show/hide toggle');
        allureReporter.addSeverity('normal');
        const password = fixtures.value('samplePassword');
        await startService.openCustomerIdLogin();
        await loginPage.verifyPasswordVisibilityToggle(password);
        recordActualResult(
            'The password was masked, shown after tapping the eye, and masked again after the second tap; the eye control label followed the state.',
        );
    });

    it('TC_US002_014: Verify the show/hide password control is available on the Customer ID login screen.', async () => {
        allureReporter.addStory('Show/hide control available');
        allureReporter.addSeverity('minor');
        await startService.openCustomerIdLogin();
        await loginPage.verifyShowPasswordControl();
        recordActualResult('The eye control was shown beside the Password field and could be tapped.');
    });

    it('TC_US002_015: Perform the documented action for Forgot ID or Password- Link on the Customer ID login screen.', async () => {
        allureReporter.addStory('Forgot ID or Password? opens the help page');
        allureReporter.addSeverity('normal');
        await startService.openCustomerIdLogin();
        await loginPage.tapForgotIdOrPassword();
        await forgotPasswordPage.verifyOpenInsideAppThenGoBack();
        await loginPage.verifyShownAfterReturningFromWebPage();
        recordActualResult(
            '"Forgot ID or Password?" opened the Online Activation page in the in-app browser; its Back returned to the login screen.',
        );
    });

    it('TC_US002_016: Verify Forgot ID or Password- Link is visible and available on the Customer ID login screen.', async () => {
        allureReporter.addStory('Forgot ID or Password? available');
        allureReporter.addSeverity('minor');
        await startService.openCustomerIdLogin();
        await loginPage.verifyForgotLinkAvailable();
        recordActualResult('"Forgot ID or Password?" was shown and tappable.');
    });

    it('TC_US002_018: Check the Login button state with a missing credential on the Customer ID login screen.', async () => {
        allureReporter.addStory('Login inactive with a missing credential');
        allureReporter.addSeverity('normal');
        const customerId = fixtures.value('sampleCustomerId');
        const password = fixtures.value('samplePassword');
        await startService.openCustomerIdLogin();
        await loginPage.verifyLoginDisabledWhileEitherFieldEmpty('customerId', customerId, password);
        recordActualResult('Login stayed inactive with only the Customer ID and with only the password (nothing submitted).');
    });

    it('TC_US002_022: Verify "Don\'t have an account- Sign up now" Link is visible and available on the Customer ID login screen.', async () => {
        allureReporter.addStory('Sign up now available');
        allureReporter.addSeverity('minor');
        await startService.openCustomerIdLogin();
        await loginPage.verifySignUpLinkAvailable();
        recordActualResult('"Don\'t have an account? Sign up now" was shown and "Sign up now" was tappable.');
    });

    it('TC_US002_023: Check the six-character minimum and alphanumeric rule for Customer ID.', async () => {
        allureReporter.addStory('Customer ID minimum 6 characters');
        allureReporter.addSeverity('normal');
        const customerId = fixtures.value('sampleCustomerId');
        const password = fixtures.value('samplePassword');
        await startService.openCustomerIdLogin();
        await loginPage.verifyCustomerIdMinimumLength(customerId, password);
        recordActualResult('5 Customer ID characters kept Login inactive; 6 alphanumeric characters made it active (nothing submitted).');
    });

    it('TC_US002_024: Use Android Back after opening the password-help page from Customer ID login.', async () => {
        allureReporter.addStory('Android Back from the help page');
        allureReporter.addSeverity('normal');
        await startService.openCustomerIdLogin();
        await loginPage.tapForgotIdOrPassword();
        await forgotPasswordPage.goBackWithAndroidBack();
        await loginPage.verifyShownAfterReturningFromWebPage();
        recordActualResult('Android Back on the password-help page returned to the Customer ID login screen.');
    });
});
