// P1/P2 regression cases of US-013. Logout.
// Only workbook rows with Automation Candidate = Yes and Priority P1/P2 are implemented here; P0 cases of this story
// live only in src/tests/smoke/GFG_EPIC001_Login_Authentication_v5 3/. Specs only call page and start-service methods.
import allureReporter from '@wdio/allure-reporter';
import { createMorePage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const morePage = createMorePage();

describe('US013 Logout', () => {
    it('TC_US013_004: Verify Logout Option (In-App) is visible and available on the logout flow.', async () => {
        allureReporter.addStory('Logout option available');
        allureReporter.addSeverity('normal');
        await startService.openMoreTab();
        await morePage.verifyLogoutOptionAvailable();
        recordActualResult('The More tab showed the Logout option (not tapped).');
    });
});
