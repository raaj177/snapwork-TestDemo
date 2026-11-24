// Base page: lazy locators, atomic actions with human descriptions, polling checks, step screenshots.
// No `private` anywhere: helpers are protected (platform pages may reuse/override) or public.
import { logger, describeError } from '../../utils/Logger';
import { registerSensitive } from '../../utils/Redactor';
import { TIMEOUTS } from '../../constants/timeouts';
import { AllureEvidence } from '../../reporting/AllureEvidence';
import { GestureUtils } from '../../utils/GestureUtils';
import * as Locators from '../../utils/Locators';
import type { ElementLocator } from '../../utils/Locators';

export type { ElementLocator };

/** Tap descriptions that submit something: a step screenshot is taken before the tap. */
export const SUBMIT_ACTION =
    /\b(login|log in|logout|log out|save|submit|continue|confirm|proceed|next|send|resend|sign up|register|ok|yes|done|apply|update|reset|unlock|verify|try again|change password)\b/i;
/** Descriptions of popups/messages: a step screenshot is taken once they are shown. */
export const POPUP = /\b(popup|pop-up|dialog|alert|toast|snackbar|bottom sheet|message|error)\b/i;

export abstract class BasePage {
    protected readonly logger = logger.child({ page: this.constructor.name });

    // ---- locator builders (priority order) ----
    protected byRole(role: string, name: string): ElementLocator {
        this.logger.debug(`Locator byRole(${role})`);
        return Locators.byRole(role, name);
    }

    protected byId(id: string): ElementLocator {
        this.logger.debug(`Locator byId(${id})`);
        return Locators.byId(id);
    }

    protected byLabel(label: string): ElementLocator {
        this.logger.debug('Locator byLabel');
        return Locators.byLabel(label);
    }

    protected byText(text: string): ElementLocator {
        this.logger.debug('Locator byText');
        return Locators.byText(text);
    }

    protected byXPath(xpath: string): ElementLocator {
        this.logger.debug('Locator byXPath');
        return Locators.byXPath(xpath);
    }

    protected byAria(name: string): ElementLocator {
        this.logger.debug('Locator byAria');
        return Locators.byAria(name);
    }

    protected byCss(selector: string): ElementLocator {
        this.logger.debug('Locator byCss');
        return Locators.byCss(selector);
    }

    // ---- evidence ----
    /** Step screenshot for a submission or popup read another way. Never fails the test. */
    protected async captureScreen(label: string): Promise<void> {
        this.logger.debug(`Capturing the screen: ${label}`);
        try {
            await AllureEvidence.step(label);
            this.logger.info(`Screen captured: ${label}`);
        } catch (error) {
            this.logger.warn(`Screen capture failed (ignored): ${describeError(error)}`);
        }
    }

