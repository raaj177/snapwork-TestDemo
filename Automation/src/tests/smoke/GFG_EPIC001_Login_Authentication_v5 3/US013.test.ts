// P0 smoke cases of US-013. Logout.
// Only workbook rows with Automation Candidate = Yes and Priority = P0 are implemented here; P1/P2 cases of this
// story go in src/tests/regression/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_1/. Write and change these tests here (this file is not generated).
import allureReporter from '@wdio/allure-reporter';
import { createDashboardPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const dashboardPage = createDashboardPage();

describe('US013 Logout', () => {
    it('TC_US013_003: Perform the documented action for Logout Option (In-App) on the logout flow.', async () => {
        allureReporter.addStory('In-app logout with confirmation');
        allureReporter.addSeverity('blocker');
        await startService.loginThenLogout();
        await dashboardPage.verifyNotShown();
        recordActualResult(
            'More > Logout showed "Are you sure you want to logout?"; confirming returned to the login screen with the user code shown.',
        );
    });

    it('TC_US013_006: Verify the session and username state immediately after logout.', async () => {
        allureReporter.addStory('Session cleared, username kept');
        allureReporter.addSeverity('blocker');
        const userCode = await startService.loginThenLogout();
        await startService.relaunchAndVerifyLoginOnly(userCode);
        recordActualResult(
            'After logout the login screen showed the user code; relaunching the app showed the login screen again, not the Dashboard.',
        );
    });

    it('TC_US013_008: Use Android Back after logout and verify the authenticated screen does not return.', async () => {
        allureReporter.addStory('Back after logout');
        allureReporter.addSeverity('blocker');
        const userCode = await startService.loginThenLogout();
        await startService.pressBackAndVerifyLoginOnly(userCode);
        recordActualResult('Back after logout did not return to the Dashboard; returning to the app showed the login screen.');
    });

    it('TC_US013_015: Exercise the source requirement without adding behavior: Tapping Logout clears the active session and returns the user to the login screen with user name.', async () => {
        allureReporter.addStory('Logout returns to login with user name');
        allureReporter.addSeverity('blocker');
        const userCode = await startService.loginThenLogout();
        await startService.relaunchAndVerifyLoginOnly(userCode);
        recordActualResult('Logout returned to the login screen with the user code; the session was gone after a relaunch.');
    });

    it('TC_US013_017: Exercise the source requirement without adding behavior: All cached portfolio and transaction data becomes inaccessible after logout.', async () => {
        allureReporter.addStory('Cached data inaccessible after logout');
        allureReporter.addSeverity('blocker');
        const userCode = await startService.loginThenLogout();
        await startService.relaunchAndVerifyLoginOnly(userCode);
        recordActualResult(
            'After logout and relaunch only the login screen was shown; the Dashboard with portfolio and transaction data could not be reached.',
        );
    });

    it('TC_US013_019: Exercise the source requirement without adding behavior: After logout, all cached portfolio and transaction data is inaccessible without re-authentication.', async () => {
        allureReporter.addStory('Re-authentication required after logout');
        allureReporter.addSeverity('blocker');
        const userCode = await startService.loginThenLogout();
        await startService.pressBackAndVerifyLoginOnly(userCode);
        await startService.relaunchAndVerifyLoginOnly(userCode);
        recordActualResult(
            'After logout, Back and a relaunch both led to the login screen; portfolio and transaction data needed a new login.',
        );
    });
});
