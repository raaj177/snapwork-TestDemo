// Shared test data (src/data/test-data.json) + optional Git-ignored local overrides (test-data.local.json), merged field
// by field: shared common -> shared platform override -> shared environments.<env> -> local common -> local platform
// override -> local environments.<env>. Secrets stay in the environment (passwordEnv / {{env:NAME}}).
import fs from 'node:fs';
import path from 'node:path';
import { FRAMEWORK_ROOT } from '../../config/load-dotenv';
import { logger, describeError } from '../utils/Logger';
import { registerSensitive } from '../utils/Redactor';
import { TestDataSchema, LocalTestDataSchema, type OverrideSection, type TestData } from '../data/test-data.schema';
import type { ResolvedUser } from '../types/test-data.types';

export interface TestDataOptions {
    dataFile?: string;
    localFile?: string;
    platform?: string;
    testEnv?: string;
    environment?: NodeJS.ProcessEnv;
}

interface MergedData {
    users: Record<string, { username?: string; passwordEnv?: string; description?: string }>;
    messages: Record<string, string>;
    values: Record<string, string | number | boolean>;
}

const ENV_REF = /\{\{env:([A-Z][A-Z0-9_]*)\}\}/g;

export class TestDataService {
    protected readonly logger = logger.child({ service: 'TestDataService' });
    readonly dataFile: string;
    readonly localFile: string;
    readonly platform: string;
    readonly testEnv: string;
    readonly environment: NodeJS.ProcessEnv;
    protected merged: MergedData | undefined;
    /** Keys the local file overrode (no values). */
    localOverrides: string[] = [];

    constructor(options: TestDataOptions = {}) {
        this.dataFile = options.dataFile ?? path.join(FRAMEWORK_ROOT, 'src', 'data', 'test-data.json');
        this.localFile = options.localFile ?? path.join(path.dirname(this.dataFile), 'test-data.local.json');
        this.platform = (options.platform ?? process.env.PLATFORM ?? 'android').toLowerCase();
        this.testEnv = (options.testEnv ?? process.env.TEST_ENV ?? 'qa').toLowerCase();
        this.environment = options.environment ?? process.env;
    }

