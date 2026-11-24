import { qaConfig } from './qa.config';
import { env } from '../env';
import { logger, describeError } from '../../src/utils/Logger';

const log = logger.child({ module: 'environments' });

export interface EnvironmentConfig {
    readonly name: string;
    readonly apiBaseUrl: string;
}

/** Returns the non-secret settings of the active TEST_ENV. */
export function environmentConfig(name: string = env.TEST_ENV): EnvironmentConfig {
    log.debug(`Resolving environment config for ${name}`);
    try {
        // This project has one environment (qa). Add another <name>.config.ts here only when one exists.
        const all: Record<string, EnvironmentConfig> = { qa: qaConfig };
        const found = all[name];
        if (!found) throw new Error(`Unknown TEST_ENV "${name}"`);
        log.debug(`Environment config resolved: ${found.name}`);
        return found;
    } catch (error) {
        log.error(`Failed to resolve environment config: ${describeError(error)}`);
        throw error;
    }
}
