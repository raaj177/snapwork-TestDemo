// Device-free tests of npm run smoke / regression (workbook-commands.md section 8). Run: npm run run-commands:test
process.env.SCRIPT_LOG_SILENT = 'true';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parseRunArgs } from '../args.mjs';
import { selectCases } from '../select.mjs';
import { chooseDevice, parseAdbDevices, androidPreflight, PreflightError } from '../preflight.mjs';
import { acquireLock, releaseLock, LockError } from '../lock.mjs';
import { resultsOf, exitCodeOf, EXIT } from '../outcome.mjs';
import { buildRunReport } from '../run-report.mjs';
import { main, grepOf } from '../cli.mjs';
import { resolveApprovedWorkbook, UsageError } from '../../lib/paths.mjs';
import * as R from '../../report/report-lib.mjs';

const HEADERS = [
    'Module',
    'Test Case ID',
    'Test Description',
    'Priority (P0/P1/P2)',
    'Automation Candidate (Yes/No)',
    'IOS Testcase',
    'Test Case Type',
];

async function writeWorkbook(file, sheets) {
    const wb = new ExcelJS.Workbook();
    for (const [name, rows] of Object.entries(sheets)) {
        const ws = wb.addWorksheet(name);
        ws.getRow(1).values = [name];
        ws.getRow(2).values = ['meta'];
        ws.getRow(3).values = HEADERS;
        rows.forEach(
            (r, i) => (ws.getRow(4 + i).values = ['M', r.id, r.title, r.priority ?? 'P0', r.candidate ?? 'Yes', 'Yes', r.type ?? 'new']),
        );
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await wb.xlsx.writeFile(file);
}

function writeSpec(root, folder, name, its, extra = '') {
    const file = path.join(root, 'src', 'tests', 'regression', folder, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
        file,
        `describe('US001 Login', () => {\n${its.map((t) => `    it('${t}', async () => {});`).join('\n')}\n${extra}});\n`,
    );
    return file;
}

async function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-cmd-'));
    const tc = path.join(root, 'testcase', 'Testcases');
    await writeWorkbook(path.join(tc, 'Book A v1.xlsx'), {
        'US-001 Login': [
            { id: 'TC_US001_001', title: 'Login shown' },
            { id: 'TC_US001_002', title: 'Login works', priority: 'P1' },
            { id: 'TC_US001_003', title: 'Renamed in workbook' },
            { id: 'TC_US001_004', title: 'Skipped one' },
            { id: 'TC_US001_005', title: 'Not implemented' },
        ],
        'US-002 Logout': [{ id: 'TC_US002_001', title: 'Logout' }],
    });
    await writeWorkbook(path.join(tc, 'Book B.xlsx'), { 'US-001 Other': [{ id: 'TC_US001_001', title: 'Other book same ID' }] });
    writeSpec(
        root,
        'Book A v1',
        'US-001. Login.test.ts',
        ['TC_US001_001: Login shown', 'TC_US001_002: Login works', 'TC_US001_003: Old title'],
        "    it.skip('TC_US001_004: Skipped one', async () => {});\n",
    );
    writeSpec(root, 'Book A v1', 'US-002. Logout.test.ts', ['TC_US002_001: Logout']);
    writeSpec(root, 'Book B', 'US-001. Other.test.ts', ['TC_US001_001: Other book same ID']);
    return root;
}

test('argument parsing: workbook names with spaces, story IDs, options', () => {
    const a = parseRunArgs(['regression', 'My Book v1.xlsx', 'us002', 'US003', '--dry-run', '--retries', '1']);
    assert.equal(a.workbook, 'My Book v1.xlsx');
    assert.deepEqual(a.stories, ['US002', 'US003']);
    assert.equal(a.dryRun, true);
    assert.equal(a.retries, 1);
    assert.equal(parseRunArgs(['smoke', 'x.xlsx']).retries, 0);
});

test('argument errors exit as usage: unknown option, missing value, extra workbook, story in smoke', () => {
    assert.throws(() => parseRunArgs(['smoke', 'a.xlsx', '--fast']), UsageError);
    assert.throws(() => parseRunArgs(['smoke', 'a.xlsx', '--retries']), UsageError);
    assert.throws(() => parseRunArgs(['regression', 'a.xlsx', 'b.xlsx']), UsageError);
    assert.throws(() => parseRunArgs(['smoke', 'a.xlsx', 'US001']), UsageError);
    assert.throws(() => parseRunArgs(['regression', 'a.xlsx', 'X1']), UsageError);
    assert.throws(() => parseRunArgs(['smoke']), UsageError);
});

