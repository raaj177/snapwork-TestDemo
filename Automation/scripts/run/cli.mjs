// npm run smoke -- "<Workbook>.xlsx" [--dry-run]           (workbook-commands.md)
// npm run regression -- "<Workbook>.xlsx" [US002 US003] [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { log } from '../lib/log.mjs';
import { resolveApprovedWorkbook, testcaseDirOf, UsageError } from '../lib/paths.mjs';
import { parseRunArgs, USAGE } from './args.mjs';
import { selectCases, formatSelection } from './select.mjs';
import { failedIdsOf, junitPrefixOf, dropEarlierAttempts } from './rerun.mjs';
import { androidPreflight, readDotenv, resolveSetting, PreflightError, mask } from './preflight.mjs';
import { acquireLock, releaseLock, LockError } from './lock.mjs';
import { EXIT, newRunId, resultsOf, exitCodeOf } from './outcome.mjs';
import { buildRunReport } from './run-report.mjs';

const clog = log.child('run-cli');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TC_ID = /^TC_[A-Za-z0-9_]+$/;

/** Builds the grep from validated IDs: (?:^|\s)(?:ID1|ID2): */
export function grepOf(ids) {
    clog.debug(`Building the grep for ${ids.length} ID(s)`);
    try {
        const bad = ids.filter((id) => !TC_ID.test(id));
        if (bad.length) throw new UsageError(`Invalid testcase ID(s): ${bad.join(', ')}`);
        return `(?:^|\\s)(?:${[...new Set(ids)].join('|')}):`;
    } catch (error) {
        clog.error(`Failed to build the grep: ${log.describe(error)}`);
        throw error;
    }
}