    // ---- atomic actions ----
    /** Taps an element; screenshots before a submission tap. */
    async tap(locator: ElementLocator, description: string, timeout: number = TIMEOUTS.standard): Promise<void> {
        this.logger.debug(`Tapping ${description}`);
        try {
            const el = locator();
            await el.waitForDisplayed({
                timeout,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `${description} was not displayed within ${timeout / 1000} s`,
            });
            if (SUBMIT_ACTION.test(description)) await this.captureScreen(`before ${description}`);
            await el.click();
            this.logger.debug(`Tapped ${description}`);
        } catch (error) {
            this.logger.error(`Failed to tap ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Types a value; a secret is never logged and is registered with the Redactor. */
    /**
     * Types with real key presses, one character at a time, as a person would. Fallback for Flutter fields: the normal
     * type() sets the text through accessibility, which now and then reaches only the accessibility layer and not the
     * app's own field (the field reads back filled while the app sees it empty).
     */
    async typeWithKeys(locator: ElementLocator, value: string, description: string, secret = false): Promise<void> {
        this.logger.debug(`Typing into ${description} with key presses${secret ? ' (secret)' : ''}`);
        try {
            if (secret) registerSensitive(value);
            const el = locator();
            await el.waitForDisplayed({
                timeout: TIMEOUTS.standard,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `${description} was not displayed`,
            });
            await el.click();
            await el.clearValue();
            await driver.keys(value.split(''));
            this.logger.debug(`Typed into ${description} with key presses`);
        } catch (error) {
            this.logger.error(`Failed to type into ${description} with key presses: ${describeError(error)}`);
            throw error;
        }
    }

    async type(locator: ElementLocator, value: string, description: string, secret = false): Promise<void> {
        this.logger.debug(`Typing into ${description}${secret ? ' (secret)' : ''}`);
        try {
            if (secret) registerSensitive(value);
            const el = locator();
            await el.waitForDisplayed({
                timeout: TIMEOUTS.standard,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `${description} was not displayed`,
            });
            await el.click();
            await el.clearValue();
            await el.setValue(value);
            this.logger.debug(`Typed into ${description}`);
        } catch (error) {
            this.logger.error(`Failed to type into ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Clears a field. */
    async clear(locator: ElementLocator, description: string): Promise<void> {
        this.logger.debug(`Clearing ${description}`);
        try {
            const el = locator();
            await el.waitForDisplayed({ timeout: TIMEOUTS.standard, interval: TIMEOUTS.pollInterval });
            await el.clearValue();
            this.logger.debug(`Cleared ${description}`);
        } catch (error) {
            this.logger.error(`Failed to clear ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Reads an element's text. */
    async textOf(locator: ElementLocator, description: string): Promise<string> {
        this.logger.debug(`Reading the text of ${description}`);
        try {
            const el = locator();
            await el.waitForDisplayed({ timeout: TIMEOUTS.standard, interval: TIMEOUTS.pollInterval });
            const text = await el.getText();
            this.logger.debug(`Read the text of ${description}`);
            return text;
        } catch (error) {
            this.logger.error(`Failed to read the text of ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Scrolls until the element is in view. */
    async scrollTo(locator: ElementLocator, description: string): Promise<void> {
        this.logger.debug(`Scrolling to ${description}`);
        try {
            await GestureUtils.scrollIntoView(locator, description);
            this.logger.debug(`Scrolled to ${description}`);
        } catch (error) {
            this.logger.error(`Failed to scroll to ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Hides the keyboard when shown. */
    async hideKeyboard(): Promise<void> {
        this.logger.debug('Hiding the keyboard');
        try {
            await GestureUtils.hideKeyboard();
            this.logger.debug('Keyboard handled');
        } catch (error) {
            this.logger.error(`Failed to hide the keyboard: ${describeError(error)}`);
            throw error;
        }
    }

    // ---- polling checks for verify... methods ----
    /** Expects the element to be displayed; captures popups once shown. */
    async expectDisplayed(locator: ElementLocator, description: string, timeout: number = TIMEOUTS.standard): Promise<void> {
        this.logger.debug(`Checking that ${description} is displayed`);
        try {
            await expect(locator()).toBeDisplayed({
                wait: timeout,
                interval: TIMEOUTS.pollInterval,
                message: `${description} was not displayed within ${timeout / 1000} s`,
            });
            if (POPUP.test(description)) await this.captureScreen(description);
            this.logger.debug(`${description} is displayed`);
        } catch (error) {
            this.logger.error(`Check failed: ${description} not displayed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Expects the element text to equal (or contain) the expected text. */
    async expectText(
        locator: ElementLocator,
        expected: string,
        description: string,
        contains = false,
        timeout: number = TIMEOUTS.standard,
    ): Promise<void> {
        this.logger.debug(`Checking the text of ${description}`);
        try {
            const options = { wait: timeout, interval: TIMEOUTS.pollInterval, message: `${description} did not show the expected text` };
            if (contains) await expect(locator()).toHaveText(expect.stringContaining(expected), options);
            else await expect(locator()).toHaveText(expected, options);
            this.logger.debug(`${description} shows the expected text`);
        } catch (error) {
            this.logger.error(`Check failed: text of ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Expects an attribute value. */
    async expectAttribute(
        locator: ElementLocator,
        attribute: string,
        expected: string,
        description: string,
        timeout: number = TIMEOUTS.standard,
    ): Promise<void> {
        this.logger.debug(`Checking attribute ${attribute} of ${description}`);
        try {
            await expect(locator()).toHaveAttribute(attribute, expected, {
                wait: timeout,
                interval: TIMEOUTS.pollInterval,
                message: `${description} ${attribute} differs`,
            });
            this.logger.debug(`${description} has the expected ${attribute}`);
        } catch (error) {
            this.logger.error(`Check failed: attribute ${attribute} of ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Expects the element to be enabled. */
    async expectEnabled(locator: ElementLocator, description: string, timeout: number = TIMEOUTS.standard): Promise<void> {
        this.logger.debug(`Checking that ${description} is enabled`);
        try {
            await expect(locator()).toBeEnabled({
                wait: timeout,
                interval: TIMEOUTS.pollInterval,
                message: `${description} was not enabled`,
            });
            this.logger.debug(`${description} is enabled`);
        } catch (error) {
            this.logger.error(`Check failed: ${description} not enabled: ${describeError(error)}`);
            throw error;
        }
    }

    /** One check that the element is absent; call it only after a positive anchor is displayed. */
    async expectAbsent(locator: ElementLocator, description: string): Promise<void> {
        this.logger.debug(`Checking that ${description} is absent`);
        try {
            const shown = await locator()
                .isDisplayed()
                .catch(() => false);
            if (shown) throw new Error(`${description} is displayed but should be absent`);
            this.logger.debug(`${description} is absent`);
        } catch (error) {
            this.logger.error(`Check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /**
     * The KYC "Get Started on your Investment Journey!" bottom sheet can slide up at any moment after login (on the
     * Dashboard, the More tab, ...) and cover the tab bar and the page. Closes it with "I'll Do It Later" when it is shown
     * within ms; returns whether it was closed. Logged-in pages call it before their actions and checks.
     */
    async dismissKycPromptIfShown(ms = 1): Promise<boolean> {
        this.logger.debug('Checking for the KYC prompt');
        try {
            const later = this.byRole('button', "I'll Do It Later");
            if (!(await this.isDisplayedWithin(later, ms, 'the KYC prompt'))) return false;
            // The sheet animates in and out: the button can vanish between "shown" and the click. A failed click is
            // checked again; a prompt that is gone counts as closed, one still shown is clicked once more.
            for (let attempt = 1; attempt <= 2; attempt += 1) {
                const clicked = await later()
                    .click()
                    .then(() => true)
                    .catch(() => false);
                const gone = await later()
                    .waitForDisplayed({ timeout: TIMEOUTS.short, interval: TIMEOUTS.pollInterval, reverse: true })
                    .then(() => true)
                    .catch(() => false);
                if (gone) break;
                if (attempt === 2) throw new Error(`the KYC prompt stayed open (last click ${clicked ? 'done' : 'not possible'})`);
                this.logger.warn('The KYC prompt is still shown after the click: clicking "I\'ll Do It Later" again');
            }
            this.logger.info('KYC prompt closed with "I\'ll Do It Later"');
            return true;
        } catch (error) {
            this.logger.error(`Closing the KYC prompt failed: ${describeError(error)}`);
            throw error;
        }
    }

    /**
     * Runs a logged-in check; when it fails because the KYC prompt slid up over the page, closes the prompt and runs
     * the check once more. Any other failure is rethrown unchanged.
     */
    async withKycPromptHandled<T>(description: string, check: () => Promise<T>): Promise<T> {
        this.logger.debug(`${description} (KYC prompt handled)`);
        try {
            await this.dismissKycPromptIfShown();
            try {
                return await check();
            } catch (first) {
                if (!(await this.dismissKycPromptIfShown(TIMEOUTS.pollInterval))) throw first;
                this.logger.warn(`${description}: the KYC prompt covered the page; checking again after closing it`);
                return await check();
            }
        } catch (error) {
            this.logger.error(`${description} failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** True when the element is displayed within ms (no throw). */
    async isDisplayedWithin(locator: ElementLocator, ms: number, description = 'the element'): Promise<boolean> {
        this.logger.debug(`Checking whether ${description} is shown within ${ms / 1000} s`);
        try {
            const shown = await locator()
                .waitForDisplayed({ timeout: ms, interval: TIMEOUTS.pollInterval })
                .then(() => true)
                .catch(() => false);
            this.logger.debug(`${description} shown: ${shown}`);
            return shown;
        } catch (error) {
            this.logger.error(`Failed to check ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** True when this page's anchor is shown within ms. Pages override anchor(). */
    async isShown(ms: number = TIMEOUTS.short): Promise<boolean> {
        this.logger.debug(`Checking whether ${this.constructor.name} is shown`);
        try {
            const shown = await this.isDisplayedWithin(this.anchor(), ms, this.constructor.name);
            this.logger.debug(`${this.constructor.name} shown: ${shown}`);
            return shown;
        } catch (error) {
            this.logger.error(`Failed to check ${this.constructor.name}: ${describeError(error)}`);
            throw error;
        }
    }

    /** The element that proves this page is shown. */
    protected abstract anchor(): ElementLocator;
}
