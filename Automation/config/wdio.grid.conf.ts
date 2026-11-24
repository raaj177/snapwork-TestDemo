// Remote Appium / device grid: no local Appium service; APPIUM_HOST and APPIUM_PORT point at the grid.
import { env } from './env';
import { config as androidConfig } from './wdio.android.conf';
import { config as iosConfig } from './wdio.ios.conf';

const base = env.PLATFORM === 'ios' ? iosConfig : androidConfig;

export const config: WebdriverIO.Config = {
    ...base,
    services: [],
    hostname: env.APPIUM_HOST,
    port: env.APPIUM_PORT,
};
