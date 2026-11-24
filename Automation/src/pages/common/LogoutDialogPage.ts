// In-app logout confirmation bottom sheet. Locators verified in evidence/android/LogoutDialog/default.xml.
import { SCREEN_WAIT } from '../../constants/timeouts';
import { describeError } from '../../utils/Logger';
import { BasePage, type ElementLocator } from './BasePage';

export class LogoutDialogPage extends BasePage {
    readonly question: ElementLocator;
    readonly cancelButton: ElementLocator;
    readonly logoutButton: ElementLocator;

    constructor() {
        super();
        this.question = this.byLabel('Are you sure you want to logout?');
        this.cancelButton = this.byRole('button', 'Cancel');
        this.logoutButton = this.byRole('button', 'Logout');
    }

    protected anchor(): ElementLocator {
        return this.question;
    }

    async confirmLogout(): Promise<void> {
        this.logger.info('Confirming logout');
        try {
            await this.tap(this.logoutButton, 'the Logout button of the logout dialog');
            this.logger.info('Logout confirmed');
        } catch (error) {
            this.logger.error(`Failed to confirm logout: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyVisible(): Promise<void> {
        this.logger.info('Verifying the logout confirmation dialog');
        try {
            await this.expectDisplayed(this.question, 'the logout confirmation dialog', SCREEN_WAIT);
            await this.expectDisplayed(this.cancelButton, 'the Cancel button');
            await this.expectDisplayed(this.logoutButton, 'the Logout button of the dialog');
            this.logger.info('Logout confirmation dialog verified');
        } catch (error) {
            this.logger.error(`Logout dialog verification failed: ${describeError(error)}`);
            throw error;
        }
    }
}
