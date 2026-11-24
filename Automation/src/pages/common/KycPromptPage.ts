// "Get Started on your Investment Journey!" bottom sheet shown over the Dashboard after some logins.
// Locators verified in evidence/android/KycPrompt/default.xml.
import { describeError } from '../../utils/Logger';
import { BasePage, type ElementLocator } from './BasePage';

export class KycPromptPage extends BasePage {
    readonly heading: ElementLocator;
    readonly doItLaterButton: ElementLocator;
    readonly registerNowButton: ElementLocator;

    constructor() {
        super();
        this.heading = this.byLabel('Get Started on your Investment Journey!');
        this.doItLaterButton = this.byRole('button', "I'll Do It Later");
        this.registerNowButton = this.byRole('button', 'Register Now');
    }

    protected anchor(): ElementLocator {
        return this.heading;
    }

    async tapDoItLater(): Promise<void> {
        this.logger.info('Tapping "I\'ll Do It Later"');
        try {
            await this.tap(this.doItLaterButton, 'the "I\'ll Do It Later" button');
            this.logger.info('"I\'ll Do It Later" tapped');
        } catch (error) {
            this.logger.error(`Failed to tap "I'll Do It Later": ${describeError(error)}`);
            throw error;
        }
    }

    /** Closes the sheet when it is shown within `ms`; does nothing otherwise. Returns whether it was shown. */
    async dismissIfShown(ms: number): Promise<boolean> {
        this.logger.info('Closing the KYC prompt if it is shown');
        try {
            const shown = await this.isDisplayedWithin(this.doItLaterButton, ms, 'the KYC prompt');
            if (shown) await this.tapDoItLater();
            this.logger.info(`KYC prompt ${shown ? 'closed' : 'not shown'}`);
            return shown;
        } catch (error) {
            this.logger.error(`Failed to close the KYC prompt: ${describeError(error)}`);
            throw error;
        }
    }
}
