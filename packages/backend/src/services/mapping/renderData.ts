import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { pages } from "../../schema.js";
import { parseJson } from "../../utils/parseJson.js";
import {
  mappingWorkspacePath,
  mappingLatestDecisionPath,
  mappingMetaPath,
} from "./paths.js";
import { loadAndValidateDecisionFile, extractDecisionFileMetadata } from "./validator.js";
import type { MappingOverview, MappingRenderData, MappingRenderComponent, MappingRenderInstance } from "./types.js";

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function getMappingOverview(projectId: string): Promise<MappingOverview> {
  const metaPath = mappingMetaPath(projectId);
  const metaContent = await readFileSafe(metaPath);
  const hasMappingWorkspace = metaContent !== null;

  let lastPreparedAt: string | null = null;
  let pageCount = 0;
  let candidateCount = 0;

  if (metaContent) {
    try {
      const meta = JSON.parse(metaContent) as { generatedAt?: string };
      lastPreparedAt = meta.generatedAt ?? null;
    } catch { /* ignore */ }
  }

  // Read manifest for counts
  const manifestPath = path.join(mappingWorkspacePath(projectId), "manifest.json");
  const manifestContent = await readFileSafe(manifestPath);
  if (manifestContent) {
    try {
      const manifest = JSON.parse(manifestContent) as { pageCount?: number; candidateCount?: number };
      pageCount = manifest.pageCount ?? 0;
      candidateCount = manifest.candidateCount ?? 0;
    } catch { /* ignore */ }
  }

  let hasDecisions = false;
  let lastDecisionsAt: string | null = null;
  let componentTypeCount = 0;
  let instanceCount = 0;

  const latestPath = mappingLatestDecisionPath(projectId);
  const latestContent = await readFileSafe(latestPath);
  if (latestContent) {
    const meta = extractDecisionFileMetadata(tryParse(latestContent));
    lastDecisionsAt = meta.generatedAt;
    const { valid } = loadAndValidateDecisionFile(latestContent);
    if (valid.length > 0) {
      hasDecisions = true;
      componentTypeCount = valid.length;
      instanceCount = valid.reduce((sum, c) => sum + c.instances.length, 0);
    }
  }

  return {
    projectId,
    mappingWorkspaceRoot: mappingWorkspacePath(projectId),
    hasMappingWorkspace,
    hasDecisions,
    lastPreparedAt,
    lastDecisionsAt,
    pageCount,
    candidateCount,
    componentTypeCount,
    instanceCount,
  };
}

function tryParse(content: string): unknown {
  try { return JSON.parse(content); } catch { return null; }
}

export async function getMappingRenderData(projectId: string): Promise<MappingRenderData> {
  const overview = await getMappingOverview(projectId);

  if (!overview.hasMappingWorkspace) {
    return {
      projectId,
      hasMappingWorkspace: false,
      hasDecisions: false,
      lastPreparedAt: null,
      lastDecisionsAt: null,
      components: [],
      warnings: [],
    };
  }

  const latestPath = mappingLatestDecisionPath(projectId);
  const latestContent = await readFileSafe(latestPath);
  if (!latestContent) {
    return {
      projectId,
      hasMappingWorkspace: true,
      hasDecisions: false,
      lastPreparedAt: overview.lastPreparedAt,
      lastDecisionsAt: null,
      components: [],
      warnings: [],
    };
  }

  const { valid, warnings } = loadAndValidateDecisionFile(latestContent);
  const meta = extractDecisionFileMetadata(tryParse(latestContent));

  // Build page metadata lookup from SQLite
  const projectNumId = parseInt(projectId, 10);
  const pageRows = db.select().from(pages).where(eq(pages.projectId, projectNumId)).all();
  const pageMap = new Map(
    pageRows.map((row) => [
      String(row.id),
      {
        url: row.url,
        screenshotPaths: parseJson<string[]>(row.screenshotPaths, []),
        viewportWidth: row.viewportWidth ?? null,
      },
    ])
  );

  const components: MappingRenderComponent[] = valid.map((comp) => {
    const instances: MappingRenderInstance[] = comp.instances.map((inst) => {
      const pageData = pageMap.get(inst.pageId);
      return {
        instanceId: inst.instanceId ?? inst.elementId ?? `${inst.pageId}:vision`,
        elementId: inst.elementId,
        pageId: inst.pageId,
        pageUrl: inst.sourceUrl ?? pageData?.url ?? "",
        bbox: inst.bbox,
        source: inst.source,
        confidence: inst.confidence,
        rawLabel: inst.rawLabel,
        label: inst.label,
        notes: inst.notes,
        screenshotPaths: pageData?.screenshotPaths ?? [],
        viewportWidth: pageData?.viewportWidth ?? null,
      };
    });
    return {
      type: comp.type,
      instanceCount: instances.length,
      instances,
    };
  });

  return {
    projectId,
    hasMappingWorkspace: true,
    hasDecisions: valid.length > 0,
    lastPreparedAt: overview.lastPreparedAt,
    lastDecisionsAt: meta.generatedAt,
    components,
    warnings,
  };
}

export async function getMappingDecisions(projectId: string): Promise<{
  projectId: string;
  hasMappingWorkspace: boolean;
  hasDecisions: boolean;
  lastDecisionsAt: string | null;
  components: unknown;
  warnings: string[];
}> {
  const overview = await getMappingOverview(projectId);
  const latestPath = mappingLatestDecisionPath(projectId);
  const latestContent = await readFileSafe(latestPath);

  if (!latestContent) {
    return {
      projectId,
      hasMappingWorkspace: overview.hasMappingWorkspace,
      hasDecisions: false,
      lastDecisionsAt: null,
      components: [],
      warnings: [],
    };
  }

  const { valid, warnings } = loadAndValidateDecisionFile(latestContent);
  const meta = extractDecisionFileMetadata(tryParse(latestContent));

  return {
    projectId,
    hasMappingWorkspace: overview.hasMappingWorkspace,
    hasDecisions: valid.length > 0,
    lastDecisionsAt: meta.generatedAt,
    components: valid,
    warnings,
  };
}
