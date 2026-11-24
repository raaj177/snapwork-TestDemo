// Dashboard (first authenticated screen of the account used by the tests) and its bottom tab bar.
// Locators verified in evidence/android/Dashboard/default.xml.
import { BACKEND_WAIT } from '../../constants/timeouts';
import { describeError } from '../../utils/Logger';
import { BasePage, type ElementLocator } from './BasePage';

export abstract class DashboardPage extends BasePage {
    readonly title: ElementLocator;
    readonly searchButton: ElementLocator;
    // TalkBack tab wording ("Tab 4 of 4") is platform-specific
    abstract readonly dashboardTab: ElementLocator;
    abstract readonly moreTab: ElementLocator;

    constructor() {
        super();
        this.title = this.byRole('image', 'Dashboard');
        this.searchButton = this.byRole('button', 'Search');
    }

    protected anchor(): ElementLocator {
        return this.moreTab;
    }

    async tapMoreTab(): Promise<void> {
        this.logger.info('Opening the More tab');
        try {
            await this.tap(this.moreTab, 'the More tab');
            this.logger.info('More tab opened');
        } catch (error) {
            this.logger.error(`Failed to open the More tab: ${describeError(error)}`);
            throw error;
        }
    }

    /** Returns to the Dashboard home tab from any tab of a live session (used when a session is reused). */
    async openDashboardTab(): Promise<void> {
        this.logger.info('Opening the Dashboard tab');
        try {
            await this.tap(this.dashboardTab, 'the Dashboard tab');
            await this.verifyVisible();
            this.logger.info('Dashboard tab open');
        } catch (error) {
            this.logger.error(`Failed to open the Dashboard tab: ${describeError(error)}`);
            throw error;
        }
    }

    /** The Dashboard is shown after a back-end login. */
    async verifyVisible(): Promise<void> {
        this.logger.info('Verifying the Dashboard');
        try {
            await this.expectDisplayed(this.title, 'the Dashboard header', BACKEND_WAIT);
            await this.expectDisplayed(this.moreTab, 'the More tab');
            this.logger.info('Dashboard verified');
        } catch (error) {
            this.logger.error(`Dashboard verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Authenticated content absent: call only after a positive anchor of another screen was verified. */
    async verifyNotShown(): Promise<void> {
        this.logger.info('Verifying the Dashboard is not shown');
        try {
            await this.expectAbsent(this.title, 'the Dashboard header');
            await this.expectAbsent(this.moreTab, 'the More tab');
            this.logger.info('Dashboard is not shown');
        } catch (error) {
            this.logger.error(`Dashboard absence check failed: ${describeError(error)}`);
            throw error;
        }
    }
}
