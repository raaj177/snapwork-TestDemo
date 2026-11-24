// Session helpers: context switching for web views and a readable session summary.
import { logger, describeError } from '../utils/Logger';

export class SessionService {
    protected readonly logger = logger.child({ service: 'SessionService' });

    /** Switches to the first WEBVIEW context (hybrid screens). */
    async switchToWebView(): Promise<void> {
        this.logger.info('Switching to the web view context');
        try {
            const contexts = (await driver.getContexts()) as unknown[];
            const names = contexts.map((c) => (typeof c === 'string' ? c : String((c as { id?: string }).id ?? '')));
            const web = names.find((c) => c.startsWith('WEBVIEW'));
            if (!web) throw new Error(`No WEBVIEW context available (contexts: ${names.join(', ')})`);
            await driver.switchContext(web);
            this.logger.info(`Switched to ${web}`);
        } catch (error) {
            this.logger.error(`Failed to switch to the web view: ${describeError(error)}`);
            throw error;
        }
    }

    /** Switches back to the native context. */
    async switchToNative(): Promise<void> {
        this.logger.info('Switching to the native context');
        try {
            await driver.switchContext('NATIVE_APP');
            this.logger.info('Switched to NATIVE_APP');
        } catch (error) {
            this.logger.error(`Failed to switch to the native context: ${describeError(error)}`);
            throw error;
        }
    }
}

export const sessionService = new SessionService();
