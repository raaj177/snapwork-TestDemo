// Change Password screen (voluntary change from Security Settings). Nothing is saved by these methods.
// Locators verified in evidence/android/ChangePassword/ (default, expiry-90-days-selected).
import { SCREEN_WAIT, STATE_WAIT } from '../../constants/timeouts';
import { describeError, logger } from '../../utils/Logger';
import { BasePage, type ElementLocator } from './BasePage';

const log = logger.child({ module: 'ChangePasswordPage' });

export type ExpiryDays = 90 | 120 | 180;

/** The expiry date the screen should show for a choice: today + days, written d/M/yyyy as the app shows it. */
export function expectedExpiryDate(days: ExpiryDays, today: Date = new Date()): string {
    log.debug(`Computing the expiry date for ${days} days`);
    try {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
        const text = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        log.debug(`Expected expiry date: ${text}`);
        return text;
    } catch (error) {
        log.error(`Failed to compute the expiry date: ${describeError(error)}`);
        throw error;
    }
}

export class ChangePasswordPage extends BasePage {
    readonly heading: ElementLocator;
    readonly currentPasswordLabel: ElementLocator;
    readonly newPasswordLabel: ElementLocator;
    readonly retypePasswordLabel: ElementLocator;
    readonly expiryDaysLabel: ElementLocator;
    readonly expiryDate: ElementLocator;
    readonly cancelButton: ElementLocator;
    readonly saveButton: ElementLocator;

    constructor() {
        super();
        this.heading = this.byLabel('Change Password');
        this.currentPasswordLabel = this.byLabel('Current Password');
        this.newPasswordLabel = this.byLabel('New Password');
        this.retypePasswordLabel = this.byLabel('Retype New Password');
        this.expiryDaysLabel = this.byLabel('Expiry Days');
        // The date is part of the description; no builder matches a prefix, so XPath (handoff Note).
        this.expiryDate = this.byXPath('//*[starts-with(@content-desc, "Password Expiry Date:")]');
        this.cancelButton = this.byRole('button', 'Cancel');
        this.saveButton = this.byRole('button', 'Save');
    }

    protected anchor(): ElementLocator {
        return this.currentPasswordLabel;
    }

    /** One pill of the Expiry Days selector ("90 Days", "120 Days", "180 Days"). */
    expiryPill(days: ExpiryDays): ElementLocator {
        this.logger.debug(`Expiry pill locator for ${days} days`);
        try {
            const locator = this.byLabel(`${days} Days`);
            this.logger.debug('Expiry pill locator built');
            return locator;
        } catch (error) {
            this.logger.error(`Failed to build the expiry pill locator: ${describeError(error)}`);
            throw error;
        }
    }

    async selectExpiryDays(days: ExpiryDays): Promise<void> {
        this.logger.info(`Selecting the ${days}-day password expiry`);
        try {
            await this.tap(this.expiryPill(days), `the "${days} Days" expiry option`);
            this.logger.info(`${days}-day expiry selected`);
        } catch (error) {
            this.logger.error(`Failed to select the ${days}-day expiry: ${describeError(error)}`);
            throw error;
        }
    }

    async tapCancel(): Promise<void> {
        this.logger.info('Leaving Change Password with Cancel');
        try {
            await this.tap(this.cancelButton, 'the Cancel button');
            this.logger.info('Cancel tapped');
        } catch (error) {
            this.logger.error(`Failed to tap Cancel: ${describeError(error)}`);
            throw error;
        }
    }

