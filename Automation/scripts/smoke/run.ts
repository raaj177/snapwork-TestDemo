// npm run smoke:run -- --workbook "<approved file name>" --platform android|ios [--build-id <id>] [--partial]
// 1. smoke:check --with-project-checks  2. complete P0 run (or --partial: implemented only, PARTIAL - INCONCLUSIVE)
// 3. run record in reports/smoke/<WorkbookName>/<BuildId>/  4. output workbook update through testrun.py (when installed).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { logger, describeError } from '../../src/utils/Logger';
import { maskValue } from '../../src/utils/Redactor';
import { buildIdGrep } from '../../src/reporting/testCase';
import { parseSmokeArgs } from './cli-common';
import { buildPlan, checkPlan, buildIdOf, createBuildFolder, writeRecord, rel } from './smoke-lib';
import { projectChecks } from './check';

const log = logger.child({ module: 'smoke:run' });

/** App version from the installed app (Android dumpsys); 'unknown' when it cannot be read. */
export function appVersionOf(platform: string): { appVersion: string; deviceModel: string } {
    log.info('Reading the app version and device model');
    try {
        if (platform !== 'android') return { appVersion: 'unknown', deviceModel: 'unknown' };
        const pkg = process.env.APP_PACKAGE ?? '';
        const udidArgs = process.env.DEVICE_UDID ? ['-s', process.env.DEVICE_UDID] : [];
        const dump = pkg ? (spawnSync('adb', [...udidArgs, 'shell', 'dumpsys', 'package', pkg], { encoding: 'utf8' }).stdout ?? '') : '';
        const name = /versionName=(\S+)/.exec(dump)?.[1];
        const code = /versionCode=(\d+)/.exec(dump)?.[1];
        const model = (spawnSync('adb', [...udidArgs, 'shell', 'getprop', 'ro.product.model'], { encoding: 'utf8' }).stdout ?? '').trim();
        const release = (
            spawnSync('adb', [...udidArgs, 'shell', 'getprop', 'ro.build.version.release'], { encoding: 'utf8' }).stdout ?? ''
        ).trim();
        const result = {
            appVersion: name ? `${name}${code ? ` (${code})` : ''}` : 'unknown',
            deviceModel: model ? `${model} / Android ${release}` : 'unknown',
        };
        log.info(`App ${result.appVersion} on ${result.deviceModel} (${maskValue(process.env.DEVICE_UDID ?? '')})`);
        return result;
    } catch (error) {
        log.warn(`App version not read: ${describeError(error)}`);
        return { appVersion: 'unknown', deviceModel: 'unknown' };
    }
}

