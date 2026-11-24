import { env } from '../env';
import { logger, describeError } from '../../src/utils/Logger';

const log = logger.child({ module: 'android.devices' });

/** Appium capabilities for Android (UiAutomator2), built from env.ts. App values come from .env (read from the app build). */
export function androidCapabilities(): WebdriverIO.Capabilities {
    log.info('Building Android capabilities');
    try {
        const caps: Record<string, unknown> = {
            platformName: 'Android',
            'appium:automationName': 'UiAutomator2',
            'appium:newCommandTimeout': env.NEW_COMMAND_TIMEOUT,
            'appium:noReset': env.NO_RESET,
            'appium:fullReset': false,
            'appium:systemPort': env.UIAUTOMATOR2_SYSTEM_PORT,
            'appium:autoGrantPermissions': true,
            // Flutter animates constantly: do not wait for idle, give the server time to start, and fail a frozen
            // command after 30 s instead of 240 s (implement-testcases-v2 "Freezes and hangs").
            'appium:settings[waitForIdleTimeout]': 0,
            'appium:uiautomator2ServerLaunchTimeout': 90000,
            'appium:uiautomator2ServerInstallTimeout': 90000,
            'appium:uiautomator2ServerReadTimeout': 30000,
        };
        if (env.DEVICE_UDID) caps['appium:udid'] = env.DEVICE_UDID;
        if (env.DEVICE_NAME) caps['appium:deviceName'] = env.DEVICE_NAME;
        if (env.PLATFORM_VERSION) caps['appium:platformVersion'] = env.PLATFORM_VERSION;
        if (env.APP_PATH) caps['appium:app'] = env.APP_PATH;
        if (env.APP_PACKAGE) caps['appium:appPackage'] = env.APP_PACKAGE;
        if (env.APP_ACTIVITY) caps['appium:appActivity'] = env.APP_ACTIVITY;
        log.info(`Android capabilities built (package set: ${Boolean(env.APP_PACKAGE)}, udid set: ${Boolean(env.DEVICE_UDID)})`);
        return caps as WebdriverIO.Capabilities;
    } catch (error) {
        log.error(`Failed to build Android capabilities: ${describeError(error)}`);
        throw error;
    }
}
