// App lifecycle helpers. App identifiers come only from configuration (.env, read from the app build).
import { env } from '../../config/env';
import { logger, describeError } from '../utils/Logger';
import { retryOnHang } from '../utils/RetryUtils';

/** The first screen check of a launch step (it runs inside the step, so a freeze there is retried). */
export type ScreenCheck = () => Promise<void>;

export class AppService {
    protected readonly logger = logger.child({ service: 'AppService' });

    /** The configured app ID: APP_PACKAGE (Android) or BUNDLE_ID (iOS). */
    appId(): string {
        this.logger.debug('Resolving the app ID');
        try {
            const id = driver.isIOS ? env.BUNDLE_ID : env.APP_PACKAGE;
            if (!id) throw new Error(driver.isIOS ? 'BUNDLE_ID is not set in .env' : 'APP_PACKAGE is not set in .env');
            return id;
        } catch (error) {
            this.logger.error(`Failed to resolve the app ID: ${describeError(error)}`);
            throw error;
        }
    }

    /** Brings the app to the foreground. */
    async activate(): Promise<void> {
        this.logger.info('Activating the app');
        try {
            await driver.activateApp(this.appId());
            this.logger.info('App activated');
        } catch (error) {
            this.logger.error(`Failed to activate the app: ${describeError(error)}`);
            throw error;
        }
    }

    /** Stops the app. */
    async terminate(): Promise<void> {
        this.logger.info('Terminating the app');
        try {
            await driver.terminateApp(this.appId());
            this.logger.info('App terminated');
        } catch (error) {
            this.logger.error(`Failed to terminate the app: ${describeError(error)}`);
            throw error;
        }
    }

    /** Terminates and relaunches the app (fresh launch without clearing data). */
    async freshLaunch(): Promise<void> {
        this.logger.info('Fresh launch of the app');
        try {
            await this.terminate();
            await this.activate();
            this.logger.info('App relaunched');
        } catch (error) {
            this.logger.error(`Failed to relaunch the app: ${describeError(error)}`);
            throw error;
        }
    }

    /**
     * Launch step: close, relaunch, settle, then the first screen check, retried together on a UiAutomator2 freeze
     * (STEP_MAX_ATTEMPTS). App data is never cleared here: tests reach their start screen through in-app navigation.
     */
    async closeAndRelaunch(firstScreenCheck: ScreenCheck): Promise<void> {
        this.logger.info('Close and relaunch of the app started');
        try {
            await retryOnHang(env.STEP_MAX_ATTEMPTS, async () => {
                await this.terminate();
                await this.activate();
                // Freeze avoidance only (Flutter cold start), never synchronization: the check below polls.
                await driver.pause(env.APP_START_SETTLE_MS);
                await firstScreenCheck();
            });
            this.logger.info('Relaunch finished; first screen verified');
        } catch (error) {
            this.logger.error(`Close and relaunch failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Brings the app back to the foreground and runs the screen check, retried together on a freeze. */
    async activateAndCheck(firstScreenCheck: ScreenCheck): Promise<void> {
        this.logger.info('Activating the app and checking its screen');
        try {
            await retryOnHang(env.STEP_MAX_ATTEMPTS, async () => {
                await this.activate();
                await driver.pause(env.APP_START_SETTLE_MS);
                await firstScreenCheck();
            });
            this.logger.info('App active; screen verified');
        } catch (error) {
            this.logger.error(`Activate and check failed: ${describeError(error)}`);
            throw error;
        }
    }

    /** Presses the Android hardware Back key. */
    async pressBack(): Promise<void> {
        this.logger.info('Pressing the device Back key');
        try {
            await driver.back();
            this.logger.info('Back pressed');
        } catch (error) {
            this.logger.error(`Failed to press Back: ${describeError(error)}`);
            throw error;
        }
    }

    /** True when the app is in the foreground (state 4). */
    async isInForeground(): Promise<boolean> {
        this.logger.info('Checking whether the app is in the foreground');
        try {
            const state = await driver.queryAppState(this.appId());
            const foreground = state === 4;
            this.logger.info(`App in foreground: ${foreground}`);
            return foreground;
        } catch (error) {
            this.logger.error(`Failed to query the app state: ${describeError(error)}`);
            throw error;
        }
    }
}

export const appService = new AppService();
