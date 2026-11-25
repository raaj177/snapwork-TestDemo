// Device details and readiness for CI (Jenkins "Device check" stage) and local use: npm run ci:device [-- --launch-app]
// Prints the connected device (model, manufacturer, Android version, SDK, masked serial), screen state and the installed
// app version, and stops with a clear message when the device is not ready. Read-only, except --launch-app, which
// starts the app's launcher activity (never installs, clears, wakes, unlocks or kills anything).
// adb: <ANDROID_HOME>/platform-tools/adb when ANDROID_HOME (or ANDROID_SDK_ROOT) is set, else adb on PATH.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { log } from '../lib/log.mjs';
import { readDotenv, resolveSetting, mask, parseAdbDevices } from '../run/preflight.mjs';

const dlog = log.child('ci-device');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The adb executable to use. */
export function adbPath(env = process.env) {
    dlog.debug('Resolving adb');
    try {
        const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || '';
        if (!sdk) return 'adb';
        const exe = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
        if (!fs.existsSync(exe)) throw new Error(`adb not found at ${exe}: check the ANDROID_HOME parameter`);
        return exe;
    } catch (error) {
        dlog.error(`Failed to resolve adb: ${log.describe(error)}`);
        throw error;
    }
}

/** Runs adb with an argument array (no shell) and returns stdout; throws on a non-zero exit. */
export function adb(exe, args) {
    dlog.debug(`adb ${args[0] === '-s' ? args.slice(2).join(' ') : args.join(' ')}`);
    try {
        const r = spawnSync(exe, args, { encoding: 'utf8', shell: false, timeout: args.includes('install') ? 300000 : 30000 }); // an install can take minutes
        if (r.error) throw r.error;
        if (r.status !== 0) throw new Error(`adb ${args.join(' ')} exited ${r.status}: ${(r.stderr || '').trim()}`);
        return (r.stdout || '').trim();
    } catch (error) {
        dlog.error(`adb call failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Picks the device: DEVICE_UDID when given (must be online), else the only online device. */
export function pickDevice(devices, udid) {
    dlog.info('Choosing the device');
    try {
        const online = devices.filter((d) => d.state === 'device');
        for (const d of devices.filter((x) => x.state !== 'device'))
            console.log(`WARN  device ${mask(d.serial)} is ${d.state} (unauthorized = accept the USB debugging prompt on the phone)`);
        if (udid) {
            const hit = online.find((d) => d.serial === udid);
            if (!hit) throw new Error(`DEVICE_UDID ${mask(udid)} is not connected and online (adb devices)`);
            return hit.serial;
        }
        if (online.length === 0) throw new Error('No online Android device: connect the phone over USB and authorize this computer');
        if (online.length > 1)
            throw new Error(
                `${online.length} devices online (${online.map((d) => mask(d.serial)).join(', ')}): set the DEVICE_UDID parameter to choose one`,
            );
        return online[0].serial;
    } catch (error) {
        dlog.error(`Choosing the device failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Collects the device and app details. */
export function deviceDetails(exe, serial, appPackage) {
    dlog.info('Reading device details');
    try {
        const sh = (...a) => adb(exe, ['-s', serial, 'shell', ...a]);
        const prop = (p) => sh('getprop', p);
        const power = sh('dumpsys', 'power');
        const windows = sh('dumpsys', 'window');
        const details = {
            serial: mask(serial),
            manufacturer: prop('ro.product.manufacturer'),
            model: prop('ro.product.model'),
            android: prop('ro.build.version.release'),
            sdk: prop('ro.build.version.sdk'),
            awake: /mWakefulness=Awake/.test(power),
            locked: /mDreamingLockscreen=true|isStatusBarKeyguard=true|mShowingLockscreen=true|showing=true/.test(windows),
            appPackage,
            appInstalled: false,
            appVersion: '',
        };
        if (appPackage) {
            const pm = sh('pm', 'list', 'packages', appPackage);
            details.appInstalled = pm.split(/\r?\n/).some((l) => l.trim() === `package:${appPackage}`);
            if (details.appInstalled) {
                const pkg = sh('dumpsys', 'package', appPackage);
                const name = /versionName=(\S+)/.exec(pkg)?.[1] ?? '?';
                const code = /versionCode=(\d+)/.exec(pkg)?.[1] ?? '?';
                details.appVersion = `${name} (${code})`;
            }
        }
        return details;
    } catch (error) {
        dlog.error(`Reading device details failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Starts the app's launcher activity and waits until it is in the foreground. */
export function launchApp(exe, serial, appPackage) {
    dlog.info(`Bringing ${appPackage} to the foreground`);
    try {
        adb(exe, ['-s', serial, 'shell', 'monkey', '-p', appPackage, '-c', 'android.intent.category.LAUNCHER', '1']);
        const until = Date.now() + 20000;
        while (Date.now() < until) {
            const top = adb(exe, ['-s', serial, 'shell', 'dumpsys', 'activity', 'activities']);
            if (new RegExp(`(topResumedActivity|mResumedActivity)=.*${appPackage.replace(/\./g, '\\.')}/`).test(top)) {
                dlog.info('App in the foreground');
                return;
            }
            spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)']);
        }
        throw new Error(`${appPackage} did not come to the foreground within 20 s`);
    } catch (error) {
        dlog.error(`Launching the app failed: ${log.describe(error)}`);
        throw error;
    }
}

/** The .apk to install: the file itself, or the only .apk in a folder (Jenkins copies the build job's artifact there). */
export function resolveApk(target) {
    dlog.info(`Resolving the app build in ${target}`);
    try {
        const full = path.resolve(ROOT, target);
        if (!fs.existsSync(full)) throw new Error(`App build not found: ${target}`);
        if (fs.statSync(full).isFile()) return full;
        const apks = fs.readdirSync(full).filter((f) => f.toLowerCase().endsWith('.apk'));
        if (apks.length !== 1)
            throw new Error(`Expected exactly one .apk in ${target}, found ${apks.length}: ${apks.join(', ') || 'none'}`);
        return path.join(full, apks[0]);
    } catch (error) {
        dlog.error(`Resolving the app build failed: ${log.describe(error)}`);
        throw error;
    }
}

/** Installs (or upgrades, keeping the app's data) the build on the device with adb install -r. */
export function installApk(exe, serial, apk) {
    dlog.info(`Installing ${path.basename(apk)} on the device`);
    try {
        console.log(`Installing : ${path.basename(apk)} (adb install -r, app data kept)`);
        const result = adb(exe, ['-s', serial, 'install', '-r', apk]);
        if (!/Success/.test(result)) throw new Error(`adb install did not report Success: ${result.split(/\r?\n/).pop()}`);
        console.log('Installed  : Success');
    } catch (error) {
        dlog.error(`Installing the app build failed: ${log.describe(error)}`);
        throw error;
    }
}

/** CLI entry: prints the details; exit 0 ready, 3 not ready, 2 usage. */
export function main(argv = process.argv.slice(2), env = process.env) {
    dlog.info('Device check started');
    try {
        const installIndex = argv.indexOf('--install');
        const installTarget = installIndex >= 0 ? argv[installIndex + 1] : undefined;
        const unknown = argv.filter((a, i) => a !== '--launch-app' && a !== '--install' && !(installIndex >= 0 && i === installIndex + 1));
        if (unknown.length || (installIndex >= 0 && !installTarget)) {
            console.error(
                `Unknown argument(s): ${unknown.join(' ')}\nUsage: npm run ci:device [-- [--install <apk or folder>] [--launch-app]]`,
            );
            return 2;
        }
        const dotenv = readDotenv(path.join(ROOT, '.env'));
        const appPackage = resolveSetting('APP_PACKAGE', env, dotenv).value;
        const udid = resolveSetting('DEVICE_UDID', env, {}).value; // process/Jenkins value only; a stale .env serial is ignored
        const exe = adbPath(env);
        console.log(`adb        : ${exe === 'adb' ? 'adb on PATH' : exe}`);
        console.log(`adb version: ${adb(exe, ['version']).split(/\r?\n/)[0]}`);
        const devices = parseAdbDevices(adb(exe, ['devices']));
        const serial = pickDevice(devices, udid);
        if (installTarget) installApk(exe, serial, resolveApk(installTarget));
        const d = deviceDetails(exe, serial, appPackage);
        // Saved for the Allure Environment panel (npm run report:ci); the serial stays masked.
        fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
        fs.writeFileSync(path.join(ROOT, 'test-results', 'device.json'), `${JSON.stringify(d, null, 2)}\n`, 'utf8');
        console.log('================ DEVICE ================');
        console.log(`Serial     : ${d.serial}${udid ? ' (DEVICE_UDID)' : ' (only online device)'}`);
        console.log(`Device     : ${d.manufacturer} ${d.model}`);
        console.log(`Android    : ${d.android} (SDK ${d.sdk})`);
        console.log(`Screen     : ${d.awake ? 'awake' : 'ASLEEP'}${d.locked ? ', LOCKED' : ', unlocked'}`);
        console.log(
            `App        : ${appPackage || '(APP_PACKAGE not set)'} ${d.appInstalled ? `installed, version ${d.appVersion}` : 'NOT INSTALLED'}`,
        );
        console.log('========================================');
        const problems = [];
        if (!d.awake) problems.push('the screen is asleep: wake the phone (and set Stay awake while charging in Developer options)');
        if (d.locked) problems.push('the phone is locked: unlock it (use no screen lock on the test phone)');
        if (!appPackage) problems.push('APP_PACKAGE is not set (Jenkins parameter, the .env file credential, or .env)');
        else if (!d.appInstalled) problems.push(`${appPackage} is not installed: install the build on the phone`);
        if (problems.length) {
            for (const p of problems) console.log(`NOT READY: ${p}`);
            return 3;
        }
        if (argv.includes('--launch-app')) {
            launchApp(exe, serial, appPackage);
            console.log(`App started: ${appPackage} is in the foreground`);
        }
        console.log('DEVICE READY');
        dlog.info('Device check finished: ready');
        return 0;
    } catch (error) {
        dlog.error(`Device check failed: ${log.describe(error)}`);
        console.error(`NOT READY: ${log.describe(error)}`);
        return 3;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
