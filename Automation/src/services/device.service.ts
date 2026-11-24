// Device facts for logs and run records (the serial/UDID is only ever logged masked).
import { logger, describeError } from '../utils/Logger';
import { maskValue } from '../utils/Redactor';
import type { DeviceInfo } from '../types/device.types';

export class DeviceService {
    protected readonly logger = logger.child({ service: 'DeviceService' });

    /** Reads model, OS version and UDID from the session capabilities. */
    info(): DeviceInfo {
        this.logger.info('Reading device information');
        try {
            const caps = driver.capabilities as Record<string, unknown>;
            const info: DeviceInfo = {
                platform: driver.isIOS ? 'ios' : 'android',
                model: String(
                    caps['appium:deviceModel'] ?? caps['deviceModel'] ?? caps['appium:deviceName'] ?? caps['deviceName'] ?? 'unknown',
                ),
                osVersion: String(caps['appium:platformVersion'] ?? caps['platformVersion'] ?? 'unknown'),
                udid: String(caps['appium:udid'] ?? caps['udid'] ?? ''),
            };
            this.logger.info(`Device: ${info.model} / ${info.platform} ${info.osVersion} (${maskValue(info.udid)})`);
            return info;
        } catch (error) {
            this.logger.error(`Failed to read device information: ${describeError(error)}`);
            throw error;
        }
    }
}

export const deviceService = new DeviceService();
