// npm run smoke:check -- --workbook "<approved file name>" [--with-project-checks]   (read-only)
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { logger, describeError } from '../../src/utils/Logger';
import { parseSmokeArgs } from './cli-common';
import { buildPlan, checkPlan } from './smoke-lib';

const log = logger.child({ module: 'smoke:check' });

/** Runs typecheck, lint and the smoke fixture tests; returns failure lines. */
export function projectChecks(root: string): string[] {
    log.info('Running project checks (typecheck, lint, smoke fixture tests)');
    try {
        const failures: string[] = [];
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        for (const script of ['typecheck', 'lint', 'smoke:test']) {
            const r = spawnSync(npm, ['run', script], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
            if (r.status !== 0) failures.push(`PROJECT CHECK npm run ${script} failed (exit ${r.status})`);
        }
        log.info(`Project checks: ${failures.length} failure(s)`);
        return failures;
    } catch (error) {
        log.error(`Project checks could not run: ${describeError(error)}`);
        throw error;
    }
}

/** Prints one line per problem and COVERAGE COMPLETE / COVERAGE INCOMPLETE. Exit 0 only when complete. */
export async function main(argv: string[]): Promise<number> {
    log.info('smoke:check started');
    try {
        const args = parseSmokeArgs(argv);
        const plan = await buildPlan(args.root, args.workbookFile, args.platform);
        const problems = checkPlan(plan);
        if (args.withProjectChecks) problems.push(...projectChecks(args.root));
        for (const p of problems) console.log(p);
        const missing = plan.manifest.totals.missing;
        if (problems.length === 0) console.log('COVERAGE COMPLETE');
        else console.log(`COVERAGE INCOMPLETE: ${missing} missing`);
        log.info(`smoke:check finished with ${problems.length} problem(s)`);
        return problems.length === 0 ? 0 : 1;
    } catch (error) {
        log.error(`smoke:check failed: ${describeError(error)}`);
        console.error(describeError(error));
        return 2;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('smoke', 'check.ts'))) {
    main(process.argv.slice(2)).then((code) => process.exit(code));
}
