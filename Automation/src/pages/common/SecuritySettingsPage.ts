// Security Settings (Biometric Login switch, Change Password, TOTP Login).
// Locators verified in evidence/android/SecuritySettings/default.xml.
import { SCREEN_WAIT } from '../../constants/timeouts';
import { describeError } from '../../utils/Logger';
import { BasePage, type ElementLocator } from './BasePage';

export class SecuritySettingsPage extends BasePage {
    readonly biometricLoginSwitch: ElementLocator;
    readonly changePasswordRow: ElementLocator;
    readonly totpLoginRow: ElementLocator;

    constructor() {
        super();
        this.biometricLoginSwitch = this.byRole('switch', 'Biometric Login');
        this.changePasswordRow = this.byRole('image', 'Change Password');
        this.totpLoginRow = this.byRole('image', 'TOTP Login');
    }

    protected anchor(): ElementLocator {
        return this.changePasswordRow;
    }

    async tapChangePassword(): Promise<void> {
        this.logger.info('Opening Change Password from Security Settings');
        try {
            await this.tap(this.changePasswordRow, 'the Change Password row');
            this.logger.info('Change Password opened');
        } catch (error) {
            this.logger.error(`Failed to open Change Password: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyChangePasswordOffered(): Promise<void> {
        this.logger.info('Verifying Change Password is offered in Security Settings');
        try {
            await this.expectDisplayed(this.changePasswordRow, 'the Change Password row', SCREEN_WAIT);
            this.logger.info('Change Password is offered');
        } catch (error) {
            this.logger.error(`Change Password offer check failed: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- flow methods ----

    /** Security Settings offers Change Password, and tapping it opens the Change Password screen. */
    async verifyChangePasswordOfferedAndOpen(): Promise<void> {
        this.logger.info('Verifying Change Password is offered, then opening it');
        try {
            await this.verifyChangePasswordOffered();
            await this.tapChangePassword();
            this.logger.info('Change Password offered and opened');
        } catch (error) {
            this.logger.error(`Opening Change Password from Security Settings failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The Biometric Login toggle is shown in Security Settings (it is not switched). */
    async verifyBiometricLoginToggleShown(): Promise<void> {
        this.logger.info('Verifying the Biometric Login toggle is shown');
        try {
            await this.expectDisplayed(this.biometricLoginSwitch, 'the Biometric Login toggle', SCREEN_WAIT);
            this.logger.info('Biometric Login toggle shown (not switched)');
        } catch (error) {
            this.logger.error(`Biometric Login toggle check failed: ${describeError(error)}`);
            throw error;
        }
    }
}
