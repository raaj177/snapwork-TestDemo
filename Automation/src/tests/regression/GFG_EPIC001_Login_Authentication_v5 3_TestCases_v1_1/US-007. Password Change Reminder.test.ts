// P1/P2 regression cases of US-007. Password Change Reminder.
// Only workbook rows with Automation Candidate = Yes and Priority P1/P2 are implemented here; P0 cases of this story
// live only in src/tests/smoke/GFG_EPIC001_Login_Authentication_v5 3/. Specs only call page and start-service methods.
import allureReporter from '@wdio/allure-reporter';
import { createReturningLoginPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const returningLoginPage = createReturningLoginPage();

describe('US007 Password Change Reminder', () => {
    it('TC_US007_001: Verify Pre-filled User Name & Code Display is shown on the returning-user login screen.', async () => {
        allureReporter.addStory('Remembered user name and code');
        allureReporter.addSeverity('minor');
        const userCode = await startService.openReturningLogin();
        await returningLoginPage.verifyUserNameAndCodeShown(userCode);
        recordActualResult('The returning-user screen showed the remembered user name above the user code.');
    });
});
