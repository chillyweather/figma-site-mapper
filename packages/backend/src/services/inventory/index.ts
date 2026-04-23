import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { elements, pages } from "../../schema.js";
import { analyzeComponentClusters } from "./componentClustering.js";
import { analyzeInconsistencies } from "./inconsistencyAnalysis.js";
import { analyzeTokenCandidates } from "./tokenMining.js";
import type {
  InventoryCluster,
  InventoryInconsistency,
  InventoryOverview,
  InventoryTokenCandidate,
  ParsedInventoryElement,
  ParsedInventoryPage,
} from "./types.js";

function isValidId(id: string): boolean {
  const parsed = parseInt(id, 10);
  return !Number.isNaN(parsed) && parsed > 0 && String(parsed) === id;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function loadProjectData(projectId: string): Promise<{
  pages: ParsedInventoryPage[];
  elements: ParsedInventoryElement[];
}> {
  if (!isValidId(projectId)) {
    throw new Error("Invalid projectId supplied to inventory analysis");
  }

  const projectNumId = parseInt(projectId, 10);
  const pageRows = db
    .select()
    .from(pages)
    .where(eq(pages.projectId, projectNumId))
    .all();
  const elementRows = db
    .select()
    .from(elements)
    .where(eq(elements.projectId, projectNumId))
    .all();

  return {
    pages: pageRows.map((row) => {
      const globalStyles = parseJson<{ cssVariables?: Record<string, string>; tokens?: string[] }>(
        row.globalStyles,
        {}
      );

      return {
        id: String(row.id),
        projectId: String(row.projectId),
        url: row.url,
        title: row.title,
        cssVariables: globalStyles.cssVariables || {},
        tokens: Array.isArray(globalStyles.tokens) ? globalStyles.tokens : [],
      } satisfies ParsedInventoryPage;
    }),
    elements: elementRows.map((row) => ({
      id: String(row.id),
      pageId: String(row.pageId),
      projectId: String(row.projectId),
      type: row.type,
      selector: row.selector ?? undefined,
      tagName: row.tagName ?? undefined,
      elementId: row.elementId ?? undefined,
      classes: parseJson<string[]>(row.classes, []),
      bbox: parseJson<{ x: number; y: number; width: number; height: number } | undefined>(
        row.bbox,
        undefined
      ),
      href: row.href ?? undefined,
      text: row.text ?? undefined,
      styles: parseJson<Record<string, unknown>>(row.styles, {}),
      styleTokens: parseJson<string[]>(row.styleTokens, []),
      ariaLabel: row.ariaLabel ?? undefined,
      role: row.role ?? undefined,
      value: row.value ?? undefined,
      placeholder: row.placeholder ?? undefined,
      checked: row.checked ?? undefined,
      src: row.src ?? undefined,
      alt: row.alt ?? undefined,
    } satisfies ParsedInventoryElement)),
  };
}

async function analyzeProject(projectId: string): Promise<{
  pages: ParsedInventoryPage[];
  elements: ParsedInventoryElement[];
  tokens: InventoryTokenCandidate[];
  clusters: InventoryCluster[];
  inconsistencies: InventoryInconsistency[];
}> {
  const data = await loadProjectData(projectId);
  const tokens = analyzeTokenCandidates(data.pages, data.elements);
  const clusters = analyzeComponentClusters(data.elements);
  const inconsistencies = analyzeInconsistencies(tokens, clusters);

  return {
    ...data,
    tokens,
    clusters,
    inconsistencies,
  };
}

export async function getInventoryOverview(
  projectId: string
): Promise<InventoryOverview> {
  const { pages: projectPages, elements: projectElements, tokens, clusters, inconsistencies } =
    await analyzeProject(projectId);

  return {
    projectId,
    summary: {
      pageCount: projectPages.length,
      elementCount: projectElements.length,
      clusterCount: clusters.length,
      tokenCandidateCount: tokens.length,
      inconsistencyCount: inconsistencies.length,
    },
    topClusters: clusters.slice(0, 10),
    topTokenCandidates: tokens.slice(0, 12),
    topInconsistencies: inconsistencies.slice(0, 10),
  };
}

export async function getInventoryTokens(
  projectId: string
): Promise<{ projectId: string; tokens: InventoryTokenCandidate[] }> {
  const { tokens } = await analyzeProject(projectId);
  return { projectId, tokens };
}

export async function getInventoryClusters(
  projectId: string
): Promise<{ projectId: string; clusters: InventoryCluster[] }> {
  const { clusters } = await analyzeProject(projectId);
  return { projectId, clusters };
}

export async function getInventoryInconsistencies(
  projectId: string
): Promise<{ projectId: string; inconsistencies: InventoryInconsistency[] }> {
  const { inconsistencies } = await analyzeProject(projectId);
  return { projectId, inconsistencies };
}
