// Device- and browser-free fixture tests of the shareable report builder (share-report.md section 5).
process.env.SCRIPT_LOG_SILENT = 'true';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as R from '../report-lib.mjs';
import { buildShareReport } from '../build-share-report.mjs';

let counter = 0;
function result(overrides) {
    counter += 1;
    const labels = Object.entries(overrides.labels ?? {}).map(([name, value]) => ({ name, value }));
    return {
        uuid: `u${counter}`,
        name: overrides.name ?? 'TC_US001_001: Verify',
        fullName: overrides.name ?? 'x',
        status: overrides.status ?? 'passed',
        start: overrides.start ?? 1700000000000 + counter,
        stop: (overrides.start ?? 1700000000000 + counter) + 10,
        statusDetails: overrides.statusDetails,
        labels,
        parameters: overrides.parameters ?? [],
        attachments: overrides.attachments ?? [],
        steps: overrides.steps ?? [],
    };
}

function reg(epic, story, id, extra = {}) {
    return result({
        name: `${id}: t`,
        ...extra,
        labels: { executionType: 'regression', epic, workbook: `${epic}.xlsx`, specFile: `src/tests/regression/${epic}/${story}.test.ts`, storyId: story, storyName: `Story ${story}`, testCaseId: id, platform: 'android', environment: 'qa', ...(extra.labels ?? {}) },
    });
}

function writeRun(root, kind, runId, results, meta = {}) {
    const dir = kind === 'regression' ? path.join(root, 'test-results', 'allure-archive', runId) : path.join(root, 'reports', 'smoke', 'WB', runId);
    fs.mkdirSync(path.join(dir, 'allure-results'), { recursive: true });
    for (const r of results) fs.writeFileSync(path.join(dir, 'allure-results', `${r.uuid}-result.json`), JSON.stringify(r));
    fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ runId, executionType: kind, startedAt: meta.startedAt ?? '2026-01-01T00:00:00Z', ...meta }));
    return dir;
}

const stubGenerate = async (_src, out) => {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'index.html'), '<html>stub allure</html>');
};

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'share-report-'));
const entry = (data, source = {}) => ({ data, dir: '.', file: 'x', source });

test('classifies by executionType label; a result is counted in one section only', () => {
    const { smoke, regression } = R.classify([entry(reg('E1', 'US001', 'TC_A')), entry(result({ labels: { executionType: 'smoke' } }))]);
    assert.equal(smoke.length, 1);
    assert.equal(regression.length, 1);
});

test('refuses unknown or contradicting labels', () => {
    assert.throws(() => R.classify([entry(result({ labels: { executionType: 'unknown' } }))]), /AMBIGUOUS 1/);
    assert.throws(() => R.classify([entry(result({ labels: { executionType: 'smoke' } }), { type: 'regression' })]), /AMBIGUOUS/);
    assert.equal(R.classify([entry(result({ labels: { executionType: 'unknown' } }), { typeOverride: 'regression' })]).regression.length, 1);
});

test('NO EPIC refusal for a regression result without an epic', () => {
    assert.throws(() => R.groupByEpic([entry(result({ labels: { executionType: 'regression', specFile: 'src/tests/regression/a.test.ts' } }))]), /NO EPIC 1/);
});

test('snapshot selection keeps the latest run per identity; two specs sharing an ID stay separate', () => {
    const a1 = entry(reg('E1', 'US001', 'TC_A'), { runId: 'r1', startedAt: '2026-01-01' });
    const a2 = entry(reg('E1', 'US001', 'TC_A'), { runId: 'r2', startedAt: '2026-01-02' });
    const other = entry(reg('E1', 'US002', 'TC_A'), { runId: 'r1', startedAt: '2026-01-01' });
    const selected = R.selectLatest([a1, a2, other]);
    assert.equal(selected.length, 2);
    assert.ok(selected.includes(a2) && selected.includes(other));
});

test('retries are counted apart from distinct testcases', () => {
    const counts = R.countsOf([entry(reg('E1', 'US001', 'TC_A', { status: 'failed' })), entry(reg('E1', 'US001', 'TC_A')), entry(reg('E1', 'US001', 'TC_B'))]);
    assert.equal(counts.sourceResults, 3);
    assert.equal(counts.retriedAttempts, 1);
    assert.equal(counts.distinctTestcases, 2);
    assert.equal(counts.status.passed, 2);
});

