// Shared WebdriverIO configuration. A session is created only when a spec runs, never at type-check or config load.
import fs from 'node:fs';
import path from 'node:path';
import allureReporter from '@wdio/allure-reporter';
import { env, FRAMEWORK_ROOT } from './env';
import { logger, describeError, startTestLog, takeTestLog } from '../src/utils/Logger';
import { setCurrentTest } from '../src/utils/TestState';
import { AllureEvidence } from '../src/reporting/AllureEvidence';
import { ResultWriter, statusOf } from '../src/reporting/ResultWriter';
import { testCaseIdOf, parseTestIds, buildIdGrep } from '../src/reporting/testCase';
import { isBlockedError } from '../src/reporting/BlockedError';
import { takeActualResult } from '../src/reporting/ResultNotes';
import { describeFailure, isServerHang } from '../src/utils/RetryUtils';

const log = logger.child({ module: 'wdio.shared' });

/** Reasons of the failed attempts of the running test, oldest first (keyed by full title). */
const failedAttempts = new Map<string, string[]>();

/** Mocha retries for this run: TEST_RETRIES (set by `.\run -Retries`) wins over MOCHA_RETRIES. */
export function testRetries(): number {
    log.debug('Resolving the test retries');
    try {
        const override = env.TEST_RETRIES.trim();
        const retries = override === '' ? env.MOCHA_RETRIES : Number(override);
        if (!Number.isInteger(retries) || retries < 0 || retries > 5) throw new Error(`TEST_RETRIES must be 0-5, got "${override}"`);
        log.debug(`Test retries: ${retries}`);
        return retries;
    } catch (error) {
        log.error(`Invalid retry setting: ${describeError(error)}`);
        throw error;
    }
}

/** Appends the attempt history when the result needed more than one attempt (never prepended). */
export function withAttempts(remark: string, earlier: string[], attempt: number, max: number): string {
    log.debug(`Adding the attempt history (attempt ${attempt} of ${max})`);
    try {
        if (attempt <= 1 || earlier.length === 0) return remark;
        const list = earlier
            .slice(0, attempt - 1)
            .map((reason, i) => `${i + 1}) ${reason}`)
            .join('; ');
        const note = `Attempt ${attempt} of ${max}. Earlier attempts failed: ${list}.`;
        return remark.trim() ? `${remark} ${note}` : note;
    } catch (error) {
        log.error(`Adding the attempt history failed: ${describeError(error)}`);
        throw error;
    }
}

/** The title after "<ID>:" (the human-readable name in the progress lines). */
export function titleAfterId(title: string, id: string): string {
    log.debug('Splitting the test title');
    try {
        return id && title.startsWith(`${id}:`) ? title.slice(id.length + 1).trim() : title;
    } catch (error) {
        log.error(`Failed to split the test title: ${describeError(error)}`);
        throw error;
    }
}

type HookTest = { title: string; parent: string; file?: string; fullTitle?: string; pending?: boolean };
type HookResult = { error?: unknown; passed: boolean; duration: number; retries?: { attempts: number; limit: number } };

/** Grep from TEST_IDS, built in-process so no '|' or '^' passes through a shell. */
export function grepFromTestIds(): RegExp | undefined {
    log.debug('Building the grep from TEST_IDS');
    try {
        const ids = parseTestIds(env.TEST_IDS);
        const grep = ids.length ? buildIdGrep(ids) : undefined;
        log.debug(grep ? `TEST_IDS grep: ${grep.source}` : 'No TEST_IDS');
        return grep;
    } catch (error) {
        log.error(`Invalid TEST_IDS, the run stops before a session: ${describeError(error)}`);
        throw error;
    }
}

