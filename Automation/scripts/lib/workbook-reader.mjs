// The project's ONE workbook reader (smoke:generate/check, npm run smoke/regression, resolveTestValue).
// Same rules as scripts/testrun/common.py: a story sheet is any sheet with a "Test Case ID" header in its first 7 rows;
// the story ID comes from the sheet name (US-002 / US002 / US_002 ...); the testcase title is "Test Description".
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { log } from './log.mjs';

const mlog = log.child('workbook-reader');

/** Collapses whitespace and trims a cell value (rich text, formulas and hyperlinks resolved to text). */
export function norm(value) {
    if (value === null || value === undefined) return '';
    let v = value;
    if (typeof v === 'object') {
        if (Array.isArray(v.richText)) v = v.richText.map((p) => p.text).join('');
        else if ('result' in v) v = v.result ?? '';
        else if ('text' in v) v = v.text;
        else if (v instanceof Date) v = v.toISOString();
    }
    return String(v ?? '')
        .replace(/﻿/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Story ID and label from a sheet name: "US-002 Login" -> ["US002", "US-002"]. */
export function storyOf(sheetName) {
    const m = /^\s*(US)[-_ ]?(\d+)/i.exec(sheetName);
    return m ? [`US${m[2]}`, `US-${m[2]}`] : ['', ''];
}

/** Maps header texts of one row to logical column keys. */
export function columnsOf(headerTexts) {
    const cols = {};
    headerTexts.forEach((raw, index) => {
        const text = norm(raw).toLowerCase();
        if (!text) return;
        const col = index + 1;
        if (text === 'test case id') cols.id = col;
        else if (text === 'test description') cols.title = col;
        else if (text.startsWith('automation candidate')) cols.candidate = col;
        else if (text.startsWith('priority')) cols.priority = col;
        else if (text === 'ios testcase') cols.ios = col;
        else if (text === 'test data') cols.testData = col;
        else if (text === 'test case type') cols.caseType = col;
        else if (text === 'expected result') cols.expected = col;
        else if (text === 'test steps') cols.steps = col;
        else if (text.replace(/[-\s]/g, '') === 'precondition') cols.precondition = col;
    });
    return cols;
}

/** Reads every story sheet of a workbook. Returns { file, sheets: [{ name, story, storyLabel, headerRow, columns, rows }] }. */
export async function readWorkbook(file) {
    mlog.info(`Reading workbook ${path.basename(file)}`);
    try {
        if (!fs.existsSync(file)) throw new Error(`Workbook not found: ${file}`);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(file);
        const sheets = [];
        wb.eachSheet((ws) => {
            for (let r = 1; r <= Math.min(7, ws.rowCount); r += 1) {
                const values = [];
                ws.getRow(r).eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    values[colNumber - 1] = cell.value;
                });
                const columns = columnsOf(values);
                if (!columns.id) continue;
                const [story, storyLabel] = storyOf(ws.name);
                const rows = [];
                for (let rr = r + 1; rr <= ws.rowCount; rr += 1) {
                    const row = ws.getRow(rr);
                    const get = (key) => (columns[key] ? norm(row.getCell(columns[key]).value) : '');
                    const id = get('id');
                    if (!id) continue;
                    rows.push({
                        sheet: ws.name,
                        story,
                        storyLabel,
                        row: rr,
                        id,
                        title: get('title'),
                        candidate: get('candidate').toLowerCase() === 'yes',
                        priority: get('priority').toUpperCase(),
                        ios: get('ios').toLowerCase() === 'yes',
                        testData: columns.testData ? norm(row.getCell(columns.testData).value) : undefined,
                        caseType: get('caseType').toLowerCase().replace(/\s+/g, ''),
                    });
                }
                sheets.push({ name: ws.name, story, storyLabel, headerRow: r, columns, rows });
                break;
            }
        });
        mlog.info(`Workbook read: ${sheets.length} story sheet(s), ${sheets.reduce((n, s) => n + s.rows.length, 0)} row(s)`);
        return { file, sheets };
    } catch (error) {
        mlog.error(`Failed to read workbook ${path.basename(file)}: ${log.describe(error)}`);
        throw error;
    }
}

/** True for an active row (not deleted / invalidated). */
export function isActive(row) {
    return row.caseType !== 'deleted' && row.caseType !== 'invalidated';
}

export const TEST_CASE_ID = /^TC_[A-Za-z0-9_]+$/;

/** Eligible P0 smoke rows (Automation Candidate Yes, P0, active, valid ID; iOS also IOS Testcase Yes). */
export function smokeRows(workbook, platform = 'android') {
    mlog.info(`Selecting P0 smoke rows for ${platform}`);
    try {
        const rows = workbook.sheets
            .flatMap((s) => s.rows)
            .filter((r) => r.candidate && r.priority === 'P0' && isActive(r) && TEST_CASE_ID.test(r.id) && (platform !== 'ios' || r.ios));
        mlog.info(`${rows.length} eligible P0 row(s)`);
        return rows;
    } catch (error) {
        mlog.error(`Failed to select smoke rows: ${log.describe(error)}`);
        throw error;
    }
}

/** Active Automation Candidate rows (regression selection), optionally for some stories. */
export function regressionRows(workbook, stories = [], platform = 'android') {
    mlog.info(`Selecting regression rows${stories.length ? ` for ${stories.join(' ')}` : ''}`);
    try {
        const wanted = new Set(stories.map((s) => s.toUpperCase().replace(/[-_ ]/g, '')));
        const rows = workbook.sheets
            .flatMap((s) => s.rows)
            .filter(
                (r) =>
                    r.candidate &&
                    isActive(r) &&
                    TEST_CASE_ID.test(r.id) &&
                    (platform !== 'ios' || r.ios) &&
                    (wanted.size === 0 || wanted.has(r.story)),
            );
        mlog.info(`${rows.length} regression row(s)`);
        return rows;
    } catch (error) {
        mlog.error(`Failed to select regression rows: ${log.describe(error)}`);
        throw error;
    }
}

/** IDs that appear more than once across the workbook. */
export function duplicateIds(workbook) {
    const seen = new Map();
    for (const r of workbook.sheets.flatMap((s) => s.rows)) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
}

/** WorkbookName for smoke folders: drops .xlsx, a trailing version suffix and a trailing _TestCases. */
export function workbookNameOf(fileName) {
    let name = path.basename(fileName).replace(/\.xlsx$/i, '');
    name = name.replace(/[_\s-]*v\d+(?:[_.]\d+)*$/i, '');
    name = name.replace(/[_\s-]*test[_\s-]?cases$/i, '');
    return name;
}

/** WorkbookFolder for regression specs: the file name without .xlsx, exactly. */
export function workbookFolderOf(fileName) {
    return path.basename(fileName).replace(/\.xlsx$/i, '');
}
