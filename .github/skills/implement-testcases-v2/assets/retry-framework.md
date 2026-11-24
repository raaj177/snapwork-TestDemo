# Retry Framework Reference

Reference implementation of the two retry levels required by `../references/typescript-wdio-standards.md` ("Freezes and hangs", "Retries"), for the TypeScript/WebdriverIO/Mocha framework that `automation-setup` creates. It is a reference, not a drop-in file: adapt import paths, the exported names of `env`, the logger, `testCaseIdOf`, `ResultWriter` and `AllureEvidence`, and the existing hook bodies to the project, then run `npm run typecheck` and `npm run lint`. Add it once per automation project when it is missing. Never copy it into story specs.

Contents:

1. `RetryUtils.ts` - `isServerHang`, `retryOnHang`, the failure reason
2. App service - launch steps with the step-level retry
3. Shared wdio config - test-level retry, no retry for Blocked, `[TEST START]`/`[TEST RETRY]`/`[TEST END]`, attempt history
4. Config keys
5. Usage in a story spec

## 1. src/utils/RetryUtils.ts

```ts
import { describeError, logger } from './Logger';

const log = logger.child({ module: 'RetryUtils' });

/** Messages that show the UiAutomator2 server froze or died; the run script uses the same markers. */
export const HANG_MARKERS = [
    'Could not proxy command',
    'instrumentation process is not running',
    'Appium session creation failed',
    'UiAutomator2 Server cannot start',
] as const;

/**
 * True when the error shows the UiAutomator2 server froze or died (the session is unusable
 * afterwards). Walks the cause chain. Used by the step retry, the session probe and afterTest.
 */
export function isServerHang(error: unknown): boolean {
    log.debug('Checking whether the error is a UiAutomator2 server freeze');
    try {
        let current: unknown = error;
        for (let depth = 0; current && depth < 10; depth++) {
            const message = current instanceof Error ? current.message : String(current);
            if (HANG_MARKERS.some((marker) => message.includes(marker))) {
                log.debug('Server freeze detected');
                return true;
            }
            current = (current as { cause?: unknown }).cause;
        }
        log.debug('Not a server freeze');
        return false;
    } catch (checkError) {
        log.error(`Server freeze check failed: ${describeError(checkError)}`);
        throw checkError;
    }
}

/**
 * Runs a set-up step and, only when the UiAutomator2 server froze, reloads the dead session
 * and redoes the step. Assertion failures and ordinary errors fail at once.
 */
export async function retryOnHang<T>(attempts: number, step: () => Promise<T>): Promise<T> {
    log.info(`Running the step (up to ${attempts} attempts on a server freeze)`);
    for (let attempt = 1; ; attempt++) {
        try {
            const result = await step();
            log.info(`Step finished on attempt ${attempt}/${attempts}`);
            return result;
        } catch (error) {
            if (!isServerHang(error) || attempt >= attempts) {
                log.error(`Step failed on attempt ${attempt}/${attempts}: ${describeError(error)}`);
                throw error;
            }
            log.warn(`UiAutomator2 server froze (attempt ${attempt}/${attempts}); restarting the session.`);
            await browser.reloadSession();
        }
    }
}

/**
 * One-line reason of a failed attempt, at most 160 characters. Never contains a HANG_MARKERS
 * text, or a later real Fail would be written as Skip by the run script.
 */
export function describeFailure(error: unknown): string {
    log.debug('Building the failure reason');
    try {
        if (!error) {
            return 'failed';
        }
        if (isServerHang(error)) {
            return 'UiAutomator2 server froze';
        }
        const name = error instanceof Error ? error.name : 'Error';
        let message = (error instanceof Error ? error.message : String(error)).trim().split('\n')[0];
        if (message.length > 160) {
            message = `${message.slice(0, 157)}...`;
        }
        const reason = message ? `${name}: ${message}` : name;
        log.debug(`Failure reason: ${reason}`);
        return reason;
    } catch (buildError) {
        log.error(`Building the failure reason failed: ${describeError(buildError)}`);
        throw buildError;
    }
}
```

## 2. src/services/app.service.ts

`APP_START_SETTLE` is about 5 s (in `src/constants/timeouts.ts`); `env.APP_PACKAGE` is the app ID from `config/env.ts`. The settle pause is the only fixed pause allowed: it avoids a freeze during the Flutter cold start and is never used as synchronization.

