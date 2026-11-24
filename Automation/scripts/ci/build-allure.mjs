// Builds ONE complete Allure report (allure-report/) from every run of this build, for Jenkins and local use:
//   npm run report:ci
// Sources: test-results/runs/*/allure-results (npm run smoke / regression), reports/smoke/*/*/allure-results
// (smoke:run gate) and allure-results/ (direct runs). Adds the Overview widgets: Environment (workbook, epic,
// platform, device, Android, app version, build), Categories (defect candidate / automation-environment / blocked),
// Executor (Jenkins build link) and Trend (history kept in .allure-history/ between builds), then the Logger and
// Screenshots tabs (scripts/allure-extras.mjs). Results keep every attachment: step screenshots, failure screenshot,
// page source, diagnostics and the per-test log. Raw results are copied, never changed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { log } from '../lib/log.mjs';
import { generateAllure } from '../report/report-lib.mjs';

const blog = log.child('ci-allure');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every allure-results folder of this build that holds results, newest last. */
export function resultFolders(root = ROOT) {
    blog.info('Finding allure-results folders');
    try {
        const out = [];
        const add = (dir) => {
            if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('-result.json'))) out.push(dir);
        };
        const runs = path.join(root, 'test-results', 'runs');
        if (fs.existsSync(runs)) for (const r of fs.readdirSync(runs).sort()) add(path.join(runs, r, 'allure-results'));
        const smoke = path.join(root, 'reports', 'smoke');
        if (fs.existsSync(smoke))
            for (const wb of fs.readdirSync(smoke)) {
                const wbDir = path.join(smoke, wb);
                if (fs.statSync(wbDir).isDirectory())
                    for (const b of fs.readdirSync(wbDir).sort()) add(path.join(wbDir, b, 'allure-results'));
            }
        add(path.join(root, 'allure-results'));
        blog.info(`${out.length} allure-results folder(s)`);
        return out;
    } catch (error) {
        blog.error(`Finding allure-results failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Copies every file of the source folders into one folder (Allure file names are unique UUIDs). */
export function mergeResults(folders, target) {
    blog.info(`Merging ${folders.length} folder(s) into ${path.basename(target)}`);
    try {
        fs.rmSync(target, { recursive: true, force: true });
        fs.mkdirSync(target, { recursive: true });
        let n = 0;
        for (const dir of folders)
            for (const f of fs.readdirSync(dir)) {
                const src = path.join(dir, f);
                if (fs.statSync(src).isFile()) {
                    fs.copyFileSync(src, path.join(target, f));
                    n += 1;
                }
            }
        blog.info(`${n} file(s) merged`);
        return n;
    } catch (error) {
        blog.error(`Merging results failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Reads a JSON file, or returns the fallback when it is missing or invalid. */
function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return fallback; // optional input: absent before the first device check / run
    }
}

