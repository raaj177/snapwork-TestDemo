// describeError lives in Logger.ts (one redacted line); re-exported here for callers that only need error helpers.
import { describeError, logger } from './Logger';

export { describeError };

const log = logger.child({ module: 'ErrorUtils' });

/** True when the error looks like a lost/hung Appium or UiAutomator2 server (environment problem, not a product result). */
export function isServerHang(error: unknown): boolean {
    log.debug('Checking whether an error is a server hang');
    try {
        const text = describeError(error).toLowerCase();
        const hang = [
            'instrumentation process is not running',
            'socket hang up',
            'econnrefused',
            'session is either terminated',
            'could not proxy',
        ].some((p) => text.includes(p));
        log.debug(`Server hang: ${hang}`);
        return hang;
    } catch (failure) {
        log.error(`Failed to classify the error: ${describeError(failure)}`);
        throw failure;
    }
}
