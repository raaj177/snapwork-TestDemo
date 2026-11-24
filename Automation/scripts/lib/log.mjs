// Small logger for plain-Node scripts (scripts/run, scripts/report, scripts/lib). Same line format and redaction
// rules as src/utils/Logger.ts, without the WebdriverIO/TS toolchain. Logging-rule exception: this is the logger.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = () => LEVELS[(process.env.LOG_LEVEL ?? 'info').trim()] ?? 2;
const SECRET = /((?:password|passwd|pwd|pin|otp|token|secret|api[_-]?key|authorization|cookie)\s*[:=]\s*)("?)([^"\s,;&]+)("?)/gi;
const registered = new Set();

function redactText(text) {
    let out = String(text);
    for (const v of [...registered].sort((a, b) => b.length - a.length)) out = out.split(v).join('***');
    return out.replace(SECRET, (_m, p, o, _v, c) => `${p}${o}***${c}`);
}

function write(level, context, message) {
    if (LEVELS[level] > threshold()) return;
    if (process.env.SCRIPT_LOG_SILENT === 'true' && level !== 'error') return;
    const line = `${new Date().toISOString()} [${level.toUpperCase()}]${context ? ` [${context}]` : ''} ${redactText(message)}`;
    if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
    else process.stderr.write(`${line}\n`);
}

function make(context) {
    return {
        error: (m) => write('error', context, m),
        warn: (m) => write('warn', context, m),
        info: (m) => write('info', context, m),
        debug: (m) => write('debug', context, m),
        child: (name) => make(context ? `${context}/${name}` : name),
        describe: (error) => describeError(error),
    };
}

export function describeError(error) {
    if (error instanceof Error) return redactText(`${error.name}: ${String(error.message ?? '').split('\n')[0]}`);
    return redactText(String(error));
}

export function registerSensitive(value) {
    if (value !== undefined && value !== null && String(value).trim().length >= 3) registered.add(String(value));
}

export function redact(text) {
    return redactText(text);
}

export const log = make('');
