// Missing-result detection and exit-code precedence (workbook-commands.md section 5).
import crypto from 'node:crypto';
import { log } from '../lib/log.mjs';
import { readResults } from '../lib/csv.mjs';

const olog = log.child('run-outcome');

export const EXIT = { ok: 0, failures: 1, usage: 2, preflight: 3, missingResults: 4, report: 5, strictIncomplete: 6, lock: 7 };

/** <type>-<yyyyMMdd-HHmmss>-<4 hex>. */
export function newRunId(type, now = new Date()) {
    olog.debug('Creating a run ID');
    try {
        const pad = (n) => String(n).padStart(2, '0');
        return `${type}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${crypto.randomBytes(2).toString('hex')}`;
    } catch (error) {
        olog.error(`Failed to create a run ID: ${log.describe(error)}`);
        throw error;
    }
}

/** Selected IDs without a result row; latest outcomes and retry counts. */
export function resultsOf(selectedIds, csvFile) {
    olog.info('Checking results for every selected ID');
    try {
        const { latest, attempts } = readResults(csvFile);
        const missing = selectedIds.filter((id) => !latest[id]);
        const retried = Object.values(attempts).reduce((n, a) => n + Math.max(0, a - 1), 0);
        return { latest, attempts, missing, retried };
    } catch (error) {
        olog.error(`Failed to check results: ${log.describe(error)}`);
        throw error;
    }
}

/** Final exit code: runner failure wins; then missing results; report failure only when nothing worse happened. */
export function exitCodeOf({ runnerExit, missing, reportFailed }) {
    olog.debug('Computing the exit code');
    try {
        if (runnerExit !== 0) return EXIT.failures;
        if (missing > 0) return EXIT.missingResults;
        if (reportFailed) return EXIT.report;
        return EXIT.ok;
    } catch (error) {
        olog.error(`Failed to compute the exit code: ${log.describe(error)}`);
        throw error;
    }
}
