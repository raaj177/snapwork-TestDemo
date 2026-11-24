import { logger, describeError } from './Logger';
import type { PlatformName } from '../constants/platforms';

const log = logger.child({ module: 'PlatformUtils' });

/** Platform of the running session (falls back to PLATFORM when no session exists). */
export function currentPlatform(): PlatformName {
    log.debug('Resolving the current platform');
    try {
        const hasDriver = typeof (globalThis as { driver?: unknown }).driver !== 'undefined';
        const platform: PlatformName = hasDriver
            ? driver.isIOS
                ? 'ios'
                : 'android'
            : (process.env.PLATFORM ?? 'android').toLowerCase() === 'ios'
              ? 'ios'
              : 'android';
        log.debug(`Current platform: ${platform}`);
        return platform;
    } catch (error) {
        log.error(`Failed to resolve the platform: ${describeError(error)}`);
        throw error;
    }
}

/** True on Android. */
export function isAndroid(): boolean {
    log.debug('Checking for Android');
    try {
        const result = currentPlatform() === 'android';
        log.debug(`isAndroid: ${result}`);
        return result;
    } catch (error) {
        log.error(`Failed to check the platform: ${describeError(error)}`);
        throw error;
    }
}
