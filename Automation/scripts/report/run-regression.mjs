// npm run test:regression -- <wdio args>   (iOS and any direct run that does not go through scripts/run.ps1)
// Sets EXECUTION_TYPE=regression and RUN_ID, runs the platform's wdio config, then archives allure-results/ and
// run.json to test-results/allure-archive/<RunId>/ for npm run report:share.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { log } from '../lib/log.mjs';

const rlog = log.child('test:regression');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** regression-<yyyyMMdd-HHmmss>-<hex>. */
export function newRunId(now = new Date()) {
    rlog.debug('Creating a run ID');
    try {
        const pad = (n) => String(n).padStart(2, '0');
        return `regression-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${crypto.randomBytes(2).toString('hex')}`;
    } catch (error) {
        rlog.error(`Failed to create a run ID: ${log.describe(error)}`);
        throw error;
    }
}

/** Copies allure-results/ and writes run.json into the archive. */
export function archiveRun(root, runId, meta) {
    rlog.info(`Archiving run ${runId}`);
    try {
        const target = path.join(root, 'test-results', 'allure-archive', runId);
        if (fs.existsSync(target)) throw new Error(`Archive ${runId} already exists`);
        fs.mkdirSync(target, { recursive: true });
        const src = path.join(root, process.env.ALLURE_RESULTS_DIR || 'allure-results');
        if (fs.existsSync(src)) fs.cpSync(src, path.join(target, 'allure-results'), { recursive: true });
        fs.writeFileSync(path.join(target, 'run.json'), `${JSON.stringify({ runId, executionType: 'regression', ...meta }, null, 2)}\n`, 'utf8');
        rlog.info(`Archived to test-results/allure-archive/${runId}`);
        return target;
    } catch (error) {
        rlog.error(`Failed to archive the run: ${log.describe(error)}`);
        throw error;
    }
}

/** Runs wdio with the given arguments, labelled as regression. */
export function main(argv) {
    rlog.info('test:regression started');
    try {
        const platform = (process.env.PLATFORM || 'android').toLowerCase();
        const runId = process.env.RUN_ID || newRunId();
        const startedAt = new Date().toISOString();
        const wdio = path.join(ROOT, 'node_modules', '@wdio', 'cli', 'bin', 'wdio.js');
        fs.rmSync(path.join(ROOT, process.env.ALLURE_RESULTS_DIR || 'allure-results'), { recursive: true, force: true });
        const run = spawnSync(process.execPath, [wdio, 'run', path.join(ROOT, 'config', `wdio.${platform}.conf.ts`), ...argv], {
            cwd: ROOT,
            stdio: 'inherit',
            shell: false,
            env: { ...process.env, EXECUTION_TYPE: 'regression', RUN_ID: runId },
        });
        archiveRun(ROOT, runId, {
            runType: 'direct',
            platform,
            environment: process.env.TEST_ENV || 'qa',
            workbook: process.env.WORKBOOK || '',
            startedAt,
            finishedAt: new Date().toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            exitCode: run.status,
        });
        return run.status ?? 1;
    } catch (error) {
        rlog.error(`test:regression failed: ${log.describe(error)}`);
        return 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}
