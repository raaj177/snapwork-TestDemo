// P1/P2 regression cases of US-003. Login Screen — Mobile Number & Password Authentication.
// Only workbook rows with Automation Candidate = Yes and Priority P1/P2 are implemented here; P0 cases of this story
// live only in src/tests/smoke/GFG_EPIC001_Login_Authentication_v5 3/. Specs only call page and start-service methods.
import allureReporter from '@wdio/allure-reporter';
import { fixtures } from '../../../fixtures/test-data.fixture';
import { createForgotPasswordPage, createLoginPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const loginPage = createLoginPage();
const forgotPasswordPage = createForgotPasswordPage();

describe('US003 Login Screen — Mobile Number & Password Authentication', () => {
    it('TC_US003_001: Verify the mobile-number login view shows the complete credential form.', async () => {
        allureReporter.addStory('Complete mobile credential form');
        allureReporter.addSeverity('normal');
        await startService.openMobileNumberLogin();
        await loginPage.verifyMobileNumberViewContent();
        recordActualResult(
            'The mobile view showed +91, the Mobile number and Password fields, the eye control, Forgot ID or Password?, Login and Sign up now.',
        );
    });

    it('TC_US003_002: Verify the Mobile No. tab is visible and selectable on the login screen.', async () => {
        allureReporter.addStory('Mobile No. tab available');
        allureReporter.addSeverity('normal');
        await startService.openCustomerIdLogin();
        await loginPage.verifyMobileNoTabAvailable();
        recordActualResult('The Mobile No. tab was shown and selectable.');
    });

    it('TC_US003_003: Verify the India-only mobile login view displays the +91 country prefix.', async () => {
        allureReporter.addStory('+91 prefix');
        allureReporter.addSeverity('normal');
        await startService.openMobileNumberLogin();
        await loginPage.verifyCountryCodeSelector();
        recordActualResult('The mobile number field showed the +91 prefix image.');
    });

    it('TC_US003_004: Verify Phase 1 does not display a country-code selector.', async () => {
        allureReporter.addStory('No country-code selector');
        allureReporter.addSeverity('normal');
        await startService.openMobileNumberLogin();
        await loginPage.verifyNoCountryCodeSelector();
        recordActualResult('+91 was a fixed, non-selectable image; no country-code choice was offered.');
    });

    it('TC_US003_005: Perform the documented action for Mobile Number Field on the mobile-number login screen.', async () => {
        allureReporter.addStory('Mobile number field rules');
        allureReporter.addSeverity('normal');
        const mobileNumber = fixtures.value('sampleMobileNumber');
        await startService.openMobileNumberLogin();
        await loginPage.verifyMobileNumberFieldRules(mobileNumber);
        recordActualResult(
            'The Mobile number field showed its placeholder, kept digits only, stopped at 10 digits and showed the documented error for an invalid number.',
        );
    });

    it('TC_US003_006: Verify the mobile-number field shows the documented example placeholder.', async () => {
        allureReporter.addStory('Mobile number placeholder');
        allureReporter.addSeverity('minor');
        await startService.openMobileNumberLogin();
        await loginPage.verifyIdentifierPlaceholder('mobileNumber');
        recordActualResult('The empty Mobile number field showed "Eg: 9000000000".');
    });

    it('TC_US003_007: Verify Mobile Number Field displays the specified text -Please enter a valid 10-digit mobile number.-.', async () => {
        allureReporter.addStory('Mobile number error text');
        allureReporter.addSeverity('normal');
        await startService.openMobileNumberLogin();
        await loginPage.verifyMobileNumberErrorText();
        recordActualResult('An invalid mobile number showed "Please enter a valid 10-digit mobile number.".');
    });

    it('TC_US003_008: Check the ten-digit Indian mobile number boundary.', async () => {
        allureReporter.addStory('10-digit mobile number boundary');
        allureReporter.addSeverity('normal');
        const mobileNumber = fixtures.value('sampleMobileNumber');
        await startService.openMobileNumberLogin();
        await loginPage.verifyMobileNumberBoundaries(mobileNumber);
        recordActualResult('10 digits starting 6-9 were accepted; 9 digits and a leading 5 were rejected; an 11th digit was not kept.');
    });

    it('TC_US003_009: Perform the documented action for Password Field on the mobile-number login screen. on the mobile-number login screen.', async () => {
        allureReporter.addStory('Password field rules (mobile view)');
        allureReporter.addSeverity('normal');
        const mobileNumber = fixtures.value('sampleMobileNumber');
        const password = fixtures.value('samplePassword');
        await startService.openMobileNumberLogin();
        await loginPage.verifyPasswordFieldRules('mobileNumber', mobileNumber, password);
        recordActualResult(
            'The Password field was masked with the "Enter Password" watermark; 7 characters kept Login inactive and 8 made it active (nothing submitted).',
        );
    });

    it('TC_US003_010: Leave Password Field empty and attempt to continue. on the mobile-number login screen.', async () => {
        allureReporter.addStory('Empty password not accepted (mobile view)');
        allureReporter.addSeverity('normal');
        const mobileNumber = fixtures.value('sampleMobileNumber');
        await startService.openMobileNumberLogin();
        await loginPage.verifyLoginDisabledWithEmptyPassword('mobileNumber', mobileNumber);
        recordActualResult('With the mobile number filled and the Password empty, Login stayed inactive (nothing submitted).');
    });

    it('TC_US003_011: Check the documented boundary for Password Field on the mobile-number login screen. on the mobile-number login screen.', async () => {
        allureReporter.addStory('Password minimum 8 characters (mobile view)');
        allureReporter.addSeverity('normal');
        const mobileNumber = fixtures.value('sampleMobileNumber');
        const password = fixtures.value('samplePassword');
        await startService.openMobileNumberLogin();
        await loginPage.verifyPasswordMinimumLength('mobileNumber', mobileNumber, password);
        recordActualResult('7 password characters kept Login inactive; 8 made it active (nothing submitted).');
    });

    it('TC_US003_012: Toggle password visibility on the mobile-number login screen.', async () => {
        allureReporter.addStory('Password show/hide toggle (mobile view)');
        allureReporter.addSeverity('normal');
        const password = fixtures.value('samplePassword');
        await startService.openMobileNumberLogin();
        await loginPage.verifyPasswordVisibilityToggle(password);
        recordActualResult('The password was masked, shown after tapping the eye, and masked again after the second tap.');
    });

    it('TC_US003_013: Verify the show/hide password control is available on the mobile-number login screen.', async () => {
        allureReporter.addStory('Show/hide control available (mobile view)');
        allureReporter.addSeverity('minor');
        await startService.openMobileNumberLogin();
        await loginPage.verifyShowPasswordControl();
        recordActualResult('The eye control was shown beside the Password field and could be tapped.');
    });

    it('TC_US003_014: Perform the documented action for Forgot ID or Password- Link on the mobile-number login screen.', async () => {
        allureReporter.addStory('Forgot ID or Password? opens the help page (mobile view)');
        allureReporter.addSeverity('normal');
        await startService.openMobileNumberLogin();
        await loginPage.tapForgotIdOrPassword();
        await forgotPasswordPage.verifyOpenInsideAppThenGoBack();
        recordActualResult('"Forgot ID or Password?" opened the Online Activation page in the in-app browser.');
    });

    it('TC_US003_015: Verify Forgot ID or Password- Link is visible and available on the mobile-number login screen.', async () => {
        allureReporter.addStory('Forgot ID or Password? available (mobile view)');
        allureReporter.addSeverity('minor');
        await startService.openMobileNumberLogin();
        await loginPage.verifyForgotLinkAvailable();
        recordActualResult('"Forgot ID or Password?" was shown and tappable.');
    });

    it('TC_US003_017: Check the Login button state with a missing credential on the mobile-number login screen.', async () => {
        allureReporter.addStory('Login inactive with a missing credential (mobile view)');
        allureReporter.addSeverity('normal');
        const mobileNumber = fixtures.value('sampleMobileNumber');
        const password = fixtures.value('samplePassword');
        await startService.openMobileNumberLogin();
        await loginPage.verifyLoginDisabledWhileEitherFieldEmpty('mobileNumber', mobileNumber, password);
        recordActualResult('Login stayed inactive with only the mobile number and with only the password (nothing submitted).');
    });

    it('TC_US003_019: Verify "Don\'t have an account- Sign up now" Link is visible and available on the mobile-number login screen.', async () => {
        allureReporter.addStory('Sign up now available (mobile view)');
        allureReporter.addSeverity('minor');
        await startService.openMobileNumberLogin();
        await loginPage.verifySignUpLinkAvailable();
        recordActualResult('"Don\'t have an account? Sign up now" was shown and "Sign up now" was tappable.');
    });
});
