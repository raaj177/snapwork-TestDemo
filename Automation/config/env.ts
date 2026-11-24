// The one configuration layer: process environment (CI/CLI) -> .env (local) -> safe defaults, validated with zod.
import { FRAMEWORK_ROOT } from './load-dotenv';
import { z } from 'zod';
import { logger, describeError } from '../src/utils/Logger';

const log = logger.child({ module: 'env' });

const bool = (def: boolean) =>
    z
        .string()
        .optional()
        .transform((v) => (v === undefined || v.trim() === '' ? def : ['1', 'true', 'yes'].includes(v.trim().toLowerCase())));
const int = (def: number) =>
    z
        .string()
        .optional()
        .transform((v) => (v === undefined || v.trim() === '' ? def : Number(v)))
        .pipe(z.number().int().nonnegative());
const str = (def = '') =>
    z
        .string()
        .optional()
        .transform((v) => (v === undefined ? def : v.trim()));

export const EnvSchema = z.object({
    PLATFORM: z.enum(['android', 'ios']).default('android'),
    /** The one environment of this project (config/environments/qa.config.ts). */
    TEST_ENV: z.enum(['qa']).default('qa'),
    APPIUM_HOST: str('127.0.0.1'),
    APPIUM_PORT: int(4723),
    DEVICE_UDID: str(),
    DEVICE_NAME: str(),
    PLATFORM_VERSION: str(),
    APP_PACKAGE: str(),
    APP_ACTIVITY: str(),
    START_ACTIVITY: str(),
    BUNDLE_ID: str(),
    APP_PATH: str(),
    NO_RESET: bool(true),
    NEW_COMMAND_TIMEOUT: int(240),
    UIAUTOMATOR2_SYSTEM_PORT: int(8200),
    WDA_LOCAL_PORT: int(8100),
    MAX_INSTANCES: int(1),
    MOCHA_TIMEOUT: int(300000),
    MOCHA_RETRIES: int(2),
    /** Per-run override of MOCHA_RETRIES set by `.\run -Retries <n>` (empty = use MOCHA_RETRIES). */
    TEST_RETRIES: str(),
    /** Attempts for a launch step (app start + first screen check) when the UiAutomator2 server freezes. */
    STEP_MAX_ATTEMPTS: int(2),
    /**
     * Reuse the screen the previous test left instead of relaunching the app (src/services/start.service.ts):
     * a clean login screen, the returning-user screen or a live Dashboard session. Unknown or dirty state still
     * relaunches. false = relaunch before every test (strict isolation, slower).
     */
    REUSE_APP_STATE: bool(true),
    /** Pause after an app (re)start before the first lookup: Flutter cold-start freeze avoidance, never synchronization. */
    APP_START_SETTLE_MS: int(5000),
    AUTOMATION_RESULTS_FILE: str('test-results/automation-results/automation-results.csv'),
    ALLURE_RESULTS_DIR: str('allure-results'),
    JUNIT_DIR: str('test-results/junit'),
    LOG_DIR: str('logs'),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    WDIO_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'silent']).default('warn'),
    STEP_SCREENSHOTS: bool(true),
    TEST_IDS: str(),
    EXECUTION_TYPE: str(),
    RUN_ID: str(),
    WORKBOOK: str(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Parses and validates the environment; stops with a non-secret message naming each wrong variable. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
    log.debug('Loading configuration');
    try {
        const result = EnvSchema.safeParse(source);
        if (!result.success) {
            const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
            throw new Error(`Invalid configuration (.env / environment): ${problems}`);
        }
        log.debug(`Configuration loaded for platform ${result.data.PLATFORM}, environment ${result.data.TEST_ENV}`);
        return result.data;
    } catch (error) {
        log.error(`Failed to load configuration: ${describeError(error)}`);
        throw error;
    }
}

export const env = loadEnv();
export { FRAMEWORK_ROOT };
