// Finds implemented testcases: it('<ID>: <title>') in regression specs. One implementation = one non-skipped it()
// whose title is exactly "<ID>: <workbook title>". Generated smoke files (marker) are never counted.
import fs from 'node:fs';
import path from 'node:path';
import { log } from './log.mjs';

const slog = log.child('specs');
export const SMOKE_MARKER = '// @generated workbook-smoke story=';
const IT_CALL = /\b(it|xit|it\.skip|it\.only)\s*\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2\s*,\s*(async\s*)?(\(|function)/g;

/**
 * The workbook's smoke folder src/tests/smoke/<WorkbookName>/: the workbook folder without a trailing version suffix
 * and a trailing _TestCases (01_Login_TestCases_v1_1 -> 01_Login). The generated/ manifest folder is never scanned.
 */
export function smokeFolderOf(root, workbookFolder) {
    slog.debug(`Resolving the smoke folder of ${workbookFolder}`);
    try {
        let name = workbookFolder.replace(/[_\s-]*v\d+(?:[_.]\d+)*$/i, '');
        name = name.replace(/[_\s-]*test[_\s-]?cases$/i, '');
        return path.join(root, 'src', 'tests', 'smoke', name);
    } catch (error) {
        slog.error(`Failed to resolve the smoke folder: ${log.describe(error)}`);
        throw error;
    }
}

/** Lists *.test.ts files under a folder (recursive), sorted. */
export function listSpecs(dir) {
    slog.debug(`Listing specs in ${dir}`);
    try {
        if (!fs.existsSync(dir)) return [];
        const out = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) out.push(...listSpecs(full));
            else if (entry.isFile() && entry.name.endsWith('.test.ts')) out.push(full);
        }
        return out.sort();
    } catch (error) {
        slog.error(`Failed to list specs: ${log.describe(error)}`);
        throw error;
    }
}

/** Unescapes a JS string literal body. */
function unescape(text) {
    return text.replace(/\\(['"`\\])/g, '$1');
}

/**
 * Reads the it() titles of one spec: [{ file, id, title, skipped }]. Generated smoke specs (marker) are never counted
 * as implementations: their it() blocks are copies of the regression ones.
 */
export function testsInSpec(file) {
    slog.debug(`Reading it() titles of ${path.basename(file)}`);
    try {
        const source = fs.readFileSync(file, 'utf8');
        if (source.startsWith(SMOKE_MARKER)) return [];
        return testsInSource(source, file);
    } catch (error) {
        slog.error(`Failed to read ${path.basename(file)}: ${log.describe(error)}`);
        throw error;
    }
}

/** Reads the it() titles of spec source text, generated or not (used by smoke:check on the smoke files themselves). */
export function testsInSource(source, file) {
    slog.debug(`Reading it() titles of ${path.basename(file)} source`);
    try {
        const tests = [];
        for (const m of source.matchAll(IT_CALL)) {
            const full = unescape(m[3]);
            const idMatch = /^(TC_[A-Za-z0-9_]+):\s?(.*)$/.exec(full);
            if (!idMatch) continue;
            tests.push({ file, id: idMatch[1], title: idMatch[2].trim(), skipped: m[1] !== 'it' && m[1] !== 'it.only' });
        }
        return tests;
    } catch (error) {
        slog.error(`Failed to read ${path.basename(file)}: ${log.describe(error)}`);
        throw error;
    }
}

/**
 * Implementations for a workbook: searches src/tests/regression/<WorkbookFolder>/ (the whole regression folder only
 * when that folder does not exist). Returns { scope, folderExists, tests, misplaced }.
 */
export function implementationsFor(root, workbookFolder) {
    slog.info(`Finding implementations for ${workbookFolder}`);
    try {
        const regression = path.join(root, 'src', 'tests', 'regression');
        const folder = path.join(regression, workbookFolder);
        const folderExists = fs.existsSync(folder);
        // P0 cases live only in the workbook's smoke folder; every other candidate in its regression folder.
        const smokeFolder = smokeFolderOf(root, workbookFolder);
        const scopeFiles = [...(folderExists ? listSpecs(folder) : listSpecs(regression)), ...listSpecs(smokeFolder)];
        const tests = scopeFiles
            .flatMap(testsInSpec)
            .map((t) => ({ ...t, area: t.file.startsWith(smokeFolder + path.sep) ? 'smoke' : 'regression' }));
        const misplaced = folderExists
            ? listSpecs(regression)
                  .filter((f) => !f.startsWith(folder + path.sep))
                  .flatMap(testsInSpec)
            : [];
        slog.info(`${tests.length} it() with a testcase ID in scope (${folderExists ? 'workbook folder' : 'whole regression folder'})`);
        return { scope: folderExists ? folder : regression, folderExists, tests, misplaced };
    } catch (error) {
        slog.error(`Failed to find implementations: ${log.describe(error)}`);
        throw error;
    }
}

/** Testcase IDs listed as Blocked in automation-handoff/<story>.md, with their reasons. */
export function blockedFromHandoff(root, story) {
    slog.debug(`Reading Blocked rows of the ${story} handoff`);
    try {
        const dir = path.join(root, 'automation-handoff');
        const blocked = new Map();
        if (!fs.existsSync(dir)) return blocked;
        const files = fs
            .readdirSync(dir)
            .filter((f) => f.toUpperCase().replace(/[-_ ]/g, '').startsWith(story.toUpperCase()) && f.endsWith('.md'));
        for (const f of files) {
            for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
                const m = /(TC_[A-Za-z0-9_]+)/.exec(line);
                if (m && /\bBlocked\b/i.test(line)) {
                    const cells = line
                        .split('|')
                        .map((c) => c.trim())
                        .filter(Boolean);
                    const reason = cells.length > 2 ? cells[cells.length - 1] : 'Blocked in handoff';
                    blocked.set(m[1], reason);
                }
            }
        }
        return blocked;
    } catch (error) {
        slog.error(`Failed to read the handoff: ${log.describe(error)}`);
        throw error;
    }
}