```ts
import { env } from '../../config/env';
import { APP_START_SETTLE } from '../constants/timeouts';
import { describeError, logger } from '../utils/Logger';
import { retryOnHang } from '../utils/RetryUtils';

const log = logger.child({ module: 'app.service' });

type ScreenCheck = () => Promise<void>;
const noCheck: ScreenCheck = async () => {};

/**
 * Fresh launch followed by the first screen check, retried together as one step: a freeze in
 * either part restarts the session and redoes the launch (up to STEP_MAX_ATTEMPTS).
 */
export async function freshLaunch(firstScreenCheck: ScreenCheck = noCheck): Promise<void> {
    log.info('Fresh launch of the app (data cleared) started');
    try {
        await retryOnHang(env.STEP_MAX_ATTEMPTS, async () => {
            const appId = env.APP_PACKAGE;
            await driver.execute('mobile: terminateApp', { appId });
            await driver.execute('mobile: clearApp', { appId });
            await driver.execute('mobile: activateApp', { appId });
            await browser.pause(APP_START_SETTLE);
            await firstScreenCheck();
        });
        log.info('Fresh launch finished; first screen verified');
    } catch (error) {
        log.error(`Fresh launch failed: ${describeError(error)}`);
        throw error;
    }
}

/** Close, relaunch and the first screen check, retried together as one step on a freeze. */
export async function closeAndRelaunch(firstScreenCheck: ScreenCheck = noCheck): Promise<void> {
    log.info('Close and relaunch of the app started');
    try {
        await retryOnHang(env.STEP_MAX_ATTEMPTS, async () => {
            const appId = env.APP_PACKAGE;
            await driver.execute('mobile: terminateApp', { appId });
            await browser.pause(1_000);
            await driver.execute('mobile: activateApp', { appId });
            await browser.pause(APP_START_SETTLE);
            await firstScreenCheck();
        });
        log.info('Relaunch finished; first screen verified');
    } catch (error) {
        log.error(`Close and relaunch failed: ${describeError(error)}`);
        throw error;
    }
}
```

## 3. config/wdio.shared.conf.ts

Merge into the existing `mochaOpts`, `beforeTest` and `afterTest`; keep what they already do (Allure testcase label, `ResultWriter`, `AllureEvidence`). WebdriverIO runs `beforeTest`/`afterTest` once per attempt and passes `retries: { attempts, limit }` (retries used so far, retries allowed). `context` is the Mocha context the test ran with; `context.retries(0)` stops Mocha from rerunning a Blocked test. Check that it behaves so on the project's WebdriverIO version; if it does not, a Blocked test is rerun but still ends Blocked.