test('unsafe and out-of-folder workbook paths are rejected', async () => {
    const root = await fixture();
    const tcDir = path.join(root, 'testcase');
    fs.writeFileSync(path.join(root, 'outside.xlsx'), 'x');
    assert.throws(() => resolveApprovedWorkbook('../../outside.xlsx', tcDir), UsageError);
    assert.throws(() => resolveApprovedWorkbook(path.join(root, 'outside.xlsx'), tcDir), UsageError);
    assert.throws(() => resolveApprovedWorkbook('~$Book A v1.xlsx', tcDir), UsageError);
    assert.throws(() => resolveApprovedWorkbook('Book A v1.csv', tcDir), UsageError);
    assert.throws(() => resolveApprovedWorkbook('Missing.xlsx', tcDir), UsageError);
    assert.ok(resolveApprovedWorkbook('Book A v1.xlsx', tcDir).endsWith('Book A v1.xlsx'));
});

test('selection: ID + exact title within the workbook folder; repeated IDs across workbooks stay apart; counts', async () => {
    const root = await fixture();
    const fileA = path.join(root, 'testcase', 'Testcases', 'Book A v1.xlsx');
    const sel = await selectCases({ root, workbookFile: fileA, type: 'regression' });
    assert.deepEqual(
        sel.selected.map((s) => s.id),
        ['TC_US001_001', 'TC_US001_002', 'TC_US002_001'],
    );
    assert.ok(sel.selected[0].file.includes('Book A v1'));
    assert.deepEqual(sel.excluded, [
        { id: 'TC_US001_003', reason: 'title-mismatch' },
        { id: 'TC_US001_004', reason: 'it.skip' },
    ]);
    assert.deepEqual(sel.missing, [{ id: 'TC_US001_005', reason: 'no it()' }]);
    assert.equal(sel.candidates, 6);
    const smoke = await selectCases({ root, workbookFile: fileA, type: 'smoke' });
    assert.deepEqual(
        smoke.selected.map((s) => s.id),
        ['TC_US001_001', 'TC_US002_001'],
    );
    const story = await selectCases({ root, workbookFile: fileA, type: 'regression', stories: ['US002'] });
    assert.deepEqual(
        story.selected.map((s) => s.id),
        ['TC_US002_001'],
    );
    await assert.rejects(() => selectCases({ root, workbookFile: fileA, type: 'regression', stories: ['US009'] }), UsageError);
    const fileB = path.join(root, 'testcase', 'Testcases', 'Book B.xlsx');
    const b = await selectCases({ root, workbookFile: fileB, type: 'regression' });
    assert.equal(b.selected[0].title, 'Other book same ID');
});

test('ambiguous duplicates stop the selection', async () => {
    const root = await fixture();
    writeSpec(root, 'Book A v1', 'US-002. Copy.test.ts', ['TC_US002_001: Logout']);
    await assert.rejects(
        () => selectCases({ root, workbookFile: path.join(root, 'testcase', 'Testcases', 'Book A v1.xlsx'), type: 'regression' }),
        /AMBIGUOUS/,
    );
});

test('device lists: single, multiple, none, unauthorized, stale .env', () => {
    const one = parseAdbDevices('List of devices attached\nABC123\tdevice\n');
    assert.equal(chooseDevice({ devices: one, processUdid: '', envUdid: 'OLD999' }).udid, 'ABC123');
    assert.match(chooseDevice({ devices: one, processUdid: '', envUdid: 'OLD999' }).note, /is not connected; using the only online device/);
    assert.throws(
        () => chooseDevice({ devices: parseAdbDevices('List\nA1\tdevice\nB2\tdevice\n'), processUdid: '', envUdid: '' }),
        /More than one/,
    );
    assert.throws(() => chooseDevice({ devices: [], processUdid: '', envUdid: '' }), /No device connected/);
    assert.throws(
        () => chooseDevice({ devices: parseAdbDevices('List\nA1\tunauthorized\n'), processUdid: '', envUdid: '' }),
        /No online device/,
    );
    assert.throws(() => chooseDevice({ devices: one, processUdid: 'ZZZ', envUdid: '' }), /not online/);
});

