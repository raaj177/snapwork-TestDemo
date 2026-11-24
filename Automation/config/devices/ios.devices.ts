import { env } from '../env';
import { appBuildPath } from './app-path';
import { logger, describeError } from '../../src/utils/Logger';

const log = logger.child({ module: 'ios.devices' });

/** Appium capabilities for iOS (XCUITest), built from env.ts. BUNDLE_ID comes from .env (read from Info.plist). */
export function iosCapabilities(): WebdriverIO.Capabilities {
    log.info('Building iOS capabilities');
    try {
        const caps: Record<string, unknown> = {
            platformName: 'iOS',
            'appium:automationName': 'XCUITest',
            'appium:newCommandTimeout': env.NEW_COMMAND_TIMEOUT,
            'appium:noReset': env.NO_RESET,
            'appium:fullReset': false,
            'appium:wdaLocalPort': env.WDA_LOCAL_PORT,
        };
        if (env.DEVICE_UDID) caps['appium:udid'] = env.DEVICE_UDID;
        if (env.DEVICE_NAME) caps['appium:deviceName'] = env.DEVICE_NAME;
        if (env.PLATFORM_VERSION) caps['appium:platformVersion'] = env.PLATFORM_VERSION;
        const app = appBuildPath();
        if (app) caps['appium:app'] = app;
        if (env.BUNDLE_ID) caps['appium:bundleId'] = env.BUNDLE_ID;
        log.info(`iOS capabilities built (bundle set: ${Boolean(env.BUNDLE_ID)}, udid set: ${Boolean(env.DEVICE_UDID)})`);
        return caps as WebdriverIO.Capabilities;
    } catch (error) {
        log.error(`Failed to build iOS capabilities: ${describeError(error)}`);
        throw error;
    }
}
