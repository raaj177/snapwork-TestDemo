// Thrown by a test that cannot prove its expected result; recorded as Blocked, never Fail.
import { logger, describeError } from '../utils/Logger';

const log = logger.child({ module: 'BlockedError' });

export class BlockedError extends Error {
    readonly blocked = true;

    // Constructor only assigns fields (logging-rule exception).
    constructor(reason: string) {
        super(reason);
        this.name = 'BlockedError';
    }
}

/** True for a BlockedError, also across module loaders (checks the name/flag, not only instanceof). */
export function isBlockedError(error: unknown): boolean {
    log.debug('Checking whether an error is a BlockedError');
    try {
        if (error instanceof BlockedError) return true;
        const candidate = error as { name?: string; blocked?: boolean; message?: string } | undefined;
        const blocked = Boolean(
            candidate &&
            (candidate.name === 'BlockedError' || candidate.blocked === true || /^BlockedError:/.test(candidate.message ?? '')),
        );
        log.debug(`BlockedError: ${blocked}`);
        return blocked;
    } catch (failure) {
        log.error(`Failed to classify the error: ${describeError(failure)}`);
        throw failure;
    }
}
