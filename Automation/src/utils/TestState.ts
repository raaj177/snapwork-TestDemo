// The running test's state lives on globalThis (keyed by Symbol.for), because WebdriverIO loads the config
// and the spec files through separate module loaders: a module-level variable would not be shared.
// Logging-rule exception: the Logger writes into this state, so these helpers do not log.

export interface TestStateData {
    testName: string;
    testCaseId: string;
    logLines: string[];
    screenshotCount: number;
    capturing: boolean;
}

const KEY = Symbol.for('automation.test.state');

/** Returns the shared state object (created on first use). */
export function testState(): TestStateData {
    const holder = globalThis as unknown as Record<symbol, TestStateData | undefined>;
    if (!holder[KEY]) {
        holder[KEY] = { testName: '', testCaseId: '', logLines: [], screenshotCount: 0, capturing: false };
    }
    return holder[KEY] as TestStateData;
}

/** Sets the running test's name and testcase ID and resets its screenshot counter. */
export function setCurrentTest(testName: string, testCaseId: string): void {
    const state = testState();
    state.testName = testName;
    state.testCaseId = testCaseId;
    state.screenshotCount = 0;
}

/** Starts a fresh per-test log buffer. */
export function startTestLog(): void {
    const state = testState();
    state.logLines = [];
    state.capturing = true;
}

/** Appends one already-redacted line to the per-test buffer while a test runs. */
export function appendTestLog(line: string): void {
    const state = testState();
    if (state.capturing) state.logLines.push(line);
}

/** Returns and clears the per-test log buffer. */
export function takeTestLog(): string {
    const state = testState();
    const text = state.logLines.join('\n');
    state.logLines = [];
    state.capturing = false;
    return text;
}

/** Next step-screenshot number of the running test (01, 02 ...). */
export function nextScreenshotNumber(): number {
    const state = testState();
    state.screenshotCount += 1;
    return state.screenshotCount;
}
