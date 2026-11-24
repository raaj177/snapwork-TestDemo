// npm run smoke:record -- --workbook "<file>" --folder reports/smoke/<WorkbookName>/<BuildId> [--partial]
// Recomputes the decision from the manifest and the build's results.csv and (re)writes its run record.
import fs from 'node:fs';
import path from 'node:path';
import { logger, describeError } from '../../src/utils/Logger';
import { parseSmokeArgs } from './cli-common';
import { buildPlan, writeRecord, type Manifest } from './smoke-lib';

const log = logger.child({ module: 'smoke:record' });

/** Records an existing build folder. */
export async function main(argv: string[]): Promise<number> {
    log.info('smoke:record started');
    try {
        const args = parseSmokeArgs(argv);
        if (!args.folder) throw new Error('--folder reports/smoke/<WorkbookName>/<BuildId> is required');
        const folder = path.resolve(args.root, args.folder);
        const smokeRoot = path.resolve(args.root, 'reports', 'smoke');
        if (!folder.startsWith(smokeRoot + path.sep) || !fs.existsSync(folder))
            throw new Error('--folder must be an existing build folder under reports/smoke/');
        const plan = await buildPlan(args.root, args.workbookFile, args.platform);
        const manifest: Manifest = fs.existsSync(plan.manifestPath)
            ? (JSON.parse(fs.readFileSync(plan.manifestPath, 'utf8')) as Manifest)
            : plan.manifest;
        const previous = fs.existsSync(path.join(folder, 'run-record.json'))
            ? JSON.parse(fs.readFileSync(path.join(folder, 'run-record.json'), 'utf8'))
            : {};
        const selectedIds: string[] =
            previous.selectedIds ?? manifest.stories.flatMap((s) => s.eligible.filter((e) => e.status === 'implemented').map((e) => e.id));
        const outcome = writeRecord({
            folder,
            manifest,
            buildId: path.basename(folder),
            platform: args.platform,
            appVersion: previous.appVersion ?? 'unknown',
            deviceModel: previous.deviceModel ?? 'unknown',
            startedAt: previous.startedAt ?? '',
            finishedAt: previous.finishedAt ?? new Date().toISOString(),
            runType: args.partial ? 'partial' : (previous.runType ?? 'complete'),
            selectedIds,
        });
        console.log(`DECISION ${outcome.decision}: ${outcome.reason}`);
        log.info('smoke:record finished');
        return 0;
    } catch (error) {
        log.error(`smoke:record failed: ${describeError(error)}`);
        console.error(describeError(error));
        return 2;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('smoke', 'record.ts'))) {
    main(process.argv.slice(2)).then((code) => process.exit(code));
}