test('sanitization drops parameters, stacks, logs, non-image attachments and unreviewed screenshots', () => {
    const dir = tmp();
    const src = path.join(dir, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'a.png'), 'png');
    fs.writeFileSync(path.join(src, 'b.txt'), 'log password=hunter22');
    const data = reg('E1', 'US001', 'TC_A', {
        status: 'failed',
        statusDetails: { message: 'Expected password=hunter22\nsecond line', trace: 'stack...' },
        parameters: [{ name: 'password', value: 'hunter22' }],
        attachments: [
            { name: 'Logger', source: 'b.txt', type: 'text/plain' },
            { name: 'Screenshot', source: 'a.png', type: 'image/png' },
        ],
    });
    const out = path.join(dir, 'out');
    const omitted = R.sanitizeInto([{ data, dir: src, source: {} }], out, {});
    const written = fs.readdirSync(out).find((f) => f.endsWith('-result.json'));
    const clean = JSON.parse(fs.readFileSync(path.join(out, written), 'utf8'));
    assert.equal(clean.parameters.length, 0);
    assert.equal(clean.statusDetails.trace, undefined);
    assert.equal(clean.attachments.length, 0);
    assert.doesNotMatch(JSON.stringify(clean), /hunter22/);
    assert.equal(omitted.unreviewedScreenshots, 1);
    assert.equal(omitted.attachments, 1);
    const out2 = path.join(dir, 'out2');
    R.sanitizeInto([{ data, dir: src, source: {} }], out2, { includeScreenshots: true, reviewed: { 'a.png': 'reviewed' } });
    const clean2 = JSON.parse(fs.readFileSync(path.join(out2, fs.readdirSync(out2).find((f) => f.endsWith('-result.json'))), 'utf8'));
    assert.equal(clean2.attachments.length, 1);
});

test('percent-encoded links for folder names with spaces', () => {
    assert.equal(R.encodeLink('./01 Login Book/index.html'), './01%20Login%20Book/index.html');
    const html = R.epicIndexHtml([R.epicSummary('01 Login Book', [entry(reg('01 Login Book', 'US001', 'TC_A'))], 2)]);
    assert.match(html, /href="\.\/01%20Login%20Book\/index\.html"/);
    assert.match(html, /Partial epic/);
    assert.match(html, /Regression/);
    assert.doesNotMatch(html, /Normal/);
});

test('snapshot: one epic folder per workbook with all its stories, scope counts, ZIP entries, dashboard', async () => {
    const root = tmp();
    writeRun(root, 'regression', 'regression-1', [reg('01 Login', 'US001', 'TC_US001_001'), reg('01 Login', 'US002', 'TC_US002_001'), reg('02 Pay', 'US005', 'TC_US005_001', { status: 'failed' })]);
    writeRun(root, 'smoke', 'android-1', [result({ labels: { executionType: 'smoke', testCaseId: 'TC_US001_001', platform: 'android' } })], { runType: 'partial', decision: 'INCONCLUSIVE' });
    const out = await buildShareReport({ root, application: 'App', generate: stubGenerate, date: '2026-01-02' });
    const regDir = path.join(out.folder, 'regression');
    assert.deepEqual(fs.readdirSync(regDir).sort(), ['01 Login', '02 Pay', 'index.html']);
    assert.ok(fs.existsSync(path.join(out.folder, 'smoke', 'index.html')));
    assert.equal(out.scope.epics.find((e) => e.epic === '01 Login').stories.length, 2);
    assert.equal(out.scope.counts.regression.status.failed, 1);
    assert.ok(out.scope.warnings.some((w) => /partial smoke run/.test(w)));
    const names = R.zipEntryNames(out.zip);
    assert.deepEqual(names, R.listFiles(out.folder));
    assert.ok(names.includes('regression/01 Login/index.html'));
    assert.ok(fs.readFileSync(path.join(root, 'report', 'index.html'), 'utf8').includes('snapshots/'));
    assert.deepEqual(R.brokenLinks(path.join(root, 'report')), []);
});

test('refuses a foreign report/ folder', async () => {
    const root = tmp();
    writeRun(root, 'regression', 'regression-1', [reg('E1', 'US001', 'TC_A')]);
    fs.mkdirSync(path.join(root, 'report'), { recursive: true });
    fs.writeFileSync(path.join(root, 'report', 'notes.txt'), 'mine');
    await assert.rejects(() => buildShareReport({ root, generate: stubGenerate }), /neither report producer created/);
});

test('ZIP writer round-trips entry names', () => {
    const dir = tmp();
    R.writeZip([{ name: 'a/b c.txt', data: Buffer.from('x') }, { name: 'index.html', data: Buffer.from('y') }], path.join(dir, 'z.zip'));
    assert.deepEqual(R.zipEntryNames(path.join(dir, 'z.zip')), ['a/b c.txt', 'index.html']);
});

const javaOk = spawnSync('java', ['-version'], { encoding: 'utf8' }).status === 0;
test('optional: the real local Allure CLI generates a single-file epic report', { skip: !javaOk && 'Java not available' }, async () => {
    const root = tmp();
    writeRun(root, 'regression', 'regression-1', [reg('E1', 'US001', 'TC_A')]);
    const out = await buildShareReport({ root, application: 'App' });
    assert.ok(fs.existsSync(path.join(out.folder, 'regression', 'E1', 'index.html')));
});