    async verifyVisible(): Promise<void> {
        this.logger.info('Verifying the Change Password screen');
        try {
            await this.expectDisplayed(this.heading, 'the Change Password heading', SCREEN_WAIT);
            await this.expectDisplayed(this.currentPasswordLabel, 'the Current Password field');
            await this.expectDisplayed(this.newPasswordLabel, 'the New Password field');
            await this.expectDisplayed(this.retypePasswordLabel, 'the Retype New Password field');
            this.logger.info('Change Password screen verified');
        } catch (error) {
            this.logger.error(`Change Password screen verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The Expiry Days selector offers 90, 120 and 180 days. */
    async verifyExpiryOptions(): Promise<void> {
        this.logger.info('Verifying the Expiry Days options');
        try {
            await this.expectDisplayed(this.expiryDaysLabel, 'the Expiry Days label');
            for (const days of [90, 120, 180] as const) {
                await this.expectDisplayed(this.expiryPill(days), `the "${days} Days" option`);
            }
            this.logger.info('Expiry Days options verified');
        } catch (error) {
            this.logger.error(`Expiry Days options verification failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The shown Password Expiry Date equals today + the chosen days (polls until the screen updates). */
    async verifyExpiryDateFor(days: ExpiryDays): Promise<void> {
        const expected = `Password Expiry Date: ${expectedExpiryDate(days)}`;
        this.logger.info(`Verifying "${expected}"`);
        try {
            await this.expectAttribute(this.expiryDate, 'content-desc', expected, 'the Password Expiry Date', STATE_WAIT);
            this.logger.info(`"${expected}" shown`);
        } catch (error) {
            this.logger.error(`Password Expiry Date check failed: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- flow methods ----

    /** Offers 90, 120 and 180 days; each choice updates the expiry date. Leaves with Cancel (nothing is saved). */
    async verifyExpiryDaysSelectorThenCancel(): Promise<void> {
        this.logger.info('Verifying the Expiry Days selector (90, 180, 120), then Cancel');
        try {
            await this.verifyVisible();
            await this.verifyExpiryOptions();
            for (const days of [90, 180, 120] as const) {
                await this.selectExpiryDays(days);
                await this.verifyExpiryDateFor(days);
            }
            await this.tapCancel();
            this.logger.info('Expiry Days selector verified for 90, 180 and 120 days; left with Cancel');
        } catch (error) {
            this.logger.error(`Expiry Days selector check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The Change Password screen is shown; leaves with Cancel (nothing is saved). */
    async verifyOpenThenCancel(): Promise<void> {
        this.logger.info('Verifying the Change Password screen, then Cancel');
        try {
            await this.verifyVisible();
            await this.tapCancel();
            this.logger.info('Change Password screen shown; left with Cancel');
        } catch (error) {
            this.logger.error(`Change Password open/cancel check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Changing the selection recalculates the date: each choice shows today + that many days. Leaves with Cancel. */
    async verifyExpiryDateRecalculatesThenCancel(): Promise<void> {
        this.logger.info('Verifying the expiry date recalculates on every selection change, then Cancel');
        try {
            await this.verifyVisible();
            for (const days of [180, 90, 120, 180] as const) {
                await this.selectExpiryDays(days);
                await this.verifyExpiryDateFor(days);
            }
            await this.tapCancel();
            this.logger.info('Expiry date recalculated for 180, 90, 120 and 180 days; left with Cancel');
        } catch (error) {
            this.logger.error(`Expiry date recalculation check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** The label reads "Password Expiry Date: DD/MM/YYYY" (two-digit day and month, as the workbook requires). Leaves with Cancel. */
    async verifyExpiryDateFormatThenCancel(): Promise<void> {
        this.logger.info('Verifying the "Password Expiry Date: DD/MM/YYYY" format, then Cancel');
        try {
            await this.verifyVisible();
            await this.selectExpiryDays(90);
            await this.expectDisplayed(this.expiryDate, 'the Password Expiry Date', STATE_WAIT);
            const formatted = this.byXPath(
                '//*[starts-with(@content-desc, "Password Expiry Date: ") and string-length(@content-desc) = 32 and ' +
                    'translate(substring(@content-desc, 23), "0123456789", "dddddddddd") = "dd/dd/dddd"]',
            );
            await this.expectDisplayed(formatted, 'the Password Expiry Date in DD/MM/YYYY format', STATE_WAIT);
            await this.tapCancel();
            this.logger.info('"Password Expiry Date: DD/MM/YYYY" shown; left with Cancel');
        } catch (error) {
            this.logger.error(`Password Expiry Date format check failed: ${describeError(error)}`);
            throw error;
        }
    }
}
