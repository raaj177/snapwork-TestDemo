// Test-facing access to test data: fixtures.user(key), fixtures.message(key), fixtures.value(key).
import { testDataService } from '../services/test-data.service';
import { logger, describeError } from '../utils/Logger';
import type { ResolvedUser } from '../types/test-data.types';

const log = logger.child({ module: 'test-data.fixture' });

export const fixtures = {
    /** A test user (password from the environment variable named by passwordEnv). */
    user(key: string): ResolvedUser {
        log.info(`Fixture user "${key}"`);
        try {
            return testDataService.user(key);
        } catch (error) {
            log.error(`Fixture user "${key}" failed: ${describeError(error)}`);
            throw error;
        }
    },
    /** An expected message. */
    message(key: string): string {
        log.info(`Fixture message "${key}"`);
        try {
            return testDataService.message(key);
        } catch (error) {
            log.error(`Fixture message "${key}" failed: ${describeError(error)}`);
            throw error;
        }
    },
    /** A value. */
    value(key: string): string {
        log.info(`Fixture value "${key}"`);
        try {
            return testDataService.value(key);
        } catch (error) {
            log.error(`Fixture value "${key}" failed: ${describeError(error)}`);
            throw error;
        }
    },
};

export const testData = fixtures;