function fakeAdb(overrides = {}) {
    return (args) => {
        const cmd = args.join(' ');
        if (cmd === 'devices') return 'List of devices attached\nSER123456\tdevice\n';
        if (cmd.includes('ro.product.model')) return 'Pixel\n';
        if (cmd.includes('version.release')) return '14\n';
        if (cmd.includes('version.sdk')) return '34\n';
        if (cmd.includes('pm path')) return overrides.installed === false ? '' : 'package:/data/app/base.apk\n';
        if (cmd.includes('dumpsys package')) return 'versionName=1.2.3\n';
        if (cmd.includes('dumpsys power')) return overrides.asleep ? 'mWakefulness=Asleep' : 'mWakefulness=Awake';
        if (cmd.includes('dumpsys window')) return overrides.locked ? 'mDreamingLockscreen=true' : 'mDreamingLockscreen=false';
        if (cmd.includes('dumpsys activity')) return '  topResumedActivity=ActivityRecord{1 u0 com.app.test/.MainActivity t1}\n';
        return '';
    };
}

test('preflight: an occupied port is rejected and no process is killed', async () => {
    const server = net.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const port = server.address().port;
    const settings = { processUdid: '', envUdid: '', appPackage: 'com.app.test', startActivity: '' };
    await assert.rejects(
        () => androidPreflight({ adb: fakeAdb(), settings, ports: [port] }),
        (e) => e instanceof PreflightError && /Port \d+ is in use/.test(e.message),
    );
    assert.equal(server.listening, true);
    server.close();
    const facts = await androidPreflight({ adb: fakeAdb(), settings, ports: [1] });
    assert.equal(facts.appVersion, '1.2.3');
    await assert.rejects(() => androidPreflight({ adb: fakeAdb({ installed: false }), settings, ports: [] }), /not installed/);
    await assert.rejects(() => androidPreflight({ adb: fakeAdb({ asleep: true }), settings, ports: [] }), /asleep/);
    await assert.rejects(() => androidPreflight({ adb: fakeAdb({ locked: true }), settings, ports: [] }), /locked/);
    await assert.rejects(
        () => androidPreflight({ adb: fakeAdb(), settings: { ...settings, appPackage: 'com.other' }, ports: [] }),
        /not installed|foreground/,
    );
});

test('lock: held lock and stale lock both exit 7 and are never deleted', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-'));
    const file = acquireLock(dir, { runId: 'r1' });
    assert.throws(
        () => acquireLock(dir, { runId: 'r2' }),
        (e) => e instanceof LockError && /in progress: r1/.test(e.message),
    );
    assert.throws(() => acquireLock(dir, { runId: 'r2' }, () => false), /stale lock from r1/);
    assert.ok(fs.existsSync(file));
    releaseLock(file);
    assert.equal(fs.existsSync(file), false);
});

test('missing results, latest outcome and retry counting; exit-code precedence', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'res-'));
    const csv = path.join(dir, 'results.csv');
    fs.writeFileSync(csv, 'Test Case ID,Execution Status,Actual Result\nTC_A,Fail,"x, y"\nTC_A,Pass,ok\nTC_B,Pass,ok\n');
    const r = resultsOf(['TC_A', 'TC_B', 'TC_C'], csv);
    assert.equal(r.latest.TC_A, 'Pass');
    assert.equal(r.retried, 1);
    assert.deepEqual(r.missing, ['TC_C']);
    assert.equal(exitCodeOf({ runnerExit: 1, missing: 1, reportFailed: true }), EXIT.failures);
    assert.equal(exitCodeOf({ runnerExit: 0, missing: 1, reportFailed: true }), EXIT.missingResults);
    assert.equal(exitCodeOf({ runnerExit: 0, missing: 0, reportFailed: true }), EXIT.report);
    assert.equal(exitCodeOf({ runnerExit: 0, missing: 0, reportFailed: false }), EXIT.ok);
    assert.equal(grepOf(['TC_A', 'TC_B']), '(?:^|\\s)(?:TC_A|TC_B):');
    assert.throws(() => grepOf(['TC_A|x']), UsageError);
});

const stub = async (_s, out) => {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'index.html'), '<html>stub</html>');
};

function allureResult(dir, labels, extra = {}) {
    fs.mkdirSync(dir, { recursive: true });
    const uuid = `${Math.random().toString(16).slice(2)}`;
    const data = {
        uuid,
        name: `${labels.testCaseId}: t`,
        status: 'passed',
        start: Date.now(),
        stop: Date.now() + 5,
        labels: Object.entries(labels).map(([name, value]) => ({ name, value })),
        parameters: [{ name: 'password', value: 'S3cretValue' }],
        statusDetails: { message: 'token=abc123456', trace: 'at stack' },
        attachments: [{ name: 'Logger', source: 'x.txt', type: 'text/plain' }],
        ...extra,
    };
    fs.writeFileSync(path.join(dir, `${uuid}-result.json`), JSON.stringify(data));
}

