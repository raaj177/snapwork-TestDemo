// Reusable mobile assertions built on expect-webdriverio (polling, explicit waits).
import { logger, describeError } from '../utils/Logger';
import { TIMEOUTS } from '../constants/timeouts';
import type { ElementLocator } from '../utils/Locators';

const log = logger.child({ module: 'mobile.assertions' });

/** Asserts a boolean read by a polling page method (isShown, waitUntil...) with a message naming what was expected. */
export function expectTrue(value: boolean, message: string): void {
    log.info(`Checking: ${message}`);
    try {
        if (!value) throw new Error(message);
        log.info('Check passed');
    } catch (error) {
        log.error(`Check failed: ${describeError(error)}`);
        throw error;
    }
}

/** Asserts that each element is displayed. */
export async function assertAllDisplayed(
    items: ReadonlyArray<[ElementLocator, string]>,
    timeout: number = TIMEOUTS.standard,
): Promise<void> {
    log.info(`Checking that ${items.length} element(s) are displayed`);
    try {
        for (const [locator, description] of items) {
            await expect(locator()).toBeDisplayed({
                wait: timeout,
                interval: TIMEOUTS.pollInterval,
                message: `${description} was not displayed`,
            });
        }
        log.info('All elements displayed');
    } catch (error) {
        log.error(`Display check failed: ${describeError(error)}`);
        throw error;
    }
}
