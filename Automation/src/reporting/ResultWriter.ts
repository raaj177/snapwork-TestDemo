// Writes one CSV row per finished testcase attempt to AUTOMATION_RESULTS_FILE (the last attempt wins downstream).
import fs from 'node:fs';
import path from 'node:path';
import { logger, describeError } from '../utils/Logger';
import { redact } from '../utils/Redactor';
import { STATUS, type ExecutionStatus } from './statuses';
import { isBlockedError } from './BlockedError';

const log = logger.child({ module: 'ResultWriter' });

export const RESULTS_HEADER = 'Test Case ID,Execution Status,Actual Result,Automation Remark,Spec File,Test Title,Duration (ms),Timestamp';

export interface ResultRow {
    testCaseId: string;
    status: ExecutionStatus;
    actualResult: string;
    remark: string;
    specFile: string;
    title: string;
    durationMs: number;
    timestamp: string;
}

/** RFC 4180 quoting. */
export function csvField(value: unknown): string {
    log.debug('Quoting a CSV field');
    try {
        const text = String(value ?? '');
        const quoted = /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        return quoted;
    } catch (error) {
        log.error(`Failed to quote a CSV field: ${describeError(error)}`);
        throw error;
    }
}

/** Maps a Mocha/wdio result to the status vocabulary. */
export function statusOf(result: { passed: boolean; error?: unknown }, pending = false): ExecutionStatus {
    log.debug('Mapping a test result to a status');
    try {
        const status: ExecutionStatus = pending
            ? STATUS.Skip
            : result.passed
              ? STATUS.Pass
              : isBlockedError(result.error)
                ? STATUS.Blocked
                : STATUS.Fail;
        log.debug(`Status: ${status}`);
        return status;
    } catch (error) {
        log.error(`Failed to map the status: ${describeError(error)}`);
        throw error;
    }
}

export class ResultWriter {
    readonly file: string;
    protected readonly logger = logger.child({ module: 'ResultWriter' });

    constructor(file: string) {
        this.file = path.resolve(file);
    }

    /** Creates the folder and the header when the file does not exist. */
    ensureFile(): void {
        this.logger.debug(`Ensuring the results file ${this.file}`);
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, `${RESULTS_HEADER}\n`, 'utf8');
            this.logger.debug('Results file ready');
        } catch (error) {
            this.logger.error(`Failed to prepare the results file: ${describeError(error)}`);
            throw error;
        }
    }

    /** Appends one row (redacted, UTF-8, flushed). */
    write(row: ResultRow): void {
        this.logger.info(`Writing result ${row.testCaseId || '<no ID>'}: ${row.status}`);
        try {
            this.ensureFile();
            const fields = [
                row.testCaseId,
                row.status,
                redact(row.actualResult),
                redact(row.remark),
                row.specFile,
                row.title,
                row.durationMs,
                row.timestamp,
            ];
            const fd = fs.openSync(this.file, 'a');
            try {
                fs.writeSync(fd, `${fields.map(csvField).join(',')}\n`, null, 'utf8');
                fs.fsyncSync(fd);
            } finally {
                fs.closeSync(fd);
            }
            this.logger.info(`Result written to ${this.file}`);
        } catch (error) {
            this.logger.error(`Failed to write the result row: ${describeError(error)}`);
            throw error;
        }
    }
}