test('regression run report: one Allure report per epic with all its stories, partial epic, encoded links, ZIP, dashboard, redaction', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runrep-'));
    const runDir = path.join(root, 'test-results', 'runs', 'regression-1');
    const res = path.join(runDir, 'allure-results');
    for (const [epic, story, id] of [
        ['Book A v1', 'US001', 'TC_US001_001'],
        ['Book A v1', 'US002', 'TC_US002_001'],
        ['Book B', 'US001', 'TC_US001_001'],
    ]) {
        allureResult(res, {
            executionType: 'regression',
            epic,
            workbook: `${epic}.xlsx`,
            specFile: `src/tests/regression/${epic}/${story}.test.ts`,
            storyId: story,
            storyName: 'n',
            testCaseId: id,
            platform: 'android',
        });
    }
    const out = await buildRunReport({
        root,
        runDir,
        generate: stub,
        meta: {
            runId: 'regression-1',
            type: 'regression',
            workbook: 'Book A v1.xlsx',
            platform: 'android',
            environment: 'qa',
            storiesInWorkbook: 3,
            runnerExit: 0,
        },
    });
    assert.deepEqual(fs.readdirSync(path.join(out.folder, 'regression')).sort(), ['Book A v1', 'Book B', 'index.html']);
    const idx = fs.readFileSync(path.join(out.folder, 'regression', 'index.html'), 'utf8');
    assert.match(idx, /Book%20A%20v1\/index\.html/);
    assert.ok(out.scope.warnings.some((w) => /Partial epic: 2 of 3 stories/.test(w)));
    const zip = R.zipEntryNames(out.zip);
    assert.ok(zip.includes('index.html') && zip.includes('runs/regression-1/regression/Book A v1/index.html'));
    assert.ok(zip.every((n) => !n.startsWith('test-results')));
    assert.deepEqual(R.brokenLinks(path.join(root, 'report')), []);
    const all = R.listFiles(path.join(root, 'report'))
        .map((f) => fs.readFileSync(path.join(root, 'report', f), 'utf8'))
        .join('');
    assert.doesNotMatch(all, /S3cretValue|abc123456|at stack/);
});

test('smoke run report; no results -> no Allure report and a clear message', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runrep-'));
    const runDir = path.join(root, 'test-results', 'runs', 'smoke-1');
    allureResult(path.join(runDir, 'allure-results'), { executionType: 'smoke', testCaseId: 'TC_A', platform: 'android' });
    const s = await buildRunReport({
        root,
        runDir,
        generate: stub,
        meta: {
            runId: 'smoke-1',
            type: 'smoke',
            workbook: 'W.xlsx',
            platform: 'android',
            environment: 'qa',
            coverageComplete: false,
            runnerExit: 0,
        },
    });
    assert.ok(fs.existsSync(path.join(s.folder, 'smoke', 'index.html')));
    assert.ok(s.scope.warnings.some((w) => /INCOMPLETE COVERAGE/.test(w)));
    const runDir2 = path.join(root, 'test-results', 'runs', 'smoke-2');
    fs.mkdirSync(runDir2, { recursive: true });
    const n = await buildRunReport({
        root,
        runDir: runDir2,
        generate: stub,
        meta: {
            runId: 'smoke-2',
            type: 'smoke',
            workbook: 'W.xlsx',
            platform: 'android',
            environment: 'qa',
            coverageComplete: true,
            runnerExit: 1,
        },
    });
    assert.equal(n.noResults, true);
    assert.equal(fs.existsSync(path.join(n.folder, 'smoke')), false);
    assert.match(fs.readFileSync(path.join(n.folder, 'index.html'), 'utf8'), /No testcase results were produced/);
});

test('main(): dry run prints the selection and preflight, never starts a session; --strict exits 6; usage exits 2', async () => {
    const root = await fixture();
    const lines = [];
    let spawned = false;
    const deps = {
        root,
        env: {},
        print: (l) => lines.push(l),
        preflight: async () => ({ lines: ['Device ok'], udid: 'S1', model: 'm', osVersion: '14' }),
        spawn: () => ((spawned = true), { status: 0 }),
    };
    assert.equal(await main(['regression', 'Book A v1.xlsx', '--dry-run'], deps), EXIT.ok);
    assert.equal(spawned, false);
    assert.ok(lines.some((l) => /Implemented: 3/.test(l)));
    assert.ok(lines.some((l) => /Device ok/.test(l)));
    await writeWorkbook(path.join(root, 'testcase', 'Testcases', 'Smoke.xlsx'), {
        'US-001 A': [
            { id: 'TC_US001_001', title: 'Login shown' },
            { id: 'TC_US001_009', title: 'missing' },
        ],
    });
    assert.equal(await main(['smoke', 'Smoke.xlsx', '--strict'], deps), EXIT.strictIncomplete);
    assert.equal(await main(['smoke', 'nope.xlsx'], deps), EXIT.usage);
    assert.equal(await main(['smoke', 'Book A v1.xlsx', '--platform', 'ios', '--dry-run'], deps), EXIT.preflight);
});

