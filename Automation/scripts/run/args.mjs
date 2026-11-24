// Argument parsing for npm run smoke / npm run regression (workbook-commands.md section 1).
import { log } from '../lib/log.mjs';
import { UsageError } from '../lib/paths.mjs';

const alog = log.child('run-args');

export const USAGE = `Usage:
  npm run smoke -- "<Approved Workbook>.xlsx" [--dry-run] [--strict] [--retries <0-5>] [--rerun-failed <0-2>] [--update-workbook] [--platform android|ios]
  npm run regression -- "<Approved Workbook>.xlsx" [US002 US003 ...] [--dry-run] [--retries <0-5>] [--rerun-failed <0-2>] [--update-workbook] [--platform android|ios]
The workbook is a file name in testcase/Testcases/ (or a path inside it).`;

/** Parses [type, ...args]. Throws UsageError (exit 2) for anything unexpected. */
export function parseRunArgs(argv, defaults = {}) {
    alog.info('Parsing run-command arguments');
    try {
        const [type, ...rest] = argv;
        if (type !== 'smoke' && type !== 'regression') throw new UsageError(`Unknown command "${type ?? ''}"`);
        const out = {
            type,
            workbook: '',
            stories: [],
            dryRun: false,
            retries: 0,
            // Failed cases run once more AFTER the whole run (not immediately): default 1 round.
            rerunFailed: 1,
            strict: false,
            updateWorkbook: false,
            platform: (defaults.platform ?? 'android').toLowerCase(),
        };
        const positionals = [];
        for (let i = 0; i < rest.length; i += 1) {
            const a = rest[i];
            if (a === '--dry-run') out.dryRun = true;
            else if (a === '--strict') {
                if (type !== 'smoke') throw new UsageError('--strict is a smoke option');
                out.strict = true;
            } else if (a === '--update-workbook') out.updateWorkbook = true;
            else if (a === '--retries' || a === '--platform' || a === '--rerun-failed') {
                const value = rest[i + 1];
                if (value === undefined || value.startsWith('--')) throw new UsageError(`${a} needs a value`);
                i += 1;
                if (a === '--rerun-failed') {
                    if (!/^[0-2]$/.test(value)) throw new UsageError('--rerun-failed must be 0-2');
                    out.rerunFailed = Number(value);
                } else if (a === '--retries') {
                    if (!/^[0-5]$/.test(value)) throw new UsageError('--retries must be 0-5');
                    out.retries = Number(value);
                } else {
                    if (!['android', 'ios', 'web'].includes(value.toLowerCase()))
                        throw new UsageError('--platform must be android, ios or web');
                    out.platform = value.toLowerCase();
                }
            } else if (a.startsWith('--')) throw new UsageError(`Unknown option ${a}`);
            else positionals.push(a);
        }
        if (positionals.length === 0) throw new UsageError('An approved workbook is required');
        [out.workbook] = positionals;
        for (const extra of positionals.slice(1)) {
            if (/\.xlsx$/i.test(extra)) throw new UsageError('Only one workbook per run');
            if (type === 'smoke') throw new UsageError(`Story IDs are not allowed in a smoke command ("${extra}")`);
            if (!/^US\d+$/i.test(extra)) throw new UsageError(`Invalid story ID "${extra}" (expected US<number>)`);
            out.stories.push(extra.toUpperCase());
        }
        alog.info(`Command ${type}, workbook given, ${out.stories.length} story filter(s)`);
        return out;
    } catch (error) {
        alog.error(`Invalid arguments: ${log.describe(error)}`);
        throw error;
    }
}
