// Re-exports the platform config chosen by PLATFORM (android | ios).
import { env } from './config/env';
import { config as androidConfig } from './config/wdio.android.conf';
import { config as iosConfig } from './config/wdio.ios.conf';

export const config = env.PLATFORM === 'ios' ? iosConfig : androidConfig;
