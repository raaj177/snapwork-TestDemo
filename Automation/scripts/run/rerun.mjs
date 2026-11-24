// Rerun of failed cases ONCE MORE AFTER THE WHOLE RUN (npm run smoke / regression, default 1 round, --rerun-failed 0-2).
// Only Fail and no-result cases are rerun; Pass, Blocked and Skip are never rerun. The rerun writes into the same run
// folder: results.csv gets the new rows (the last attempt wins), Allure shows the first attempt under the test's Retries,
// and JUnit keeps only the final attempt of each rerun case (so Jenkins counts every case once).
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../lib/log.mjs';

const rlog = log.child('rerun');

/** Selected IDs whose latest result is Fail, or that have no result (a crashed session); never Pass / Blocked / Skip. */
export function failedIdsOf(selectedIds, latest) {
    rlog.debug('Choosing the cases to rerun');
    try {
        return selectedIds.filter((id) => !latest[id] || latest[id] === 'Fail');
    } catch (error) {
        rlog.error(`Choosing the cases to rerun failed: ${log.describe(error)}`);
        throw error;
    }
}

/** The JUnit file prefix of a rerun round (round 0 = the first run, no prefix). */
export function junitPrefixOf(round) {
    rlog.debug(`JUnit prefix of round ${round}`);
    try {
        return round > 0 ? `rerun${round}-` : '';
    } catch (error) {
        rlog.error(`JUnit prefix failed: ${log.describe(error)}`);
        throw error;
    }
}

/**
 * Removes, from every JUnit file of earlier rounds, the <testcase> elements of the given IDs (their final attempt is in
 * the files of the current round). Returns how many elements were removed.
 */
export function dropEarlierAttempts(junitDir, ids, currentPrefix) {
    rlog.info(`Removing earlier JUnit attempts of ${ids.length} rerun case(s)`);
    try {
        if (!fs.existsSync(junitDir) || ids.length === 0) return 0;
        // The wdio JUnit reporter writes "TC_US002_025: title" as name="TC US002 025 title" (underscores -> spaces, no colon).
        const forms = ids.map((id) => id.replace(/_/g, ' '));
        const isRerun = (name) => forms.some((f) => name === f || name.startsWith(`${f} `)) || ids.some((id) => name.startsWith(`${id}:`));
        let removed = 0;
        for (const f of fs.readdirSync(junitDir).filter((x) => x.endsWith('.xml') && !x.startsWith(currentPrefix || '\u0000'))) {
            const file = path.join(junitDir, f);
            const xml = fs.readFileSync(file, 'utf8');
            const next = xml.replace(/[ \t]*<testcase\b[^>]*?\bname="([^"]*)"[^>]*?(?:\/>|>[\s\S]*?<\/testcase>)\r?\n?/g, (m, name) => {
                if (!isRerun(name)) return m;
                removed += 1;
                return '';
            });
            if (next !== xml) fs.writeFileSync(file, next, 'utf8');
        }
        rlog.info(`${removed} earlier JUnit attempt(s) removed`);
        return removed;
    } catch (error) {
        rlog.error(`Removing earlier JUnit attempts failed: ${log.describe(error)}`);
        throw error;
    }
}
