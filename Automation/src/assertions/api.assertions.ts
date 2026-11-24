// Reusable API assertions.
import type { AxiosResponse } from 'axios';
import { logger, describeError } from '../utils/Logger';

const log = logger.child({ module: 'api.assertions' });

/** Asserts the HTTP status (the body is never logged). */
export function assertStatus(response: AxiosResponse, expected: number): void {
    log.info(`Checking HTTP status ${expected}`);
    try {
        if (response.status !== expected) throw new Error(`Expected HTTP ${expected}, got ${response.status}`);
        log.info(`HTTP status is ${expected}`);
    } catch (error) {
        log.error(`Status check failed: ${describeError(error)}`);
        throw error;
    }
}
