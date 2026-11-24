// Testcase selection for npm run smoke / regression: ID + exact title within this workbook's regression folder.
import path from 'node:path';
import { log } from '../lib/log.mjs';
import { readWorkbook, smokeRows, regressionRows, workbookFolderOf } from '../lib/workbook-reader.mjs';
import { implementationsFor, blockedFromHandoff } from '../lib/specs.mjs';
import { UsageError } from '../lib/paths.mjs';

const slog = log.child('run-select');

/** Selects the executable cases. Throws UsageError (exit 2) for unknown stories or ambiguous implementations. */
export async function selectCases({ root, workbookFile, type, stories = [], platform = 'android' }) {
    slog.info(`Selecting ${type} cases from ${path.basename(workbookFile)}`);
    try {
        const workbook = await readWorkbook(workbookFile);
        const storiesInWorkbook = [...new Set(workbook.sheets.map((s) => s.story).filter(Boolean))];
        for (const s of stories)
            if (!storiesInWorkbook.includes(s))
                throw new UsageError(
                    `Story ${s} does not exist in ${path.basename(workbookFile)} (stories: ${storiesInWorkbook.join(' ')})`,
                );
        const rows = type === 'smoke' ? smokeRows(workbook, platform) : regressionRows(workbook, stories, platform);
        const folder = workbookFolderOf(workbookFile);
        const impl = implementationsFor(root, folder);
        const blockedByStory = new Map();
        const implemented = [];
        const missing = [];
        const excluded = [];
        for (const row of rows) {
            if (!blockedByStory.has(row.story)) blockedByStory.set(row.story, blockedFromHandoff(root, row.story));
            const blocked = blockedByStory.get(row.story);
            const exact = impl.tests.filter((t) => t.id === row.id && t.title === row.title);
            const active = exact.filter((t) => !t.skipped);
            if (active.length > 1)
                throw new UsageError(
                    `AMBIGUOUS ${row.id}: the same ID and title in ${active.map((t) => path.basename(t.file)).join(', ')}`,
                );
            if (blocked.has(row.id)) {
                missing.push({ id: row.id, reason: `Blocked: ${blocked.get(row.id)}` });
                continue;
            }
            if (active.length === 1) {
                implemented.push({ id: row.id, title: row.title, story: row.story, file: active[0].file });
                continue;
            }
            if (exact.length > 0) {
                excluded.push({ id: row.id, reason: 'it.skip' });
                continue;
            }
            const misplaced = impl.misplaced.find((t) => t.id === row.id && t.title === row.title && !t.skipped);
            if (misplaced) {
                missing.push({
                    id: row.id,
                    reason: `MISPLACED in ${path.relative(root, misplaced.file).replace(/\\/g, '/')} (move it into src/tests/regression/${folder}/)`,
                });
                continue;
            }
            if (impl.tests.some((t) => t.id === row.id)) {
                excluded.push({ id: row.id, reason: 'title-mismatch' });
                continue;
            }
            missing.push({ id: row.id, reason: 'no it()' });
        }
        const selection = {
            workbook: path.basename(workbookFile),
            workbookFolder: folder,
            sheets: workbook.sheets.length,
            storiesInWorkbook,
            type,
            stories,
            candidates: rows.length,
            implemented,
            missing,
            excluded,
            selected: implemented,
            coverageComplete: missing.length === 0 && excluded.length === 0,
        };
        slog.info(`Candidates ${rows.length}, implemented ${implemented.length}, missing ${missing.length}, excluded ${excluded.length}`);
        return selection;
    } catch (error) {
        slog.error(`Selection failed: ${log.describe(error)}`);
        throw error;
    }
}

/** The block printed before anything runs. */
export function formatSelection(sel, runId = '<dry run>') {
    slog.debug('Formatting the selection');
    try {
        const list = (items) => items.map((i) => `${i.id} (${i.reason})`).join(', ');
        return [
            `Workbook   : ${sel.workbook}  (sheets: ${sel.sheets}, stories: ${sel.storiesInWorkbook.join(' ')})`,
            `Type       : ${sel.type}${sel.stories.length ? ` [${sel.stories.join(' ')}]` : ''}`,
            `Candidates : ${sel.candidates}   eligible rows in scope`,
            `Implemented: ${sel.implemented.length}   real it() with exact ID + title`,
            `Missing    : ${sel.missing.length}${sel.missing.length ? `    ${list(sel.missing)}` : ''}`,
            `Excluded   : ${sel.excluded.length}${sel.excluded.length ? `    ${list(sel.excluded)}` : ''}`,
            `Selected   : ${sel.selected.length}   -> run ${runId}`,
            `Coverage   : ${sel.coverageComplete ? 'COMPLETE' : `INCOMPLETE (${sel.missing.length + sel.excluded.length} eligible cases not executable)`}`,
        ].join('\n');
    } catch (error) {
        slog.error(`Failed to format the selection: ${log.describe(error)}`);
        throw error;
    }
}
