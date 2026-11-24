// Device-free fixture tests of the P0 smoke tooling (p0-smoke.md). Run: npm run smoke:test
// P0 cases are implemented only in src/tests/smoke/<WorkbookName>/<StoryId>.test.ts; others only in regression.
import './quiet';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as lib from '../smoke-lib';
import { writeWorkbook, tempRoot, writeSpec } from './fixtures';

const FOLDER = '01_Login_TestCases_v1_0';
const FILE = `${FOLDER}.xlsx`;
const SMOKE = '01_Login';

/** Writes a hand-written smoke spec src/tests/smoke/01_Login/<story>.test.ts with the given it() titles. */
function writeSmoke(root: string, story: string, its: string[]): string {
    const file = path.join(root, 'src', 'tests', 'smoke', SMOKE, `${story}.test.ts`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const body = [`describe('${story}', () => {`, ...its.map((t) => `    it('${t.replace(/'/g, "\\'")}', async () => {});`), '});', ''];
    fs.writeFileSync(file, body.join('\n'), 'utf8');
    return file;
}

async function setup() {
    const root = tempRoot();
    const wbFile = path.join(root, 'testcase', 'Testcases', FILE);
    await writeWorkbook(wbFile, {
        'US-001 Login': [
            { id: 'TC_US001_001', title: 'Verify login screen' },
            { id: 'TC_US001_002', title: 'Verify login works' },
            { id: 'TC_US001_003', title: 'P1 case', priority: 'P1' },
            { id: 'TC_US001_004', title: 'Not a candidate', candidate: 'No' },
            { id: 'TC_US001_005', title: 'Invalidated', caseType: 'invalidated' },
            { id: 'BAD ID', title: 'Invalid id' },
        ],
        'US-002 Logout': [{ id: 'TC_US002_001', title: 'Verify logout' }],
        'US-003 Profile': [{ id: 'TC_US003_001', title: 'Verify profile' }],
    });
    writeSmoke(root, 'US001', ['TC_US001_001: Verify login screen', 'TC_US001_002: Verify login works']);
    writeSmoke(root, 'US002', ['TC_US002_001: Verify logout']);
    writeSpec(root, FOLDER, 'US-001. Login.test.ts', 'US001 Login', ['TC_US001_003: P1 case']);
    return { root, wbFile };
}

test('selects exactly the eligible P0 IDs across stories and excludes P1, No, invalidated and invalid IDs', async () => {
    const { root, wbFile } = await setup();
    const plan = await lib.buildPlan(root, wbFile);
    const ids = plan.manifest.stories.flatMap((s) => s.eligible.map((e) => `${e.id}:${e.title}`));
    assert.deepEqual(ids, [
        'TC_US001_001:Verify login screen',
        'TC_US001_002:Verify login works',
        'TC_US002_001:Verify logout',
        'TC_US003_001:Verify profile',
    ]);
    assert.equal(plan.manifest.totals.eligible, 4);
    assert.equal(plan.manifest.totals.implemented, 3);
    assert.equal(plan.manifest.workbookName, '01_Login');
});

test('P0 cases implemented in the smoke story files count; the manifest names each smoke file; nothing is generated', async () => {
    const { root, wbFile } = await setup();
    const plan = await lib.buildPlan(root, wbFile);
    const before = fs.readdirSync(path.join(root, 'src', 'tests', 'smoke', SMOKE)).sort();
    lib.writePlan(plan);
    assert.deepEqual(fs.readdirSync(path.join(root, 'src', 'tests', 'smoke', SMOKE)).sort(), before);
    assert.ok(fs.existsSync(path.join(root, 'src', 'tests', 'smoke', 'generated', SMOKE, 'manifest.json')));
    const us1 = plan.manifest.stories.find((s) => s.story === 'US001');
    assert.equal(us1?.smokeSpec, 'src/tests/smoke/01_Login/US001.test.ts');
    const us3 = plan.manifest.stories.find((s) => s.story === 'US003');
    assert.equal(us3?.smokeSpec, '');
    assert.equal(us3?.eligible[0].reason, 'no it() found');
    assert.equal(plan.manifest.coverageComplete, false);
});

test('a P0 case in a regression spec is MISPLACED and not counted', async () => {
    const { root, wbFile } = await setup();
    writeSpec(root, FOLDER, 'US-003. Profile.test.ts', 'US003 Profile', ['TC_US003_001: Verify profile']);
    const plan = await lib.buildPlan(root, wbFile);
    assert.ok(plan.problems.some((p) => p.startsWith('MISPLACED TC_US003_001') && p.includes('smoke/01_Login/US003.test.ts')));
    assert.equal(plan.manifest.stories.find((s) => s.story === 'US003')?.eligible[0].status, 'missing');
});

test('a non-P0 case in a smoke spec is MISPLACED', async () => {
    const { root, wbFile } = await setup();
    writeSmoke(root, 'US001', ['TC_US001_001: Verify login screen', 'TC_US001_002: Verify login works', 'TC_US001_003: P1 case']);
    fs.unlinkSync(path.join(root, 'src', 'tests', 'regression', FOLDER, 'US-001. Login.test.ts'));
    const plan = await lib.buildPlan(root, wbFile);
    assert.ok(plan.problems.some((p) => p.startsWith('MISPLACED TC_US001_003') && p.includes('regression')));
});

test('a P0 case in another story file is a MISMATCH', async () => {
    const { root, wbFile } = await setup();
    writeSmoke(root, 'US002', ['TC_US002_001: Verify logout', 'TC_US003_001: Verify profile']);
    const plan = await lib.buildPlan(root, wbFile);
    lib.writePlan(plan);
    const problems = lib.checkPlan(plan);
    assert.ok(problems.some((p) => p.startsWith('MISMATCH TC_US003_001 is in US002.test.ts')));
    assert.ok(problems.some((p) => p.startsWith('MISMATCH US002.test.ts has TC_US003_001 of story US003')));
});

test('manifest regeneration is idempotent (byte-identical)', async () => {
    const { root, wbFile } = await setup();
    lib.writePlan(await lib.buildPlan(root, wbFile));
    const manifest = path.join(root, 'src', 'tests', 'smoke', 'generated', SMOKE, 'manifest.json');
    const first = fs.readFileSync(manifest, 'utf8');
    lib.writePlan(await lib.buildPlan(root, wbFile));
    assert.equal(fs.readFileSync(manifest, 'utf8'), first);
});

test('a leftover generated smoke file from the old layout stops generation and is reported STALE', async () => {
    const { root, wbFile } = await setup();
    const old = path.join(root, 'src', 'tests', 'smoke', SMOKE, 'US009.test.ts');
    fs.writeFileSync(old, "// @generated workbook-smoke story=US009 workbook=01_Login\nimport '../../regression/x';\n");
    const plan = await lib.buildPlan(root, wbFile);
    assert.throws(() => lib.writePlan(plan), /old layout/);
    assert.ok(lib.checkPlan(plan).some((p) => p.startsWith('STALE US009.test.ts')));
});

test('a workbook with no eligible rows writes a manifest with eligible 0 and no smoke folder', async () => {
    const root = tempRoot();
    const wbFile = path.join(root, 'testcase', 'Testcases', 'Empty_TestCases_v1_0.xlsx');
    await writeWorkbook(wbFile, { 'US-001 A': [{ id: 'TC_US001_001', title: 'x', priority: 'P2' }] });
    const plan = await lib.buildPlan(root, wbFile);
    lib.writePlan(plan);
    assert.equal(plan.manifest.totals.eligible, 0);
    assert.equal(fs.existsSync(path.join(root, 'src', 'tests', 'smoke', 'Empty')), false);
    assert.equal(plan.manifest.coverageComplete, true);
});

test('a duplicate ID in the workbook fails the check', async () => {
    const root = tempRoot();
    const wbFile = path.join(root, 'testcase', 'Testcases', FILE);
    await writeWorkbook(wbFile, { 'US-001 A': [{ id: 'TC_US001_001', title: 'a' }], 'US-002 B': [{ id: 'TC_US001_001', title: 'a' }] });
    writeSmoke(root, 'US001', ['TC_US001_001: a']);
    const plan = await lib.buildPlan(root, wbFile);
    assert.ok(plan.problems.some((p) => p.startsWith('DUPLICATE TC_US001_001')));
});

test('check reports missing, duplicate it(), title mismatch and a stale manifest', async () => {
    const { root, wbFile } = await setup();
    writeSmoke(root, 'US003', ['TC_US003_001: Different title']);
    fs.writeFileSync(
        path.join(root, 'src', 'tests', 'smoke', SMOKE, 'US002 copy.test.ts'),
        "it('TC_US002_001: Verify logout', async () => {});\n",
    );
    let plan = await lib.buildPlan(root, wbFile);
    let problems = lib.checkPlan(plan);
    assert.ok(problems.some((p) => p.startsWith('TITLE TC_US003_001')));
    assert.ok(problems.some((p) => p.startsWith('DUPLICATE TC_US002_001')));
    assert.ok(problems.some((p) => p.startsWith('STALE manifest.json')));
    fs.unlinkSync(path.join(root, 'src', 'tests', 'smoke', SMOKE, 'US002 copy.test.ts'));
    fs.unlinkSync(path.join(root, 'src', 'tests', 'smoke', SMOKE, 'US003.test.ts'));
    plan = await lib.buildPlan(root, wbFile);
    lib.writePlan(plan);
    problems = lib.checkPlan(plan);
    assert.deepEqual(problems, ['MISSING TC_US003_001 (no it() found)']);
});

test('complete coverage prints no problems', async () => {
    const { root, wbFile } = await setup();
    writeSmoke(root, 'US003', ['TC_US003_001: Verify profile']);
    const plan = await lib.buildPlan(root, wbFile);
    lib.writePlan(plan);
    assert.deepEqual(lib.checkPlan(plan), []);
    assert.equal(plan.manifest.coverageComplete, true);
});

test('Blocked cases in the handoff count as missing with the reason', async () => {
    const { root, wbFile } = await setup();
    fs.mkdirSync(path.join(root, 'automation-handoff'), { recursive: true });
    fs.writeFileSync(path.join(root, 'automation-handoff', 'US003.md'), '| TC_US003_001 | Blocked | OTP cannot be read |\n');
    const plan = await lib.buildPlan(root, wbFile);
    const us3 = plan.manifest.stories.find((s) => s.story === 'US003');
    assert.equal(us3?.eligible[0].reason, 'Blocked: OTP cannot be read');
});

test('decision table', () => {
    const ids = ['TC_A', 'TC_B'];
    assert.equal(
        lib.decide({ coverageComplete: true, partial: false, selectedIds: ids, results: { TC_A: 'Pass', TC_B: 'Pass' } }).decision,
        'ACCEPT',
    );
    assert.equal(
        lib.decide({ coverageComplete: true, partial: false, selectedIds: ids, results: { TC_A: 'Pass', TC_B: 'Fail' } }).decision,
        'REJECT',
    );
    assert.equal(
        lib.decide({ coverageComplete: false, partial: false, selectedIds: ids, results: { TC_A: 'Pass', TC_B: 'Pass' } }).decision,
        'INCONCLUSIVE',
    );
    assert.equal(
        lib.decide({ coverageComplete: true, partial: true, selectedIds: ids, results: { TC_A: 'Pass', TC_B: 'Pass' } }).decision,
        'INCONCLUSIVE',
    );
    assert.equal(
        lib.decide({ coverageComplete: true, partial: false, selectedIds: ids, results: { TC_A: 'Pass', TC_B: 'Skip' } }).decision,
        'INCONCLUSIVE',
    );
    assert.equal(
        lib.decide({ coverageComplete: true, partial: false, selectedIds: ids, results: { TC_A: 'Pass', TC_B: 'Blocked' } }).decision,
        'INCONCLUSIVE',
    );
    assert.equal(
        lib.decide({ coverageComplete: true, partial: false, selectedIds: ids, results: { TC_A: 'Pass' } }).decision,
        'INCONCLUSIVE',
    );
});

test('build folders are unique and never overwritten; the record is written', async () => {
    const { root, wbFile } = await setup();
    const plan = await lib.buildPlan(root, wbFile);
    const folder = lib.createBuildFolder(root, '01_Login', 'android-1.0-20260101-000000');
    assert.throws(() => lib.createBuildFolder(root, '01_Login', 'android-1.0-20260101-000000'), /already exists/);
    fs.writeFileSync(path.join(folder, 'results.csv'), 'Test Case ID,Execution Status\nTC_US001_001,Fail\nTC_US001_001,Pass\n');
    const outcome = lib.writeRecord({
        folder,
        manifest: plan.manifest,
        buildId: 'android-1.0-20260101-000000',
        platform: 'android',
        appVersion: '1.0',
        deviceModel: 'm',
        startedAt: '',
        finishedAt: '',
        runType: 'partial',
        selectedIds: ['TC_US001_001'],
    });
    assert.equal(outcome.decision, 'INCONCLUSIVE');
    const record = JSON.parse(fs.readFileSync(path.join(folder, 'run-record.json'), 'utf8'));
    assert.equal(record.results.TC_US001_001, 'Pass');
    assert.ok(fs.existsSync(path.join(folder, 'summary.md')));
    assert.ok(fs.existsSync(path.join(folder, 'run.json')));
    assert.match(lib.buildIdOf(undefined, 'android', '1.0 (5)', new Date(2026, 0, 2, 3, 4, 5)), /^(android-1\.0_5_-20260102-030405|.+)$/);
});

test('a normal run includes the smoke folder (P0 tests live only there, so no case runs twice)', () => {
    const conf = fs.readFileSync(path.resolve('config', 'wdio.shared.conf.ts'), 'utf8');
    assert.match(conf, /src\/tests\/smoke\/\*\*\/\*\.test\.ts/);
    assert.match(conf, /exclude: \[\]/);
});
