// Minimal RFC 4180 CSV reader for results files (plain Node).
import fs from 'node:fs';
import { log } from './log.mjs';

const clog = log.child('csv');

/** Parses CSV text into rows of fields. */
export function parseCsv(text) {
    clog.debug('Parsing CSV');
    try {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;
        for (let i = 0; i < text.length; i += 1) {
            const c = text[i];
            if (quoted) {
                if (c === '"' && text[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else if (c === '"') quoted = false;
                else field += c;
            } else if (c === '"') quoted = true;
            else if (c === ',') {
                row.push(field);
                field = '';
            } else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i += 1;
                row.push(field);
                if (row.some((f) => f !== '')) rows.push(row);
                row = [];
                field = '';
            } else field += c;
        }
        if (field !== '' || row.length) {
            row.push(field);
            rows.push(row);
        }
        return rows;
    } catch (error) {
        clog.error(`Failed to parse CSV: ${log.describe(error)}`);
        throw error;
    }
}

/** Reads a results CSV: { latest: {id: status}, attempts: {id: n} } (the last attempt wins). */
export function readResults(file) {
    clog.info(`Reading results ${file}`);
    try {
        if (!fs.existsSync(file)) return { latest: {}, attempts: {} };
        const [header = [], ...rows] = parseCsv(fs.readFileSync(file, 'utf8'));
        const idCol = header.indexOf('Test Case ID');
        const statusCol = header.indexOf('Execution Status');
        const latest = {};
        const attempts = {};
        for (const r of rows) {
            const id = r[idCol];
            if (!id) continue;
            latest[id] = r[statusCol];
            attempts[id] = (attempts[id] ?? 0) + 1;
        }
        return { latest, attempts };
    } catch (error) {
        clog.error(`Failed to read results: ${log.describe(error)}`);
        throw error;
    }
}
