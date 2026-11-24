export interface ScriptLogger {
    error(message: string): void;
    warn(message: string): void;
    info(message: string): void;
    debug(message: string): void;
    child(name: string): ScriptLogger;
    describe(error: unknown): string;
}
export declare const log: ScriptLogger;
export declare function describeError(error: unknown): string;
export declare function registerSensitive(value: unknown): void;
export declare function redact(text: unknown): string;
