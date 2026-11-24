import fs from 'node:fs';
import path from 'node:path';
import { env, FRAMEWORK_ROOT } from '../env';
import { logger, describeError } from '../../src/utils/Logger';

const log = logger.child({ module: 'app-path' });

/**
 * The app build for the `appium:app` capability, or undefined to use the app already installed on the device.
 * APP_PATH is optional: when it is empty, or names a file that does not exist here (app builds are never committed,
 * so a CI checkout has none), the session uses the installed app (APP_PACKAGE / BUNDLE_ID) and a warning says so.
 */
export function appBuildPath(): string | undefined {
    log.debug('Resolving APP_PATH');
    try {
        if (!env.APP_PATH) return undefined;
        const resolved = path.isAbsolute(env.APP_PATH) ? env.APP_PATH : path.join(FRAMEWORK_ROOT, env.APP_PATH);
        if (!fs.existsSync(resolved)) {
            log.warn(`APP_PATH ${env.APP_PATH} not found on this machine: using the app already installed on the device`);
            return undefined;
        }
        log.info(`Using the app build ${path.basename(resolved)} (installed by Appium only when missing, NO_RESET keeps its data)`);
        return resolved;
    } catch (error) {
        log.error(`Failed to resolve APP_PATH: ${describeError(error)}`);
        throw error;
    }
}
