// Small generated workbooks and spec trees for the device-free smoke tests.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

export interface FixtureRow {
    id: string;
    title: string;
    priority?: string;
    candidate?: string;
    caseType?: string;
    ios?: string;
    testData?: string;
}

const HEADERS = [
    'Module',
    'Test Case ID',
    'Test Description',
    'Priority (P0/P1/P2)',
    'Test Data',
    'Automation Candidate (Yes/No)',
    'IOS Testcase',
    'Test Case Type',
];

/** Writes a workbook with one sheet per story (title row, meta row, header row 3, data from row 4). */
export async function writeWorkbook(file: string, sheets: Record<string, FixtureRow[]>): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Dashboard').getCell('A1').value = 'Dashboard';
    for (const [name, rows] of Object.entries(sheets)) {
        const ws = wb.addWorksheet(name);
        ws.getRow(1).values = [`${name} test cases`];
        ws.getRow(2).values = ['meta'];
        ws.getRow(3).values = HEADERS;
        rows.forEach((r, i) => {
            ws.getRow(4 + i).values = [
                'M',
                r.id,
                r.title,
                r.priority ?? 'P0',
                r.testData ?? '',
                r.candidate ?? 'Yes',
                r.ios ?? 'Yes',
                r.caseType ?? 'new',
            ];
        });
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await wb.xlsx.writeFile(file);
}

/** Creates an empty framework-like root with testcase/Testcases. */
export function tempRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-fixture-'));
    fs.mkdirSync(path.join(root, 'testcase', 'Testcases'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'tests', 'regression'), { recursive: true });
    return root;
}

/** Writes a regression spec with the given it() titles. */
export function writeSpec(
    root: string,
    workbookFolder: string,
    fileName: string,
    describe: string,
    its: string[],
    skipped: string[] = [],
): string {
    const file = path.join(root, 'src', 'tests', 'regression', workbookFolder, fileName);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const body = [
        `describe('${describe}', () => {`,
        ...its.map((t) => `    it('${t.replace(/'/g, "\\'")}', async () => {});`),
        ...skipped.map((t) => `    it.skip('${t.replace(/'/g, "\\'")}', async () => {});`),
        '});',
        '',
    ].join('\n');
    fs.writeFileSync(file, body, 'utf8');
    return file;
}
