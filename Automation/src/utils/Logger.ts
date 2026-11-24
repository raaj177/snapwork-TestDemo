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

// ---- Console (terminal / Jenkins): grouped by story, then by test case, with the test's steps indented ----
// Markers stay byte-identical inside the line ("[TEST START] <ID> | <title>", "[TEST END] <ID> | <title> | PASS"):
// scripts/run-tests.ps1 reads them. Plain ASCII borders render the same in every terminal and in Jenkins.
const RULE = '='.repeat(78);
const THIN = '-'.repeat(78);
const IN_TEST = Symbol.for('automation.console.inTest');

/** Short context: "AndroidLoginPage" -> "LoginPage", "module/x" kept. */
function shortContext(context: string): string {
    return context.replace(/^(Android|Ios|IOS)(?=[A-Z])/, '');
}

const consoleFormat = winston.format.printf((info) => {
    const { level, message, timestamp, durationMs, ...meta } = info as Record<string, unknown>;
    const holder = globalThis as unknown as Record<symbol, boolean | undefined>;
    const text = redact(String(message));
    const time = String(timestamp).slice(11, 19);
    const lvl = String(level).toUpperCase();
    const context = shortContext(
        ['page', 'service', 'component', 'module']
            .map((k) => meta[k])
            .filter(Boolean)
            .join('/'),
    );
    if (text.startsWith('[STORY] ')) return `\n${RULE}\n STORY  ${text.slice(8)}\n${RULE}`;
    if (text.startsWith('[STORY END] ')) return `\n${THIN}\n END STORY  ${text.slice(12)}\n${THIN}`;
    if (text.startsWith('[TEST START]')) {
        holder[IN_TEST] = true;
        return `\n+-- ${text}`;
    }
    if (text.startsWith('[TEST RETRY]')) return `|-- ${text}`;
    if (text.startsWith('[TEST END]')) {
        holder[IN_TEST] = false;
        const took = typeof durationMs === 'number' ? `(${(durationMs / 1000).toFixed(1)} s) ` : '';
        return `+-- ${took}${text}`;
    }
    const tag = lvl === 'INFO' ? '' : `${lvl} `;
    if (holder[IN_TEST]) return `|   ${time}  ${context.padEnd(20)} ${tag}${text}`;
    return `${time} [${lvl}]${context ? ` [${context}]` : ''} ${text}`;
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
    // Console and the per-test Allure "Logger" attachment show LOG_LEVEL (info: the steps of each test); the log files
    // keep debug too (every low-level check), so nothing is lost for investigation.
    const transports: winston.transport[] = [
        new winston.transports.Console({ level: LEVEL, format: winston.format.combine(winston.format.timestamp(), consoleFormat) }),
        new winston.transports.Stream({
            level: LEVEL,
            stream: testBufferStream,
            format: winston.format.combine(winston.format.timestamp(), lineFormat),
        }),
    ];
    if (process.env.LOG_TO_FILE !== 'false') {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        transports.push(
            new winston.transports.File({
                level: 'debug',
                filename: path.join(LOG_DIR, 'automation.log'),
                format: winston.format.combine(winston.format.timestamp(), redactFormat(), winston.format.json()),
            }),
            new winston.transports.File({
                level: 'debug',
                filename: path.join(LOG_DIR, 'automation.txt'),
                format: winston.format.combine(winston.format.timestamp(), lineFormat),
            }),
        );
    }
    return transports;
}

// The logger passes debug through so the files can keep it; each transport filters to its own level.
export const logger: winston.Logger = winston.createLogger({ level: 'debug', transports: buildTransports() });

/** One redacted line describing an error (name + message, no stack). */
export function describeError(error: unknown): string {
    if (error instanceof Error) {
        const first = (error.message ?? '').split('\n')[0];
        return redact(`${error.name}: ${first}`);
    }
    return redact(String(error));
}

export { startTestLog, takeTestLog } from './TestState';
