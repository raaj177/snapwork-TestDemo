// P0 smoke tooling (implement-testcases-v2/references/p0-smoke.md): plan, manifest, check, decide, record.
// P0 cases (Automation Candidate = Yes, Priority = P0) are implemented ONLY in the workbook's smoke folder,
// src/tests/smoke/<WorkbookName>/<StoryId>.test.ts; every other candidate ONLY in src/tests/regression/<WorkbookFolder>/.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { logger, describeError } from '../../src/utils/Logger';
import { readWorkbook, smokeRows, duplicateIds, workbookNameOf, workbookFolderOf, type WorkbookRow } from '../lib/workbook-reader.mjs';
import { implementationsFor, blockedFromHandoff, listSpecs, testsInSource, SMOKE_MARKER } from '../lib/specs.mjs';

const log = logger.child({ module: 'smoke-lib' });

export interface EligibleCase {
    id: string;
    title: string;
    status: 'implemented' | 'missing';
    reason?: string;
}

export interface StoryEntry {
    story: string;
    smokeSpec: string;
    smokeSha256: string;
    eligible: EligibleCase[];
}

export interface Manifest {
    generator: 'smoke:generate';
    workbook: string;
    workbookName: string;
    workbookSha256: string;
    platform: string;
    selection: { automationCandidate: 'Yes'; priority: 'P0'; excludeTypes: string[] };
    stories: StoryEntry[];
    totals: { eligible: number; implemented: number; missing: number };
    coverageComplete: boolean;
}

export interface Plan {
    manifest: Manifest;
    manifestPath: string;
    problems: string[];
    smokeDir: string;
}

/** sha256 of a file. */
export function sha256File(file: string): string {
    log.debug(`Hashing ${path.basename(file)}`);
    try {
        return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    } catch (error) {
        log.error(`Failed to hash ${path.basename(file)}: ${describeError(error)}`);
        throw error;
    }
}

/** Forward-slash path relative to root. */
export function rel(root: string, file: string): string {
    log.debug('Making a path relative');
    try {
        return path.relative(root, file).replace(/\\/g, '/');
    } catch (error) {
        log.error(`Failed to make a path relative: ${describeError(error)}`);
        throw error;
    }
}

/** The smoke spec file of a story: src/tests/smoke/<WorkbookName>/<StoryId>.test.ts. */
export function smokeSpecPathOf(smokeDir: string, story: string): string {
    log.debug(`Resolving the smoke spec of ${story}`);
    try {
        return path.join(smokeDir, `${story}.test.ts`);
    } catch (error) {
        log.error(`Failed to resolve the smoke spec of ${story}: ${describeError(error)}`);
        throw error;
    }
}

