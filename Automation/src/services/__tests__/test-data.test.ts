// Device-free tests of local overrides, the workbook Test Data cell and the synthetic fallback
// (references/test-data-sources.md section 5). Run: npm run test-data:test
import './quiet';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { TestDataService } from '../test-data.service';
import { resolveTestValue } from '../test-value.service';
import { redact, clearSensitive } from '../../utils/Redactor';
import { BlockedError } from '../../reporting/BlockedError';

const SHARED = {
    common: {
        users: {
            main: { username: 'shared-user', passwordEnv: 'MAIN_PASSWORD', description: 'shared' },
            other: { username: '{{env:OTHER_USER}}' },
        },
        messages: { welcome: 'Welcome' },
        values: { city: 'Pune' },
    },
    overrides: { android: { messages: { welcome: 'Welcome (android)' } }, ios: {} },
    environments: {},
};

function dataDir(local?: unknown, raw?: string): { dataFile: string; localFile: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'td-'));
    const dataFile = path.join(dir, 'test-data.json');
    fs.writeFileSync(dataFile, JSON.stringify(SHARED));
    const localFile = path.join(dir, 'test-data.local.json');
    if (raw !== undefined) fs.writeFileSync(localFile, raw);
    else if (local !== undefined) fs.writeFileSync(localFile, JSON.stringify(local));
    return { dataFile, localFile };
}

const environment = { MAIN_PASSWORD: 'pw-value-1', OTHER_USER: 'env-user-77' };

test('no local file: shared data unchanged', () => {
    const svc = new TestDataService({ ...dataDir(), platform: 'android', testEnv: 'qa', environment });
    assert.equal(svc.user('main').username, 'shared-user');
    assert.equal(svc.message('welcome'), 'Welcome (android)');
    assert.deepEqual(svc.localOverrides, []);
});

test('local file overrides one field of one user; other fields, users and env references keep the shared values', () => {
    const svc = new TestDataService({
        ...dataDir({ common: { users: { main: { username: 'local-user-42' } } } }),
        platform: 'android',
        testEnv: 'qa',
        environment,
    });
    const main = svc.user('main');
    assert.equal(main.username, 'local-user-42');
    assert.equal(main.password, 'pw-value-1');
    assert.equal(main.description, 'shared');
    assert.equal(svc.user('other').username, 'env-user-77');
    assert.deepEqual(svc.localOverrides, ['users.main.username']);
});

test('local platform override and environments.<env> are applied in order', () => {
    const local = {
        common: { values: { city: 'A' } },
        overrides: { android: { values: { city: 'B' } } },
        environments: { uat: { values: { city: 'C' } } },
    };
    assert.equal(new TestDataService({ ...dataDir(local), platform: 'android', testEnv: 'qa', environment }).value('city'), 'B');
    assert.equal(new TestDataService({ ...dataDir(local), platform: 'android', testEnv: 'uat', environment }).value('city'), 'C');
    assert.equal(new TestDataService({ ...dataDir(local), platform: 'ios', testEnv: 'qa', environment }).value('city'), 'A');
});

test('malformed JSON and an unknown field stop with the file and field path, never the value', () => {
    assert.throws(
        () => new TestDataService({ ...dataDir(undefined, '{ "common": { "values": { "x": "secret-abc" '), environment }).load(),
        (e: Error) => /test-data\.local\.json is not valid JSON/.test(e.message) && !e.message.includes('secret-abc'),
    );
    assert.throws(
        () => new TestDataService({ ...dataDir({ common: { users: { main: { password: 'secret-xyz' } } } }), environment }).load(),
        (e: Error) => /common\.users\.main/.test(e.message) && !e.message.includes('secret-xyz'),
    );
});

test('every local value is redacted afterwards', () => {
    clearSensitive();
    const svc = new TestDataService({ ...dataDir({ common: { values: { customer: 'CUST-998877' } } }), environment });
    svc.load();
    assert.equal(redact('id CUST-998877 used'), 'id *** used');
});

