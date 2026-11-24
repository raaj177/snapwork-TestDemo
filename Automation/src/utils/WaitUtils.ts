import { logger, describeError } from './Logger';
import { TIMEOUTS } from '../constants/timeouts';
import type { ElementLocator } from './Locators';

const log = logger.child({ module: 'WaitUtils' });

/** Bounded, polling waits. Never use fixed sleeps as synchronization. */
export class WaitUtils {
    /** Waits until the element is displayed. */
    static async forDisplayed(locator: ElementLocator, description: string, timeout: number = TIMEOUTS.standard): Promise<void> {
        log.info(`Waiting for ${description} to be displayed`);
        const started = Date.now();
        try {
            await locator().waitForDisplayed({
                timeout,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `${description} was not displayed within ${timeout / 1000} s`,
            });
            log.info(`${description} shown after ${((Date.now() - started) / 1000).toFixed(1)} s`);
        } catch (error) {
            log.error(`${description} not shown within ${timeout / 1000} s: ${describeError(error)}`);
            throw error;
        }
    }

    /** Waits until the element exists in the hierarchy. */
    static async forExist(locator: ElementLocator, description: string, timeout: number = TIMEOUTS.standard): Promise<void> {
        log.info(`Waiting for ${description} to exist`);
        try {
            await locator().waitForExist({
                timeout,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `${description} did not exist within ${timeout / 1000} s`,
            });
            log.info(`${description} exists`);
        } catch (error) {
            log.error(`Failed waiting for ${description} to exist: ${describeError(error)}`);
            throw error;
        }
    }

    /** Waits until the element is enabled. */
    static async forEnabled(locator: ElementLocator, description: string, timeout: number = TIMEOUTS.standard): Promise<void> {
        log.info(`Waiting for ${description} to be enabled`);
        try {
            await locator().waitForEnabled({
                timeout,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `${description} was not enabled within ${timeout / 1000} s`,
            });
            log.info(`${description} is enabled`);
        } catch (error) {
            log.error(`Failed waiting for ${description} to be enabled: ${describeError(error)}`);
            throw error;
        }
    }

    /** Waits until the element is clickable (displayed and enabled). */
    static async forClickable(locator: ElementLocator, description: string, timeout: number = TIMEOUTS.standard): Promise<void> {
        log.info(`Waiting for ${description} to be clickable`);
        try {
            await locator().waitForClickable({
                timeout,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `${description} was not clickable within ${timeout / 1000} s`,
            });
            log.info(`${description} is clickable`);
        } catch (error) {
            log.error(`Failed waiting for ${description} to be clickable: ${describeError(error)}`);
            throw error;
        }
    }

    /** Waits until the element is gone. */
    static async forAbsent(locator: ElementLocator, description: string, timeout: number = TIMEOUTS.standard): Promise<void> {
        log.info(`Waiting for ${description} to disappear`);
        try {
            await locator().waitForDisplayed({
                timeout,
                reverse: true,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `${description} was still shown after ${timeout / 1000} s`,
            });
            log.info(`${description} is gone`);
        } catch (error) {
            log.error(`Failed waiting for ${description} to disappear: ${describeError(error)}`);
            throw error;
        }
    }

    /** Waits until the element's text contains the expected text. */
    static async forText(
        locator: ElementLocator,
        expected: string,
        description: string,
        timeout: number = TIMEOUTS.standard,
    ): Promise<void> {
        log.info(`Waiting for ${description} to show the expected text`);
        try {
            await browser.waitUntil(async () => (await locator().getText()).includes(expected), {
                timeout,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `${description} did not show the expected text within ${timeout / 1000} s`,
            });
            log.info(`${description} shows the expected text`);
        } catch (error) {
            log.error(`Failed waiting for text on ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Polls a condition until it is true. */
    static async until(condition: () => Promise<boolean>, description: string, timeout: number = TIMEOUTS.standard): Promise<void> {
        log.info(`Waiting until ${description}`);
        try {
            await browser.waitUntil(condition, {
                timeout,
                interval: TIMEOUTS.pollInterval,
                timeoutMsg: `Timed out after ${timeout / 1000} s waiting until ${description}`,
            });
            log.info(`Condition met: ${description}`);
        } catch (error) {
            log.error(`Failed waiting until ${description}: ${describeError(error)}`);
            throw error;
        }
    }
}