/** Builds the manifest and the coverage / placement problems for the workbook. Writes nothing. */
export async function buildPlan(root: string, workbookFile: string, platform = 'android'): Promise<Plan> {
    log.info(`Planning the smoke manifest for ${path.basename(workbookFile)} (${platform})`);
    try {
        const workbook = await readWorkbook(workbookFile);
        const workbookName = workbookNameOf(workbookFile);
        const workbookFolder = workbookFolderOf(workbookFile);
        const eligibleRows = smokeRows(workbook, platform);
        const eligibleIds = new Set(eligibleRows.map((r) => r.id));
        const problems: string[] = [];
        const dupInWorkbook = new Set(duplicateIds(workbook));
        const impl = implementationsFor(root, workbookFolder);
        const smokeDir = path.join(root, 'src', 'tests', 'smoke', workbookName);
        const manifestPath = path.join(root, 'src', 'tests', 'smoke', 'generated', workbookName, 'manifest.json');
        const byStory = new Map<string, WorkbookRow[]>();
        for (const row of eligibleRows) {
            const key = row.story || row.sheet;
            if (!byStory.has(key)) byStory.set(key, []);
            byStory.get(key)?.push(row);
            if (dupInWorkbook.has(row.id)) problems.push(`DUPLICATE ${row.id} appears more than once in the workbook`);
        }
        const stories: StoryEntry[] = [];
        for (const [story, rows] of byStory) {
            const blocked = blockedFromHandoff(root, story);
            const eligible: EligibleCase[] = [];
            const smokeSpec = smokeSpecPathOf(smokeDir, story);
            for (const row of rows) {
                const sameId = impl.tests.filter((t) => t.id === row.id && !t.skipped);
                const exact = sameId.filter((t) => t.title === row.title);
                if (exact.length > 1) problems.push(`DUPLICATE ${row.id} in ${exact.map((t) => path.basename(t.file)).join(', ')}`);
                const inRegression = exact.find((t) => t.area === 'regression');
                if (inRegression) {
                    const reason = `P0 case implemented in ${rel(root, inRegression.file)}: move its it() to ${rel(root, smokeSpec)}`;
                    problems.push(`MISPLACED ${row.id} (${reason})`);
                    eligible.push({ id: row.id, title: row.title, status: 'missing', reason: 'misplaced in regression' });
                    continue;
                }
                const inSmoke = exact.find((t) => t.area === 'smoke');
                if (inSmoke && path.resolve(inSmoke.file) !== path.resolve(smokeSpec)) {
                    problems.push(
                        `MISMATCH ${row.id} is in ${path.basename(inSmoke.file)}, expected ${path.basename(smokeSpec)} (story ${story})`,
                    );
                    eligible.push({ id: row.id, title: row.title, status: 'missing', reason: 'wrong story file' });
                    continue;
                }
                if (inSmoke) {
                    eligible.push({ id: row.id, title: row.title, status: 'implemented' });
                    continue;
                }
                if (sameId.length > 0) {
                    problems.push(`TITLE ${row.id} workbook="${row.title}" test="${sameId[0].title}"`);
                    eligible.push({ id: row.id, title: row.title, status: 'missing', reason: 'title mismatch' });
                    continue;
                }
                const reason = blocked.has(row.id) ? `Blocked: ${blocked.get(row.id)}` : 'no it() found';
                problems.push(`MISSING ${row.id} (${reason})`);
                eligible.push({ id: row.id, title: row.title, status: 'missing', reason });
            }
            const exists = fs.existsSync(smokeSpec);
            stories.push({
                story,
                smokeSpec: exists ? rel(root, smokeSpec) : '',
                smokeSha256: exists ? sha256File(smokeSpec) : '',
                eligible,
            });
        }
        // Only eligible P0 cases belong in the smoke folder.
        for (const t of impl.tests.filter((x) => x.area === 'smoke' && !eligibleIds.has(x.id)))
            problems.push(
                `MISPLACED ${t.id} (not an eligible P0 case of ${path.basename(workbookFile)}: move its it() from ${rel(root, t.file)} to src/tests/regression/${workbookFolder}/)`,
            );
        const implemented = stories.reduce((n, s) => n + s.eligible.filter((e) => e.status === 'implemented').length, 0);
        const total = eligibleRows.length;
        const manifest: Manifest = {
            generator: 'smoke:generate',
            workbook: path.basename(workbookFile),
            workbookName,
            workbookSha256: sha256File(workbookFile),
            platform,
            selection: { automationCandidate: 'Yes', priority: 'P0', excludeTypes: ['deleted', 'invalidated'] },
            stories,
            totals: { eligible: total, implemented, missing: total - implemented },
            coverageComplete: problems.length === 0 && implemented === total,
        };
        log.info(`Plan: ${total} eligible, ${implemented} implemented, ${problems.length} problem(s)`);
        return { manifest, manifestPath, problems, smokeDir };
    } catch (error) {
        log.error(`Failed to plan the smoke manifest: ${describeError(error)}`);
        throw error;
    }
}