/** Runs the P0 smoke suite and records the build. */
export async function main(argv: string[]): Promise<number> {
    log.info('smoke:run started');
    try {
        const args = parseSmokeArgs(argv);
        const plan = await buildPlan(args.root, args.workbookFile, args.platform);
        const problems = [...checkPlan(plan), ...projectChecks(args.root)];
        for (const p of problems) console.log(p);
        const coverageProblems = problems.filter((p) => !p.startsWith('PROJECT CHECK'));
        if (problems.some((p) => p.startsWith('PROJECT CHECK'))) {
            console.error('Project checks failed: fix typecheck / lint / smoke fixture tests before a smoke run.');
            return 1;
        }
        const implemented = plan.manifest.stories.flatMap((s) => s.eligible.filter((e) => e.status === 'implemented').map((e) => e.id));
        const { appVersion, deviceModel } = appVersionOf(args.platform);
        const buildId = buildIdOf(args.buildId, args.platform, appVersion);
        const folder = createBuildFolder(args.root, plan.manifest.workbookName, buildId);
        const startedAt = new Date().toISOString();
        const complete = coverageProblems.length === 0;
        if (!complete && !args.partial) {
            console.log(
                `COVERAGE INCOMPLETE: ${plan.manifest.totals.missing} missing - no session started. Build recorded as INCONCLUSIVE.`,
            );
            const outcome = writeRecord({
                folder,
                manifest: plan.manifest,
                buildId,
                platform: args.platform,
                appVersion,
                deviceModel,
                startedAt,
                finishedAt: new Date().toISOString(),
                runType: 'not-run',
                selectedIds: [],
            });
            console.log(`DECISION ${outcome.decision}: ${outcome.reason}`);
            return 1;
        }
        if (implemented.length === 0) {
            console.log('No implemented P0 case to run.');
            writeRecord({
                folder,
                manifest: plan.manifest,
                buildId,
                platform: args.platform,
                appVersion,
                deviceModel,
                startedAt,
                finishedAt: new Date().toISOString(),
                runType: 'not-run',
                selectedIds: [],
            });
            return 1;
        }
        const header = args.partial && !complete ? 'PARTIAL - INCONCLUSIVE' : 'COMPLETE P0 RUN';
        console.log(`==== SMOKE ${header}: ${plan.manifest.workbook} (${implemented.length} case(s)) build ${buildId} ====`);
        const specs = [
            ...new Set(
                plan.manifest.stories
                    .filter((s) => s.smokeSpec && s.eligible.some((e) => e.status === 'implemented'))
                    .map((s) => path.join(args.root, s.smokeSpec)),
            ),
        ];
        const grep = buildIdGrep(implemented).source;
        const wdio = path.join(args.root, 'node_modules', '@wdio', 'cli', 'bin', 'wdio.js');
        const cliArgs = [wdio, 'run', path.join(args.root, 'config', `wdio.${args.platform}.conf.ts`)];
        for (const s of specs) cliArgs.push('--spec', s);
        cliArgs.push('--mochaOpts.grep', grep);
        const env = {
            ...process.env,
            AUTOMATION_RESULTS_FILE: path.join(folder, 'results.csv'),
            ALLURE_RESULTS_DIR: path.join(folder, 'allure-results'),
            EXECUTION_TYPE: 'smoke',
            RUN_ID: buildId,
            WORKBOOK: plan.manifest.workbook,
            MOCHA_RETRIES: process.env.MOCHA_RETRIES ?? '2',
        };
        const run = spawnSync(process.execPath, cliArgs, { cwd: args.root, stdio: 'inherit', env, shell: false });
        const outcome = writeRecord({
            folder,
            manifest: plan.manifest,
            buildId,
            platform: args.platform,
            appVersion,
            deviceModel,
            startedAt,
            finishedAt: new Date().toISOString(),
            runType: complete ? 'complete' : 'partial',
            selectedIds: implemented,
        });
        console.log(`==== SMOKE ${header} DECISION ${outcome.decision}: ${outcome.reason} ====`);
        const testrun = path.join(args.root, 'scripts', 'testrun', 'testrun.py');
        if (fs.existsSync(testrun) && fs.existsSync(path.join(folder, 'results.csv'))) {
            const idsFile = path.join(folder, 'selected-ids.txt');
            fs.writeFileSync(idsFile, `${implemented.join('\n')}\n`, 'utf8');
            const update = [
                'update',
                '--workbook',
                plan.manifest.workbook,
                '--csv',
                path.join(folder, 'results.csv'),
                '--expect-file',
                idsFile,
            ];
            if (!complete) update.push('--partial-ok');
            const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [testrun, ...update], {
                cwd: args.root,
                stdio: 'inherit',
                shell: false,
            });
            if (py.status !== 0) console.warn('Output workbook update failed; the run record is still valid.');
        } else {
            console.log('Output workbook not updated (scripts/testrun/testrun.py not installed yet or no results).');
        }
        console.log(`Run record: ${rel(args.root, folder)}`);
        log.info('smoke:run finished');
        return run.status === 0 && outcome.decision === 'ACCEPT' ? 0 : 1;
    } catch (error) {
        log.error(`smoke:run failed: ${describeError(error)}`);
        console.error(describeError(error));
        return 2;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('smoke', 'run.ts'))) {
    main(process.argv.slice(2)).then((code) => process.exit(code));
}
