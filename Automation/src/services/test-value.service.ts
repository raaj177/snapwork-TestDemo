// resolveTestValue: opt-in per testcase. Order: local -> shared/env reference -> the workbook row's Test Data cell
// (exactly one explicitly mapped value) -> a seeded synthetic value only when that cell is blank.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Faker, en } from '@faker-js/faker';
import { FRAMEWORK_ROOT } from '../../config/load-dotenv';
import { logger, describeError } from '../utils/Logger';
import { registerSensitive, maskValue, redact } from '../utils/Redactor';
import { BlockedError } from '../reporting/BlockedError';
import { readWorkbook, type Workbook } from '../../scripts/lib/workbook-reader.mjs';
import { SYNTHETIC_FIELDS, FORBIDDEN_FIELDS, type SyntheticField } from '../data/synthetic-data';
import { testDataService, type TestDataService } from './test-data.service';

const log = logger.child({ service: 'TestValueService' });

export interface TestValueRequest {
    testCaseId: string;
    title: string;
    field: string;
    specFile: string;
}

export interface TestValueDeps {
    testData?: Pick<TestDataService, 'hasValue' | 'value'>;
    testcaseDir?: string;
    fields?: Readonly<Record<string, SyntheticField>>;
}

export interface ResolvedTestValue {
    value: string;
    source: 'local/shared' | 'workbook' | 'synthetic';
}

/** testcase folder: TESTCASE_DIR, else <framework>/testcase, else ../testcase. */
export function testcaseDir(): string {
    log.debug('Resolving the testcase folder');
    try {
        const candidates = [
            process.env.TESTCASE_DIR,
            path.join(FRAMEWORK_ROOT, 'testcase'),
            path.join(FRAMEWORK_ROOT, '..', 'testcase'),
        ].filter(Boolean) as string[];
        const found = candidates.find((c) => fs.existsSync(c)) ?? candidates[0];
        log.debug(`Testcase folder: ${found}`);
        return found;
    } catch (error) {
        log.error(`Failed to resolve the testcase folder: ${describeError(error)}`);
        throw error;
    }
}

/** Approved workbook of a regression spec: src/tests/regression/<WorkbookFolder>/... -> Testcases/<WorkbookFolder>.xlsx */
export function workbookForSpec(specFile: string, dir: string): string {
    log.debug('Resolving the workbook of a spec');
    try {
        const parts = specFile.replace(/\\/g, '/').split('/');
        const index = parts.lastIndexOf('regression');
        const folder = index >= 0 && parts.length > index + 2 ? parts[index + 1] : '';
        if (!folder || folder === '.' || folder === '..')
            throw new Error(`Spec ${path.basename(specFile)} is not inside src/tests/regression/<WorkbookFolder>/`);
        const testcases = path.resolve(dir, 'Testcases');
        const file = path.resolve(testcases, `${folder}.xlsx`);
        if (path.dirname(file) !== testcases) throw new Error('Workbook path resolves outside testcase/Testcases/');
        log.debug(`Workbook: ${path.basename(file)}`);
        return file;
    } catch (error) {
        log.error(`Failed to resolve the workbook: ${describeError(error)}`);
        throw error;
    }
}

/** Finds the single "<label>: <value>" (or "=") for the field in a Test Data cell; throws BlockedError otherwise. */
export function parseCell(cell: string, field: string, spec: SyntheticField | undefined, testCaseId: string): string {
    log.debug(`Parsing the Test Data cell for ${field}`);
    try {
        if (!spec)
            throw new BlockedError(`${testCaseId}: Test Data cell for ${field} is not one mapped value: field "${field}" has no label map`);
        const labels = spec.labels.map((l) => l.toLowerCase());
        const segments = cell
            .split(/\r?\n|;/)
            .map((s) => s.trim())
            .filter(Boolean);
        const matches: string[] = [];
        for (const segment of segments) {
            const m = /^([^:=]+?)\s*[:=]\s*(.+)$/.exec(segment);
            if (m && labels.includes(m[1].trim().toLowerCase())) matches.push(m[2].trim());
        }
        if (matches.length !== 1) {
            const reason =
                matches.length === 0
                    ? `no "<label>: <value>" for ${spec.labels.join(' / ')} in "${redact(cell)}"`
                    : `${matches.length} values for ${field}`;
            throw new BlockedError(`${testCaseId}: Test Data cell for ${field} is not one mapped value: ${reason}`);
        }
        log.debug(`Mapped value found for ${field}`);
        return matches[0];
    } catch (error) {
        log.error(`Failed to parse the Test Data cell: ${describeError(error)}`);
        throw error;
    }
}

/** Seeded synthetic value (same testcase + field -> same value). Never for forbidden fields. */
export function syntheticValue(testCaseId: string, field: string, spec: SyntheticField | undefined): string {
    log.info(`Generating a synthetic value for ${field}`);
    try {
        if (FORBIDDEN_FIELDS.some((p) => p.test(field)))
            throw new Error(`Field "${field}" is never generated (credentials, OTPs, contacts, account data)`);
        if (!spec?.generate) throw new Error(`No synthetic generator for field "${field}" in src/data/synthetic-data.ts`);
        const seed = crypto.createHash('sha256').update(`${testCaseId}|${field}`).digest().readUInt32BE(0);
        const faker = new Faker({ locale: [en] });
        faker.seed(seed);
        const value = spec.generate(faker);
        registerSensitive(value);
        log.info(`Synthetic ${field} generated with seed ${seed}: ${maskValue(value)}`);
        return value;
    } catch (error) {
        log.error(`Failed to generate a synthetic value: ${describeError(error)}`);
        throw error;
    }
}

/** Resolves one field for an opted-in testcase (references/test-data-sources.md). */
export async function resolveTestValue(request: TestValueRequest, deps: TestValueDeps = {}): Promise<ResolvedTestValue> {
    const { testCaseId, title, field, specFile } = request;
    log.info(`Resolving ${field} for ${testCaseId}`);
    try {
        const data = deps.testData ?? testDataService;
        const fields = deps.fields ?? SYNTHETIC_FIELDS;
        if (data.hasValue(field)) {
            const value = data.value(field);
            log.info(`${field} for ${testCaseId} from local/shared test data: ${maskValue(value)}`);
            return { value, source: 'local/shared' };
        }
        const file = workbookForSpec(specFile, deps.testcaseDir ?? testcaseDir());
        if (!fs.existsSync(file)) throw new Error(`Approved workbook not found: ${path.basename(file)}`);
        const workbook: Workbook = await readWorkbook(file);
        const row = workbook.sheets.flatMap((s) => s.rows).find((r) => r.id === testCaseId && r.title === title);
        if (!row) throw new Error(`Row ${testCaseId} with the exact title was not found in ${path.basename(file)}`);
        if (row.testData === undefined) throw new Error(`Sheet "${row.sheet}" of ${path.basename(file)} has no Test Data header`);
        if (row.testData.trim() === '') {
            const value = syntheticValue(testCaseId, field, fields[field]);
            return { value, source: 'synthetic' };
        }
        const value = parseCell(row.testData, field, fields[field], testCaseId);
        registerSensitive(value);
        log.info(`${field} for ${testCaseId} from the workbook Test Data cell: ${maskValue(value)}`);
        return { value, source: 'workbook' };
    } catch (error) {
        log.error(`Failed to resolve ${field} for ${testCaseId}: ${describeError(error)}`);
        throw error;
    }
}
