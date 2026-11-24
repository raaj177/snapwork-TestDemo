// Argument parsing shared by the smoke commands.
import { parseArgs } from 'node:util';
import { FRAMEWORK_ROOT } from '../../config/load-dotenv';
import { logger, describeError } from '../../src/utils/Logger';
import { resolveApprovedWorkbook, testcaseDirOf } from '../lib/paths.mjs';

const log = logger.child({ module: 'smoke-cli' });

export interface SmokeArgs {
    workbookFile: string;
    platform: 'android' | 'ios' | 'web';
    buildId?: string;
    partial: boolean;
    withProjectChecks: boolean;
    folder?: string;
    root: string;
}

/** Parses --workbook, --platform, --build-id, --partial, --with-project-checks, --folder. */
export function parseSmokeArgs(argv: string[], root: string = FRAMEWORK_ROOT): SmokeArgs {
    log.info('Parsing smoke arguments');
    try {
        const { values } = parseArgs({
            args: argv,
            options: {
                workbook: { type: 'string' },
                platform: { type: 'string', default: process.env.PLATFORM ?? 'android' },
                'build-id': { type: 'string' },
                partial: { type: 'boolean', default: false },
                'with-project-checks': { type: 'boolean', default: false },
                folder: { type: 'string' },
            },
            strict: true,
            allowPositionals: false,
        });
        const platform = String(values.platform).toLowerCase();
        if (!['android', 'ios', 'web'].includes(platform)) throw new Error(`--platform must be android, ios or web (got "${platform}")`);
        if (!values.workbook) throw new Error('--workbook "<approved file name>" is required');
        const workbookFile = resolveApprovedWorkbook(values.workbook, testcaseDirOf(root));
        const args: SmokeArgs = {
            workbookFile,
            platform: platform as SmokeArgs['platform'],
            buildId: values['build-id'],
            partial: Boolean(values.partial),
            withProjectChecks: Boolean(values['with-project-checks']),
            folder: values.folder,
            root,
        };
        log.info(`Workbook ${values.workbook}, platform ${platform}`);
        return args;
    } catch (error) {
        log.error(`Invalid arguments: ${describeError(error)}`);
        throw error;
    }
}
