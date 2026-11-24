// Loads .env once (process environment wins over .env). Side-effect module: no methods to log.
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAMEWORK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotenv({ path: path.join(FRAMEWORK_ROOT, '.env'), quiet: true, override: false });
