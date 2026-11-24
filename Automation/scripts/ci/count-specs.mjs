// Prints how many *.test.ts files a src/tests/<folder>/ holds (CI uses it to skip an empty folder instead of failing).
// Usage: node scripts/ci/count-specs.mjs <smoke|regression|integration>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../lib/log.mjs';
import { listSpecs } from '../lib/specs.mjs';

const clog = log.child('ci-specs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Number of spec files in src/tests/<folder>/ (generated/ manifests are not specs). */
export function countSpecs(folder, root = ROOT) {
    clog.debug(`Counting specs in src/tests/${folder}`);
    try {
        if (!/^(smoke|regression|integration)$/.test(folder))
            throw new Error(`Unknown test folder "${folder}" (smoke, regression or integration)`);
        return listSpecs(path.join(root, 'src', 'tests', folder)).length;
    } catch (error) {
        clog.error(`Counting specs failed: ${log.describe(error)}`);
        throw error;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        process.stdout.write(`${countSpecs(process.argv[2] ?? '')}\n`);
    } catch (error) {
        process.stderr.write(`${log.describe(error)}\n`);
        process.exit(2);
    }
}