```ts
import { BlockedError } from '../src/reporting/BlockedError';
import { testCaseIdOf } from '../src/reporting/testCase';
import { describeError, logger } from '../src/utils/Logger';
import { describeFailure, isServerHang } from '../src/utils/RetryUtils';

const log = logger.child({ module: 'wdio.shared.conf' });

/** Reasons of the failed attempts of the test that is running, oldest first. */
const failedAttempts = new Map<string, string[]>();

function isBlocked(error: unknown): boolean {
    log.debug('Checking whether the test was Blocked');
    const blocked = error instanceof BlockedError || (error as Error | undefined)?.name === 'BlockedError';
    log.debug(`Blocked: ${blocked}`);
    return blocked;
}

/**
 * Appends the attempt history when the result needed more than one attempt. Appended, never
 * prepended: the test's own remark comes first.
 */
function withAttempts(remark: string, earlier: string[], attempt: number, max: number): string {
    log.debug(`Adding the attempt history (attempt ${attempt} of ${max})`);
    try {
        if (attempt <= 1 || earlier.length === 0) {
            return remark;
        }
        const list = earlier.slice(0, attempt - 1).map((reason, i) => `${i + 1}) ${reason}`).join('; ');
        const note = `Attempt ${attempt} of ${max}. Earlier attempts failed: ${list}.`;
        log.debug('Attempt history added');
        return remark.trim() ? `${remark} ${note}` : note;
    } catch (error) {
        log.error(`Adding the attempt history failed: ${describeError(error)}`);
        throw error;
    }
}

export const config = {
    // ...
    connectionRetryCount: 1, // session creation is retried once
    mochaOpts: {
        ui: 'bdd',
        timeout: env.MOCHA_TIMEOUT,
        retries: env.TEST_RETRIES, // default 2: a failed or frozen test runs up to 3 attempts
    },

    beforeTest(test) {
        const id = testCaseIdOf(test.title) ?? test.title;
        console.log(`[TEST START] ${id} | ${test.title.slice(id.length + 1).trim()}`);
    },

    async afterTest(test, context, { error, passed, retries }) {
        const id = testCaseIdOf(test.title) ?? test.title;
        const title = test.title.slice(id.length + 1).trim();
        const blocked = isBlocked(error);
        if (blocked) {
            (context as { retries?: (n: number) => void }).retries?.(0); // a Blocked test is never rerun
        }
        const attempt = retries.attempts + 1;
        const max = retries.limit + 1;
        const willRetry = !passed && !blocked && retries.attempts < retries.limit;
        const earlier = failedAttempts.get(test.fullTitle) ?? [];
        try {
            if (!passed && isServerHang(error)) {
                await browser.reloadSession(); // dead session: no screenshot, no page source
            } else if (!passed) {
                // Existing evidence call; a discarded attempt's files are named RETRY_attempt<n>_<id>.
                await AllureEvidence.capture(willRetry ? `RETRY_attempt${attempt}_${id}` : id, error);
            }
            // Existing ResultWriter call: one row per finished attempt, the last one wins.
            // Pass its remark through withAttempts so the final row carries the attempt history.
            //   remark = withAttempts(remark, earlier, attempt, max)
            if (willRetry) {
                failedAttempts.set(test.fullTitle, [...earlier, describeFailure(error)]);
            } else {
                failedAttempts.delete(test.fullTitle);
            }
        } finally {
            if (willRetry) {
                // Not a [TEST END]: the run script counts those as finished rows.
                const reason = describeFailure(error);
                console.log(`[TEST RETRY] ${id} | ${title} | attempt ${attempt}/${max} failed (${reason}); rerunning from the start`);
            } else {
                const status = passed ? 'PASS' : blocked ? 'BLOCKED' : 'FAIL';
                console.log(`[TEST END] ${id} | ${title} | ${status}`);
            }
        }
    },
};
```

`AllureEvidence.capture(...)` stands for the project's existing evidence helper. On a freeze it must not be called: page source and screenshot would each wait out another timeout.

## 4. Config keys

`config/env.ts` (zod schema, validated with the other numeric keys; keep the project's names when it already has them):

```ts
    /** Mocha retries per test: a failed or frozen test is rerun from the start. 2 = 3 attempts. */
    TEST_RETRIES: z.coerce.number().int().min(0).default(2),
    /** Attempts for a launch step (app start + first screen check) when the UiAutomator2 server freezes. */
    STEP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(2),
```

`.env.example`:

```dotenv
# Retries. TEST_RETRIES: reruns of a test that fails or freezes (rerun from the start; 2 = 3 attempts).
# STEP_MAX_ATTEMPTS: tries of the app launch + first screen check when the UiAutomator2 server freezes.
TEST_RETRIES=2
STEP_MAX_ATTEMPTS=2
```

## 5. Usage in a story spec

The first screen check goes inside the launch step, so a freeze on that first lookup restarts the launch:

```ts
const log = logger.child({ module: 'US001.onboarding' }); // helper functions in a spec log too

async function launchToOnboarding(): Promise<void> {
    log.info('Launching the app to the onboarding screen');
    try {
        await freshLaunch(async () =>
            expectTrue(await onboardingPage.isShown(SCREEN_WAIT),
                "The onboarding screen with 'Open an account' and 'Login' was not displayed on the first launch."));
        log.info('Onboarding screen shown');
    } catch (error) {
        log.error(`Launch to onboarding failed: ${describeError(error)}`);
        throw error;
    }
}

// Relaunch with the screen that must appear checked inside the step:
await closeAndRelaunch(async () =>
    expectTrue(await loginPage.isShown(BACKEND_WAIT),
        'The login screen was not displayed directly on relaunch.'));
```

Story specs need nothing else: the test retry applies to every `it()` through `mochaOpts.retries`.
