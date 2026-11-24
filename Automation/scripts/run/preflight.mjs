// Android preflight for npm run smoke / regression (workbook-commands.md section 3). Read-only: never installs,
// wakes, unlocks, clears or kills anything. adb is injected so the device-free tests can use a fake runner.
import fs from 'node:fs';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { log } from '../lib/log.mjs';

const plog = log.child('preflight');

export class PreflightError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PreflightError';
    }
}

/** Masks a serial/UDID. */
export function mask(value) {
    const v = String(value ?? '');
    return v.length <= 4 ? '****' : `${'*'.repeat(Math.min(v.length - 4, 8))}${v.slice(-4)}`;
}

/** Reads KEY=VALUE pairs of a .env file (no expansion). */
export function readDotenv(file) {
    plog.debug('Reading .env');
    try {
        const out = {};
        if (!fs.existsSync(file)) return out;
        for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
            const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
            if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
        return out;
    } catch (error) {
        plog.error(`Failed to read .env: ${log.describe(error)}`);
        throw error;
    }
}

/** Resolves a value: process env > .env > default, with its source. */
export function resolveSetting(name, processEnv, dotenv, def = '') {
    if (processEnv[name] !== undefined && processEnv[name] !== '') return { value: processEnv[name], source: 'process env' };
    if (dotenv[name] !== undefined && dotenv[name] !== '') return { value: dotenv[name], source: '.env' };
    return { value: def, source: 'default' };
}

/** Parses `adb devices` output. */
export function parseAdbDevices(output) {
    plog.debug('Parsing adb devices');
    try {
        return String(output)
            .split(/\r?\n/)
            .slice(1)
            .map((l) => l.trim().split(/\s+/))
            .filter((p) => p.length >= 2 && p[0])
            .map(([serial, state]) => ({ serial, state }));
    } catch (error) {
        plog.error(`Failed to parse adb devices: ${log.describe(error)}`);
        throw error;
    }
}

/** Chooses the device (process DEVICE_UDID honoured; else the only online device, even over a stale .env ID). */
export function chooseDevice({ devices, processUdid, envUdid }) {
    plog.info('Choosing the device');
    try {
        const online = devices.filter((d) => d.state === 'device');
        if (processUdid) {
            if (!online.some((d) => d.serial === processUdid))
                throw new PreflightError(`DEVICE_UDID ${mask(processUdid)} (process env) is not online. Check: adb devices`);
            return { udid: processUdid, note: `DEVICE_UDID: process env (${mask(processUdid)})` };
        }
        if (online.length === 0) {
            const bad = devices.map((d) => `${mask(d.serial)} ${d.state}`).join(', ');
            throw new PreflightError(
                devices.length
                    ? `No online device (${bad}). Unlock the device and accept the USB debugging prompt, then run again.`
                    : 'No device connected. Connect a device or start an emulator, then check: adb devices',
            );
        }
        if (online.length > 1) {
            throw new PreflightError(
                `More than one online device (${online.map((d) => mask(d.serial)).join(', ')}). Choose one: $env:DEVICE_UDID="<id>"; npm run ...`,
            );
        }
        const udid = online[0].serial;
        const note =
            envUdid && envUdid !== udid
                ? `.env DEVICE_UDID ${mask(envUdid)} is not connected; using the only online device ${mask(udid)}`
                : `DEVICE_UDID: auto-detected (${mask(udid)})`;
        return { udid, note };
    } catch (error) {
        plog.error(`Device check failed: ${log.describe(error)}`);
        throw error;
    }
}

/** True when something listens on 127.0.0.1:<port>. Never kills a process. */
export function isPortInUse(port, timeoutMs = 800) {
    plog.debug(`Checking port ${port}`);
    return new Promise((resolve) => {
        const socket = net.connect({ host: '127.0.0.1', port });
        const done = (used) => {
            socket.destroy();
            resolve(used);
        };
        socket.setTimeout(timeoutMs, () => done(false));
        socket.once('connect', () => done(true));
        socket.once('error', () => done(false));
    });
}

/** Real adb runner (argument array, no shell). */
export function realAdb(args) {
    const r = spawnSync('adb', args, { encoding: 'utf8', shell: false });
    if (r.error) throw new PreflightError(`adb not available: ${r.error.message}. Set ANDROID_HOME and add platform-tools to PATH.`);
    return r.stdout ?? '';
}

/** Runs every Android check; returns facts for run.json. Throws PreflightError (exit 3) on the first failure. */
export async function androidPreflight({ adb = realAdb, settings, ports }) {
    plog.info('Running the Android preflight');
    try {
        const facts = { lines: [] };
        const devices = parseAdbDevices(adb(['devices']));
        const { udid, note } = chooseDevice({ devices, processUdid: settings.processUdid, envUdid: settings.envUdid });
        facts.udid = udid;
        facts.lines.push(note);
        const sh = (...a) => adb(['-s', udid, 'shell', ...a]);
        facts.model = sh('getprop', 'ro.product.model').trim();
        facts.osVersion = sh('getprop', 'ro.build.version.release').trim();
        facts.sdk = sh('getprop', 'ro.build.version.sdk').trim();
        facts.lines.push(`Device     : ${facts.model} / Android ${facts.osVersion} (SDK ${facts.sdk}) ${mask(udid)}`);
        if (!settings.appPackage)
            throw new PreflightError('APP_PACKAGE is not set (.env). It comes from the app build: aapt dump badging <apk>.');
        if (!/package:/.test(sh('pm', 'path', settings.appPackage)))
            throw new PreflightError(`App ${settings.appPackage} is not installed on the device: install the build yourself.`);
        const dump = sh('dumpsys', 'package', settings.appPackage);
        facts.appVersion = /versionName=(\S+)/.exec(dump)?.[1] ?? 'unknown';
        if (!/mWakefulness=Awake/.test(sh('dumpsys', 'power')))
            throw new PreflightError('The device is asleep: wake and unlock the device.');
        const win = sh('dumpsys', 'window');
        if (/mDreamingLockscreen=true|isKeyguardShowing=true|mShowingLockscreen=true|KeyguardShowing=true/i.test(win))
            throw new PreflightError('The device is locked: wake and unlock the device.');
        const act = sh('dumpsys', 'activity', 'activities');
        const resumed = /(?:mResumedActivity|topResumedActivity|ResumedActivity)[^\n]*\{[^}]*\s(\S+)\/(\S+)/.exec(act);
        if (!resumed || resumed[1] !== settings.appPackage)
            throw new PreflightError('The app is not in the foreground: open the app at its start screen.');
        if (settings.startActivity && !resumed[2].endsWith(settings.startActivity.replace(/^.*\./, '')))
            throw new PreflightError(`The app is not at ${settings.startActivity}: open the app at its start screen.`);
        facts.lines.push(`App        : ${settings.appPackage} ${facts.appVersion} in foreground`);
        for (const port of ports) {
            if (await isPortInUse(port))
                throw new PreflightError(
                    `Port ${port} is in use. Find the owner: netstat -ano | findstr :${port} (Windows) / lsof -i :${port}`,
                );
        }
        facts.lines.push(`Ports free : ${ports.join(', ')}`);
        plog.info('Android preflight passed');
        return facts;
    } catch (error) {
        plog.error(`Preflight failed: ${log.describe(error)}`);
        throw error;
    }
}
