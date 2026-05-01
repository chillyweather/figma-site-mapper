import fs from "fs";
import path from "path";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../../db.js";
import { inventoryBuilds, crawlRuns } from "../../schema.js";
import { readDecisionFiles, decisionSummary } from "./decisions.js";
import { loadWorkspaceData } from "./loadData.js";
import { materializeWorkspace } from "./materialize.js";
import { readWorkspaceMeta } from "./meta.js";
import { defaultWorkspacePath, ensureDir, writeJson } from "./paths.js";
import { composeWorkspaceArtifacts } from "./prepare.js";
import type { WorkspaceBuildResult, WorkspaceData } from "./types.js";

export function getLatestCompletedCrawlRun(projectId: string) {
  const n = parseInt(projectId, 10);
  if (isNaN(n) || n <= 0) return null;
  return db
    .select()
    .from(crawlRuns)
    .where(and(eq(crawlRuns.projectId, n), eq(crawlRuns.status, "completed")))
    .orderBy(desc(crawlRuns.completedAt))
    .get() ?? null;
}

export interface BuildWorkspaceOptions {
  outPath?: string;
  verbose?: boolean;
}

function log(verbose: boolean | undefined, message: string): void {
  if (verbose) console.log(message);
}

interface InventoryBuildRecord {
  id: number;
  crawlRunId: number | null;
}

function startInventoryBuild(projectId: string, workspacePath: string): InventoryBuildRecord | null {
  const projectNumId = parseInt(projectId, 10);
  if (isNaN(projectNumId) || projectNumId <= 0) return null;

  const latestCrawlRun = getLatestCompletedCrawlRun(projectId);
  const crawlRunId = latestCrawlRun?.id ?? null;

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

  return row ? { id: row.id, crawlRunId } : null;
}

function completeInventoryBuild(buildId: number, data: WorkspaceData): void {
  db.update(inventoryBuilds)
    .set({
      status: "completed",
      pageCount: data.pages.length,
      elementCount: data.elements.length,
      completedAt: new Date(),
    })
    .where(eq(inventoryBuilds.id, buildId))
    .run();
}

function failInventoryBuild(buildId: number): void {
  db.update(inventoryBuilds)
    .set({ status: "failed", completedAt: new Date() })
    .where(eq(inventoryBuilds.id, buildId))
    .run();
}

export async function buildWorkspace(
  projectId: string,
  options: BuildWorkspaceOptions = {}
): Promise<WorkspaceBuildResult> {
  log(options.verbose, `Loading project ${projectId} from SQLite`);
  const data = await loadWorkspaceData(projectId);
  return buildWorkspaceFromData(projectId, data, options);
}

export async function buildWorkspaceFromData(
  projectId: string,
  data: WorkspaceData,
  options: BuildWorkspaceOptions = {}
): Promise<WorkspaceBuildResult> {
  const workspacePath = options.outPath ?? defaultWorkspacePath(projectId);
  const generatedAt = new Date().toISOString();

  log(options.verbose, "Composing workspace artifacts");
  const artifacts = composeWorkspaceArtifacts(data);

  log(options.verbose, "Creating inventory build record");
  const buildRecord = startInventoryBuild(projectId, workspacePath);

  try {
    log(options.verbose, `Materializing workspace at ${workspacePath}`);
    await materializeWorkspace(workspacePath, data, artifacts, generatedAt, {
      metaExtra: {
        inventoryBuildId: buildRecord ? String(buildRecord.id) : undefined,
        crawlRunId: buildRecord?.crawlRunId ? String(buildRecord.crawlRunId) : undefined,
      },
    });

    if (buildRecord) completeInventoryBuild(buildRecord.id, data);
  } catch (error) {
    if (buildRecord) failInventoryBuild(buildRecord.id);
    throw error;
  }

  return {
    projectId,
    workspaceRoot: workspacePath,
    pageCount: data.pages.length,
    elementCount: data.elements.length,
    categoryCounts: artifacts.categoryCountsAll,
    generatedAt,
  };
}

export async function getWorkspaceStatus(projectId: string, outPath?: string): Promise<Record<string, unknown>> {
  const workspacePath = outPath ?? defaultWorkspacePath(projectId);
  const meta = await readWorkspaceMeta(workspacePath);
  const projectJson = await fs.promises
    .readFile(path.join(workspacePath, "project.json"), "utf8")
    .then((value) => JSON.parse(value) as Record<string, unknown>)
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

export async function getWorkspaceDecisionPayload(
  projectId: string,
  outPath?: string
): Promise<Record<string, unknown>> {
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

export async function exportDecisions(projectId: string, outPath?: string): Promise<string> {
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

export async function refreshWorkspace(projectId: string, options: BuildWorkspaceOptions = {}): Promise<Record<string, unknown>> {
  const workspacePath = options.outPath ?? defaultWorkspacePath(projectId);
  const previousDecisions = await readDecisionFiles(workspacePath);

  const data = await loadWorkspaceData(projectId);
  const result = await buildWorkspaceFromData(projectId, data, options);

  const clusters = previousDecisions.clusters as
    | { clusters?: Array<{ id?: string; memberFingerprints?: string[] }> }
    | undefined;
  if (!Array.isArray(clusters?.clusters)) {
    return { ...result, mergeReport: null };
  }

  const observed = new Set(
    data.elements
      .map((element) => element.componentFingerprint)
      .filter((value): value is string => Boolean(value))
  );
  const assigned = new Set<string>();
  const mergedClusters = clusters.clusters.map((cluster) => {
    const members = Array.isArray(cluster.memberFingerprints)
      ? cluster.memberFingerprints
      : [];
    for (const member of members) assigned.add(member);
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