test('main(): a run with a missing result exits 4 and writes run.json and the report', async () => {
    const root = await fixture();
    const lines = [];
    const deps = {
        root,
        env: {},
        print: (l) => lines.push(l),
        generate: stub,
        preflight: async () => ({ lines: [], udid: 'S1', model: 'm', osVersion: '14', appVersion: '1' }),
        spawn: (_cmd, args, opts) => {
            assert.ok(args.includes('--mochaOpts.grep'));
            const csv = opts.env.AUTOMATION_RESULTS_FILE;
            fs.mkdirSync(path.dirname(csv), { recursive: true });
            fs.writeFileSync(csv, 'Test Case ID,Execution Status\nTC_US001_001,Pass\n');
            allureResult(opts.env.ALLURE_RESULTS_DIR, { executionType: 'smoke', testCaseId: 'TC_US001_001', platform: 'android' });
            return { status: 0 };
        },
    };
    const code = await main(['smoke', 'Book A v1.xlsx'], deps);
    assert.equal(code, EXIT.missingResults);
    assert.ok(lines.includes('NO RESULT TC_US002_001'));
    const runs = fs.readdirSync(path.join(root, 'test-results', 'runs')).filter((d) => d.startsWith('smoke-'));
    const runJson = JSON.parse(fs.readFileSync(path.join(root, 'test-results', 'runs', runs[0], 'run.json'), 'utf8'));
    assert.equal(runJson.deviceSerial.includes('S1'), false);
    assert.ok(fs.existsSync(path.join(root, 'report', `${runs[0]}.zip`)));
    assert.equal(fs.existsSync(path.join(root, 'test-results', 'runs', '.lock')), false);
});

test('end-of-run rerun: only Fail / no-result cases are chosen; earlier JUnit attempts are removed; --rerun-failed parses', async () => {
    const { failedIdsOf, junitPrefixOf, dropEarlierAttempts } = await import('../rerun.mjs');
    assert.deepEqual(
        failedIdsOf(['TC_A_1', 'TC_A_2', 'TC_A_3', 'TC_A_4', 'TC_A_5'], {
            TC_A_1: 'Pass',
            TC_A_2: 'Fail',
            TC_A_3: 'Blocked',
            TC_A_4: 'Skip',
        }),
        ['TC_A_2', 'TC_A_5'],
    );
    assert.equal(junitPrefixOf(0), '');
    assert.equal(junitPrefixOf(1), 'rerun1-');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'junit-'));
    const first =
        '<testsuites><testsuite>\n' +
        '    <testcase classname="c" name="TC US002 025 Mobile tab" time="1"><failure message="x"/></testcase>\n' +
        '    <testcase classname="c" name="TC US002 027 Default tab" time="1"/>\n' +
        '</testsuite></testsuites>\n';
    fs.writeFileSync(path.join(dir, 'results-0-0.xml'), first);
    fs.writeFileSync(path.join(dir, 'rerun1-results-0-0.xml'), '<testcase classname="c" name="TC US002 025 Mobile tab" time="1"/>\n');
    assert.equal(dropEarlierAttempts(dir, ['TC_US002_025'], 'rerun1-'), 1);
    const after = fs.readFileSync(path.join(dir, 'results-0-0.xml'), 'utf8');
    assert.doesNotMatch(after, /TC US002 025/);
    assert.match(after, /TC US002 027/);
    assert.match(fs.readFileSync(path.join(dir, 'rerun1-results-0-0.xml'), 'utf8'), /TC US002 025/);
    assert.equal(parseRunArgs(['smoke', 'W.xlsx']).rerunFailed, 1);
    assert.equal(parseRunArgs(['smoke', 'W.xlsx', '--rerun-failed', '0']).rerunFailed, 0);
    assert.throws(() => parseRunArgs(['smoke', 'W.xlsx', '--rerun-failed', '3']), /0-2/);
});
