// P0 smoke cases of US-008. Change Password & Password Expiry Reset.
// Only workbook rows with Automation Candidate = Yes and Priority = P0 are implemented here; P1/P2 cases of this
// story go in src/tests/regression/GFG_EPIC001_Login_Authentication_v5 3_TestCases_v1_1/. Write and change these tests here (this file is not generated).
import allureReporter from '@wdio/allure-reporter';
import { createChangePasswordPage, createSecuritySettingsPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const securitySettingsPage = createSecuritySettingsPage();
const changePasswordPage = createChangePasswordPage();

describe('US008 Change Password & Password Expiry Reset', () => {
    it('TC_US008_026: Exercise the source requirement without adding behavior: Expiry Days Selector: Pill-style selector allowing user to choose password validity period: 90, 120, or 180 days.. Type: Dropdown / Selection. Mandatory: Yes. Validation: Yes', async () => {
        allureReporter.addStory('Expiry Days selector');
        allureReporter.addSeverity('critical');
        await startService.openSecuritySettings();
        await securitySettingsPage.tapChangePassword();
        await changePasswordPage.verifyExpiryDaysSelectorThenCancel();
        recordActualResult(
            'Change Password offered 90, 120 and 180 Days; choosing each updated the Password Expiry Date to today plus that many days (left with Cancel, nothing saved).',
        );
    });

    it('TC_US008_038: Exercise the source requirement without adding behavior: Change Password is also accessible from Profile / Settings for voluntary non-expired changes.', async () => {
        allureReporter.addStory('Change Password from Settings');
        allureReporter.addSeverity('critical');
        await startService.openSecuritySettings();
        await securitySettingsPage.verifyChangePasswordOfferedAndOpen();
        await changePasswordPage.verifyOpenThenCancel();
        recordActualResult(
            'More > Settings > Security Settings offered Change Password, which opened the Change Password screen for a non-expired account (left with Cancel).',
        );
    });
});
