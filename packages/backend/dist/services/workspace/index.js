import fs from "fs";
import path from "path";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../../db.js";
import { inventoryBuilds, crawlRuns } from "../../schema.js";
import { buildContactSheets } from "./contactSheet.js";
import { ensureDecisionScaffold, readDecisionFiles, decisionSummary } from "./decisions.js";
import { loadWorkspaceData } from "./loadData.js";
import { allCatalogFolders, buildCatalogGroups, categoryCounts, writeCatalogManifests, writePageManifests, writeProjectManifest, writeRegionManifests, } from "./manifests.js";
import { readWorkspaceMeta, writeWorkspaceMeta } from "./meta.js";
import { defaultWorkspacePath, ensureDir, writeJson } from "./paths.js";
import { writeWorkspaceReadme } from "./readme.js";
import { buildColorSwatches } from "./swatches.js";
import { buildTypographySpecimens } from "./typeSpecimens.js";
import { writeMappingContextScaffold } from "../mappingContext/scaffold.js";
export function getLatestCompletedCrawlRun(projectId) {
    const n = parseInt(projectId, 10);
    if (isNaN(n) || n <= 0)
        return null;
    return db
        .select()
        .from(crawlRuns)
        .where(and(eq(crawlRuns.projectId, n), eq(crawlRuns.status, "completed")))
        .orderBy(desc(crawlRuns.completedAt))
        .get() ?? null;
}
const GENERATED_ENTRIES = [
    "README.md",
    "project.json",
    ".workspace-meta.json",
    "pages",
    "catalog",
    "tokens",
    "regions",
    "mapping-context",
    "exports",
];
function log(verbose, message) {
    if (verbose)
        console.log(message);
}
async function resetGeneratedWorkspace(workspacePath) {
    await ensureDir(workspacePath);
    for (const entry of GENERATED_ENTRIES) {
        await fs.promises.rm(path.join(workspacePath, entry), {
            recursive: true,
            force: true,
        });
    }
    await ensureDecisionScaffold(workspacePath);
}
async function writeTokenFiles(workspacePath, data) {
    const tokenDir = path.join(workspacePath, "tokens");
    await writeJson(path.join(tokenDir, "colors.json"), data.tokenTable.colors);
    await writeJson(path.join(tokenDir, "typography.json"), data.tokenTable.typography);
    await writeJson(path.join(tokenDir, "spacing.json"), data.tokenTable.spacing);
    await writeJson(path.join(tokenDir, "radii.json"), data.tokenTable.radii);
    await writeJson(path.join(tokenDir, "shadows.json"), data.tokenTable.shadows);
    await buildColorSwatches(data.tokenTable, path.join(tokenDir, "colors-swatches.png"));
    await buildTypographySpecimens(data.tokenTable, path.join(tokenDir, "typography-specimens.png"));
}
export async function buildWorkspace(projectId, options = {}) {
    const workspacePath = options.outPath ?? defaultWorkspacePath(projectId);
    const generatedAt = new Date().toISOString();
    log(options.verbose, `Loading project ${projectId} from SQLite`);
    const data = await loadWorkspaceData(projectId);
    const latestCrawlRun = getLatestCompletedCrawlRun(projectId);
    const crawlRunId = latestCrawlRun?.id ?? null;
    log(options.verbose, `Creating inventory build record`);
    const projectNumId = parseInt(projectId, 10);
    let buildRow = null;
    if (!isNaN(projectNumId) && projectNumId > 0) {
        const [row] = db
            .insert(inventoryBuilds)
            .values({
            projectId: projectNumId,
            crawlRunId,
            workspacePath,
            schemaVersion: 1,
            status: "running",
            startedAt: new Date(),
        })
            .returning()
            .all();
        buildRow = row ?? null;
    }
    try {
        log(options.verbose, `Resetting generated workspace at ${workspacePath}`);
        await resetGeneratedWorkspace(workspacePath);
        for (const folder of allCatalogFolders()) {
            await ensureDir(path.join(workspacePath, "catalog", folder, "crops"));
        }
        log(options.verbose, "Writing project/page/catalog manifests");
        const groupsByFolder = buildCatalogGroups(data.elements);
        await writeProjectManifest(workspacePath, data, generatedAt);
        await writeCatalogManifests(workspacePath, data, groupsByFolder);
        await writePageManifests(workspacePath, data);
        await writeRegionManifests(workspacePath, data);
        log(options.verbose, "Generating contact sheets and token images");
        await buildContactSheets(workspacePath, groupsByFolder);
        await writeTokenFiles(workspacePath, data);
        log(options.verbose, "Writing mapping-context scaffold");
        await writeMappingContextScaffold(workspacePath, projectId, generatedAt);
        await writeWorkspaceReadme(workspacePath, data, generatedAt);
        await writeWorkspaceMeta(workspacePath, data, generatedAt, {
            inventoryBuildId: buildRow ? String(buildRow.id) : undefined,
            crawlRunId: crawlRunId ? String(crawlRunId) : undefined,
        });
        await ensureDecisionScaffold(workspacePath);
        if (buildRow) {
            db.update(inventoryBuilds)
                .set({
                status: "completed",
                pageCount: data.pages.length,
                elementCount: data.elements.length,
                completedAt: new Date(),
            })
                .where(eq(inventoryBuilds.id, buildRow.id))
                .run();
        }
    }
    catch (error) {
        if (buildRow) {
            db.update(inventoryBuilds)
                .set({
                status: "failed",
                completedAt: new Date(),
            })
                .where(eq(inventoryBuilds.id, buildRow.id))
                .run();
        }
        throw error;
    }
    return {
        projectId,
        workspaceRoot: workspacePath,
        pageCount: data.pages.length,
        elementCount: data.elements.length,
        categoryCounts: categoryCounts(data.elements),
        generatedAt,
    };
}
export async function getWorkspaceStatus(projectId, outPath) {
    const workspacePath = outPath ?? defaultWorkspacePath(projectId);
    const meta = await readWorkspaceMeta(workspacePath);
    const projectJson = await fs.promises
        .readFile(path.join(workspacePath, "project.json"), "utf8")
        .then((value) => JSON.parse(value))
        .catch(() => null);
    const summary = await decisionSummary(workspacePath);
    const latestCrawlRun = getLatestCompletedCrawlRun(projectId);
    const workspaceCrawlRunId = meta && typeof meta.crawlRunId === "string" ? meta.crawlRunId : null;
    const latestCrawlRunId = latestCrawlRun ? String(latestCrawlRun.id) : null;
    const isWorkspaceStale = Boolean(meta) && latestCrawlRunId !== null && workspaceCrawlRunId !== latestCrawlRunId;
    return {
        projectId,
        workspaceRoot: workspacePath,
        hasWorkspace: Boolean(meta),
        lastBuiltAt: meta?.lastBuiltAt ?? null,
        pageCount: projectJson?.pageCount ?? 0,
        elementCount: projectJson?.elementCount ?? 0,
        decisionSummary: summary,
        crawlRunId: workspaceCrawlRunId,
        inventoryBuildId: meta && typeof meta.inventoryBuildId === "string" ? meta.inventoryBuildId : null,
        latestCrawlRunId,
        isWorkspaceStale,
    };
}
export async function getWorkspaceDecisionPayload(projectId, outPath) {
    const workspacePath = outPath ?? defaultWorkspacePath(projectId);
    const meta = await readWorkspaceMeta(workspacePath);
    if (!meta) {
        return {
            projectId,
            workspaceRoot: workspacePath,
            hasWorkspace: false,
            lastBuiltAt: null,
            clusters: {},
            tokens: {},
            inconsistencies: {},
            templates: {},
            notes: "",
        };
    }
    const decisions = await readDecisionFiles(workspacePath);
    return {
        projectId,
        workspaceRoot: workspacePath,
        hasWorkspace: true,
        lastBuiltAt: meta.lastBuiltAt ?? null,
        clusters: decisions.clusters ?? {},
        tokens: decisions.tokens ?? {},
        inconsistencies: decisions.inconsistencies ?? {},
        templates: decisions.templates ?? {},
        notes: decisions.notes ?? "",
    };
}
export async function exportDecisions(projectId, outPath) {
    const workspacePath = outPath ?? defaultWorkspacePath(projectId);
    const meta = await readWorkspaceMeta(workspacePath);
    if (!meta) {
        throw new Error(`Workspace not found for project ${projectId}`);
    }
    const decisions = await readDecisionFiles(workspacePath);
    const exportsDir = path.join(workspacePath, "exports");
    await ensureDir(exportsDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const exportPath = path.join(exportsDir, `${timestamp}.json`);
    await writeJson(exportPath, {
        projectId,
        exportedAt: new Date().toISOString(),
        workspaceMeta: meta,
        decisions,
    });
    return exportPath;
}
export async function refreshWorkspace(projectId, options = {}) {
    const workspacePath = options.outPath ?? defaultWorkspacePath(projectId);
    const previousDecisions = await readDecisionFiles(workspacePath);
    const result = await buildWorkspace(projectId, options);
    const clusters = previousDecisions.clusters;
    if (!Array.isArray(clusters?.clusters)) {
        return { ...result, mergeReport: null };
    }
    const data = await loadWorkspaceData(projectId);
    const observed = new Set(data.elements
        .map((element) => element.componentFingerprint)
        .filter((value) => Boolean(value)));
    const assigned = new Set();
    const mergedClusters = clusters.clusters.map((cluster) => {
        const members = Array.isArray(cluster.memberFingerprints)
            ? cluster.memberFingerprints
            : [];
        for (const member of members)
            assigned.add(member);
        return {
            ...cluster,
            _mergeReport: {
                resolved: members.filter((member) => observed.has(member)),
                missing: members.filter((member) => !observed.has(member)),
            },
        };
    });
    const newFingerprints = Array.from(observed).filter((fingerprint) => !assigned.has(fingerprint));
    const mergedPath = path.join(workspacePath, "decisions", "clusters.merged.json");
    await writeJson(mergedPath, {
        ...clusters,
        clusters: mergedClusters,
        _mergeReport: {
            new: newFingerprints,
            newCount: newFingerprints.length,
            generatedAt: new Date().toISOString(),
        },
    });
    return {
        ...result,
        mergeReport: {
            path: mergedPath,
            newCount: newFingerprints.length,
        },
    };
}
