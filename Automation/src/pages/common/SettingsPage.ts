// Settings list (More > Settings). Locators verified in evidence/android/Settings/default.xml.
import { SCREEN_WAIT } from '../../constants/timeouts';
import { describeError } from '../../utils/Logger';
import { BasePage, type ElementLocator } from './BasePage';

export class SettingsPage extends BasePage {
    readonly orderSettingsRow: ElementLocator;
    readonly securitySettingsRow: ElementLocator;

    constructor() {
        super();
        this.orderSettingsRow = this.byLabel('Order Settings');
        this.securitySettingsRow = this.byLabel('Security Settings');
    }

    protected anchor(): ElementLocator {
        return this.orderSettingsRow;
    }

    async tapSecuritySettings(): Promise<void> {
        this.logger.info('Opening Security Settings');
        try {
            await this.expectDisplayed(this.orderSettingsRow, 'the Order Settings row', SCREEN_WAIT);
            await this.tap(this.securitySettingsRow, 'the Security Settings row');
            this.logger.info('Security Settings opened');
        } catch (error) {
            this.logger.error(`Failed to open Security Settings: ${describeError(error)}`);
            throw error;
        }
    }
}
