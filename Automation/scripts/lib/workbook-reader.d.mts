export interface WorkbookRow {
    sheet: string;
    story: string;
    storyLabel: string;
    row: number;
    id: string;
    title: string;
    candidate: boolean;
    priority: string;
    ios: boolean;
    testData: string | undefined;
    caseType: string;
}
export interface WorkbookSheet {
    name: string;
    story: string;
    storyLabel: string;
    headerRow: number;
    columns: Record<string, number>;
    rows: WorkbookRow[];
}
export interface Workbook {
    file: string;
    sheets: WorkbookSheet[];
}
export declare const TEST_CASE_ID: RegExp;
export declare function norm(value: unknown): string;
export declare function storyOf(sheetName: string): [string, string];
export declare function columnsOf(headerTexts: unknown[]): Record<string, number>;
export declare function readWorkbook(file: string): Promise<Workbook>;
export declare function isActive(row: WorkbookRow): boolean;
export declare function smokeRows(workbook: Workbook, platform?: string): WorkbookRow[];
export declare function regressionRows(workbook: Workbook, stories?: string[], platform?: string): WorkbookRow[];
export declare function duplicateIds(workbook: Workbook): string[];
export declare function workbookNameOf(fileName: string): string;
export declare function workbookFolderOf(fileName: string): string;
