import { sharedConfig } from './wdio.shared.conf';
import { iosCapabilities } from './devices/ios.devices';

export const config: WebdriverIO.Config = {
    ...sharedConfig,
    capabilities: [iosCapabilities()],
};
