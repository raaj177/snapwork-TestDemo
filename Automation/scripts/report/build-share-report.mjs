// npm run report:share -- [--source latest|archive] [--runs <RunId[=type],...>] [--since <date>] [--application "<name>"]
//                         [--date <YYYY-MM-DD>] [--include-screenshots] [--allow-mixed-platforms]
// Builds report/snapshots/<SnapshotId>/ from saved results (sanitized copies), plus the ZIP and the dashboard.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { log } from '../lib/log.mjs';
import * as R from './report-lib.mjs';

const slog = log.child('report:share');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Finds archived runs: regression archives and smoke build folders. */
export function discoverSources(root) {
    slog.info('Discovering saved results');
    try {
        const sources = [];
        const archive = path.join(root, 'test-results', 'allure-archive');
        if (fs.existsSync(archive)) {
            for (const id of fs.readdirSync(archive)) {
                const dir = path.join(archive, id);
                const meta = fs.existsSync(path.join(dir, 'run.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8')) : {};
                sources.push({ runId: id, type: 'regression', dir: path.join(dir, 'allure-results'), startedAt: meta.startedAt ?? '', meta, label: `test-results/allure-archive/${id}` });
            }
        }
        const smoke = path.join(root, 'reports', 'smoke');
        if (fs.existsSync(smoke)) {
            for (const wb of fs.readdirSync(smoke)) {
                for (const id of fs.readdirSync(path.join(smoke, wb))) {
                    const dir = path.join(smoke, wb, id);
                    const meta = fs.existsSync(path.join(dir, 'run.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8')) : {};
                    sources.push({ runId: id, type: 'smoke', dir: path.join(dir, 'allure-results'), startedAt: meta.startedAt ?? '', meta, label: `reports/smoke/${wb}/${id}` });
                }
            }
        }
        slog.info(`${sources.length} archived run(s) found`);
        return sources;
    } catch (error) {
        slog.error(`Failed to discover sources: ${log.describe(error)}`);
        throw error;
    }
}

