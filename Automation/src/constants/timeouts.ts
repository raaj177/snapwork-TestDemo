// Default waits (ms). No fixed sleeps: every wait polls with these bounds.
export const TIMEOUTS = {
    standard: 15000,
    backendResponse: 20000,
    short: 5000,
    pollInterval: 500,
    appLaunch: 30000,
    /** Quick look at the current screen before deciding to relaunch (REUSE_APP_STATE). */
    stateProbe: 3000,
} as const;

/** Page wait budgets (implement-testcases-v2 "Every expected check waits"). */
export const SCREEN_WAIT = TIMEOUTS.standard;
export const STATE_WAIT = TIMEOUTS.standard;
export const BACKEND_WAIT = TIMEOUTS.backendResponse;
/** A slow screen: the in-app browser page took about 10 s to expose its hierarchy during device inspection. */
export const WEB_PAGE_WAIT = 30000;
