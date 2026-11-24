// P0 smoke cases of US-007. Password Change Reminder.
// Only workbook rows with Automation Candidate = Yes and Priority = P0 are implemented here; P1/P2 cases of this
// story go in src/tests/regression/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_1/. Write and change these tests here (this file is not generated).
import allureReporter from '@wdio/allure-reporter';
import { createReturningLoginPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const returningLoginPage = createReturningLoginPage();

describe('US007 Password Change Reminder', () => {
    it('TC_US007_008: Exercise the source requirement without adding behavior: Switch Account and Forgot Password? links remain visible alongside the Login button.', async () => {
        allureReporter.addStory('Links beside Login on the returning-user screen');
        allureReporter.addSeverity('critical');
        await startService.openReturningLogin();
        await returningLoginPage.verifyLinksBesideLogin();
        recordActualResult('The returning-user login screen showed Switch Account and "Forgot ID or Password?" with the Login button.');
    });

    it('TC_US007_015: Exercise the source requirement without adding behavior: The pre-filled username and code is a local convenience — the password is never pre-filled.', async () => {
        allureReporter.addStory('Password never pre-filled');
        allureReporter.addSeverity('critical');
        const userCode = await startService.openReturningLogin();
        await returningLoginPage.verifyUserCodeShownAndPasswordEmpty(userCode);
        recordActualResult('The returning-user screen showed the remembered user code while the Password field was empty.');
    });
});
