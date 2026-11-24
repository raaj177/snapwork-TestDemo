import fs from 'node:fs';
import path from 'node:path';
import { logger, describeError } from './Logger';

const log = logger.child({ module: 'ScreenshotUtils' });

/** Filesystem-safe name part. */
export function safeName(text: string, max = 60): string {
    log.debug('Building a filesystem-safe name');
    try {
        const name =
            text
                .replace(/[^A-Za-z0-9_-]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, max) || 'screen';
        log.debug(`Safe name: ${name}`);
        return name;
    } catch (error) {
        log.error(`Failed to build a safe name: ${describeError(error)}`);
        throw error;
    }
}

/** Saves a screenshot of the current screen and returns its path. */
export async function saveScreenshot(folder: string, baseName: string): Promise<string> {
    log.info(`Saving screenshot ${baseName}`);
    try {
        fs.mkdirSync(folder, { recursive: true });
        const file = path.join(folder, `${safeName(baseName, 100)}.png`);
        await browser.saveScreenshot(file);
        log.info(`Screenshot saved: ${file}`);
        return file;
    } catch (error) {
        log.error(`Failed to save screenshot ${baseName}: ${describeError(error)}`);
        throw error;
    }
}
