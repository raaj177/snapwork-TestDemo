// Winston logger: console (terminal / Jenkins), logs/automation.log (JSON lines), logs/automation.txt (console lines)
// and the per-test buffer attached to Allure as "Logger". Every line is redacted.
// Logging-rule exception: this module is the logger itself, so its functions do not log (recursion).
import '../../config/load-dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import winston from 'winston';
import { redact } from './Redactor';
import { appendTestLog } from './TestState';

const LEVEL = (process.env.LOG_LEVEL ?? 'info').trim() || 'info';
const LOG_DIR = path.resolve((process.env.LOG_DIR ?? 'logs').trim() || 'logs');

const lineFormat = winston.format.printf((info) => {
    const { level, message, timestamp, ...meta } = info as Record<string, unknown>;
    const context = ['page', 'service', 'component', 'module']
        .map((k) => meta[k])
        .filter(Boolean)
        .join('/');
    return `${String(timestamp)} [${String(level).toUpperCase()}]${context ? ` [${context}]` : ''} ${redact(String(message))}`;
});

const redactFormat = winston.format((info) => {
    info.message = redact(String(info.message));
    return info;
});

const testBufferStream = new Writable({
    write(chunk, _encoding, callback): void {
        appendTestLog(String(chunk).trimEnd());
        callback();
    },
});

function buildTransports(): winston.transport[] {
    const transports: winston.transport[] = [
        new winston.transports.Console({ format: winston.format.combine(winston.format.timestamp(), lineFormat) }),
        new winston.transports.Stream({ stream: testBufferStream, format: winston.format.combine(winston.format.timestamp(), lineFormat) }),
    ];
    if (process.env.LOG_TO_FILE !== 'false') {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        transports.push(
            new winston.transports.File({
                filename: path.join(LOG_DIR, 'automation.log'),
                format: winston.format.combine(winston.format.timestamp(), redactFormat(), winston.format.json()),
            }),
            new winston.transports.File({
                filename: path.join(LOG_DIR, 'automation.txt'),
                format: winston.format.combine(winston.format.timestamp(), lineFormat),
            }),
        );
    }
    return transports;
}

export const logger: winston.Logger = winston.createLogger({ level: LEVEL, transports: buildTransports() });

/** One redacted line describing an error (name + message, no stack). */
export function describeError(error: unknown): string {
    if (error instanceof Error) {
        const first = (error.message ?? '').split('\n')[0];
        return redact(`${error.name}: ${first}`);
    }
    return redact(String(error));
}

export { startTestLog, takeTestLog } from './TestState';
