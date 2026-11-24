// More tab: profile header, Settings, ..., Logout. Locators verified in evidence/android/More/.
import { SCREEN_WAIT } from '../../constants/timeouts';
import { describeError } from '../../utils/Logger';
import { BasePage, type ElementLocator } from './BasePage';

export class MorePage extends BasePage {
    readonly heading: ElementLocator;
    readonly settingsRow: ElementLocator;
    readonly logoutRow: ElementLocator;

    constructor() {
        super();
        this.heading = this.byLabel('More');
        this.settingsRow = this.byLabel('Settings');
        this.logoutRow = this.byLabel('Logout');
    }

    protected anchor(): ElementLocator {
        return this.heading;
    }

    async tapSettings(): Promise<void> {
        this.logger.info('Opening Settings');
        try {
            await this.tap(this.settingsRow, 'the Settings row');
            this.logger.info('Settings opened');
        } catch (error) {
            this.logger.error(`Failed to open Settings: ${describeError(error)}`);
            throw error;
        }
    }

    /** Scrolls to the Logout row (below the fold) and taps it. */
    async tapLogout(): Promise<void> {
        this.logger.info('Tapping Logout on the More tab');
        try {
            await this.expectDisplayed(this.heading, 'the More heading', SCREEN_WAIT);
            if (!(await this.isDisplayedWithin(this.logoutRow, 1000, 'the Logout row'))) {
                await this.scrollTo(this.logoutRow, 'the Logout row');
            }
            await this.tap(this.logoutRow, 'the Logout row');
            this.logger.info('Logout row tapped');
        } catch (error) {
            this.logger.error(`Failed to tap Logout: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyVisible(): Promise<void> {
        this.logger.info('Verifying the More tab');
        try {
            await this.expectDisplayed(this.heading, 'the More heading', SCREEN_WAIT);
            await this.expectDisplayed(this.settingsRow, 'the Settings row');
            this.logger.info('More tab verified');
        } catch (error) {
            this.logger.error(`More tab verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The Logout option is on the More tab (scrolled into view when needed) and can be tapped. */
    async verifyLogoutOptionAvailable(): Promise<void> {
        this.logger.info('Verifying the Logout option is available on the More tab');
        try {
            await this.expectDisplayed(this.heading, 'the More heading', SCREEN_WAIT);
            if (!(await this.isDisplayedWithin(this.logoutRow, 1000, 'the Logout row'))) {
                await this.scrollTo(this.logoutRow, 'the Logout row');
            }
            await this.expectDisplayed(this.logoutRow, 'the Logout option');
            this.logger.info('Logout option shown (not tapped)');
        } catch (error) {
            this.logger.error(`Logout option check failed: ${describeError(error)}`);
            throw error;
        }
    }
}
