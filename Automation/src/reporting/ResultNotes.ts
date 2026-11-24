// The successful-result text of the running test. A spec calls recordActualResult(...) after its verify steps;
// afterTest reads it with takeActualResult() and writes it as the Actual Result (the start of the workbook's
// Automation Remark). Kept on globalThis because WebdriverIO loads the config and the specs through separate module
// loaders (same reason as src/utils/TestState.ts).
import { logger, describeError } from '../utils/Logger';
import { redact } from '../utils/Redactor';

const log = logger.child({ module: 'ResultNotes' });
const KEY = Symbol.for('automation.test.actualResult');

type Holder = Record<symbol, string | undefined>;

/** Records what the device showed for the running test (redacted). */
export function recordActualResult(text: string): void {
    log.info('Recording the actual result');
    try {
        (globalThis as unknown as Holder)[KEY] = redact(text);
        log.info('Actual result recorded');
    } catch (error) {
        log.error(`Failed to record the actual result: ${describeError(error)}`);
        throw error;
    }
}

/** Returns and clears the recorded actual result ('' when the test recorded none). */
export function takeActualResult(): string {
    log.debug('Taking the recorded actual result');
    try {
        const holder = globalThis as unknown as Holder;
        const text = holder[KEY] ?? '';
        holder[KEY] = undefined;
        return text;
    } catch (error) {
        log.error(`Failed to take the actual result: ${describeError(error)}`);
        throw error;
    }
}
