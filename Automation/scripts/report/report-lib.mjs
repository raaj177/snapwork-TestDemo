// Shared report builder (references/share-report.md): classify, group by epic, sanitize, generate Allure, write the
// epic index, dashboards and ZIPs. Used by npm run report:share (snapshots) and npm run smoke/regression (per-run reports).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { log, redact } from '../lib/log.mjs';

const rlog = log.child('report-lib');
const require = createRequire(import.meta.url);

export class ReportError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ReportError';
    }
}

/** Label value of an Allure result. */
export function labelOf(result, name) {
    return (result.labels ?? []).find((l) => l.name === name)?.value ?? '';
}

/** Loads *-result.json of a folder: [{ data, dir, source, runId }]. Never modifies the source. */
export function loadResults(dir, source = {}) {
    rlog.info(`Loading results from ${dir}`);
    try {
        if (!fs.existsSync(dir)) return [];
        const out = [];
        for (const name of fs.readdirSync(dir).sort()) {
            if (!name.endsWith('-result.json')) continue;
            const data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
            out.push({ data, dir, file: name, source });
        }
        rlog.info(`${out.length} result file(s) in ${path.basename(dir)}`);
        return out;
    } catch (error) {
        rlog.error(`Failed to load results: ${log.describe(error)}`);
        throw error;
    }
}

