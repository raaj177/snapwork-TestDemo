// Run lock test-results/runs/.lock: created exclusively; never deleted on its own when held or stale, never kills.
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../lib/log.mjs';

const llog = log.child('run-lock');

export class LockError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LockError';
    }
}

/** True when a process with this pid exists. */
export function pidRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM';
    }
}

/** Acquires the lock or throws LockError (exit 7). */
export function acquireLock(runsDir, info, isRunning = pidRunning) {
    llog.info('Acquiring the run lock');
    try {
        fs.mkdirSync(runsDir, { recursive: true });
        const file = path.join(runsDir, '.lock');
        try {
            const fd = fs.openSync(file, 'wx');
            fs.writeSync(fd, JSON.stringify({ pid: process.pid, ...info, startedAt: new Date().toISOString() }));
            fs.closeSync(fd);
            return file;
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            let held = {};
            try {
                held = JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch {
                held = {};
            }
            if (held.pid && isRunning(held.pid)) throw new LockError(`another run is in progress: ${held.runId ?? '?'}`);
            throw new LockError(
                `stale lock from ${held.runId ?? '?'} (${held.startedAt ?? '?'}): confirm no run is active, delete test-results/runs/.lock, run again`,
            );
        }
    } catch (error) {
        llog.error(`Lock not acquired: ${log.describe(error)}`);
        throw error;
    }
}

/** Releases a lock this process created. */
export function releaseLock(file) {
    llog.info('Releasing the run lock');
    try {
        if (file && fs.existsSync(file)) fs.unlinkSync(file);
    } catch (error) {
        llog.error(`Failed to release the lock: ${log.describe(error)}`);
        throw error;
    }
}
