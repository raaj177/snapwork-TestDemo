// P1/P2 regression cases of US-008. Change Password & Password Expiry Reset.
// Only workbook rows with Automation Candidate = Yes and Priority P1/P2 are implemented here; P0 cases of this story
// live only in src/tests/smoke/GFG_EPIC001_Login_Authentication_v5 3/. Specs only call page and start-service methods.
import allureReporter from '@wdio/allure-reporter';
import { createChangePasswordPage, createSecuritySettingsPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const changePasswordPage = createChangePasswordPage();
const securitySettingsPage = createSecuritySettingsPage();

describe('US008 Change Password & Password Expiry Reset', () => {
    it('TC_US008_018: Select each available password expiry duration.', async () => {
        allureReporter.addStory('Each expiry duration selectable');
        allureReporter.addSeverity('normal');
        await startService.openSecuritySettings();
        await securitySettingsPage.tapChangePassword();
        await changePasswordPage.verifyExpiryDaysSelectorThenCancel();
        recordActualResult('90, 120 and 180 Days were offered; each choice updated the expiry date (left with Cancel).');
    });

    it('TC_US008_019: Verify Password Expiry Date recalculates when the selected duration changes', async () => {
        allureReporter.addStory('Expiry date recalculates');
        allureReporter.addSeverity('normal');
        await startService.openSecuritySettings();
        await securitySettingsPage.tapChangePassword();
        await changePasswordPage.verifyExpiryDateRecalculatesThenCancel();
        recordActualResult('Every change of the selection recalculated the date to today plus the chosen days (left with Cancel).');
    });

    it('TC_US008_020: Verify Password Expiry Date label and date format', async () => {
        allureReporter.addStory('Expiry date label and format');
        allureReporter.addSeverity('normal');
        await startService.openSecuritySettings();
        await securitySettingsPage.tapChangePassword();
        await changePasswordPage.verifyExpiryDateFormatThenCancel();
        recordActualResult('The screen showed "Password Expiry Date: DD/MM/YYYY" (left with Cancel).');
    });
});
