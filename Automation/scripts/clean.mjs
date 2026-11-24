// npm run clean: removes generated run output only (never source, .env, workbooks, handoff files, evidence or reports/smoke).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './lib/log.mjs';

const clog = log.child('clean');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GENERATED = [
    'allure-results',
    'allure-report',
    'logs',
    'screenshots',
    path.join('test-results', 'junit'),
    path.join('test-results', 'automation-results'),
];

/** Removes the generated folders; --dry-run lists them. */
export function main(argv = []) {
    clog.info('Cleaning generated run output');
    try {
        const dry = argv.includes('--dry-run');
        for (const rel of GENERATED) {
            const full = path.join(ROOT, rel);
            if (!fs.existsSync(full)) continue;
            console.log(`${dry ? 'would remove' : 'removing'} ${rel}`);
            if (!dry) fs.rmSync(full, { recursive: true, force: true });
        }
        return 0;
    } catch (error) {
        clog.error(`Clean failed: ${log.describe(error)}`);
        return 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
