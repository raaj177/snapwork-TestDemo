export const PLATFORMS = { android: 'android', ios: 'ios' } as const;
export type PlatformName = (typeof PLATFORMS)[keyof typeof PLATFORMS];
export const AUTOMATION_NAMES = { android: 'UiAutomator2', ios: 'XCUITest' } as const;