/** Spec path relative to the framework root, forward slashes. */
export function relativeSpec(file: string | undefined): string {
    log.debug('Making the spec path relative');
    try {
        return file ? path.relative(FRAMEWORK_ROOT, file.replace(/^file:\/\//, '')).replace(/\\/g, '/') : '';
    } catch (error) {
        log.error(`Failed to make the spec path relative: ${describeError(error)}`);
        throw error;
    }
}

/**
 * The approved workbook of a smoke folder: the one file in testcase/Testcases/ whose name without .xlsx, the version
 * suffix and _TestCases equals <WorkbookName>; '' when none or several match (WORKBOOK from the run scripts wins).
 */
export function approvedWorkbookFor(workbookName: string): string {
    log.debug(`Finding the approved workbook of smoke folder ${workbookName}`);
    try {
        const dir = path.join(FRAMEWORK_ROOT, 'testcase', 'Testcases');
        if (!fs.existsSync(dir)) return '';
        const nameOf = (f: string) =>
            f
                .replace(/\.xlsx$/i, '')
                .replace(/[_\s-]*v\d+(?:[_.]\d+)*$/i, '')
                .replace(/[_\s-]*test[_\s-]?cases$/i, '');
        const matches = fs.readdirSync(dir).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$') && nameOf(f) === workbookName);
        return matches.length === 1 ? matches[0] : '';
    } catch (error) {
        log.error(`Failed to find the approved workbook of ${workbookName}: ${describeError(error)}`);
        throw error;
    }
}

/** Shareable-report labels (references/share-report.md section 2). */
export function reportLabels(test: HookTest): Record<string, string> {
    log.debug('Building report labels');
    try {
        const specFile = relativeSpec(test.file);
        const parts = specFile.split('/');
        const regIndex = parts.indexOf('regression');
        const smokeIndex = parts.indexOf('smoke');
        const folderWorkbook =
            regIndex >= 0 && parts.length > regIndex + 2
                ? `${parts[regIndex + 1]}.xlsx`
                : smokeIndex >= 0 && parts.length > smokeIndex + 2
                  ? approvedWorkbookFor(parts[smokeIndex + 1])
                  : '';
        const workbook = env.WORKBOOK || folderWorkbook;
        const storyMatch = /^\s*(US[-_ ]?\d+)\s*(.*)$/i.exec(test.parent ?? '');
        const labels: Record<string, string> = {
            executionType: env.EXECUTION_TYPE || 'unknown',
            runId: env.RUN_ID || `run-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`,
            specFile,
            storyId: storyMatch ? storyMatch[1].toUpperCase().replace(/[-_ ]/g, '') : '',
            storyName: storyMatch ? storyMatch[2].trim() : '',
            testCaseId: testCaseIdOf(test.title),
            platform: env.PLATFORM,
            environment: env.TEST_ENV,
        };
        if (workbook) {
            labels.workbook = workbook;
            labels.epic = workbook.replace(/\.xlsx$/i, '');
        }
        if (test.parent) labels.feature = test.parent;
        return labels;
    } catch (error) {
        log.error(`Failed to build report labels: ${describeError(error)}`);
        throw error;
    }
}

const resultWriter = new ResultWriter(path.resolve(FRAMEWORK_ROOT, env.AUTOMATION_RESULTS_FILE));
const ROOT_POSIX = FRAMEWORK_ROOT.replace(/\\/g, '/');
const useLocalAppium = ['127.0.0.1', 'localhost', '::1'].includes(env.APPIUM_HOST);

export const sharedConfig: WebdriverIO.Config = {
    runner: 'local',
    hostname: env.APPIUM_HOST,
    port: env.APPIUM_PORT,
    path: '/',
    // Glob patterns use forward slashes on every OS.
    // P0 cases live only in src/tests/smoke/<WorkbookName>/, every other candidate only in src/tests/regression/, so a
    // full run includes both folders and never runs a case twice.
    specs: [
        `${ROOT_POSIX}/src/tests/smoke/**/*.test.ts`,
        `${ROOT_POSIX}/src/tests/regression/**/*.test.ts`,
        `${ROOT_POSIX}/src/tests/integration/**/*.test.ts`,
    ],
    exclude: [],
    maxInstances: env.MAX_INSTANCES,
    capabilities: [],
    logLevel: env.WDIO_LOG_LEVEL,
    outputDir: path.resolve(FRAMEWORK_ROOT, env.LOG_DIR, 'wdio'),
    bail: 0,
    waitforTimeout: 15000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 2, // session creation is retried; a port left busy by an earlier run frees itself
    services: useLocalAppium ? [['appium', { args: { address: env.APPIUM_HOST, port: env.APPIUM_PORT, relaxedSecurity: true } }]] : [],
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: env.MOCHA_TIMEOUT,
        retries: testRetries(), // default 2: a failed or frozen test runs up to 3 attempts
        grep: grepFromTestIds(),
    },
    reporters: [
        'spec',
        [
            'allure',
            {
                outputDir: path.resolve(FRAMEWORK_ROOT, env.ALLURE_RESULTS_DIR),
                disableWebdriverStepsReporting: true,
                disableWebdriverScreenshotsReporting: true,
            },
        ],
        [
            'junit',
            {
                outputDir: path.resolve(FRAMEWORK_ROOT, env.JUNIT_DIR),
                outputFileFormat: (options: { cid: string }) => `results-${options.cid}.xml`,
            },
        ],
    ],

    beforeSession(_config, capabilities): void {
        log.info('Creating an Appium session');
        try {
            const caps = capabilities as Record<string, unknown>;
            log.info(`Session for ${String(caps.platformName ?? '')} (${String(caps['appium:automationName'] ?? '')})`);
        } catch (error) {
            log.error(`Session preparation failed: ${describeError(error)}`);
            throw error;
        }
    },

    async beforeTest(test: HookTest): Promise<void> {
        try {
            const id = testCaseIdOf(test.title);
            setCurrentTest(test.title, id);
            startTestLog();
            takeActualResult(); // clear a note left by an earlier attempt
            AllureEvidence.startTest();
            const labels = reportLabels(test);
            for (const [name, value] of Object.entries(labels)) if (value) allureReporter.addLabel(name, value);
            if (id) allureReporter.addTestId(id);
            // Session probe: one cheap command; a frozen UiAutomator2 server gets a fresh session so one freeze
            // cannot fail every later test of the spec.
            try {
                await driver.getWindowSize();
            } catch (probeError) {
                if (!isServerHang(probeError)) throw probeError;
                logger.warn('UiAutomator2 server did not answer before the test; reloading the session');
                await browser.reloadSession();
            }
            // Format read by scripts/run-tests.ps1: [TEST START] <ID> | <title>
            logger.info(`[TEST START] ${id || test.title} | ${titleAfterId(test.title, id)}`);
        } catch (error) {
            logger.error(`beforeTest hook failed: ${describeError(error)}`);
            throw error;
        }
    },

    async afterTest(test: HookTest, context: unknown, result: HookResult): Promise<void> {
        const id = testCaseIdOf(test.title);
        const title = titleAfterId(test.title, id);
        const key = test.fullTitle ?? `${test.parent} ${test.title}`;
        const blocked = isBlockedError(result.error);
        if (blocked) (context as { retries?: (n: number) => void } | undefined)?.retries?.(0); // never rerun Blocked
        const attempt = (result.retries?.attempts ?? 0) + 1;
        const max = (result.retries?.limit ?? 0) + 1;
        const willRetry = !result.passed && !blocked && (result.retries?.attempts ?? 0) < (result.retries?.limit ?? 0);
        const earlier = failedAttempts.get(key) ?? [];
        const status = statusOf(result, Boolean(test.pending));
        try {
            if (!result.passed && isServerHang(result.error)) {
                await browser.reloadSession(); // dead session: no screenshot, no page source
            } else if (!result.passed) {
                await AllureEvidence.onProblem(
                    willRetry ? `RETRY_attempt${attempt}_${id || test.title}` : test.title,
                    describeError(result.error),
                );
            }
            const actual = takeActualResult();
            resultWriter.write({
                testCaseId: id,
                status,
                actualResult: result.passed ? actual || 'As expected' : describeFailure(result.error),
                remark: withAttempts('', earlier, attempt, max),
                specFile: relativeSpec(test.file),
                title: test.title,
                durationMs: Math.round(result.duration ?? 0),
                timestamp: new Date().toISOString(),
            });
            if (willRetry) failedAttempts.set(key, [...earlier, describeFailure(result.error)]);
            else failedAttempts.delete(key);
            AllureEvidence.attachLog(takeTestLog());
        } catch (error) {
            logger.error(`afterTest hook failed: ${describeError(error)}`);
            throw error;
        } finally {
            // Formats read by scripts/run-tests.ps1. A discarded attempt never prints [TEST END].
            if (willRetry) {
                logger.info(
                    `[TEST RETRY] ${id || test.title} | ${title} | attempt ${attempt}/${max} failed (${describeFailure(result.error)}); rerunning from the start`,
                );
            } else {
                const word = status === 'Pass' ? 'PASS' : status === 'Blocked' ? 'BLOCKED' : status === 'Skip' ? 'SKIP' : 'FAIL';
                logger.info(`[TEST END] ${id || test.title} | ${title} | ${word}`);
            }
        }
    },
};
