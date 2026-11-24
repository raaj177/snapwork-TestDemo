// P0 smoke cases of US-002. Login Screen — Customer ID & Password Authentication.
// Only workbook rows with Automation Candidate = Yes and Priority = P0 are implemented here; P1/P2 cases of this
// story go in src/tests/regression/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_1/. Write and change these tests here (this file is not generated).
import allureReporter from '@wdio/allure-reporter';
import { fixtures } from '../../../fixtures/test-data.fixture';
import { createLoginPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const loginPage = createLoginPage();

describe('US002 Login Screen — Customer ID & Password Authentication', () => {
    it('TC_US002_025: Exercise the source requirement without adding behavior: Mobile No. Tab: Tab selector — switches view to Mobile Number + Password login (US-003). Type: Toggle / Tab. Mandatory: Yes. Validation: Yes', async () => {
        allureReporter.addStory('Mobile No. tab switches the login view');
        allureReporter.addSeverity('critical');
        await startService.openCustomerIdLogin();
        await loginPage.switchToMobileNoTabAndVerify();
        recordActualResult('Tapping the Mobile No. tab selected it and showed the Mobile number + Password login view.');
    });

    it('TC_US002_027: Exercise the source requirement without adding behavior: The Customer ID tab is selected by default; tapping Mobile No. tab switches to the mobile number login screen (US-003).', async () => {
        allureReporter.addStory('Customer ID tab is the default');
        allureReporter.addSeverity('critical');
        await startService.openCustomerIdLogin();
        await loginPage.verifyCustomerIdDefaultThenSwitchToMobileNo();
        recordActualResult('The login screen opened on the Customer ID tab; tapping Mobile No. switched to the mobile number login view.');
    });

    it('TC_US002_029: Exercise the source requirement without adding behavior: The Login button is inactive (greyed out) until both fields contain values.', async () => {
        allureReporter.addStory('Login inactive until both fields are filled');
        allureReporter.addSeverity('critical');
        const customerId = fixtures.value('sampleCustomerId');
        const password = fixtures.value('samplePassword');
        await startService.openCustomerIdLogin();
        await loginPage.verifyLoginActivatesAfterCustomerIdThenPassword(customerId, password);
        recordActualResult(
            'Login stayed inactive with empty fields and with only the Customer ID filled, and became active once both fields held values (nothing was submitted).',
        );
    });

    it('TC_US002_040: Exercise the source requirement without adding behavior: The Login button remains inactive (greyed out) until both the Customer ID and Password fields contain at least one character.', async () => {
        allureReporter.addStory('Login inactive until both fields hold one character');
        allureReporter.addSeverity('critical');
        await startService.openCustomerIdLogin();
        await loginPage.verifyLoginActivatesAfterPasswordThenCustomerId('a', 'A');
        recordActualResult(
            'Login stayed inactive with only one Password character and became active once the Customer ID also held one character (nothing was submitted).',
        );
    });
});
