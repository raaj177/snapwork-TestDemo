import { logger, describeError } from './Logger';

const log = logger.child({ module: 'RetryUtils' });

/** Retries an idempotent action a bounded number of times (no fixed sleep between attempts beyond a short backoff). */
export async function retry<T>(action: () => Promise<T>, description: string, attempts = 3, backoffMs = 500): Promise<T> {
    log.info(`Running "${description}" with up to ${attempts} attempts`);
    let lastError: unknown;
    try {
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                const result = await action();
                log.info(`"${description}" succeeded on attempt ${attempt}`);
                return result;
            } catch (error) {
                lastError = error;
                log.warn(`"${description}" attempt ${attempt} failed: ${describeError(error)}`);
                if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
            }
        }
        throw lastError;
    } catch (error) {
        log.error(`"${description}" failed after ${attempts} attempts: ${describeError(error)}`);
        throw error;
    }
}

/** Messages that show the UiAutomator2 server froze or died; the run script uses the same markers. */
export const HANG_MARKERS = [
    'Could not proxy command',
    'instrumentation process is not running',
    'Appium session creation failed',
    'UiAutomator2 Server cannot start',
] as const;

/** True when the error (or any error in its cause chain) shows the UiAutomator2 server froze or died. */
export function isServerHang(error: unknown): boolean {
    log.debug('Checking whether the error is a UiAutomator2 server freeze');
    try {
        let current: unknown = error;
        for (let depth = 0; current && depth < 10; depth++) {
            const message = current instanceof Error ? current.message : String(current);
            if (HANG_MARKERS.some((marker) => message.includes(marker))) {
                log.debug('Server freeze detected');
                return true;
            }
            current = (current as { cause?: unknown }).cause;
        }
        log.debug('Not a server freeze');
        return false;
    } catch (checkError) {
        log.error(`Server freeze check failed: ${describeError(checkError)}`);
        throw checkError;
    }
}

/**
 * Runs a set-up step and, only when the UiAutomator2 server froze, reloads the dead session and redoes the step.
 * Assertion failures and ordinary errors fail at once.
 */
export async function retryOnHang<T>(attempts: number, step: () => Promise<T>): Promise<T> {
    log.info(`Running the step (up to ${attempts} attempts on a server freeze)`);
    for (let attempt = 1; ; attempt++) {
        try {
            const result = await step();
            log.info(`Step finished on attempt ${attempt}/${attempts}`);
            return result;
        } catch (error) {
            if (!isServerHang(error) || attempt >= attempts) {
                log.error(`Step failed on attempt ${attempt}/${attempts}: ${describeError(error)}`);
                throw error;
            }
            log.warn(`UiAutomator2 server froze (attempt ${attempt}/${attempts}); restarting the session.`);
            await browser.reloadSession();
        }
    }
}

/**
 * One-line reason of a failed attempt, at most 160 characters. Never contains a HANG_MARKERS text, or a later real
 * Fail would be written as Skip by the run script.
 */
export function describeFailure(error: unknown): string {
    log.debug('Building the failure reason');
    try {
        if (!error) return 'failed';
        if (isServerHang(error)) return 'UiAutomator2 server froze';
        const name = error instanceof Error ? error.name : 'Error';
        let message = (error instanceof Error ? error.message : String(error)).trim().split('\n')[0];
        if (message.length > 160) message = `${message.slice(0, 157)}...`;
        const reason = message ? `${name}: ${message}` : name;
        log.debug(`Failure reason: ${reason}`);
        return reason;
    } catch (buildError) {
        log.error(`Building the failure reason failed: ${describeError(buildError)}`);
        throw buildError;
    }
}