/** Writes environment.properties, categories.json and executor.json for the Overview page. */
export function writeOverviewFiles(target, root = ROOT, env = process.env) {
    blog.info('Writing the Overview files (environment, categories, executor)');
    try {
        const runs = path.join(root, 'test-results', 'runs');
        const runJsons = fs.existsSync(runs)
            ? fs
                  .readdirSync(runs)
                  .sort()
                  .map((r) => readJson(path.join(runs, r, 'run.json'), null))
                  .filter(Boolean)
            : [];
        const device = readJson(path.join(root, 'test-results', 'device.json'), {});
        const workbooks = [...new Set(runJsons.map((r) => r.workbook).filter(Boolean))];
        const props = {
            Workbook: workbooks.join(', '),
            Epic: workbooks.map((w) => w.replace(/\.xlsx$/i, '')).join(', '),
            'Test types': [...new Set(runJsons.map((r) => r.type).filter(Boolean))].join(', '),
            'Run IDs': runJsons.map((r) => r.runId).join(', '),
            Platform: env.PLATFORM || 'android',
            Environment: env.TEST_ENV || 'qa',
            Device: [device.manufacturer, device.model].filter(Boolean).join(' '),
            Android: device.android ? `${device.android} (SDK ${device.sdk})` : '',
            App: device.appPackage ? `${device.appPackage} ${device.appVersion || ''}`.trim() : '',
            Build: env.BUILD_TAG || 'local',
            Commit: (env.GIT_COMMIT || '').slice(0, 7),
        };
        const lines = Object.entries(props)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k.replace(/ /g, '\\ ')}=${String(v).replace(/\r?\n/g, ' ')}`);
        fs.writeFileSync(path.join(target, 'environment.properties'), `${lines.join('\n')}\n`, 'utf8');
        const categories = [
            {
                name: 'Blocked (precondition not reachable)',
                messageRegex: '.*(BlockedError|Blocked:|blocked).*',
                matchedStatuses: ['broken', 'failed', 'skipped'],
            },
            { name: 'Product defect candidate (needs triage)', matchedStatuses: ['failed'] },
            { name: 'Automation / environment problem', matchedStatuses: ['broken'] },
            { name: 'Skipped', matchedStatuses: ['skipped'] },
        ];
        fs.writeFileSync(path.join(target, 'categories.json'), `${JSON.stringify(categories, null, 2)}\n`, 'utf8');
        if (env.BUILD_URL) {
            const executor = {
                name: 'Jenkins',
                type: 'jenkins',
                url: env.JENKINS_URL || '',
                buildOrder: Number(env.BUILD_NUMBER) || 0,
                buildName: env.BUILD_DISPLAY_NAME || env.BUILD_TAG || '',
                buildUrl: env.BUILD_URL,
                reportName: 'Mobile Allure Report',
                reportUrl: `${env.BUILD_URL}Mobile_20Allure_20Report/`,
            };
            fs.writeFileSync(path.join(target, 'executor.json'), `${JSON.stringify(executor, null, 2)}\n`, 'utf8');
        }
        blog.info(`Overview files written (${lines.length} environment entries)`);
        return props;
    } catch (error) {
        blog.error(`Writing the Overview files failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Copies a folder tree (used for the Trend history). */
export function copyTree(src, dest) {
    blog.debug(`Copying ${path.basename(src)}`);
    try {
        if (!fs.existsSync(src)) return;
        fs.mkdirSync(dest, { recursive: true });
        for (const f of fs.readdirSync(src)) {
            const s = path.join(src, f);
            if (fs.statSync(s).isDirectory()) copyTree(s, path.join(dest, f));
            else fs.copyFileSync(s, path.join(dest, f));
        }
    } catch (error) {
        blog.error(`Copying ${path.basename(src)} failed: ${log.describe(error)}`);
        throw error;
    }
}

/** CLI: merge, add the Overview files and the Trend history, generate allure-report/, add Logger + Screenshots. */
export async function main(root = ROOT) {
    blog.info('Building the CI Allure report');
    try {
        const folders = resultFolders(root);
        if (folders.length === 0) {
            console.log('No Allure results in this build: no report generated.');
            return 0;
        }
        const merged = path.join(root, 'test-results', 'ci-allure-results');
        mergeResults(folders, merged);
        const props = writeOverviewFiles(merged, root);
        const history = path.join(root, '.allure-history');
        copyTree(history, path.join(merged, 'history'));
        await generateAllure(merged, path.join(root, 'allure-report'), false);
        fs.rmSync(history, { recursive: true, force: true });
        copyTree(path.join(root, 'allure-report', 'history'), history);
        const runs = path.join(root, 'test-results', 'runs');
        const lastRun = fs.existsSync(runs) ? fs.readdirSync(runs).sort().pop() : undefined;
        const logDir =
            lastRun && fs.existsSync(path.join(runs, lastRun, 'logs')) ? path.join(runs, lastRun, 'logs') : path.join(root, 'logs');
        const extras = spawnSync(process.execPath, [path.join(root, 'scripts', 'allure-extras.mjs')], {
            cwd: root,
            stdio: 'inherit',
            env: { ...process.env, ALLURE_RESULTS_DIR: merged, LOG_DIR: logDir },
        });
        if (extras.status !== 0) console.warn('Logger / Screenshots tabs could not be added (the Allure report itself is complete).');
        console.log(`Allure report: allure-report/index.html (${folders.length} run(s); ${props.Workbook || 'no workbook'})`);
        blog.info('CI Allure report built');
        return 0;
    } catch (error) {
        blog.error(`Building the CI Allure report failed: ${log.describe(error)}`);
        console.error(log.describe(error));
        return 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((code) => process.exit(code));
