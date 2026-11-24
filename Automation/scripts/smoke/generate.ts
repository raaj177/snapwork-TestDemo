// npm run smoke:generate -- --workbook "<approved file name>" [--platform android|ios]
import path from 'node:path';
import { logger, describeError } from '../../src/utils/Logger';
import { parseSmokeArgs } from './cli-common';
import { buildPlan, writePlan, rel } from './smoke-lib';

const log = logger.child({ module: 'smoke:generate' });

/** Writes the smoke manifest (eligible P0 cases, implemented in the smoke files, missing with reasons). */
export async function main(argv: string[]): Promise<number> {
    log.info('smoke:generate started');
    try {
        const args = parseSmokeArgs(argv);
        const plan = await buildPlan(args.root, args.workbookFile, args.platform);
        const { written, removed } = writePlan(plan);
        console.log(`Workbook  : ${path.basename(args.workbookFile)}`);
        console.log(
            `Eligible  : ${plan.manifest.totals.eligible}  Implemented: ${plan.manifest.totals.implemented}  Missing: ${plan.manifest.totals.missing}`,
        );
        for (const f of written) console.log(`WROTE     ${rel(args.root, f)}`);
        for (const f of removed) console.log(`REMOVED   ${rel(args.root, f)}`);
        console.log(`MANIFEST  ${rel(args.root, plan.manifestPath)}`);
        log.info('smoke:generate finished');
        return 0;
    } catch (error) {
        log.error(`smoke:generate failed: ${describeError(error)}`);
        console.error(describeError(error));
        return 2;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('smoke', 'generate.ts'))) {
    main(process.argv.slice(2)).then((code) => process.exit(code));
}
