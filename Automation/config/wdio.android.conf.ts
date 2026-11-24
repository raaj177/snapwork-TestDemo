import { sharedConfig } from './wdio.shared.conf';
import { androidCapabilities } from './devices/android.devices';

export const config: WebdriverIO.Config = {
    ...sharedConfig,
    capabilities: [androidCapabilities()],
};