/** Serializes the manifest deterministically. */
export function manifestText(manifest: Manifest): string {
    log.debug('Serializing the manifest');
    try {
        return `${JSON.stringify(manifest, null, 2)}\n`;
    } catch (error) {
        log.error(`Failed to serialize the manifest: ${describeError(error)}`);
        throw error;
    }
}

/** Writes the manifest only. Smoke specs are hand-written; a leftover generated (marker) smoke file is an error. */
export function writePlan(plan: Plan): { written: string[]; removed: string[] } {
    log.info(`Writing the smoke manifest for ${plan.manifest.workbookName}`);
    try {
        const leftovers = listSpecs(plan.smokeDir).filter((f) => fs.readFileSync(f, 'utf8').startsWith(SMOKE_MARKER));
        if (leftovers.length)
            throw new Error(
                `Generated smoke file(s) from the old layout: ${leftovers.map((f) => path.basename(f)).join(', ')}. P0 tests are written directly in the smoke file; delete these and move the P0 it() blocks there.`,
            );
        if (fs.existsSync(plan.manifestPath)) {
            const existing = fs.readFileSync(plan.manifestPath, 'utf8');
            if (!existing.includes('"generator": "smoke:generate"'))
                throw new Error(`${plan.manifestPath} was not written by smoke:generate`);
        }
        fs.mkdirSync(path.dirname(plan.manifestPath), { recursive: true });
        fs.writeFileSync(plan.manifestPath, manifestText(plan.manifest), 'utf8');
        log.info('Smoke manifest written');
        return { written: [plan.manifestPath], removed: [] };
    } catch (error) {
        log.error(`Failed to write the smoke manifest: ${describeError(error)}`);
        throw error;
    }
}

/** Read-only coverage check: plan problems, a stale manifest, and smoke files holding another story's cases. */
export function checkPlan(plan: Plan): string[] {
    log.info(`Checking smoke coverage for ${plan.manifest.workbookName}`);
    try {
        const problems = [...plan.problems];
        if (!fs.existsSync(plan.manifestPath)) problems.push('STALE manifest.json (missing: run smoke:generate)');
        else if (fs.readFileSync(plan.manifestPath, 'utf8') !== manifestText(plan.manifest)) problems.push('STALE manifest.json');
        for (const file of listSpecs(plan.smokeDir)) {
            const text = fs.readFileSync(file, 'utf8');
            if (text.startsWith(SMOKE_MARKER)) {
                problems.push(`STALE ${path.basename(file)} (generated file from the old layout: delete it)`);
                continue;
            }
            const story = path.basename(file, '.test.ts');
            for (const t of testsInSource(text, file)) {
                const owner = plan.manifest.stories.find((s) => s.eligible.some((e) => e.id === t.id));
                if (owner && owner.story !== story) problems.push(`MISMATCH ${path.basename(file)} has ${t.id} of story ${owner.story}`);
            }
        }
        log.info(`Coverage check: ${problems.length} problem(s)`);
        return problems;
    } catch (error) {
        log.error(`Failed to check smoke coverage: ${describeError(error)}`);
        throw error;
    }
}

export type Decision = 'ACCEPT' | 'REJECT' | 'INCONCLUSIVE';

