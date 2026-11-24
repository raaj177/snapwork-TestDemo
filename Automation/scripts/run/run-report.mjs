// Automatic per-run report: report/runs/<RUN_ID>/ + report/<RUN_ID>.zip + refreshed report/index.html.
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../lib/log.mjs';
import * as R from '../report/report-lib.mjs';

const rlog = log.child('run-report');

/** Builds the report of one run from test-results/runs/<RUN_ID>/ only. `generate` is injectable for tests. */
export async function buildRunReport({
    root,
    runDir,
    meta,
    application = process.env.APP_NAME || 'Application',
    generate = R.generateAllure,
}) {
    rlog.info(`Building the report of run ${meta.runId}`);
    try {
        const reportRoot = path.join(root, 'report');
        const finalDir = path.join(reportRoot, 'runs', meta.runId);
        R.assertSafeTarget(reportRoot, finalDir);
        if (fs.existsSync(finalDir)) throw new R.ReportError(`Run report ${meta.runId} already exists`);
        const entries = R.loadResults(path.join(runDir, 'allure-results'), {
            runId: meta.runId,
            type: meta.type,
            label: `test-results/runs/${meta.runId}`,
        });
        const tmp = path.join(reportRoot, `.tmp-${meta.runId}`);
        const work = path.join(reportRoot, `.tmp-${meta.runId}-work`);
        fs.mkdirSync(tmp, { recursive: true });
        const warnings = [];
        if (meta.type === 'smoke' && !meta.coverageComplete)
            warnings.push('INCOMPLETE COVERAGE: some eligible P0 cases are not executable');
        if (meta.missingResults?.length) warnings.push(`INCOMPLETE RUN: no result for ${meta.missingResults.join(', ')}`);
        const allure = R.allureInfo();
        let epics = [];
        let counts = R.countsOf([]);
        try {
            if (entries.length === 0) {
                warnings.push(`No testcase results were produced (runner exit code ${meta.runnerExit})`);
            } else {
                const { smoke, regression } = R.classify(entries);
                const list = meta.type === 'smoke' ? smoke : regression;
                counts = R.countsOf(list);
                const env = {
                    Application: application,
                    Platform: meta.platform,
                    Environment: meta.environment,
                    Run: meta.runId,
                    'Execution type': meta.type,
                };
                if (meta.type === 'smoke') {
                    R.sanitizeInto(list, path.join(work, 'smoke'), {});
                    R.writeEnvironment(path.join(work, 'smoke'), env, 'run-commands');
                    await generate(path.join(work, 'smoke'), path.join(tmp, 'smoke'), allure.singleFile);
                } else {
                    const grouped = R.groupByEpic(list);
                    for (const [epic, items] of grouped) {
                        const san = path.join(work, `regression-${epic}`);
                        R.sanitizeInto(items, san, {});
                        R.writeEnvironment(san, env, 'run-commands');
                        await generate(san, path.join(tmp, 'regression', epic), allure.singleFile);
                        const summary = R.epicSummary(epic, items, meta.storiesInWorkbook ?? 0);
                        const executed = new Set(summary.stories.map((s) => s.storyId));
                        summary.selectedNoResult = (meta.selectedStories ?? []).filter((s) => !executed.has(s));
                        if (summary.partial)
                            warnings.push(`Partial epic: ${summary.stories.length} of ${summary.storiesInWorkbook} stories (${epic})`);
                        epics.push(summary);
                    }
                    fs.writeFileSync(
                        path.join(tmp, 'regression', 'index.html'),
                        R.epicIndexHtml(epics, `Regression run ${meta.runId}`),
                        'utf8',
                    );
                }
            }
            const starts = entries.map((e) => e.data.start).filter(Boolean);
            const scope = {
                generator: 'run-commands',
                generatedAt: new Date().toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                runId: meta.runId,
                type: meta.type,
                workbook: meta.workbook,
                stories: meta.stories ?? [],
                selectedIds: meta.selectedIds ?? [],
                observedResultRows: entries.length,
                retriedAttempts: counts.retriedAttempts,
                distinctTestcases: counts.distinctTestcases,
                missingIds: meta.missingResults ?? [],
                excludedIds: meta.excluded ?? [],
                statusTotals: counts.status,
                epics,
                coverageLimitation: meta.type === 'smoke' && !meta.coverageComplete ? 'INCOMPLETE COVERAGE' : null,
                observedRange: starts.length
                    ? { from: new Date(Math.min(...starts)).toISOString(), to: new Date(Math.max(...starts)).toISOString() }
                    : null,
                runnerExitCode: meta.runnerExit,
                warnings,
                omitted: { stackTraces: true, logs: true, pageSources: true, parameters: true, screenshots: true },
                allure,
            };
            fs.writeFileSync(path.join(tmp, 'report-scope.json'), `${JSON.stringify(scope, null, 2)}\n`, 'utf8');
            const link = entries.length
                ? meta.type === 'smoke'
                    ? '<p><a href="smoke/index.html">Smoke Allure report</a></p>'
                    : '<p><a href="regression/index.html">Regression by epic</a></p>'
                : '';
            const body = `<p>${R.esc(meta.type)} run of <strong>${R.esc(meta.workbook)}</strong> on ${R.esc(meta.platform)} (${R.esc(meta.environment)}). Runner exit code ${R.esc(meta.runnerExit)}.</p>${warnings.map((w) => `<div class="warn">${R.esc(w)}</div>`).join('')}<p>Status: ${R.esc(R.statusLine(counts.status))}; distinct testcases ${counts.distinctTestcases}; retried attempts ${counts.retriedAttempts}.</p>${link}<p class="muted">Not a release sign-off. A failed assertion is a candidate for triage, not a confirmed defect.</p>`;
            fs.writeFileSync(path.join(tmp, 'index.html'), R.page(`Run ${meta.runId}`, body), 'utf8');
            fs.writeFileSync(
                path.join(tmp, 'README.txt'),
                `Run ${meta.runId}\nOpen: extract ${meta.runId}.zip and open index.html (${allure.singleFile ? 'single-file Allure reports; opening from file:// was not verified by this tool' : 'serve the folder over HTTP'}).\nOmitted: raw driver steps, logs, parameters, stack traces, page sources, screenshots.\nRaw artifacts in test-results/runs/${meta.runId}/ are private: never share them wholesale.\nA failed assertion is not a confirmed defect.\n`,
                'utf8',
            );
            const broken = R.brokenLinks(tmp);
            if (broken.length) throw new R.ReportError(`Self-check failed, broken links: ${broken.join('; ')}`);
            R.moveDir(tmp, finalDir);
            const files = R.listFiles(finalDir).map((f) => ({
                name: `runs/${meta.runId}/${f}`,
                data: fs.readFileSync(path.join(finalDir, f)),
            }));
            files.push({
                name: 'index.html',
                data: Buffer.from(
                    R.page(
                        `Run ${meta.runId}`,
                        `<p><a href="${R.encodeLink(`runs/${meta.runId}/index.html`)}">Open the run report</a></p>`,
                    ),
                ),
            });
            R.writeZip(files, path.join(reportRoot, `${meta.runId}.zip`));
            R.writeDashboard(reportRoot, application);
            rlog.info(`Run report written: report/runs/${meta.runId}`);
            return { folder: finalDir, zip: path.join(reportRoot, `${meta.runId}.zip`), scope, noResults: entries.length === 0 };
        } finally {
            fs.rmSync(work, { recursive: true, force: true });
            if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
        }
    } catch (error) {
        rlog.error(`Run report failed: ${log.describe(error)}`);
        throw error;
    }
}
