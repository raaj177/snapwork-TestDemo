// Local Appium started by @wdio/appium-service (APPIUM_HOST must be local). Platform from PLATFORM.
import { env } from './env';
import { config as androidConfig } from './wdio.android.conf';
import { config as iosConfig } from './wdio.ios.conf';

export const config: WebdriverIO.Config = env.PLATFORM === 'ios' ? iosConfig : androidConfig;