    /** Reads and validates a JSON file; errors name the file and field path, never the value. */
    protected readJson(file: string, local: boolean): unknown {
        this.logger.debug(`Reading ${path.basename(file)}`);
        try {
            let parsed: unknown;
            try {
                parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch (error) {
                throw new Error(
                    `${path.basename(file)} is not valid JSON (${error instanceof SyntaxError ? 'syntax error' : 'unreadable'})`,
                    { cause: undefined },
                );
            }
            const result = (local ? LocalTestDataSchema : TestDataSchema).safeParse(parsed);
            if (!result.success) {
                const fields = result.error.issues.map((i) => `${i.path.join('.') || '<root>'} (${i.code})`).join(', ');
                throw new Error(`${path.basename(file)} does not match the test-data schema: ${fields}`);
            }
            this.logger.debug(`${path.basename(file)} is valid`);
            return result.data;
        } catch (error) {
            this.logger.error(`Failed to read test data: ${describeError(error)}`);
            throw error;
        }
    }

    /** Applies one override section field by field. */
    protected apply(target: MergedData, section: OverrideSection | undefined, source: string, local: boolean): void {
        this.logger.debug(`Applying ${source}`);
        try {
            if (!section) return;
            for (const [key, user] of Object.entries(section.users ?? {})) {
                const existing = target.users[key] ?? {};
                for (const [field, value] of Object.entries(user)) {
                    if (value === undefined) continue;
                    (existing as Record<string, unknown>)[field] = value;
                    if (local) {
                        registerSensitive(String(value));
                        this.localOverrides.push(`users.${key}.${field}`);
                    }
                }
                target.users[key] = existing;
            }
            for (const [key, value] of Object.entries(section.messages ?? {})) {
                target.messages[key] = value;
                if (local) {
                    registerSensitive(value);
                    this.localOverrides.push(`messages.${key}`);
                }
            }
            for (const [key, value] of Object.entries(section.values ?? {})) {
                target.values[key] = value;
                if (local) {
                    registerSensitive(String(value));
                    this.localOverrides.push(`values.${key}`);
                }
            }
            this.logger.debug(`${source} applied`);
        } catch (error) {
            this.logger.error(`Failed to apply ${source}: ${describeError(error)}`);
            throw error;
        }
    }

    /** Loads, validates and merges the data once. */
    load(): MergedData {
        this.logger.info(`Loading test data for ${this.platform} / ${this.testEnv}`);
        try {
            if (this.merged) return this.merged;
            const shared = this.readJson(this.dataFile, false) as TestData;
            const merged: MergedData = { users: {}, messages: {}, values: {} };
            this.apply(merged, shared.common, 'shared common', false);
            this.apply(
                merged,
                (shared.overrides as Record<string, OverrideSection>)[this.platform],
                `shared overrides.${this.platform}`,
                false,
            );
            this.apply(merged, shared.environments[this.testEnv], `shared environments.${this.testEnv}`, false);
            this.localOverrides = [];
            if (fs.existsSync(this.localFile)) {
                const local = this.readJson(this.localFile, true) as {
                    common?: OverrideSection;
                    overrides?: Record<string, OverrideSection | undefined>;
                    environments?: Record<string, OverrideSection>;
                };
                this.apply(merged, local.common, 'local common', true);
                this.apply(merged, local.overrides?.[this.platform], `local overrides.${this.platform}`, true);
                this.apply(merged, local.environments?.[this.testEnv], `local environments.${this.testEnv}`, true);
                this.logger.info(
                    `Local test data overrode ${this.localOverrides.length} field(s): ${this.localOverrides.join(', ') || 'none'}`,
                );
            } else {
                this.logger.info('No test-data.local.json: using the shared test data unchanged');
            }
            this.merged = merged;
            return merged;
        } catch (error) {
            this.logger.error(`Failed to load test data: ${describeError(error)}`);
            throw error;
        }
    }

    /** Resolves {{env:NAME}} references from the environment; a missing variable is an error naming it. */
    resolveRefs(text: string): string {
        this.logger.debug('Resolving environment references');
        try {
            const out = text.replace(ENV_REF, (_m, name: string) => {
                const value = this.environment[name];
                if (value === undefined || value === '')
                    throw new Error(`Environment variable ${name} is not set (referenced by the test data)`);
                registerSensitive(value);
                return value;
            });
            return out;
        } catch (error) {
            this.logger.error(`Failed to resolve references: ${describeError(error)}`);
            throw error;
        }
    }

    /** A user by key; the password is read from the variable named by passwordEnv. */
    user(key: string): ResolvedUser {
        this.logger.info(`Reading test user "${key}"`);
        try {
            const user = this.load().users[key];
            if (!user || !user.username) throw new Error(`Test user "${key}" is not defined in the test data`);
            let password: string | undefined;
            if (user.passwordEnv) {
                password = this.environment[user.passwordEnv];
                if (password === undefined || password === '')
                    throw new Error(`Environment variable ${user.passwordEnv} (password of test user "${key}") is not set`);
                registerSensitive(password);
            }
            const resolved: ResolvedUser = { key, username: this.resolveRefs(user.username), password, description: user.description };
            this.logger.info(`Test user "${key}" resolved`);
            return resolved;
        } catch (error) {
            this.logger.error(`Failed to read test user "${key}": ${describeError(error)}`);
            throw error;
        }
    }

    /** An expected message by key. */
    message(key: string): string {
        this.logger.info(`Reading message "${key}"`);
        try {
            const value = this.load().messages[key];
            if (value === undefined) throw new Error(`Message "${key}" is not defined in the test data`);
            return this.resolveRefs(value);
        } catch (error) {
            this.logger.error(`Failed to read message "${key}": ${describeError(error)}`);
            throw error;
        }
    }

    /** A value by key. */
    value(key: string): string {
        this.logger.info(`Reading value "${key}"`);
        try {
            const value = this.load().values[key];
            if (value === undefined) throw new Error(`Value "${key}" is not defined in the test data`);
            return this.resolveRefs(String(value));
        } catch (error) {
            this.logger.error(`Failed to read value "${key}": ${describeError(error)}`);
            throw error;
        }
    }

    /** True when the merged data defines the value (no throw). */
    hasValue(key: string): boolean {
        this.logger.debug(`Checking whether value "${key}" exists`);
        try {
            return this.load().values[key] !== undefined;
        } catch (error) {
            this.logger.error(`Failed to check value "${key}": ${describeError(error)}`);
            throw error;
        }
    }
}

export const testDataService = new TestDataService();
