// Testcase-ID helpers (traceability contract).
import { logger, describeError } from '../utils/Logger';

const log = logger.child({ module: 'testCase' });

export const TEST_CASE_ID_IN_TITLE = /^(TC_[A-Za-z0-9_]+):/;
export const TEST_CASE_ID = /^TC_[A-Za-z0-9_]+$/;

/** Reads the testcase ID from an it() title ("TC_US003_001: Verify ..."), or '' when there is none. */
export function testCaseIdOf(title: string): string {
    log.debug('Reading the testcase ID from a test title');
    try {
        const id = TEST_CASE_ID_IN_TITLE.exec(title.trim())?.[1] ?? '';
        log.debug(`Testcase ID: ${id || '<none>'}`);
        return id;
    } catch (error) {
        log.error(`Failed to read the testcase ID: ${describeError(error)}`);
        throw error;
    }
}

/** Validates IDs and builds the grep that matches them inside a full title: (?:^|\s)(?:ID1|ID2): */
export function buildIdGrep(ids: readonly string[]): RegExp {
    log.debug(`Building a grep for ${ids.length} testcase ID(s)`);
    try {
        if (ids.length === 0) throw new Error('No testcase IDs given');
        const bad = ids.filter((id) => !TEST_CASE_ID.test(id));
        if (bad.length) throw new Error(`Invalid testcase ID(s): ${bad.join(', ')}`);
        const grep = new RegExp(`(?:^|\\s)(?:${[...new Set(ids)].join('|')}):`);
        log.debug(`Grep built: ${grep.source}`);
        return grep;
    } catch (error) {
        log.error(`Failed to build the testcase grep: ${describeError(error)}`);
        throw error;
    }
}

/** Parses a comma-separated TEST_IDS value into validated IDs ([] when empty). */
export function parseTestIds(value: string | undefined): string[] {
    log.debug('Parsing TEST_IDS');
    try {
        const ids = (value ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        const bad = ids.filter((id) => !TEST_CASE_ID.test(id));
        if (bad.length) throw new Error(`Invalid testcase ID(s) in TEST_IDS: ${bad.join(', ')}`);
        log.debug(`TEST_IDS parsed: ${ids.length} ID(s)`);
        return ids;
    } catch (error) {
        log.error(`Failed to parse TEST_IDS: ${describeError(error)}`);
        throw error;
    }
}