/** Build decision (p0-smoke.md section 6). */
export function decide(input: { coverageComplete: boolean; partial: boolean; selectedIds: string[]; results: Record<string, string> }): {
    decision: Decision;
    reason: string;
} {
    log.info('Computing the smoke decision');
    try {
        const noResult = input.selectedIds.filter((id) => !input.results[id]);
        const statuses = input.selectedIds.map((id) => input.results[id]).filter(Boolean);
        let outcome: { decision: Decision; reason: string };
        if (!input.coverageComplete) outcome = { decision: 'INCONCLUSIVE', reason: 'coverage incomplete' };
        else if (input.partial) outcome = { decision: 'INCONCLUSIVE', reason: 'partial run (PARTIAL - INCONCLUSIVE)' };
        else if (noResult.length) outcome = { decision: 'INCONCLUSIVE', reason: `no result for ${noResult.join(', ')}` };
        else if (statuses.includes('Skip'))
            outcome = { decision: 'INCONCLUSIVE', reason: 'a result is Skip (environment / infrastructure)' };
        else if (statuses.includes('Blocked')) outcome = { decision: 'INCONCLUSIVE', reason: 'a result is Blocked' };
        else if (statuses.includes('Fail')) {
            const failed = input.selectedIds.filter((id) => input.results[id] === 'Fail');
            outcome = {
                decision: 'REJECT',
                reason: `${failed.length} P0 test(s) failed (${failed.join(', ')}). Investigate before treating it as a product defect.`,
            };
        } else outcome = { decision: 'ACCEPT', reason: 'complete P0 coverage and every P0 test passed' };
        log.info(`Decision: ${outcome.decision} (${outcome.reason})`);
        return outcome;
    } catch (error) {
        log.error(`Failed to compute the decision: ${describeError(error)}`);
        throw error;
    }
}

/** Minimal RFC 4180 CSV parser. */
export function parseCsv(text: string): string[][] {
    log.debug('Parsing CSV');
    try {
        const rows: string[][] = [];
        let row: string[] = [];
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
        log.error(`Failed to parse CSV: ${describeError(error)}`);
        throw error;
    }
}

/** Latest status per testcase ID from a results CSV (the last attempt wins). */
export function latestResults(csvFile: string): Record<string, string> {
    log.info(`Reading results ${path.basename(csvFile)}`);
    try {
        if (!fs.existsSync(csvFile)) return {};
        const [header, ...rows] = parseCsv(fs.readFileSync(csvFile, 'utf8'));
        const idCol = header.indexOf('Test Case ID');
        const statusCol = header.indexOf('Execution Status');
        const out: Record<string, string> = {};
        for (const r of rows) if (r[idCol]) out[r[idCol]] = r[statusCol];
        log.info(`${Object.keys(out).length} testcase result(s)`);
        return out;
    } catch (error) {
        log.error(`Failed to read results: ${describeError(error)}`);
        throw error;
    }
}

/** Unique build ID: given, else CI variables, else <platform>-<appVersion>-<yyyyMMdd-HHmmss>. */
export function buildIdOf(given: string | undefined, platform: string, appVersion: string, now = new Date()): string {
    log.debug('Choosing the build ID');
    try {
        const ci = given || process.env.BUILD_TAG || process.env.BUILD_ID || process.env.GITHUB_RUN_ID;
        if (ci) return ci.replace(/[^A-Za-z0-9._-]+/g, '-');
        const pad = (n: number) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        return `${platform}-${(appVersion || 'unknown').replace(/[^A-Za-z0-9._-]+/g, '_')}-${stamp}`;
    } catch (error) {
        log.error(`Failed to choose the build ID: ${describeError(error)}`);
        throw error;
    }
}

/** Creates reports/smoke/<WorkbookName>/<BuildId>/ (never reuses an existing folder). */
export function createBuildFolder(root: string, workbookName: string, buildId: string): string {
    log.info(`Creating the build folder ${buildId}`);
    try {
        const folder = path.join(root, 'reports', 'smoke', workbookName, buildId);
        if (fs.existsSync(folder)) throw new Error(`Build folder already exists, refusing to overwrite: ${rel(root, folder)}`);
        fs.mkdirSync(folder, { recursive: true });
        return folder;
    } catch (error) {
        log.error(`Failed to create the build folder: ${describeError(error)}`);
        throw error;
    }
}

export interface RecordInput {
    folder: string;
    manifest: Manifest;
    buildId: string;
    platform: string;
    appVersion: string;
    deviceModel: string;
    startedAt: string;
    finishedAt: string;
    runType: 'complete' | 'partial' | 'not-run';
    selectedIds: string[];
}