/** Builds a snapshot. `generate` is injectable for device-free tests. */
export async function buildShareReport(options) {
    const { root = ROOT, source = 'latest', runs = [], since, application = process.env.APP_NAME || 'Application', date, includeScreenshots = false, generate = R.generateAllure, now = new Date() } = options;
    slog.info(`Building a ${source} snapshot`);
    try {
        const reportRoot = path.join(root, 'report');
        const overrides = Object.fromEntries(runs.filter((r) => r.includes('=')).map((r) => r.split('=')));
        const wanted = runs.map((r) => r.split('=')[0]);
        let sources = discoverSources(root).filter((s) => fs.existsSync(s.dir));
        if (wanted.length) sources = sources.filter((s) => wanted.includes(s.runId));
        if (since) sources = sources.filter((s) => s.startedAt >= since);
        if (source === 'latest') {
            const newest = (type) => sources.filter((s) => s.type === type).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
            const picked = [newest('regression'), newest('smoke')].filter(Boolean);
            if (!picked.some((s) => s.type === 'regression') && fs.existsSync(path.join(root, 'allure-results'))) {
                picked.push({ runId: 'allure-results', type: undefined, dir: path.join(root, 'allure-results'), startedAt: '', meta: {}, label: 'allure-results/' });
            }
            sources = picked;
        }
        let entries = sources.flatMap((s) => R.loadResults(s.dir, { ...s, typeOverride: overrides[s.runId] }));
        if (entries.length === 0) throw new R.ReportError('No results found: run tests first (npm run test:regression, smoke:run, npm run smoke / regression).');
        const { smoke, regression } = R.classify(entries);
        const pickSmoke = source === 'archive' ? R.selectLatest(smoke) : smoke;
        const pickReg = source === 'archive' ? R.selectLatest(regression) : regression;
        entries = [...pickSmoke, ...pickReg];
        const platforms = [...new Set(entries.map((e) => R.labelOf(e.data, 'platform')).filter(Boolean))];
        if (platforms.length > 1 && !options.allowMixedPlatforms) throw new R.ReportError(`Results from several platforms (${platforms.join(', ')}): pass --allow-mixed-platforms to combine them`);
        const epics = R.groupByEpic(pickReg);
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const snapshotId = `snapshot-${stamp}`;
        const finalDir = path.join(reportRoot, 'snapshots', snapshotId);
        const tmp = path.join(reportRoot, `.tmp-${snapshotId}`);
        R.assertSafeTarget(reportRoot, finalDir);
        if (fs.existsSync(finalDir)) throw new R.ReportError(`Snapshot ${snapshotId} already exists`);
        fs.mkdirSync(tmp, { recursive: true });
        const work = path.join(reportRoot, `.tmp-${snapshotId}-work`);
        const reviewedFile = path.join(reportRoot, 'screenshot-review.json');
        const reviewed = fs.existsSync(reviewedFile) ? JSON.parse(fs.readFileSync(reviewedFile, 'utf8')) : {};
        const allure = R.allureInfo();
        const omittedTotal = { stackTraces: true, logs: true, pageSources: true, parameters: 0, unreviewedScreenshots: 0 };
        const warnings = [];
        const starts = entries.map((e) => e.data.start).filter(Boolean);
        const range = starts.length ? { from: new Date(Math.min(...starts)).toISOString(), to: new Date(Math.max(...entries.map((e) => e.data.stop ?? e.data.start))).toISOString() } : null;
        try {
            const envProps = { Application: application, Platform: platforms.join(', '), Environment: [...new Set(entries.map((e) => R.labelOf(e.data, 'environment')))].join(', '), Runs: sources.map((s) => s.runId).join(', ') };
            const section = async (list, name, outRel) => {
                const san = path.join(work, name);
                const omitted = R.sanitizeInto(list, san, { includeScreenshots, reviewed });
                omittedTotal.parameters += omitted.parameters;
                omittedTotal.unreviewedScreenshots += omitted.unreviewedScreenshots;
                R.writeEnvironment(san, { ...envProps, 'Execution type': name.startsWith('regression') ? 'regression' : 'smoke' });
                await generate(san, path.join(tmp, outRel), allure.singleFile);
            };
            if (pickSmoke.length) await section(pickSmoke, 'smoke', 'smoke');
            for (const s of pickSmoke.map((e) => e.source).filter((v, i, a) => a.indexOf(v) === i)) {
                if (s.meta?.runType === 'partial' || s.meta?.decision === 'INCONCLUSIVE') warnings.push(`Smoke run ${s.runId} is a partial smoke run (INCONCLUSIVE)`);
            }
            const epicSummaries = [];
            for (const [epic, list] of epics) {
                await section(list, `regression-${epic}`, path.join('regression', epic));
                epicSummaries.push(R.epicSummary(epic, list));
            }
            if (epics.size) {
                fs.mkdirSync(path.join(tmp, 'regression'), { recursive: true });
                fs.writeFileSync(path.join(tmp, 'regression', 'index.html'), R.epicIndexHtml(epicSummaries), 'utf8');
            }
            if (!includeScreenshots) warnings.push('Screenshots omitted (use --include-screenshots with report/screenshot-review.json)');
            if (source === 'archive') warnings.push(`Snapshot of ${sources.length} runs (latest outcome per testcase)`);
            const counts = { smoke: R.countsOf(pickSmoke), regression: R.countsOf(pickReg) };
            const zipName = `${application.replace(/[^A-Za-z0-9._-]+/g, '-')}-Allure-Reports-${date ?? now.toISOString().slice(0, 10)}.zip`;
            const scope = {
                generator: 'report:share',
                generatedAt: now.toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                application,
                platforms,
                environments: [...new Set(entries.map((e) => R.labelOf(e.data, 'environment')).filter(Boolean))],
                allure,
                sourceMode: source,
                runSelectionPolicy:
                    source === 'latest' ? 'The newest archived run of each execution type (allure-results/ when no regression archive exists).' : 'Every archived run (filtered by --runs/--since); per testcase identity the attempts of the latest run.',
                sources: sources.map((s) => ({ runId: s.runId, executionType: s.type ?? 'label', path: s.label, rawResults: entries.filter((e) => e.source.runId === s.runId).length, startedAt: s.startedAt, finishedAt: s.meta?.finishedAt ?? '' })),
                observedRange: range,
                counts,
                epics: epicSummaries,
                warnings,
                omitted: omittedTotal,
                zip: zipName,
            };
            fs.writeFileSync(path.join(tmp, 'report-scope.json'), `${JSON.stringify(scope, null, 2)}\n`, 'utf8');
            const links = [pickSmoke.length ? '<li><a href="smoke/index.html">Smoke</a></li>' : '', epics.size ? '<li><a href="regression/index.html">Regression (by epic)</a></li>' : ''].join('');
            const body = `<p>${R.esc(application)} — ${R.esc(platforms.join(', '))}. ${source === 'latest' ? 'Single run per type' : `Snapshot of ${sources.length} runs`}${range ? `, ${R.esc(range.from)} to ${R.esc(range.to)}` : ''} (${R.esc(scope.timeZone)}).</p><ul>${links}</ul><p>Smoke: ${R.esc(R.statusLine(counts.smoke.status))}<br>Regression: ${R.esc(R.statusLine(counts.regression.status))}</p>${warnings.map((w) => `<div class="warn">${R.esc(w)}</div>`).join('')}<p class="muted">Omitted: stack traces, logs, page sources, parameters. Not a release sign-off; a failed assertion is a candidate, not a confirmed defect.</p>`;
            fs.writeFileSync(path.join(tmp, 'index.html'), R.page(`${application} test reports`, body), 'utf8');
            fs.writeFileSync(
                path.join(tmp, 'README.md'),
                `# ${application} test reports (${snapshotId})\n\n- Open: extract the ZIP and open index.html. ${allure.singleFile ? 'Allure reports are single-file.' : 'Serve the folder over HTTP (npx allure open <folder>): multi-file reports do not open from file://.'}\n- Share: the ZIP only.\n- Scope: ${scope.runSelectionPolicy}\n- Omitted: stack traces, logs, page sources, parameters, unreviewed screenshots.\n- Limitations: not a release sign-off; a failed assertion is a candidate, not a confirmed defect.\n`,
                'utf8',
            );
            const broken = R.brokenLinks(tmp);
            if (broken.length) throw new R.ReportError(`Self-check failed, broken links: ${broken.join('; ')}`);
            R.moveDir(tmp, finalDir);
            const files = R.listFiles(finalDir);
            R.writeZip(
                files.map((f) => ({ name: f, data: fs.readFileSync(path.join(finalDir, f)) })),
                path.join(reportRoot, zipName),
            );
            const zipNames = R.zipEntryNames(path.join(reportRoot, zipName));
            if (JSON.stringify(zipNames) !== JSON.stringify(files)) throw new R.ReportError('Self-check failed: ZIP entries differ from the planned list');
            R.writeDashboard(reportRoot, application);
            slog.info(`Snapshot written: report/snapshots/${snapshotId}`);
            return { snapshotId, folder: finalDir, zip: path.join(reportRoot, zipName), scope };
        } finally {
            fs.rmSync(work, { recursive: true, force: true });
            if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
        }
    } catch (error) {
        slog.error(`report:share failed: ${log.describe(error)}`);
        throw error;
    }
}

