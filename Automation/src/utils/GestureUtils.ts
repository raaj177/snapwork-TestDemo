import { logger, describeError } from './Logger';
import type { ElementLocator } from './Locators';

const log = logger.child({ module: 'GestureUtils' });

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Centralized gestures (swipe, scroll into view, hide keyboard). */
export class GestureUtils {
    /** Swipes the screen in a direction (W3C actions through WebdriverIO's swipe). */
    static async swipe(direction: Direction, percent = 0.6): Promise<void> {
        log.info(`Swiping ${direction}`);
        try {
            await driver.swipe({ direction, percent });
            log.info(`Swiped ${direction}`);
        } catch (error) {
            log.error(`Failed to swipe ${direction}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Scrolls until the element is displayed (bounded number of swipes). */
    static async scrollIntoView(locator: ElementLocator, description: string, maxScrolls = 8): Promise<void> {
        log.info(`Scrolling to ${description}`);
        try {
            await locator().scrollIntoView({ maxScrolls });
            log.info(`${description} is in view`);
        } catch (error) {
            log.error(`Failed to scroll to ${description}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Hides the soft keyboard when it is shown. */
    static async hideKeyboard(): Promise<void> {
        log.info('Hiding the keyboard');
        try {
            if (await driver.isKeyboardShown()) {
                // The IME "Done" action first: driver.hideKeyboard() presses Back on Android, and in this Flutter app Back can
                // leave the form (an earlier login screen with an empty password comes back). Done only closes the keyboard.
                await driver.execute('mobile: performEditorAction', { action: 'done' });
                if (await driver.isKeyboardShown()) {
                    log.warn('The keyboard stayed open after Done: closing it with Back');
                    await driver.hideKeyboard();
                }
                log.info('Keyboard hidden');
            } else {
                log.info('Keyboard was not shown');
            }
        } catch (error) {
            log.error(`Failed to hide the keyboard: ${describeError(error)}`);
            throw error;
        }
    }
}
