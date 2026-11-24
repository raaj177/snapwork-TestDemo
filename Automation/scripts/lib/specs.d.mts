export interface SpecTest {
    file: string;
    id: string;
    title: string;
    skipped: boolean;
    /** Where the it() lives: the workbook's smoke folder (P0 only) or its regression folder. Set by implementationsFor. */
    area?: 'smoke' | 'regression';
}
export declare function smokeFolderOf(root: string, workbookFolder: string): string;
export declare const SMOKE_MARKER: string;
export declare function listSpecs(dir: string): string[];
export declare function testsInSpec(file: string): SpecTest[];
export declare function testsInSource(source: string, file: string): SpecTest[];
export declare function implementationsFor(
    root: string,
    workbookFolder: string,
): { scope: string; folderExists: boolean; tests: SpecTest[]; misplaced: SpecTest[] };
export declare function blockedFromHandoff(root: string, story: string): Map<string, string>;