async function workbook(cell: string | null): Promise<string> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-'));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('US-001 Login');
    ws.getRow(1).values = ['US-001'];
    ws.getRow(2).values = ['meta'];
    ws.getRow(3).values =
        cell === null ? ['Module', 'Test Case ID', 'Test Description'] : ['Module', 'Test Case ID', 'Test Description', 'Test Data'];
    ws.getRow(4).values = cell === null ? ['M', 'TC_US001_001', 'Verify login'] : ['M', 'TC_US001_001', 'Verify login', cell];
    fs.mkdirSync(path.join(dir, 'Testcases'), { recursive: true });
    await wb.xlsx.writeFile(path.join(dir, 'Testcases', 'Book_v1.xlsx'));
    return dir;
}

const noData = { hasValue: () => false, value: () => '' };
const FIELDS = {
    customerId: {
        labels: ['Customer ID', 'Cust ID'],
        generate: (f: { string: { numeric: (n: number) => string } }) => `C${f.string.numeric(7)}`,
        requirement: 'BRD 3.1',
    },
} as never;
const req = {
    testCaseId: 'TC_US001_001',
    title: 'Verify login',
    field: 'customerId',
    specFile: 'src/tests/regression/Book_v1/US-001. Login.test.ts',
};

test('workbook fallback: one mapped value is returned', async () => {
    const dir = await workbook('Customer ID: 1234567; Password: x');
    const r = await resolveTestValue(req, { testData: noData, testcaseDir: dir, fields: FIELDS });
    assert.deepEqual(r, { value: '1234567', source: 'workbook' });
});

test('blank cell -> seeded synthetic value, identical across calls and in the generator format', async () => {
    const dir = await workbook('');
    const a = await resolveTestValue(req, { testData: noData, testcaseDir: dir, fields: FIELDS });
    const b = await resolveTestValue(req, { testData: noData, testcaseDir: dir, fields: FIELDS });
    assert.equal(a.source, 'synthetic');
    assert.equal(a.value, b.value);
    assert.match(a.value, /^C\d{7}$/);
});

test('descriptive cell, two values and an unmapped label -> BlockedError', async () => {
    for (const cell of ['valid customer id', 'Customer ID: 1; Cust ID: 2', 'Account: 99']) {
        const dir = await workbook(cell);
        await assert.rejects(() => resolveTestValue(req, { testData: noData, testcaseDir: dir, fields: FIELDS }), BlockedError);
    }
    const dir = await workbook('Customer ID: 1');
    await assert.rejects(
        () => resolveTestValue({ ...req, field: 'branch' }, { testData: noData, testcaseDir: dir, fields: FIELDS }),
        BlockedError,
    );
});

test('missing workbook, row (ID + title) and Test Data header -> error', async () => {
    const dir = await workbook('Customer ID: 1');
    await assert.rejects(
        () =>
            resolveTestValue(
                { ...req, specFile: 'src/tests/regression/Other_v1/x.test.ts' },
                { testData: noData, testcaseDir: dir, fields: FIELDS },
            ),
        /workbook not found/i,
    );
    await assert.rejects(
        () => resolveTestValue({ ...req, title: 'Other title' }, { testData: noData, testcaseDir: dir, fields: FIELDS }),
        /not found/,
    );
    const noHeader = await workbook(null);
    await assert.rejects(() => resolveTestValue(req, { testData: noData, testcaseDir: noHeader, fields: FIELDS }), /no Test Data header/);
});

test('Faker is never used when local/shared data has the field; forbidden fields are never generated', async () => {
    let generated = false;
    const fields = {
        customerId: { labels: ['Customer ID'], generate: () => ((generated = true), 'x') },
        password: { labels: ['Password'], generate: () => 'p' },
    } as never;
    const dir = await workbook('');
    const r = await resolveTestValue(req, { testData: { hasValue: () => true, value: () => 'from-shared' }, testcaseDir: dir, fields });
    assert.equal(r.source, 'local/shared');
    assert.equal(generated, false);
    await assert.rejects(
        () => resolveTestValue({ ...req, field: 'password' }, { testData: noData, testcaseDir: dir, fields }),
        /never generated/,
    );
});