/** Main flow; deps are injectable for the device-free tests. */
export async function main(argv, deps = {}) {
    const root = deps.root ?? ROOT;
    const out = deps.print ?? ((line) => console.log(line));
    let lockFile;
    clog.info(`Run command started: ${argv[0] ?? ''}`);
    try {
        const dotenv = readDotenv(path.join(root, '.env'));
        const penv = deps.env ?? process.env;
        const args = parseRunArgs(argv, { platform: resolveSetting('PLATFORM', penv, dotenv, 'android').value });
        const workbookFile = resolveApprovedWorkbook(args.workbook, testcaseDirOf(root));
        const sel = await selectCases({ root, workbookFile, type: args.type, stories: args.stories, platform: args.platform });
        const runId = newRunId(args.type);
        out(formatSelection(sel, args.dryRun ? '<dry run>' : runId));
        if (!sel.coverageComplete && args.type === 'smoke') {
            if (args.strict) {
                out('INCOMPLETE COVERAGE: --strict stops the run.');
                return EXIT.strictIncomplete;
            }
            out('INCOMPLETE COVERAGE: running the implemented cases only (partial).');
        }
        if (sel.selected.length === 0) {
            out('Nothing to run: no implemented case is selected.');
            return EXIT.usage;
        }
        if (args.platform === 'ios') throw new PreflightError('iOS preflight is not available yet: run npm run test:ios -- --spec <file>');
        if (args.platform === 'web') throw new PreflightError('This is the mobile framework: web runs belong to the Playwright framework');
        const runsDir = path.join(root, 'test-results', 'runs');
        lockFile = (deps.acquireLock ?? acquireLock)(runsDir, { runId, command: args.type });
        const settings = {
            processUdid: penv.DEVICE_UDID ?? '',
            envUdid: dotenv.DEVICE_UDID ?? '',
            appPackage: resolveSetting('APP_PACKAGE', penv, dotenv).value,
            startActivity: resolveSetting('START_ACTIVITY', penv, dotenv).value,
        };
        const ports = [
            Number(resolveSetting('APPIUM_PORT', penv, dotenv, '4723').value),
            Number(resolveSetting('UIAUTOMATOR2_SYSTEM_PORT', penv, dotenv, '8200').value),
        ];
        const facts = await (deps.preflight ?? androidPreflight)({ adb: deps.adb, settings, ports });
        for (const line of facts.lines) out(line);
        for (const name of ['APP_PACKAGE', 'TEST_ENV', 'APPIUM_PORT']) out(`${name}: ${resolveSetting(name, penv, dotenv).source}`);
        if (args.dryRun) {
            out('Dry run: no session started, no report generated.');
            return EXIT.ok;
        }
        const runDir = path.join(runsDir, runId);
        fs.mkdirSync(runDir, { recursive: true });
        const specs = [...new Set(sel.selected.map((s) => s.file))];
        const grep = grepOf(sel.selected.map((s) => s.id));
        const startedAt = new Date().toISOString();
        const runEnv = {
            ...process.env,
            ...penv,
            DEVICE_UDID: facts.udid,
            EXECUTION_TYPE: args.type,
            RUN_ID: runId,
            WORKBOOK: sel.workbook,
            ALLURE_RESULTS_DIR: path.join(runDir, 'allure-results'),
            JUNIT_DIR: path.join(runDir, 'junit'),
            AUTOMATION_RESULTS_FILE: path.join(runDir, 'results.csv'),
            LOG_DIR: path.join(runDir, 'logs'),
            MOCHA_RETRIES: String(args.retries),
            MAX_INSTANCES: '1',
            WDIO_LOG_LEVEL: 'warn',
            LOG_LEVEL: 'info',
            NO_RESET: 'true',
        };
        const wdio = path.join(root, 'node_modules', '@wdio', 'cli', 'bin', 'wdio.js');
        const cliArgs = [wdio, 'run', path.join(root, 'config', `wdio.${args.platform}.conf.ts`)];
        for (const s of specs) cliArgs.push('--spec', s);
        cliArgs.push('--mochaOpts.grep', grep);
        const runner = (deps.spawn ?? spawnSync)(process.execPath, cliArgs, { cwd: root, stdio: 'inherit', env: runEnv, shell: false });
        let runnerExit = runner.status ?? 1;
        const selectedIds = sel.selected.map((s) => s.id);
        // Failed cases once more AFTER the whole run (fresh session, app and back end settled); the last attempt wins.
        const reruns = [];
        for (let round = 1; round <= args.rerunFailed; round += 1) {
            const { latest } = resultsOf(selectedIds, path.join(runDir, 'results.csv'));
            const failed = failedIdsOf(selectedIds, latest);
            if (failed.length === 0) break;
            out(
                `==== RERUN ${round}/${args.rerunFailed}: ${failed.length} failed case(s) once more after the full run: ${failed.join(' ')} ====`,
            );
            const rerunSpecs = [...new Set(sel.selected.filter((s) => failed.includes(s.id)).map((s) => s.file))];
            const rerunArgs = [wdio, 'run', path.join(root, 'config', `wdio.${args.platform}.conf.ts`)];
            for (const s of rerunSpecs) rerunArgs.push('--spec', s);
            rerunArgs.push('--mochaOpts.grep', grepOf(failed));
            const prefix = junitPrefixOf(round);
            const rerun = (deps.spawn ?? spawnSync)(process.execPath, rerunArgs, {
                cwd: root,
                stdio: 'inherit',
                env: { ...runEnv, JUNIT_FILE_PREFIX: prefix, MOCHA_RETRIES: '0' },
                shell: false,
            });
            dropEarlierAttempts(path.join(runDir, 'junit'), failed, prefix);
            const after = resultsOf(selectedIds, path.join(runDir, 'results.csv')).latest;
            const recovered = failed.filter((id) => after[id] && after[id] !== 'Fail');
            reruns.push({ round, ids: failed, recovered, stillFailing: failed.filter((id) => !recovered.includes(id)) });
            out(`==== RERUN ${round} done: ${recovered.length} passed on rerun, ${failed.length - recovered.length} still failing ====`);
            runnerExit = rerun.status ?? 1;
        }
        const results = resultsOf(selectedIds, path.join(runDir, 'results.csv'));
        for (const id of results.missing) out(`NO RESULT ${id}`);
        const runJson = {
            runId,
            type: args.type,
            workbook: sel.workbook,
            stories: args.stories,
            selectedIds,
            missingIds: sel.missing,
            excludedIds: sel.excluded,
            noResultIds: results.missing,
            retries: args.retries,
            rerunFailed: args.rerunFailed,
            reruns,
            platform: args.platform,
            deviceModel: `${facts.model} / Android ${facts.osVersion}`,
            deviceSerial: mask(facts.udid),
            appPackage: settings.appPackage,
            appVersion: facts.appVersion,
            environment: resolveSetting('TEST_ENV', penv, dotenv, 'qa').value,
            coverage: sel.coverageComplete ? 'COMPLETE' : 'INCOMPLETE COVERAGE',
            startedAt,
            finishedAt: new Date().toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            runnerExitCode: runnerExit,
        };
        fs.writeFileSync(path.join(runDir, 'run.json'), `${JSON.stringify(runJson, null, 2)}\n`, 'utf8');
        let reportFailed = false;
        try {
            const report = await buildRunReport({
                root,
                runDir,
                generate: deps.generate,
                meta: {
                    runId,
                    type: args.type,
                    workbook: sel.workbook,
                    platform: args.platform,
                    environment: runJson.environment,
                    stories: args.stories,
                    selectedStories: args.stories.length ? args.stories : sel.storiesInWorkbook,
                    storiesInWorkbook: sel.storiesInWorkbook.length,
                    selectedIds,
                    excluded: sel.excluded,
                    missingResults: results.missing,
                    coverageComplete: sel.coverageComplete,
                    runnerExit,
                },
            });
            out(`Report: ${path.relative(root, report.folder)}  ZIP: ${path.relative(root, report.zip)}`);
            if (report.noResults) reportFailed = true;
        } catch (error) {
            reportFailed = true;
            out(`Report generation failed: ${log.describe(error)}`);
        }
        if (args.updateWorkbook) {
            const testrun = path.join(root, 'scripts', 'testrun', 'testrun.py');
            if (fs.existsSync(testrun)) {
                spawnSync(
                    process.platform === 'win32' ? 'python' : 'python3',
                    [testrun, 'update', '--workbook', sel.workbook, '--csv', path.join(runDir, 'results.csv'), '--partial-ok'],
                    { cwd: root, stdio: 'inherit', shell: false },
                );
            } else out('--update-workbook: scripts/testrun/testrun.py is not installed yet; workbook not updated.');
        }
        const code = exitCodeOf({
            runnerExit,
            missing: results.missing.length,
            reportFailed: reportFailed && results.missing.length === 0,
        });
        out(`Exit code ${code}`);
        return code;
    } catch (error) {
        clog.error(`Run command stopped: ${log.describe(error)}`);
        if (error instanceof UsageError) {
            out(`${log.describe(error)}\n${USAGE}`);
            return EXIT.usage;
        }
        if (error instanceof PreflightError) {
            out(`PREFLIGHT FAILED: ${error.message}`);
            return EXIT.preflight;
        }
        if (error instanceof LockError) {
            out(`LOCK: ${error.message}`);
            return EXIT.lock;
        }
        out(log.describe(error));
        return EXIT.usage;
    } finally {
        if (lockFile) releaseLock(lockFile);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).then((code) => process.exit(code));
}
