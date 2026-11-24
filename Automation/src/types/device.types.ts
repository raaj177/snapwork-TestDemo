export interface DeviceInfo {
    readonly platform: 'android' | 'ios';
    readonly model: string;
    readonly osVersion: string;
    /** Always masked when logged or recorded. */
    readonly udid: string;
}
