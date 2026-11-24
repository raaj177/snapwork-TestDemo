// Redaction of secrets and identifiers in every output (logs, attachments, CSV, reports).
// Logging-rule exception: the Logger calls these functions, so logging inside them would recurse.

const SENSITIVE_KEY = '(?:password|passwd|pwd|pin|otp|token|secret|api[_-]?key|authorization|cookie|session[_-]?id)';
// key="value" / key='value' / key=value / "key": "value" -> keeps the quotes so redacted XML/JSON stays well-formed.
const KEY_VALUE_PATTERNS: RegExp[] = [
    new RegExp(`(${SENSITIVE_KEY}\\s*=\\s*)(")([^"]*)(")`, 'gi'),
    new RegExp(`(${SENSITIVE_KEY}\\s*=\\s*)(')([^']*)(')`, 'gi'),
    new RegExp(`("${SENSITIVE_KEY}"\\s*:\\s*)(")([^"]*)(")`, 'gi'),
    new RegExp(`(${SENSITIVE_KEY}\\s*[:=]\\s*)()([^\\s"',;&]+)()`, 'gi'),
    /(Bearer\s+)()([A-Za-z0-9._~+/=-]+)()/gi,
];

const registry: Set<string> = ((): Set<string> => {
    const key = Symbol.for('automation.redactor.values');
    const holder = globalThis as unknown as Record<symbol, Set<string> | undefined>;
    if (!holder[key]) holder[key] = new Set<string>();
    return holder[key] as Set<string>;
})();

/** Registers a value (password, local test-data value, workbook value) so it is replaced by *** in every output. */
export function registerSensitive(value: string | undefined | null): void {
    if (value === undefined || value === null) return;
    const v = String(value);
    if (v.trim().length >= 3) registry.add(v);
}

/** Number of registered sensitive values (for tests and diagnostics). */
export function sensitiveCount(): number {
    return registry.size;
}

/** Clears registered values (tests only). */
export function clearSensitive(): void {
    registry.clear();
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replaces registered values and key/value secrets by ***. */
export function redact(text: unknown): string {
    let out = typeof text === 'string' ? text : text instanceof Error ? text.message : (JSON.stringify(text) ?? String(text));
    const values = [...registry].sort((a, b) => b.length - a.length);
    for (const value of values) {
        out = out.replace(new RegExp(escapeRegExp(value), 'g'), '***');
    }
    for (const pattern of KEY_VALUE_PATTERNS) {
        out = out.replace(pattern, (_m, prefix: string, open: string, _value: string, close: string) => `${prefix}${open}***${close}`);
    }
    return out;
}

/** Masks an identifier for logging: keeps the last 2 characters (e.g. "******89"). */
export function maskValue(value: unknown): string {
    if (value === undefined || value === null) return '<empty>';
    const v = String(value);
    if (v.length <= 2) return '*'.repeat(v.length);
    return '*'.repeat(Math.min(v.length - 2, 8)) + v.slice(-2);
}