/** Writes run-record.json, run.json and summary.md for the build folder. */
export function writeRecord(input: RecordInput): { decision: Decision; reason: string } {
    log.info(`Recording build ${input.buildId}`);
    try {
        const results = latestResults(path.join(input.folder, 'results.csv'));
        const missingIds = input.manifest.stories.flatMap((s) => s.eligible.filter((e) => e.status === 'missing').map((e) => e.id));
        const outcome = decide({
            coverageComplete: input.manifest.coverageComplete,
            partial: input.runType === 'partial',
            selectedIds: input.runType === 'not-run' ? [] : input.selectedIds,
            results,
        });
        const decision =
            input.runType === 'not-run' ? { decision: 'INCONCLUSIVE' as Decision, reason: outcome.reason || 'not run' } : outcome;
        const selected = Object.fromEntries(input.selectedIds.filter((id) => results[id]).map((id) => [id, results[id]]));
        const count = (s: string) => Object.values(selected).filter((v) => v === s).length;
        const record = {
            buildId: input.buildId,
            workbook: input.manifest.workbook,
            workbookSha256: input.manifest.workbookSha256,
            platform: input.platform,
            appVersion: input.appVersion,
            deviceModel: input.deviceModel,
            startedAt: input.startedAt,
            finishedAt: input.finishedAt,
            runType: input.runType,
            selectedIds: input.selectedIds,
            missingIds,
            results: selected,
            counts: {
                eligible: input.manifest.totals.eligible,
                selected: input.selectedIds.length,
                Pass: count('Pass'),
                Fail: count('Fail'),
                Skip: count('Skip'),
                Blocked: count('Blocked'),
                noResult: input.selectedIds.filter((id) => !results[id]).length,
            },
            evidence: {
                resultsCsv: fs.existsSync(path.join(input.folder, 'results.csv')) ? 'results.csv' : null,
                allureResults: fs.existsSync(path.join(input.folder, 'allure-results')) ? 'allure-results/' : null,
            },
            decision: decision.decision,
            decisionReason: decision.reason,
        };
        fs.writeFileSync(path.join(input.folder, 'run-record.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
        const runJson = {
            runId: input.buildId,
            executionType: 'smoke',
            runType: input.runType,
            workbook: input.manifest.workbook,
            platform: input.platform,
            environment: process.env.TEST_ENV ?? 'qa',
            startedAt: input.startedAt,
            finishedAt: input.finishedAt,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            decision: decision.decision,
        };
        fs.writeFileSync(path.join(input.folder, 'run.json'), `${JSON.stringify(runJson, null, 2)}\n`, 'utf8');
        const label = input.runType === 'partial' ? ' (PARTIAL - INCONCLUSIVE)' : '';
        const summary = [
            `# Smoke build ${input.buildId}${label}`,
            '',
            `- Workbook: ${input.manifest.workbook}`,
            `- Platform: ${input.platform}, app ${input.appVersion}, device ${input.deviceModel}`,
            `- Run type: ${input.runType}`,
            `- Decision: **${decision.decision}** — ${decision.reason}`,
            `- Counts: eligible ${record.counts.eligible}, selected ${record.counts.selected}, Pass ${record.counts.Pass}, Fail ${record.counts.Fail}, Skip ${record.counts.Skip}, Blocked ${record.counts.Blocked}, no result ${record.counts.noResult}`,
            `- Missing (not implemented): ${missingIds.join(', ') || 'none'}`,
            `- Failed: ${
                Object.entries(selected)
                    .filter(([, v]) => v === 'Fail')
                    .map(([k]) => k)
                    .join(', ') || 'none'
            }`,
            '',
            'A failed automated test is a result to investigate, not by itself a confirmed product defect.',
            '',
        ].join('\n');
        fs.writeFileSync(path.join(input.folder, 'summary.md'), summary, 'utf8');
        log.info(`Build ${input.buildId}: ${decision.decision}`);
        return decision;
    } catch (error) {
        log.error(`Failed to record the build: ${describeError(error)}`);
        throw error;
    }
}