/** Splits results into smoke and regression by the executionType label; refuses unknown or contradicting labels. */
export function classify(entries) {
    rlog.info(`Classifying ${entries.length} result(s)`);
    try {
        const smoke = [];
        const regression = [];
        const ambiguous = [];
        for (const e of entries) {
            const type = e.source.typeOverride || labelOf(e.data, 'executionType');
            const expected = e.source.type;
            if (!['smoke', 'regression'].includes(type) || (expected && expected !== type)) {
                ambiguous.push(`${labelOf(e.data, 'specFile') || '?'} ${labelOf(e.data, 'testCaseId') || e.data.name} (${e.source.label ?? e.dir})`);
                continue;
            }
            (type === 'smoke' ? smoke : regression).push(e);
        }
        if (ambiguous.length) {
            throw new ReportError(
                `AMBIGUOUS ${ambiguous.length} result(s): ${ambiguous.slice(0, 5).join('; ')}. Rerun through the run scripts, or pass the run's type with --runs <RunId>=<type> after the user confirms it.`,
            );
        }
        rlog.info(`Classified: ${smoke.length} smoke, ${regression.length} regression`);
        return { smoke, regression };
    } catch (error) {
        rlog.error(`Classification failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Groups regression results by epic (= workbook folder); refuses results without an epic or with contradictions. */
export function groupByEpic(entries) {
    rlog.info(`Grouping ${entries.length} regression result(s) by epic`);
    try {
        const epics = new Map();
        const noEpic = [];
        const contradictions = [];
        for (const e of entries) {
            const epic = labelOf(e.data, 'epic');
            const workbook = labelOf(e.data, 'workbook');
            const spec = labelOf(e.data, 'specFile');
            if (!epic) {
                noEpic.push(`${spec || '?'} ${labelOf(e.data, 'testCaseId')}`);
                continue;
            }
            const parts = spec.split('/');
            const i = parts.indexOf('regression');
            const folder = i >= 0 && parts.length > i + 2 ? parts[i + 1] : '';
            if ((workbook && workbook.replace(/\.xlsx$/i, '') !== epic) || (folder && folder !== epic)) {
                contradictions.push(`${spec} ${labelOf(e.data, 'testCaseId')}`);
                continue;
            }
            if (!epics.has(epic)) epics.set(epic, []);
            epics.get(epic).push(e);
        }
        if (noEpic.length) throw new ReportError(`NO EPIC ${noEpic.length} result(s): ${noEpic.slice(0, 5).join('; ')}. Move the spec into its workbook folder or rerun through the run scripts.`);
        if (contradictions.length) throw new ReportError(`AMBIGUOUS epic for ${contradictions.length} result(s): ${contradictions.slice(0, 5).join('; ')}`);
        rlog.info(`${epics.size} epic(s)`);
        return epics;
    } catch (error) {
        rlog.error(`Grouping failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Snapshot selection: per identity keep the attempts of the latest run (by run start time). */
export function selectLatest(entries) {
    rlog.info(`Selecting the latest run per testcase from ${entries.length} result(s)`);
    try {
        const identity = (e) =>
            [labelOf(e.data, 'workbook'), labelOf(e.data, 'specFile'), labelOf(e.data, 'platform'), labelOf(e.data, 'environment'), labelOf(e.data, 'testCaseId') || e.data.fullName || e.data.name].join('|');
        const latestRun = new Map();
        for (const e of entries) {
            const id = identity(e);
            const start = e.source.startedAt ?? String(e.data.start ?? 0);
            const cur = latestRun.get(id);
            if (!cur || start > cur.start) latestRun.set(id, { start, runId: e.source.runId });
        }
        const selected = entries.filter((e) => latestRun.get(identity(e))?.runId === e.source.runId);
        rlog.info(`${selected.length} result(s) selected`);
        return selected;
    } catch (error) {
        rlog.error(`Selection failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Counts: raw results, retried attempts, distinct testcases, status totals. */
export function countsOf(entries) {
    rlog.debug('Counting results');
    try {
        const key = (e) => `${labelOf(e.data, 'specFile')}|${labelOf(e.data, 'testCaseId') || e.data.fullName || e.data.name}|${e.source.runId ?? ''}`;
        const byTest = new Map();
        for (const e of entries) {
            const k = key(e);
            const cur = byTest.get(k);
            if (!cur || (e.data.stop ?? 0) >= (cur.data.stop ?? 0)) byTest.set(k, e);
        }
        const status = { passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 };
        for (const e of byTest.values()) status[e.data.status in status ? e.data.status : 'unknown'] += 1;
        return {
            sourceResults: entries.length,
            includedResults: entries.length,
            retriedAttempts: entries.length - byTest.size,
            distinctTestcases: new Set([...byTest.values()].map((e) => labelOf(e.data, 'testCaseId') || e.data.name)).size,
            status,
        };
    } catch (error) {
        rlog.error(`Counting failed: ${log.describe(error)}`);
        throw error;
    }
}

const SENSITIVE_PARAM = /password|pin|otp|token|secret|auth|cookie|email|mobile|phone|account|card/i;
const KEEP_LABELS = new Set(['epic', 'feature', 'story', 'tms', 'testCaseId', 'storyId', 'storyName', 'specFile', 'executionType', 'runId', 'platform', 'environment', 'workbook', 'severity', 'suite', 'parentSuite', 'subSuite']);

/** Redacts every step name recursively and drops step attachments/parameters. */
function cleanSteps(steps) {
    return (steps ?? []).map((s) => ({ name: redact(s.name ?? ''), status: s.status, start: s.start, stop: s.stop, steps: cleanSteps(s.steps) }));
}

/** Writes sanitized copies (and the allowed attachments) into outDir; returns what was omitted. */
export function sanitizeInto(entries, outDir, options = {}) {
    rlog.info(`Writing ${entries.length} sanitized result(s)`);
    try {
        fs.mkdirSync(outDir, { recursive: true });
        const omitted = { stackTraces: true, logs: true, pageSources: true, parameters: 0, unreviewedScreenshots: 0, attachments: 0 };
        const reviewed = options.reviewed ?? {};
        entries.forEach((e, index) => {
            const d = e.data;
            omitted.parameters += (d.parameters ?? []).length;
            const attachments = [];
            for (const a of d.attachments ?? []) {
                const isImage = /^image\//.test(a.type ?? '') || /\.(png|jpe?g)$/i.test(a.source ?? '');
                if (!isImage) {
                    omitted.attachments += 1;
                    continue;
                }
                const sourceFile = path.join(e.dir, a.source);
                if (!options.includeScreenshots || reviewed[a.source] !== 'reviewed' || !fs.existsSync(sourceFile)) {
                    omitted.unreviewedScreenshots += 1;
                    continue;
                }
                const target = `${index}-${a.source}`;
                fs.copyFileSync(sourceFile, path.join(outDir, target));
                attachments.push({ name: redact(a.name ?? 'Screenshot'), source: target, type: a.type ?? 'image/png' });
            }
            const clean = {
                uuid: d.uuid ?? `r${index}`,
                historyId: d.historyId,
                testCaseId: d.testCaseId,
                name: redact(d.name ?? ''),
                fullName: redact(d.fullName ?? ''),
                status: d.status,
                statusDetails: d.statusDetails?.message ? { message: redact(String(d.statusDetails.message).split('\n')[0]) } : undefined,
                stage: d.stage,
                start: d.start,
                stop: d.stop,
                labels: (d.labels ?? []).filter((l) => KEEP_LABELS.has(l.name)).map((l) => ({ name: l.name, value: redact(l.value) })),
                links: (d.links ?? []).map((l) => ({ name: l.name, url: l.url, type: l.type })),
                steps: cleanSteps(d.steps),
                attachments,
                parameters: [],
            };
            fs.writeFileSync(path.join(outDir, `${clean.uuid}-${index}-result.json`), JSON.stringify(clean), 'utf8');
        });
        fs.writeFileSync(
            path.join(outDir, 'categories.json'),
            JSON.stringify([
                { name: 'Product defect candidate (needs triage)', matchedStatuses: ['failed'] },
                { name: 'Blocked', matchedStatuses: ['broken'], messageRegex: '.*BlockedError.*' },
                { name: 'Automation / environment', matchedStatuses: ['broken', 'skipped'] },
            ]),
            'utf8',
        );
        void SENSITIVE_PARAM;
        rlog.info('Sanitized copies written');
        return omitted;
    } catch (error) {
        rlog.error(`Sanitizing failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Writes environment.properties and executor.json into a sanitized results folder. */
export function writeEnvironment(outDir, props, executorName = 'report:share') {
    rlog.debug('Writing environment.properties and executor.json');
    try {
        const lines = Object.entries(props).map(([k, v]) => `${k.replace(/\s+/g, '.')}=${redact(String(v)).replace(/\n/g, ' ')}`);
        fs.writeFileSync(path.join(outDir, 'environment.properties'), `${lines.join('\n')}\n`, 'utf8');
        fs.writeFileSync(path.join(outDir, 'executor.json'), JSON.stringify({ name: executorName, type: 'local' }), 'utf8');
    } catch (error) {
        rlog.error(`Failed to write environment files: ${log.describe(error)}`);
        throw error;
    }
}

/** Allure CLI version and --single-file support (added in Allure 2.24). */
export function allureInfo() {
    rlog.debug('Reading the Allure CLI version');
    try {
        const version = JSON.parse(fs.readFileSync(require.resolve('allure-commandline/package.json'), 'utf8')).version;
        const [maj, min] = version.split('.').map(Number);
        return { version, singleFile: maj > 2 || (maj === 2 && min >= 24) };
    } catch (error) {
        rlog.warn(`Allure CLI not found: ${log.describe(error)}`);
        return { version: '', singleFile: false };
    }
}

/** Runs `allure generate` with the project's local CLI (argument array, shell-safe escaping by the package). */
export function generateAllure(resultsDir, outDir, singleFile) {
    rlog.info(`Generating Allure report into ${outDir}`);
    return new Promise((resolve, reject) => {
        try {
            const allure = require('allure-commandline');
            const args = ['generate', resultsDir, '--clean', '-o', outDir];
            if (singleFile) args.push('--single-file');
            const child = allure(args);
            child.on('exit', (code) => (code === 0 ? resolve() : reject(new ReportError(`allure generate exited with ${code}`))));
            child.on('error', reject);
        } catch (error) {
            rlog.error(`Allure generation failed: ${log.describe(error)}`);
            reject(error);
        }
    });
}

/** Percent-encodes each path segment of a relative link (spaces -> %20). */
export function encodeLink(relPath) {
    return relPath
        .split('/')
        .map((s) => (s === '.' || s === '..' ? s : encodeURIComponent(s)))
        .join('/');
}

/** Escapes HTML text. */
export function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const CSS =
    'body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:16px;color:#1f2328;background:#fff}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0d7de;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f6f8fa}.warn{background:#fff8c5;border:1px solid #d4a72c;padding:8px;margin:8px 0}.muted{color:#57606a}@media(max-width:640px){td,th{font-size:13px}}';

/** A small standalone HTML page (no external resources). */
export function page(title, body) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>\n`;
}

/** Status totals line. */
export function statusLine(status) {
    return Object.entries(status ?? {})
        .map(([k, v]) => `${k} ${v}`)
        .join(', ');
}

/** regression/index.html: one row per epic with a percent-encoded link to its Allure report. */
export function epicIndexHtml(epics, title = 'Regression by epic') {
    rlog.debug('Writing the epic index');
    try {
        const rows = epics
            .map(
                (e) =>
                    `<tr><td><a href="${encodeLink(`./${e.epic}/index.html`)}">${esc(e.epic)}</a></td><td>${e.stories.length}${e.storiesInWorkbook ? ` of ${e.storiesInWorkbook}` : ''}${e.partial ? ' <strong>Partial epic</strong>' : ''}</td><td>${esc(e.stories.map((s) => `${s.storyId} ${s.storyName}`).join(', '))}</td><td>${e.distinctTestcases}</td><td>${esc(statusLine(e.status))}</td><td>${e.includedResults}</td><td>${e.retriedAttempts ?? 0}</td></tr>`,
            )
            .join('');
        return page(
            title,
            `<p>Category: <strong>Regression</strong>. One Allure report per epic (approved workbook), with all of its executed user stories.</p><table><tr><th>Epic (workbook)</th><th>Stories executed</th><th>Stories</th><th>Distinct testcases</th><th>Status</th><th>Raw results</th><th>Retries</th></tr>${rows}</table>`,
        );
    } catch (error) {
        rlog.error(`Failed to build the epic index: ${log.describe(error)}`);
        throw error;
    }
}

/** Summary of one epic: stories with their counts. */
export function epicSummary(epic, entries, storiesInWorkbook = 0) {
    rlog.debug(`Summarizing epic ${epic}`);
    try {
        const byStory = new Map();
        for (const e of entries) {
            const id = labelOf(e.data, 'storyId') || '?';
            if (!byStory.has(id)) byStory.set(id, []);
            byStory.get(id).push(e);
        }
        const stories = [...byStory].map(([storyId, list]) => ({ storyId, storyName: labelOf(list[0].data, 'storyName'), ...countsOf(list) }));
        return {
            epic,
            workbook: `${epic}.xlsx`,
            folder: `regression/${epic}/`,
            storiesInWorkbook,
            partial: storiesInWorkbook > 0 && stories.length < storiesInWorkbook,
            stories,
            ...countsOf(entries),
        };
    } catch (error) {
        rlog.error(`Failed to summarize epic ${epic}: ${log.describe(error)}`);
        throw error;
    }
}

// ---- ZIP (store method, no dependency) ----
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/** Writes a ZIP of [{ name, data }] entries (deflate), names with forward slashes. */
export function writeZip(entries, outFile) {
    rlog.info(`Writing ZIP ${path.basename(outFile)} (${entries.length} entries)`);
    try {
        const locals = [];
        const centrals = [];
        let offset = 0;
        for (const { name, data } of entries) {
            const nameBuf = Buffer.from(name, 'utf8');
            const compressed = zlib.deflateRawSync(data);
            const crc = crc32(data);
            const local = Buffer.alloc(30);
            local.writeUInt32LE(0x04034b50, 0);
            local.writeUInt16LE(20, 4);
            local.writeUInt16LE(0x0800, 6);
            local.writeUInt16LE(8, 8);
            local.writeUInt32LE(crc, 14);
            local.writeUInt32LE(compressed.length, 18);
            local.writeUInt32LE(data.length, 22);
            local.writeUInt16LE(nameBuf.length, 26);
            locals.push(local, nameBuf, compressed);
            const central = Buffer.alloc(46);
            central.writeUInt32LE(0x02014b50, 0);
            central.writeUInt16LE(20, 4);
            central.writeUInt16LE(20, 6);
            central.writeUInt16LE(0x0800, 8);
            central.writeUInt16LE(8, 10);
            central.writeUInt32LE(crc, 16);
            central.writeUInt32LE(compressed.length, 20);
            central.writeUInt32LE(data.length, 24);
            central.writeUInt16LE(nameBuf.length, 28);
            central.writeUInt32LE(offset, 42);
            centrals.push(central, nameBuf);
            offset += local.length + nameBuf.length + compressed.length;
        }
        const centralSize = centrals.reduce((n, b) => n + b.length, 0);
        const end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50, 0);
        end.writeUInt16LE(entries.length, 8);
        end.writeUInt16LE(entries.length, 10);
        end.writeUInt32LE(centralSize, 12);
        end.writeUInt32LE(offset, 16);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, Buffer.concat([...locals, ...centrals, end]));
    } catch (error) {
        rlog.error(`Failed to write the ZIP: ${log.describe(error)}`);
        throw error;
    }
}

/** Reads the entry names of a ZIP written by writeZip (for self-checks and tests). */
export function zipEntryNames(file) {
    rlog.debug(`Listing ZIP entries of ${path.basename(file)}`);
    try {
        const buf = fs.readFileSync(file);
        const endAt = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
        const count = buf.readUInt16LE(endAt + 10);
        let at = buf.readUInt32LE(endAt + 16);
        const names = [];
        for (let i = 0; i < count; i += 1) {
            const len = buf.readUInt16LE(at + 28);
            const extra = buf.readUInt16LE(at + 30);
            const comment = buf.readUInt16LE(at + 32);
            names.push(buf.subarray(at + 46, at + 46 + len).toString('utf8'));
            at += 46 + len + extra + comment;
        }
        return names;
    } catch (error) {
        rlog.error(`Failed to read the ZIP: ${log.describe(error)}`);
        throw error;
    }
}

/** All files under a folder, relative with forward slashes. */
export function listFiles(dir, base = dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listFiles(full, base));
        else out.push(path.relative(base, full).replace(/\\/g, '/'));
    }
    return out.sort();
}

/** Every local href/src in the HTML pages of a folder resolves to a file (self-check). */
export function brokenLinks(dir) {
    rlog.debug(`Checking links under ${dir}`);
    try {
        const broken = [];
        for (const file of listFiles(dir).filter((f) => f.endsWith('.html'))) {
            const html = fs.readFileSync(path.join(dir, file), 'utf8');
            if (html.length > 2_000_000) continue; // generated single-file Allure: not ours to check
            for (const m of html.matchAll(/(?:href|src)="([^"#?]+)"/g)) {
                const link = m[1];
                if (/^(https?:|data:|mailto:|javascript:)/.test(link)) continue;
                const target = path.resolve(path.dirname(path.join(dir, file)), decodeURIComponent(link));
                if (!fs.existsSync(target)) broken.push(`${file} -> ${link}`);
            }
        }
        return broken;
    } catch (error) {
        rlog.error(`Link check failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Moves a finished temp folder into place. Windows can briefly lock new files (EPERM/EBUSY): retry, then copy + remove. */
export function moveDir(from, to) {
    rlog.debug(`Moving ${path.basename(from)} into place`);
    try {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        for (let attempt = 1; attempt <= 5; attempt += 1) {
            try {
                fs.renameSync(from, to);
                return;
            } catch (error) {
                if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * attempt);
            }
        }
        fs.cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
        fs.rmSync(from, { recursive: true, force: true });
    } catch (error) {
        rlog.error(`Failed to move the report into place: ${log.describe(error)}`);
        throw error;
    }
}

/** True when a folder was produced by one of the two report producers. */
export function isProduced(folder) {
    try {
        const scope = JSON.parse(fs.readFileSync(path.join(folder, 'report-scope.json'), 'utf8'));
        return scope.generator === 'report:share' || scope.generator === 'run-commands';
    } catch {
        return false;
    }
}

/** Refuses to write into a report/ that holds foreign content, or a target outside report/. */
export function assertSafeTarget(reportRoot, target) {
    rlog.debug(`Checking the report target ${target}`);
    try {
        const root = path.resolve(reportRoot);
        const t = path.resolve(target);
        if (t !== root && !t.startsWith(root + path.sep)) throw new ReportError(`Refusing to write outside report/: ${target}`);
        if (fs.existsSync(root)) {
            for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
                const full = path.join(root, entry.name);
                if (entry.isFile() && (entry.name === 'index.html' || entry.name.endsWith('.zip'))) continue;
                if (entry.isDirectory() && (entry.name === 'runs' || entry.name === 'snapshots' || entry.name.startsWith('.tmp-'))) {
                    for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
                        if (sub.isDirectory() && !entry.name.startsWith('.tmp-') && !isProduced(path.join(full, sub.name))) {
                            throw new ReportError(`report/${entry.name}/${sub.name} was not created by report:share or the run commands; refusing to continue`);
                        }
                    }
                    continue;
                }
                throw new ReportError(`report/ holds "${entry.name}", which neither report producer created; refusing to continue`);
            }
        }
    } catch (error) {
        rlog.error(`Unsafe report target: ${log.describe(error)}`);
        throw error;
    }
}

/** Rebuilds report/index.html from runs/*\/report-scope.json and snapshots/*\/report-scope.json. */
export function writeDashboard(reportRoot, application = '') {
    rlog.info('Refreshing the report dashboard');
    try {
        const read = (kind) => {
            const dir = path.join(reportRoot, kind);
            if (!fs.existsSync(dir)) return [];
            return fs
                .readdirSync(dir)
                .filter((d) => fs.existsSync(path.join(dir, d, 'report-scope.json')))
                .map((d) => ({ id: d, kind, scope: JSON.parse(fs.readFileSync(path.join(dir, d, 'report-scope.json'), 'utf8')) }))
                .sort((a, b) => String(b.scope.generatedAt).localeCompare(String(a.scope.generatedAt)));
        };
        const runs = read('runs');
        const snaps = read('snapshots');
        const row = (r, i) => {
            const s = r.scope;
            const status = statusLine(s.statusTotals ?? s.counts?.regression?.status ?? s.counts?.smoke?.status);
            const zip = r.kind === 'runs' ? `${r.id}.zip` : s.zip;
            const warn = [...(s.warnings ?? [])].map(esc).join('<br>');
            return `<tr><td><a href="${encodeLink(`${r.kind}/${r.id}/index.html`)}">${esc(r.id)}</a>${i > 0 ? ' <span class="muted">(historical)</span>' : ''}</td><td>${esc(s.type ?? 'snapshot')}</td><td>${esc(s.workbook ?? (s.epics ?? []).map((e) => e.workbook).join(', '))}</td><td>${esc(s.observedRange ? `${s.observedRange.from} to ${s.observedRange.to}` : '')}</td><td>${esc(status)}</td><td>${(s.missingIds ?? []).length}</td><td>${warn}</td><td>${zip && fs.existsSync(path.join(reportRoot, zip)) ? `<a href="${encodeLink(zip)}">ZIP</a>` : ''}</td></tr>`;
        };
        const header = '<tr><th>Run / snapshot</th><th>Type</th><th>Workbook</th><th>Date range</th><th>Status</th><th>Missing</th><th>Warnings</th><th>Download</th></tr>';
        const body = `<p>${esc(application)} — newest first. A failed assertion is a candidate for triage, not a confirmed defect. This is not a release sign-off.</p><h2>Runs</h2>${runs.length ? `<table>${header}${runs.map(row).join('')}</table>` : '<p class="muted">No runs yet.</p>'}<h2>Snapshots</h2>${snaps.length ? `<table>${header}${snaps.map(row).join('')}</table>` : '<p class="muted">No snapshots yet.</p>'}`;
        fs.mkdirSync(reportRoot, { recursive: true });
        fs.writeFileSync(path.join(reportRoot, 'index.html'), page('Automation reports', body), 'utf8');
    } catch (error) {
        rlog.error(`Failed to write the dashboard: ${log.describe(error)}`);
        throw error;
    }
}
