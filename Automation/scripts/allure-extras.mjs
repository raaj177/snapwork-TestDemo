// After `allure generate`: adds allure-report/logger/ and allure-report/Screenshots/ (current run only:
// files and log lines not older than the oldest file in allure-results/, minus 2 minutes).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './lib/log.mjs';
import { esc, page, encodeLink, listFiles } from './report/report-lib.mjs';

const xlog = log.child('allure-extras');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Oldest allure-results file time minus 2 minutes (0 when there are no results). */
export function cutoffOf(resultsDir) {
    xlog.debug('Computing the run cutoff');
    try {
        if (!fs.existsSync(resultsDir)) return 0;
        const times = fs.readdirSync(resultsDir).map((f) => fs.statSync(path.join(resultsDir, f)).mtimeMs);
        return times.length ? Math.min(...times) - 120000 : 0;
    } catch (error) {
        xlog.error(`Failed to compute the cutoff: ${log.describe(error)}`);
        throw error;
    }
}

/** Copies log lines with an ISO timestamp not older than the cutoff. */
export function copyLog(src, dest, cutoff) {
    xlog.debug(`Copying ${path.basename(src)}`);
    try {
        if (!fs.existsSync(src)) return false;
        const lines = fs
            .readFileSync(src, 'utf8')
            .split(/\r?\n/)
            .filter((l) => {
                const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/.exec(l);
                return !m || Date.parse(m[1]) >= cutoff;
            });
        fs.writeFileSync(dest, lines.join('\n'), 'utf8');
        return true;
    } catch (error) {
        xlog.error(`Failed to copy ${path.basename(src)}: ${log.describe(error)}`);
        throw error;
    }
}

/** Writes the two extra folders. */
export function main(root = ROOT) {
    xlog.info('Adding logger/ and Screenshots/ to allure-report/');
    try {
        const report = path.join(root, 'allure-report');
        if (!fs.existsSync(report)) {
            console.log('allure-report/ not found: run allure generate first.');
            return 0;
        }
        const cutoff = cutoffOf(path.join(root, process.env.ALLURE_RESULTS_DIR || 'allure-results'));
        const logs = path.join(root, process.env.LOG_DIR || 'logs');
        const loggerDir = path.join(report, 'logger');
        fs.mkdirSync(loggerDir, { recursive: true });
        const copied = [];
        if (copyLog(path.join(logs, 'automation.txt'), path.join(loggerDir, 'automation.log'), cutoff)) copied.push('automation.log');
        for (const name of ['appium.log', 'console.log'])
            if (copyLog(path.join(logs, name), path.join(loggerDir, name), cutoff)) copied.push(name);
        const wdioDir = path.join(logs, 'wdio');
        if (fs.existsSync(wdioDir)) {
            for (const f of fs.readdirSync(wdioDir)) {
                if (fs.statSync(path.join(wdioDir, f)).mtimeMs >= cutoff) {
                    fs.copyFileSync(path.join(wdioDir, f), path.join(loggerDir, f));
                    copied.push(f);
                }
            }
        }
        fs.writeFileSync(
            path.join(loggerDir, 'index.html'),
            page(
                'Logs of this run',
                `<p><a href="../index.html">Back to the Allure report</a></p><ul>${copied.map((f) => `<li><a href="${encodeLink(f)}">${esc(f)}</a></li>`).join('')}</ul>`,
            ),
            'utf8',
        );
        const shots = path.join(root, 'screenshots');
        const shotDir = path.join(report, 'Screenshots');
        fs.mkdirSync(shotDir, { recursive: true });
        const images = listFiles(shots).filter((f) => /\.png$/i.test(f) && fs.statSync(path.join(shots, f)).mtimeMs >= cutoff);
        for (const f of images) {
            fs.mkdirSync(path.dirname(path.join(shotDir, f)), { recursive: true });
            fs.copyFileSync(path.join(shots, f), path.join(shotDir, f));
        }
        const grid = images
            .map(
                (f) =>
                    `<figure style="display:inline-block;width:220px;margin:6px"><a href="${encodeLink(f)}"><img src="${encodeLink(f)}" style="width:100%" alt="${esc(f)}"></a><figcaption>${esc(f)}</figcaption></figure>`,
            )
            .join('');
        fs.writeFileSync(
            path.join(shotDir, 'index.html'),
            page(
                'Screenshots of this run',
                `<p><a href="../index.html">Back to the Allure report</a></p>${grid || '<p>No screenshots in this run.</p>'}`,
            ),
            'utf8',
        );
        console.log(`allure-report/logger: ${copied.length} file(s); allure-report/Screenshots: ${images.length} image(s)`);
        return 0;
    } catch (error) {
        xlog.error(`allure-extras failed: ${log.describe(error)}`);
        return 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
