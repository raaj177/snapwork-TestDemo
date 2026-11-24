// P1/P2 regression cases of US-011. Enable Biometrics for Two-Factor Authentication.
// Only workbook rows with Automation Candidate = Yes and Priority P1/P2 are implemented here; P0 cases of this story
// live only in src/tests/smoke/GFG_EPIC001_Login_Authentication_v5 3/. Specs only call page and start-service methods.
import allureReporter from '@wdio/allure-reporter';
import { createSecuritySettingsPage } from '../../../pages';
import { recordActualResult } from '../../../reporting/ResultNotes';
import { startService } from '../../../services/start.service';

const securitySettingsPage = createSecuritySettingsPage();

describe('US011 Enable Biometrics for Two-Factor Authentication', () => {
    it('TC_US011_020: Verify Settings — Biometric Toggle is visible and available on the first-login biometric setup screen.', async () => {
        allureReporter.addStory('Biometric toggle in Settings');
        allureReporter.addSeverity('normal');
        await startService.openSecuritySettings();
        await securitySettingsPage.verifyBiometricLoginToggleShown();
        recordActualResult('Security Settings showed the Biometric Login toggle (not switched).');
    });
});
