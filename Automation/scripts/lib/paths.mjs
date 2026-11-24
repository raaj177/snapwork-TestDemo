// Safe resolution of an approved workbook in testcase/Testcases/ (shared by smoke and run commands).
import fs from 'node:fs';
import path from 'node:path';
import { log } from './log.mjs';

const plog = log.child('paths');

/** testcase folder: TESTCASE_DIR, else <root>/testcase, else <root>/../testcase. */
export function testcaseDirOf(root) {
    plog.debug('Resolving the testcase folder');
    try {
        const candidates = [process.env.TESTCASE_DIR, path.join(root, 'testcase'), path.join(root, '..', 'testcase')].filter(Boolean);
        return path.resolve(candidates.find((c) => fs.existsSync(c)) ?? candidates[0]);
    } catch (error) {
        plog.error(`Failed to resolve the testcase folder: ${log.describe(error)}`);
        throw error;
    }
}

export class UsageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UsageError';
    }
}

/** Resolves a workbook name/path inside <testcaseDir>/Testcases; rejects anything unsafe or ambiguous. */
export function resolveApprovedWorkbook(nameOrPath, testcaseDir) {
    plog.info(`Resolving approved workbook "${nameOrPath}"`);
    try {
        if (!nameOrPath || !String(nameOrPath).trim())
            throw new UsageError('An approved workbook (.xlsx in testcase/Testcases/) is required');
        const folder = path.resolve(testcaseDir, 'Testcases');
        const raw = String(nameOrPath).trim();
        const base = path.basename(raw);
        if (base.startsWith('~$')) throw new UsageError(`"${base}" is an Excel lock file, not a workbook`);
        if (!/\.xlsx$/i.test(base)) throw new UsageError(`"${base}" is not an .xlsx workbook`);
        const candidate = path.isAbsolute(raw) || raw.includes('/') || raw.includes('\\') ? path.resolve(raw) : path.resolve(folder, raw);
        if (!fs.existsSync(folder)) throw new UsageError(`Folder not found: ${folder}`);
        const realFolder = fs.realpathSync(folder);
        if (!fs.existsSync(candidate)) {
            const matches = fs.readdirSync(folder).filter((f) => f.toLowerCase() === base.toLowerCase());
            if (matches.length > 1) throw new UsageError(`"${base}" matches more than one file in testcase/Testcases/`);
            throw new UsageError(`Workbook not found in testcase/Testcases/: ${base}`);
        }
        const real = fs.realpathSync(candidate);
        if (path.dirname(real) !== realFolder) throw new UsageError(`"${raw}" resolves outside testcase/Testcases/`);
        plog.info(`Approved workbook: ${path.basename(real)}`);
        return real;
    } catch (error) {
        plog.error(`Workbook rejected: ${log.describe(error)}`);
        throw error;
    }
}
