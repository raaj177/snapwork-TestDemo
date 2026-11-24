// Prints the approved workbook file name for CI: the given name when it exists in testcase/Testcases/, else the only
// .xlsx there. Exit 2 (with the reason on stderr) when none or several match. Usage: node scripts/ci/workbook.mjs [name]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../lib/log.mjs';

const wlog = log.child('ci-workbook');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Resolves the approved workbook file name in testcase/Testcases/. */
export function resolveWorkbook(given, dir = path.join(ROOT, 'testcase', 'Testcases')) {
    wlog.debug('Resolving the approved workbook');
    try {
        const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$')) : [];
        const name = (given ?? '').trim();
        if (name) {
            if (!files.includes(name))
                throw new Error(`Workbook "${name}" is not in testcase/Testcases/ (found: ${files.join(', ') || 'none'})`);
            return name;
        }
        if (files.length === 1) return files[0];
        throw new Error(
            files.length === 0
                ? 'No approved workbook in testcase/Testcases/'
                : `Several workbooks in testcase/Testcases/ (${files.join(', ')}): set the WORKBOOK parameter`,
        );
    } catch (error) {
        wlog.error(`Resolving the workbook failed: ${log.describe(error)}`);
        throw error;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        process.stdout.write(`${resolveWorkbook(process.argv[2])}\n`);
    } catch (error) {
        process.stderr.write(`${log.describe(error)}\n`);
        process.exit(2);
    }
}
