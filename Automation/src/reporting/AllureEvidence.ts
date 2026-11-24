// Allure evidence: step screenshots, failure screenshot + page source + diagnostics, the per-test Logger attachment.
import fs from 'node:fs';
import path from 'node:path';
import allureReporter from '@wdio/allure-reporter';
import { logger, describeError } from '../utils/Logger';
import { redact } from '../utils/Redactor';
import { testState, nextScreenshotNumber } from '../utils/TestState';
import { safeName } from '../utils/ScreenshotUtils';

const log = logger.child({ module: 'AllureEvidence' });

function timeStamp(): string {
    log.debug('Building a file time stamp');
    try {
        return new Date().toISOString().replace(/[:.]/g, '-');
    } catch (error) {
        log.error(`Failed to build a time stamp: ${describeError(error)}`);
        throw error;
    }
}

export class AllureEvidence {
    /** Resets per-test evidence counters. */
    static startTest(): void {
        log.debug('Starting evidence for a new test');
        try {
            testState().screenshotCount = 0;
            log.debug('Evidence counters reset');
        } catch (error) {
            log.error(`Failed to reset evidence counters: ${describeError(error)}`);
            throw error;
        }
    }

    /** Step screenshot: screenshots/steps/<TestCaseID>/<NN>_<label>_<time>.png, attached as "Screenshot <NN>_<label>". Never fails the test. */
    static async step(label: string): Promise<void> {
        log.info(`Capturing step screenshot "${label}"`);
        try {
            if ((process.env.STEP_SCREENSHOTS ?? 'true').toLowerCase() === 'false') {
                log.info('Step screenshots are turned off (STEP_SCREENSHOTS=false)');
                return;
            }
            const state = testState();
            const nn = String(nextScreenshotNumber()).padStart(2, '0');
            const folder = path.resolve('screenshots', 'steps', safeName(state.testCaseId || state.testName || 'unknown'));
            fs.mkdirSync(folder, { recursive: true });
            const file = path.join(folder, `${nn}_${safeName(label, 40)}_${timeStamp()}.png`);
            const base64 = await browser.takeScreenshot();
            fs.writeFileSync(file, Buffer.from(base64, 'base64'));
            allureReporter.addAttachment(`Screenshot ${nn}_${safeName(label, 40)}`, Buffer.from(base64, 'base64'), 'image/png');
            log.info(`Step screenshot saved: ${file}`);
        } catch (error) {
            log.warn(`Step screenshot "${label}" could not be captured: ${describeError(error)}`);
        }
    }

    /** On failure, skip or block: screenshot, page source and a redacted diagnostic text. Never throws. */
    static async onProblem(testTitle: string, diagnostic: string): Promise<void> {
        log.info(`Attaching problem evidence for "${testTitle}"`);
        try {
            const base = `${safeName(testTitle, 80)}_${timeStamp()}`;
            const folder = path.resolve('screenshots', 'failures');
            fs.mkdirSync(folder, { recursive: true });
            try {
                const base64 = await browser.takeScreenshot();
                fs.writeFileSync(path.join(folder, `${base}.png`), Buffer.from(base64, 'base64'));
                allureReporter.addAttachment('Failure screenshot', Buffer.from(base64, 'base64'), 'image/png');
            } catch (error) {
                log.warn(`Failure screenshot not captured: ${describeError(error)}`);
            }
            try {
                const source = redact(await browser.getPageSource());
                allureReporter.addAttachment('Page source', source, 'text/xml');
            } catch (error) {
                log.warn(`Page source not captured: ${describeError(error)}`);
            }
            allureReporter.addAttachment('Diagnostics', redact(diagnostic), 'text/plain');
            log.info('Problem evidence attached');
        } catch (error) {
            log.warn(`Problem evidence could not be attached: ${describeError(error)}`);
        }
    }

    /** Attaches the per-test log as "Logger". */
    static attachLog(text: string): void {
        log.debug('Attaching the per-test log');
        try {
            allureReporter.addAttachment('Logger', redact(text), 'text/plain');
            log.debug('Per-test log attached');
        } catch (error) {
            log.warn(`Per-test log could not be attached: ${describeError(error)}`);
        }
    }
}