/** CLI entry. */
export async function main(argv) {
    slog.info('report:share started');
    try {
        const { values } = parseArgs({
            args: argv,
            options: {
                source: { type: 'string', default: 'latest' },
                runs: { type: 'string' },
                since: { type: 'string' },
                application: { type: 'string' },
                date: { type: 'string' },
                'include-screenshots': { type: 'boolean', default: false },
                'allow-mixed-platforms': { type: 'boolean', default: false },
            },
            strict: true,
        });
        if (!['latest', 'archive'].includes(values.source)) throw new R.ReportError('--source must be latest or archive');
        const allure = R.allureInfo();
        console.log(`Allure CLI ${allure.version || 'not found'} (single-file: ${allure.singleFile})`);
        const result = await buildShareReport({
            source: values.source,
            runs: values.runs ? values.runs.split(',').map((s) => s.trim()) : [],
            since: values.since,
            application: values.application,
            date: values.date,
            includeScreenshots: values['include-screenshots'],
            allowMixedPlatforms: values['allow-mixed-platforms'],
        });
        console.log(`Snapshot: ${path.relative(ROOT, result.folder)}\nZIP: ${path.relative(ROOT, result.zip)}\nDashboard: report/index.html`);
        return 0;
    } catch (error) {
        console.error(log.describe(error));
        return 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).then((code) => process.exit(code));
}
