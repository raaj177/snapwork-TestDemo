// P0 smoke cases of US-003. Login Screen — Mobile Number & Password Authentication.
// Only workbook rows with Automation Candidate = Yes and Priority = P0 are implemented here; P1/P2 cases of this
// story go in src/tests/regression/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_1/. Write and change these tests here (this file is not generated).
import allureReporter from '@wdio/allure-reporter';
import { fixtures } from '../../../fixtures/test-data.fixture';
import { createLoginPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const loginPage = createLoginPage();

describe('US003 Login Screen — Mobile Number & Password Authentication', () => {
    it('TC_US003_020: Exercise the source requirement without adding behavior: Country Code Selector: Displays Indian flag and +91 prefix for the mobile number field. Class C — Indian format assumed.. Type: Dropdown / Selection. Mandatory: Yes. Validation: Yes', async () => {
        allureReporter.addStory('+91 country code selector');
        allureReporter.addSeverity('critical');
        await startService.openMobileNumberLogin();
        await loginPage.verifyCountryCodeSelector();
        recordActualResult('The mobile number field showed the +91 country code selector (flag and +91 in one image node).');
    });

    it('TC_US003_021: Exercise the source requirement without adding behavior: Tapping the "Mobile No." tab on the login screen switches to the mobile number login view.', async () => {
        allureReporter.addStory('Mobile No. tab opens the mobile number view');
        allureReporter.addSeverity('critical');
        await startService.openCustomerIdLogin();
        await loginPage.switchToMobileNoTabAndVerify();
        recordActualResult('Tapping the Mobile No. tab showed the mobile number login view.');
    });

    it('TC_US003_022: Exercise the source requirement without adding behavior: The mobile number login view displays: country code selector (+91), Mobile Number field, Password field (masked), show/hide toggle, "Forgot ID or Password?" link, Login button, and "Don\'t have an account? Sign up now" link.', async () => {
        allureReporter.addStory('Mobile number login view content');
        allureReporter.addSeverity('critical');
        await startService.openMobileNumberLogin();
        await loginPage.verifyMobileNumberViewContent();
        recordActualResult(
            'The mobile number view showed +91, the Mobile number field, the masked Password field, the show/hide toggle, "Forgot ID or Password?", Login and "Don\'t have an account? Sign up now".',
        );
    });

    it('TC_US003_024: Exercise the source requirement without adding behavior: The Login button is inactive (greyed out) until both the mobile number and password fields contain values.', async () => {
        allureReporter.addStory('Login inactive until both mobile fields are filled');
        allureReporter.addSeverity('critical');
        const mobileNumber = fixtures.value('sampleMobileNumber');
        const password = fixtures.value('samplePassword');
        await startService.openMobileNumberLogin();
        await loginPage.verifyLoginActivatesAfterMobileThenPassword(mobileNumber, password);
        recordActualResult(
            'Login stayed inactive with empty fields and with only the mobile number filled, and became active once both fields held values (nothing was submitted).',
        );
    });

    it('TC_US003_028: Exercise the source requirement without adding behavior: The Login button remains inactive until both the mobile number and password fields contain values.', async () => {
        allureReporter.addStory('Login inactive with only the password filled');
        allureReporter.addSeverity('critical');
        const mobileNumber = fixtures.value('sampleMobileNumber');
        const password = fixtures.value('samplePassword');
        await startService.openMobileNumberLogin();
        await loginPage.verifyLoginActivatesAfterPasswordThenMobile(password, mobileNumber);
        recordActualResult(
            'Login stayed inactive with only the password filled and became active once the mobile number was filled too (nothing was submitted).',
        );
    });
});
