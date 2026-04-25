import fs from "fs";
import path from "path";
import type {
  InventoryDecisions,
  InventoryRenderData,
  RenderBoard,
  RenderSection,
  RenderCard,
  RenderAsset,
  RenderLink,
} from "@sitemapper/shared";
import { defaultWorkspacePath } from "../workspace/paths.js";
import { readDecisionFiles } from "../workspace/decisions.js";
import { readWorkspaceMeta } from "../workspace/meta.js";
import { getLatestCompletedCrawlRun } from "../workspace/index.js";

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
  if (!content) return fallback;
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

function workspaceAssetUrl(baseUrl: string, projectId: string, relativePath: string | undefined): string | null {
  if (!relativePath || relativePath.includes("undefined")) return null;
  return `${baseUrl}/workspace/${encodeURIComponent(projectId)}/${relativePath
    .split(path.sep)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function arrayText(value: unknown, limit = 6): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => String(item))
    .filter(Boolean)
    .slice(0, limit)
    .join(", ");
}

function normalizeRelativeWorkspacePath(...parts: string[]): string {
  return path.posix.normalize(parts.filter(Boolean).join("/")).replace(/^(\.\.\/)+/, "");
}

function workspaceRelativePathExists(workspacePath: string, relativePath: string | undefined): boolean {
  if (!relativePath || relativePath.includes("undefined")) return false;
  const normalized = normalizeRelativeWorkspacePath(relativePath);
  return fs.existsSync(path.join(workspacePath, ...normalized.split("/")));
}

function existingWorkspaceAssetUrl(
  workspacePath: string,
  baseUrl: string,
  projectId: string,
  relativePath: string | undefined
): string | null {
  if (!workspaceRelativePathExists(workspacePath, relativePath)) return null;
  if (!relativePath) return null;
  return workspaceAssetUrl(baseUrl, projectId, normalizeRelativeWorkspacePath(relativePath));
}

interface ClusterExample {
  fingerprint: string;
  shortFingerprint: string;
  instanceCount: number;
  pageCount: number;
  textSamples: string[];
  elementId: string | null;
  pageId: string | null;
  bbox: [number, number, number, number] | null;
  cropUrl: string | null;
  cropContextUrl: string | null;
}

function elementToExample(
  element: Record<string, unknown>,
  workspacePath: string,
  projectId: string,
  baseUrl: string
): ClusterExample | null {
  const elementId = typeof element.id === "string" ? element.id : null;
  const pageId = typeof element.pageId === "string" ? element.pageId : null;
  if (!elementId || !pageId) return null;

  const fingerprint = typeof element.fingerprint === "string"
    ? element.fingerprint
    : typeof element.componentFingerprint === "string"
    ? element.componentFingerprint
    : `element:${elementId}`;
  const rawCrop = typeof element.crop === "string" ? element.crop : undefined;
  const rawCropContext = typeof element.cropContext === "string" ? element.cropContext : undefined;
  const cropPath = rawCrop ? normalizeRelativeWorkspacePath("pages", pageId, rawCrop) : undefined;
  const cropContextPath = rawCropContext ? normalizeRelativeWorkspacePath("pages", pageId, rawCropContext) : undefined;
  const cropUrl = existingWorkspaceAssetUrl(workspacePath, baseUrl, projectId, cropPath);
  const cropContextUrl = existingWorkspaceAssetUrl(workspacePath, baseUrl, projectId, cropContextPath);

  return {
    fingerprint,
    shortFingerprint: fingerprint.slice(0, 18),
    instanceCount: 1,
    pageCount: 1,
    textSamples: typeof element.text === "string" && element.text.trim()
      ? [element.text.trim().replace(/\s+/g, " ").slice(0, 120)]
      : [],
    elementId,
    pageId,
    bbox: Array.isArray(element.bbox) ? (element.bbox as [number, number, number, number]) : null,
    cropUrl,
    cropContextUrl,
  };
}

function scoreElementForCluster(
  cluster: Record<string, unknown>,
  element: Record<string, unknown>
): number {
  const clusterText = [
    textValue(cluster.id),
    textValue(cluster.name),
    textValue(cluster.category),
  ].join(" ").toLowerCase();
  const elementText = [
    textValue(element.text),
    textValue(element.category),
    textValue(element.tag),
    textValue(element.region),
  ].join(" ").toLowerCase();
  const category = textValue(element.category);
  const tag = textValue(element.tag).toLowerCase();
  const text = textValue(element.text).replace(/\s+/g, " ").trim().toLowerCase();
  const region = textValue(element.region).toLowerCase();
  const hasCrop = typeof element.crop === "string" || typeof element.cropContext === "string";
  const hasBbox = Array.isArray(element.bbox);
  let score = 0;

  if (hasCrop) score += 30;
  if (hasBbox) score += 10;
  if (element.visible !== false) score += 5;

  if (clusterText.includes("button") && category === "button") score += 45;
  if (clusterText.includes("link") && category === "link") score += 45;
  if (clusterText.includes("heading") && category === "heading") score += 45;
  if ((clusterText.includes("logo") || clusterText.includes("image")) && category === "image") score += 45;
  if ((clusterText.includes("stats") || clusterText.includes("text-block")) && category === "text-block") score += 35;

  if (clusterText.includes("primary") && text.includes("start free")) score += 120;
  if (clusterText.includes("outline") && text.includes("contact sales")) score += 120;
  if ((clusterText.includes("demo") || clusterText.includes("request")) && text.includes("request a demo")) score += 120;
  if (clusterText.includes("nav-trigger") && region === "top" && category === "button") score += 90;
  if (clusterText.includes("chip") && (category === "button" || category === "link") && text.length > 0 && text.length <= 40) score += 60;

  if (clusterText.includes("final-cta") && (elementText.includes("ready to see") || elementText.includes("runs on atera"))) score += 120;
  if (clusterText.includes("global.header") && (region === "top" || element.isGlobalChrome === true)) score += 95;
  if (clusterText.includes("global.footer") && (region === "bottom" || element.isGlobalChrome === true)) score += 85;
  if (clusterText.includes("faq") && (text.includes("what is") || text.includes("faq"))) score += 120;
  if (clusterText.includes("stats") && /\b\d+([.,]\d+)?\s*(%|k|x|min|hrs?)?\b/i.test(text)) score += 110;
  if (clusterText.includes("logo") && category === "image") score += 100;
  if (clusterText.includes("product-summary") && (elementText.includes("robin") || elementText.includes("essentials suite"))) score += 120;
  if (clusterText.includes("section-title") && category === "heading" && (tag === "h2" || tag === "h3")) score += 90;
  if (clusterText.includes("eyebrow") && text.length > 0 && text.length <= 60 && (category === "heading" || category === "text-block")) score += 75;
  if (clusterText.includes("read-case-study") && text.includes("read case study")) score += 120;
  if (clusterText.includes("learn-more") && text.includes("learn more")) score += 120;

  return score;
}

function fallbackExamplesForCluster(
  cluster: Record<string, unknown>,
  elements: Record<string, unknown>[],
  workspacePath: string,
  projectId: string,
  baseUrl: string,
  existingIds: Set<string>
): ClusterExample[] {
  return elements
    .map((element) => ({ element, score: scoreElementForCluster(cluster, element) }))
    .filter(({ element, score }) => {
      const id = typeof element.id === "string" ? element.id : "";
      return score >= 80 && id && !existingIds.has(id);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ element }) => elementToExample(element, workspacePath, projectId, baseUrl))
    .filter((example): example is ClusterExample => Boolean(example));
}

export async function buildInventoryRenderModel(
  projectId: string,
  baseUrl: string
): Promise<InventoryRenderData> {
  const workspacePath = defaultWorkspacePath(projectId);
  const decisions = await readDecisionFiles(workspacePath);
  const meta = await readWorkspaceMeta(workspacePath);

  const latestCrawlRun = getLatestCompletedCrawlRun(projectId);
  const workspaceCrawlRunId = meta && typeof meta.crawlRunId === "string" ? meta.crawlRunId : null;
  const latestCrawlRunId = latestCrawlRun ? String(latestCrawlRun.id) : null;
  const isWorkspaceStale = Boolean(meta) && latestCrawlRunId !== null && workspaceCrawlRunId !== latestCrawlRunId;

  // Load catalog groups and elements for enrichment
  const groupsByFingerprint = new Map<string, Record<string, unknown>>();
  const elementsById = new Map<string, Record<string, unknown>>();
  const allElements: Record<string, unknown>[] = [];

  const catalogPath = path.join(workspacePath, "catalog");
  const entries = await fs.promises.readdir(catalogPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const categoryFolder = entry.name;
    const groups = await readJsonFile<Array<Record<string, unknown>>>(
      path.join(catalogPath, categoryFolder, "groups.json"),
      []
    );
    for (const group of groups) {
      const fingerprint = typeof group.fingerprint === "string" ? group.fingerprint : null;
      if (!fingerprint) continue;
      groupsByFingerprint.set(fingerprint, { ...group, categoryFolder });
    }
  }

  const pagesPath = path.join(workspacePath, "pages");
  const pageEntries = await fs.promises.readdir(pagesPath, { withFileTypes: true }).catch(() => []);
  for (const entry of pageEntries) {
    if (!entry.isDirectory()) continue;
    const pageElements = await readJsonFile<Array<Record<string, unknown>>>(
      path.join(pagesPath, entry.name, "elements.json"),
      []
    );
    for (const element of pageElements) {
      const id = typeof element.id === "string" ? element.id : null;
      const enrichedElement = { ...element, pageId: entry.name };
      if (id) elementsById.set(id, enrichedElement);
      allElements.push(enrichedElement);
    }
  }

  // Build cluster examples
  const clustersRecord = asRecord(decisions.clusters);
  const clusters = asArray(clustersRecord.clusters);
  const clusterExamples = new Map<string, ClusterExample[]>();

  for (const cluster of clusters) {
    const clusterId = textValue(cluster.id);
    if (!clusterId) continue;
    const examples: ClusterExample[] = [];
    const fingerprints = Array.isArray(cluster.memberFingerprints)
      ? cluster.memberFingerprints.filter((value): value is string => typeof value === "string")
      : [];

    for (const fingerprint of fingerprints) {
      const group = groupsByFingerprint.get(fingerprint);
      if (!group) continue;
      const categoryFolder = typeof group.categoryFolder === "string" ? group.categoryFolder : "";
      const cropPath = typeof group.cropPath === "string" ? group.cropPath : undefined;
      const cropContextPath = typeof group.cropContextPath === "string" ? group.cropContextPath : undefined;
      const exemplarElementId =
        typeof group.exemplarElementId === "string"
          ? group.exemplarElementId
          : Array.isArray(group.elementIds) && typeof group.elementIds[0] === "string"
          ? group.elementIds[0]
          : null;
      const exemplarElement = exemplarElementId ? elementsById.get(exemplarElementId) : null;
      const cropUrl = cropPath
        ? workspaceAssetUrl(baseUrl, projectId, `catalog/${categoryFolder}/${cropPath}`)
        : null;
      const cropContextUrl = cropContextPath
        ? workspaceAssetUrl(baseUrl, projectId, `catalog/${categoryFolder}/${cropContextPath}`)
        : null;
      examples.push({
        fingerprint,
        shortFingerprint: fingerprint.slice(0, 18),
        instanceCount: typeof group.instanceCount === "number" ? group.instanceCount : 0,
        pageCount: typeof group.pageCount === "number" ? group.pageCount : 0,
        textSamples: Array.isArray(group.textSamples) ? group.textSamples.slice(0, 3) : [],
        elementId: exemplarElementId,
        pageId:
          exemplarElement && typeof exemplarElement.pageId === "string"
            ? exemplarElement.pageId
            : null,
        bbox: Array.isArray(exemplarElement?.bbox) ? (exemplarElement.bbox as [number, number, number, number]) : null,
        cropUrl,
        cropContextUrl,
      });
      if (examples.length >= 3) break;
    }

    if (examples.length === 0 && Array.isArray(cluster.representativeElementIds)) {
      for (const elementId of cluster.representativeElementIds) {
        if (typeof elementId !== "string") continue;
        const element = elementsById.get(elementId);
        if (!element) continue;

        const example = elementToExample(element, workspacePath, projectId, baseUrl);
        if (example) examples.push(example);
        if (examples.length >= 3) break;
      }
    }

    if (examples.length === 0 || examples.every((example) => !example.cropUrl && !example.cropContextUrl)) {
      const existingIds = new Set(examples.map((example) => example.elementId).filter((id): id is string => Boolean(id)));
      examples.push(...fallbackExamplesForCluster(cluster, allElements, workspacePath, projectId, baseUrl, existingIds));
    }
    clusterExamples.set(clusterId, examples);
  }

  // Build boards
  const boards: RenderBoard[] = [];

  // Components board
  const componentCards: RenderCard[] = [];
  for (const cluster of clusters) {
    const clusterId = textValue(cluster.id);
    const examples = clusterId ? clusterExamples.get(clusterId) ?? [] : [];
    const assets: RenderAsset[] = [];
    for (const example of examples) {
      if (example.cropContextUrl) {
        assets.push({ kind: "image", url: example.cropContextUrl, label: example.shortFingerprint });
      } else if (example.cropUrl) {
        assets.push({ kind: "image", url: example.cropUrl, label: example.shortFingerprint });
      }
    }

    const links: RenderLink[] = [];
    const firstWithSample = examples.find((e) => e.pageId && e.elementId && e.bbox);
    if (firstWithSample) {
      links.push({
        label: "View sample",
        target: {
          kind: "sample",
          pageId: firstWithSample.pageId!,
          elementId: firstWithSample.elementId!,
          bbox: firstWithSample.bbox!,
        },
      });
    }

    componentCards.push({
      id: clusterId || "unknown",
      title: textValue(cluster.name, clusterId || "Unnamed cluster"),
      subtitle: clusterId || undefined,
      badges: [textValue(cluster.category, "-"), textValue(cluster.confidence, "-")].filter(Boolean),
      body: [
        `Members: ${Array.isArray(cluster.memberFingerprints) ? cluster.memberFingerprints.length : 0}`,
        examples.length > 0
          ? `Examples: ${examples.map((e) => `${e.instanceCount}x`).join(" / ")}`
          : "",
        textValue(cluster.notes),
      ].filter(Boolean),
      assets,
      links,
    });
  }

  if (componentCards.length > 0) {
    boards.push({
      id: "components",
      title: "Components",
      sections: [
        {
          id: "component-clusters",
          title: `${componentCards.length} agent-defined clusters`,
          kind: "components",
          cards: componentCards,
        },
      ],
    });
  }

  // Tokens board
  const tokenRecord = asRecord(decisions.tokens);
  const tokenCards: RenderCard[] = [];
  for (const token of asArray(tokenRecord.colors)) {
    const value = textValue(token.value);
    const assets: RenderAsset[] = [];
    if (value) {
      assets.push({ kind: "color", color: value, label: value });
    }
    tokenCards.push({
      id: textValue(token.name, value) || "unknown",
      title: textValue(token.name, value) || "Unnamed token",
      subtitle: value || undefined,
      badges: ["color"],
      body: [textValue(token.usage)].filter(Boolean),
      assets,
      links: [],
    });
  }

  for (const key of ["typography", "spacing", "radii", "shadows"] as const) {
    const tokens = asArray(tokenRecord[key]);
    for (const token of tokens) {
      tokenCards.push({
        id: textValue(token.name, "unknown"),
        title: textValue(token.name, "Unnamed token"),
        subtitle: textValue(token.value) || undefined,
        badges: [key],
        body: [textValue(token.usage)].filter(Boolean),
        assets: [],
        links: [],
      });
    }
  }

  if (tokenCards.length > 0) {
    boards.push({
      id: "tokens",
      title: "Tokens",
      sections: [
        {
          id: "tokens",
          title: `${tokenCards.length} accepted tokens`,
          kind: "tokens",
          cards: tokenCards,
        },
      ],
    });
  }

  // Issues board
  const issues = asArray(asRecord(decisions.inconsistencies).issues);
  const issueCards: RenderCard[] = [];
  for (const issue of issues) {
    const severity = textValue(issue.severity, "review");
    issueCards.push({
      id: textValue(issue.id, "unknown"),
      title: textValue(issue.id, "Issue"),
      subtitle: severity,
      badges: [severity],
      body: [
        textValue(issue.description, textValue(issue.summary)),
        `Recommendation: ${textValue(issue.recommendation, "-")}`,
      ].filter(Boolean),
      assets: [],
      links: [],
    });
  }

  if (issueCards.length > 0) {
    boards.push({
      id: "issues",
      title: "Inconsistencies",
      sections: [
        {
          id: "issues",
          title: `${issueCards.length} review items`,
          kind: "issues",
          cards: issueCards,
        },
      ],
    });
  }

  // Templates board
  const templates = asArray(asRecord(decisions.templates).templates);
  const templateCards: RenderCard[] = [];
  for (const template of templates) {
    templateCards.push({
      id: textValue(template.id, "unknown"),
      title: textValue(template.name, textValue(template.id, "Template")),
      subtitle: textValue(template.id) || undefined,
      badges: [],
      body: [
        `Pages: ${arrayText(template.pageIds) || "-"}`,
        `Regions: ${arrayText(template.regions) || "-"}`,
        textValue(template.notes),
      ].filter(Boolean),
      assets: [],
      links: [],
    });
  }

  if (templateCards.length > 0) {
    boards.push({
      id: "templates",
      title: "Templates",
      sections: [
        {
          id: "templates",
          title: `${templateCards.length} page and section patterns`,
          kind: "templates",
          cards: templateCards,
        },
      ],
    });
  }

  // Notes board
  const notes = typeof decisions.notes === "string" ? decisions.notes : "";
  boards.push({
    id: "notes",
    title: "Notes",
    sections: [
      {
        id: "notes",
        title: "Agent-written summary and caveats",
        kind: "notes",
          cards: [
          {
            id: "notes",
            title: "Notes",
            badges: [],
            body: [notes || "No notes written."],
            assets: [],
            links: [],
          },
        ],
      },
    ],
  });

  return {
    projectId,
    hasWorkspace: Boolean(meta),
    build: {
      inventoryBuildId: meta && typeof meta.inventoryBuildId === "string" ? meta.inventoryBuildId : null,
      crawlRunId: workspaceCrawlRunId,
      isWorkspaceStale,
    },
    boards,
  };
}
