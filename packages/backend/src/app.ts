import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import { db } from "./db.js";
import { projects, pages, elements, crawlRuns, discoveryRuns, discoveryCandidates } from "./schema.js";
import { runDiscovery } from "./services/discovery/discoveryRunner.js";
import { normalizeUrl } from "./services/discovery/urlNormalize.js";
import { classifyPage } from "./services/discovery/pageClassifier.js";
import { crawlQueue } from "./queue.js";
import { openAuthSession } from "./crawler.js";
import { fastifyLoggerConfig } from "./logger.js";
import { buildManifestForPageIds, serializePage, serializeElement } from "./services/manifestBuilder.js";
import { getInventoryTokens } from "./services/inventory/index.js";
import { buildInventoryRenderModel } from "./services/inventory/renderModel.js";
import {
  defaultWorkspacePath,
  workspaceRoot,
} from "./services/workspace/paths.js";
import {
  getWorkspaceDecisionPayload,
  getWorkspaceStatus,
} from "./services/workspace/index.js";
import {
  InventoryOverviewSchema,
  InventoryDecisionsSchema,
  InventoryRenderDataSchema,
} from "@sitemapper/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isValidId(id: string | undefined | null): id is string {
  if (!id) return false;
  const n = parseInt(id, 10);
  return !isNaN(n) && n > 0 && String(n) === id;
}

function toId(id: string): number {
  return parseInt(id, 10);
}

function defaultInventoryStyleExtraction(): Record<string, unknown> {
  return {
    enabled: true,
    preset: "smart",
    extractInteractiveElements: true,
    extractStructuralElements: true,
    extractTextElements: true,
    extractFormElements: true,
    extractMediaElements: false,
    extractColors: true,
    extractTypography: true,
    extractSpacing: true,
    extractLayout: true,
    extractBorders: true,
    includeSelectors: true,
    includeComputedStyles: true,
    captureOnlyVisibleElements: true,
  };
}

function effectiveCaptureUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    const port = parsed.port ? `:${parsed.port}` : "";
    let pathname = parsed.pathname.replace(/\/{2,}/g, "/");
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${host}${port}${pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function dedupeEffectiveCaptureUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const url of urls) {
    const key = effectiveCaptureUrlKey(url);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(url);
  }

  return deduped;
}

function projectExists(projectId: string): boolean {
  const row = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, toId(projectId)))
    .get();
  return Boolean(row);
}

function getUrlLookupCandidates(rawUrl: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (value && value.trim()) candidates.add(value.trim());
  };

  add(rawUrl);

  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    add(parsed.toString());

    if (parsed.pathname !== "/") {
      const originalPath = parsed.pathname;
      if (originalPath.endsWith("/")) {
        parsed.pathname = originalPath.replace(/\/+$/, "") || "/";
      } else {
        parsed.pathname = `${originalPath}/`;
      }
      add(parsed.toString());
    }
  } catch {
    // Keep the raw candidate only for non-URL values.
  }

  return Array.from(candidates);
}

function requestBaseUrl(request: { headers: { host?: string | string[] } }): string {
  const host = Array.isArray(request.headers.host)
    ? request.headers.host[0]
    : request.headers.host;
  return `http://${host || "localhost:3006"}`;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
  if (!content) return fallback;
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

function devValidate<T>(label: string, schema: { safeParse: (data: unknown) => { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } } }, data: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const result = schema.safeParse(data);
  if (!result.success && result.error) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")} — ${issue.message}`).join("; ");
    console.warn(`[dev-validation] ${label} failed: ${issues}`);
  }
}

function workspaceAssetUrl(baseUrl: string, projectId: string, relativePath: string | undefined): string | null {
  if (!relativePath || relativePath.includes("undefined")) return null;
  return `${baseUrl}/workspace/${encodeURIComponent(projectId)}/${relativePath
    .split(path.sep)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

export async function buildInventoryRenderData(projectId: string, baseUrl: string): Promise<Record<string, unknown>> {
  return buildInventoryRenderModel(projectId, baseUrl) as unknown as Record<string, unknown>;
}

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: fastifyLoggerConfig });

  await server.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  await server.register(fastifyStatic, {
    root: path.join(__dirname, "..", "static"),
    prefix: "/static/",
  });

  await server.register(async function (fastify) {
    await fastify.register(fastifyStatic, {
      root: path.join(__dirname, "..", "screenshots"),
      prefix: "/screenshots/",
    });
  });

  await server.register(async function (fastify) {
    await fastify.register(fastifyStatic, {
      root: workspaceRoot,
      prefix: "/workspace/",
      decorateReply: false,
    });
  });

  server.get("/", async () => ({ hello: "world" }));

  // ── Projects ──────────────────────────────────────────────────────────────

  server.get("/projects", async () => {
    const rows = db.select().from(projects).orderBy(desc(projects.createdAt)).all();
    return {
      projects: rows.map((r) => ({
        _id: String(r.id),
        id: r.id,
        name: r.name,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  });

  server.post("/projects", async (request, reply) => {
    const { name } = request.body as { name: string };

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: "Project name is required" });
    }

    const now = new Date();
    const [row] = db
      .insert(projects)
      .values({ name: name.trim(), createdAt: now, updatedAt: now })
      .returning()
      .all();

    return {
      project: {
        _id: String(row!.id),
        id: row!.id,
        name: row!.name,
        createdAt: row!.createdAt.toISOString(),
        updatedAt: row!.updatedAt.toISOString(),
      },
    };
  });

  server.delete("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidId(id)) {
      return reply.status(400).send({ error: "Invalid project id" });
    }
    const pid = toId(id);
    const existing = db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, pid))
      .get();
    if (!existing) {
      return reply.status(404).send({ error: "Project not found" });
    }
    db.delete(elements).where(eq(elements.projectId, pid)).run();
    db.delete(pages).where(eq(pages.projectId, pid)).run();
    db.delete(projects).where(eq(projects.id, pid)).run();
    return { ok: true, deletedId: id };
  });

  server.get("/projects/:projectId/crawl-runs", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });
    if (!projectExists(projectId)) return reply.status(404).send({ error: "Project not found" });

    const rows = db
      .select()
      .from(crawlRuns)
      .where(eq(crawlRuns.projectId, toId(projectId)))
      .orderBy(desc(crawlRuns.startedAt))
      .all();

    return {
      crawlRuns: rows.map((r) => ({
        id: String(r.id),
        projectId: String(r.projectId),
        jobId: r.jobId,
        startUrl: r.startUrl,
        pageCount: r.pageCount,
        elementCount: r.elementCount,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
    };
  });

  // ── Job progress & status ─────────────────────────────────────────────────

  server.post("/progress/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { stage, currentPage, totalPages, currentUrl, progress } =
      request.body as {
        stage: string;
        currentPage?: number;
        totalPages?: number;
        currentUrl?: string;
        progress: number;
      };

    const job = await crawlQueue.getJob(jobId);
    if (!job) return reply.status(404).send({ error: "Job not found" });

    await job.updateData({
      ...job.data,
      progress: {
        stage,
        currentPage,
        totalPages,
        currentUrl,
        progress,
        timestamp: new Date().toISOString(),
      },
    });

    return { message: "Progress updated" };
  });

  server.get("/status/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const job = await crawlQueue.getJob(jobId);
    if (!job) return reply.status(404).send({ error: "Job not found" });

    const state = await job.getState();
    const jobData = job.data as any;
    const detailedProgress = jobData.progress ?? null;

    let status: string;
    switch (state) {
      case "completed": status = "completed"; break;
      case "failed":    status = "failed";    break;
      case "active":    status = "processing"; break;
      default:          status = "pending";
    }

    if (jobData.type === "inventory-prepare") {
      return {
        jobId,
        type: "inventory-prepare",
        status,
        progress: detailedProgress ?? (typeof job.progress === "number" ? job.progress : 0),
        detailedProgress,
        result: {
          projectId: jobData.projectId ?? null,
          workspaceRoot: jobData.workspaceRoot ?? null,
          pageCount: typeof jobData.pageCount === "number" ? jobData.pageCount : 0,
          elementCount: typeof jobData.elementCount === "number" ? jobData.elementCount : 0,
          categoryCounts: jobData.categoryCounts ?? null,
          generatedAt: jobData.generatedAt ?? null,
          lastCompletedAt: jobData.lastCompletedAt ?? null,
        },
      };
    }

    return {
      jobId,
      status,
      progress: detailedProgress ?? (typeof job.progress === "number" ? job.progress : 0),
      detailedProgress,
      result: {
        projectId: jobData.projectId ?? null,
        detectInteractiveElements: jobData.detectInteractiveElements !== false,
        renderInteractiveHighlights: jobData.renderInteractiveHighlights !== false,
        startUrl: jobData.url ?? null,
        fullRefresh: jobData.fullRefresh === true,
        visitedUrls: Array.isArray(jobData.visitedUrls) ? jobData.visitedUrls : [],
        visitedPageIds: Array.isArray(jobData.visitedPageIds) ? jobData.visitedPageIds : [],
        pageCount:
          typeof jobData.pageCount === "number"
            ? jobData.pageCount
            : Array.isArray(jobData.visitedUrls)
            ? jobData.visitedUrls.length
            : 0,
        lastCompletedAt: jobData.lastCompletedAt ?? null,
        approvedUrls: Array.isArray(jobData.approvedUrls) ? jobData.approvedUrls : null,
        discoveryRunId: jobData.discoveryRunId ?? null,
      },
    };
  });

  server.get("/jobs/:jobId/pages", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const job = await crawlQueue.getJob(jobId);
    if (!job) return reply.status(404).send({ error: "Job not found" });

    const jobState = await job.getState();
    if (jobState !== "completed") {
      return reply.status(409).send({ error: "Job has not completed", state: jobState });
    }

    const jobData = job.data as any;
    const projectId = jobData.projectId;
    if (!isValidId(projectId)) {
      return reply.status(400).send({ error: "Job is missing a valid projectId" });
    }

    const visitedPageIds: string[] = Array.isArray(jobData.visitedPageIds)
      ? jobData.visitedPageIds.filter((v: unknown): v is string => typeof v === "string")
      : [];

    if (visitedPageIds.length === 0) {
      return { jobId, projectId, pages: [], elements: [] };
    }

    try {
      const manifest = await buildManifestForPageIds(projectId, visitedPageIds);
      return { jobId, projectId, pages: manifest.pages, elements: manifest.elements };
    } catch (error) {
      request.log.error(`Failed to build manifest for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({ error: "Failed to load job pages" });
    }
  });

  // ── Crawl ─────────────────────────────────────────────────────────────────

  server.post("/crawl", async (request, reply) => {
    const {
      url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor, delay, requestDelay,
      maxDepth, defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements,
      highlightAllElements, projectId, auth, styleExtraction, fullRefresh,
      captureOnlyVisibleElements,
    } = request.body as any;

    if (!url || !publicUrl) {
      return reply.status(400).send({ error: "URL and publicUrl are required" });
    }
    if (!projectId) {
      return reply.status(400).send({ error: "projectId is required" });
    }
    if (!isValidId(projectId)) {
      return reply.status(400).send({ error: "Invalid projectId" });
    }

    const projectRow = db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, toId(projectId)))
      .get();

    if (!projectRow) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const job = await crawlQueue.add("crawl", {
      url, publicUrl,
      maxRequestsPerCrawl,
      deviceScaleFactor: deviceScaleFactor || 1,
      delay: delay || 0,
      requestDelay: requestDelay || 1000,
      maxDepth: maxDepth === undefined ? 0 : maxDepth,
      defaultLanguageOnly,
      sampleSize,
      showBrowser,
      detectInteractiveElements: detectInteractiveElements !== false,
      captureOnlyVisibleElements: captureOnlyVisibleElements !== false,
      highlightAllElements: highlightAllElements || false,
      projectId,
      auth,
      styleExtraction,
      fullRefresh: !!fullRefresh,
    });

    return { message: "Crawl job successfully queued.", jobId: job.id };
  });

  server.post("/recrawl-page", async (request, reply) => {
    const {
      url, publicUrl, projectId, deviceScaleFactor, delay, requestDelay, auth, styleExtraction,
      captureOnlyVisibleElements,
    } = request.body as any;

    if (!url || !publicUrl) {
      return reply.status(400).send({ error: "URL and publicUrl are required" });
    }
    if (!projectId) {
      return reply.status(400).send({ error: "projectId is required" });
    }
    if (!isValidId(projectId)) {
      return reply.status(400).send({ error: "Invalid projectId" });
    }

    const projectRow = db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, toId(projectId)))
      .get();

    if (!projectRow) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const job = await crawlQueue.add("recrawl-page", {
      url, publicUrl,
      maxRequestsPerCrawl: 1,
      deviceScaleFactor: deviceScaleFactor || 1,
      delay: delay || 0,
      requestDelay: requestDelay || 1000,
      maxDepth: 0,
      defaultLanguageOnly: false,
      sampleSize: 0,
      showBrowser: false,
      detectInteractiveElements: true,
      captureOnlyVisibleElements: captureOnlyVisibleElements !== false,
      highlightAllElements: false,
      projectId,
      auth,
      styleExtraction,
    });

    return { message: "Recrawl job queued", jobId: job.id };
  });

  server.post("/crawl/approved", async (request, reply) => {
    const body = request.body as {
      projectId?: string;
      discoveryRunId?: string;
      approvedUrls?: string[];
      fullRefresh?: boolean;
      styleExtraction?: Record<string, unknown>;
      screenshotWidth?: number;
      deviceScaleFactor?: number;
    };

    const { projectId, discoveryRunId, approvedUrls } = body;

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });
    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });
    if (!projectExists(projectId)) return reply.status(404).send({ error: "Project not found" });

    if (!Array.isArray(approvedUrls) || approvedUrls.length === 0) {
      return reply.status(400).send({ error: "approvedUrls array is required" });
    }

    if (!discoveryRunId || !isValidId(discoveryRunId)) {
      return reply.status(400).send({ error: "discoveryRunId is required" });
    }

    const run = db
      .select()
      .from(discoveryRuns)
      .where(
        and(
          eq(discoveryRuns.id, toId(discoveryRunId)),
          eq(discoveryRuns.projectId, toId(projectId))
        )
      )
      .get();

    if (!run) return reply.status(404).send({ error: "Discovery run not found" });

    const rawNormalizedApprovedUrls = approvedUrls
      .map((url) => normalizeUrl(url)?.url)
      .filter((url): url is string => Boolean(url));
    const normalizedApprovedUrls = dedupeEffectiveCaptureUrls(rawNormalizedApprovedUrls);
    if (normalizedApprovedUrls.length === 0) {
      return reply.status(400).send({ error: "No valid approvedUrls provided" });
    }

    const runCandidates = db
      .select({ normalizedUrl: discoveryCandidates.normalizedUrl })
      .from(discoveryCandidates)
      .where(eq(discoveryCandidates.discoveryRunId, run.id))
      .all();
    const runCandidateUrls = new Set(runCandidates.map((candidate) => candidate.normalizedUrl));
    const unknownApprovedUrls = normalizedApprovedUrls.filter((url) => !runCandidateUrls.has(url));
    if (unknownApprovedUrls.length > 0) {
      return reply.status(400).send({
        error: "approvedUrls must belong to the discovery run",
        unknownApprovedUrls,
      });
    }

    const startUrl = normalizedApprovedUrls[0];
    const publicUrl = requestBaseUrl(request);

    const job = await crawlQueue.add("crawl-approved", {
      url: startUrl,
      publicUrl,
      maxRequestsPerCrawl: normalizedApprovedUrls.length,
      deviceScaleFactor: body.deviceScaleFactor || 1,
      requestDelay: 1000,
      maxDepth: 0,
      defaultLanguageOnly: false,
      sampleSize: 0,
      showBrowser: false,
      detectInteractiveElements: true,
      renderInteractiveHighlights: false,
      captureOnlyVisibleElements: true,
      highlightAllElements: false,
      fullRefresh: body.fullRefresh === true,
      projectId,
      styleExtraction: body.styleExtraction ?? defaultInventoryStyleExtraction(),
      approvedUrls: normalizedApprovedUrls,
      discoveryRunId,
    });

    return {
      message: "Approved capture crawl queued",
      jobId: job.id,
      approvedCount: normalizedApprovedUrls.length,
    };
  });

  server.post("/auth-session", async (request, reply) => {
    const { url } = request.body as { url: string };
    if (!url) return reply.status(400).send({ error: "URL is required" });

    try {
      return await openAuthSession(url);
    } catch (error) {
      server.log.error(`Error in auth session: ${error}`);
      return reply.status(500).send({
        error: "Failed to open authentication session",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ── Pages ─────────────────────────────────────────────────────────────────

  server.get("/pages/by-ids", async (request, reply) => {
    const { projectId, ids } = request.query as { projectId?: string; ids?: string | string[] };

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });
    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });

    let idList: string[] = [];
    if (Array.isArray(ids)) {
      idList = ids.filter((v): v is string => typeof v === "string");
    } else if (typeof ids === "string") {
      idList = ids.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
    }

    if (idList.length === 0) return { pages: [], elements: [] };

    try {
      return await buildManifestForPageIds(projectId, idList);
    } catch (error) {
      request.log.error(`Failed to fetch pages by ids: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({ error: "Failed to fetch pages" });
    }
  });

  server.get("/page", async (request, reply) => {
    const { projectId, url, pageId } = request.query as {
      projectId?: string;
      url?: string;
      pageId?: string;
    };

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });
    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });

    const projectNumId = toId(projectId);

    if (url || pageId) {
      if (pageId && !isValidId(pageId)) {
        return reply.status(400).send({ error: "Invalid pageId" });
      }

      let conditions = [eq(pages.projectId, projectNumId)];

      if (pageId) {
        conditions.push(eq(pages.id, toId(pageId)));
      }

      if (url) {
        const candidates = getUrlLookupCandidates(url);
        if (candidates.length === 1) {
          conditions.push(eq(pages.url, candidates[0]!));
        } else {
          conditions.push(or(...candidates.map((c) => eq(pages.url, c)))!);
        }
      }

      const pageRow = db
        .select()
        .from(pages)
        .where(and(...conditions))
        .get();

      if (!pageRow) return reply.status(404).send({ error: "Page not found" });

      return { page: serializePage(pageRow) };
    }

    const pageRows = db
      .select()
      .from(pages)
      .where(eq(pages.projectId, projectNumId))
      .orderBy(desc(pages.createdAt))
      .all();

    return { pages: pageRows.map(serializePage) };
  });

  // ── Elements ──────────────────────────────────────────────────────────────

  server.get("/elements", async (request, reply) => {
    const { projectId, pageId, url } = request.query as {
      projectId?: string;
      pageId?: string;
      url?: string;
    };

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });
    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });

    const projectNumId = toId(projectId);
    let resolvedPageId: number | null = null;

    if (pageId) {
      if (!isValidId(pageId)) return reply.status(400).send({ error: "Invalid pageId" });
      resolvedPageId = toId(pageId);
    } else if (url) {
      const pageRow = db
        .select({ id: pages.id })
        .from(pages)
        .where(and(eq(pages.projectId, projectNumId), eq(pages.url, url)))
        .get();

      if (!pageRow) return reply.status(404).send({ error: "Page not found" });
      resolvedPageId = pageRow.id;
    }

    const conditions = resolvedPageId !== null
      ? and(eq(elements.projectId, projectNumId), eq(elements.pageId, resolvedPageId))
      : eq(elements.projectId, projectNumId);

    const elementRows = db.select().from(elements).where(conditions).all();
    return { elements: elementRows.map(serializeElement) };
  });

  // ── Styles ────────────────────────────────────────────────────────────────

  server.get("/styles/global", async (request, reply) => {
    const { projectId } = request.query as { projectId?: string };

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });
    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });

    const pageRows = db
      .select({
        id: pages.id,
        url: pages.url,
        title: pages.title,
        globalStyles: pages.globalStyles,
      })
      .from(pages)
      .where(eq(pages.projectId, toId(projectId)))
      .all();

    const cssVariables: Record<string, string> = {};
    const tokens = new Set<string>();

    const pageSummaries = pageRows.map((page) => {
      const pageStyles = (page.globalStyles ? JSON.parse(page.globalStyles) : {}) as {
        cssVariables?: Record<string, string>;
        tokens?: string[];
      };

      if (pageStyles.cssVariables) {
        for (const [key, value] of Object.entries(pageStyles.cssVariables)) {
          cssVariables[key] = value;
        }
      }
      if (pageStyles.tokens) {
        for (const token of pageStyles.tokens) tokens.add(token);
      }

      return {
        pageId: String(page.id),
        url: page.url,
        title: page.title,
        cssVariableCount: pageStyles.cssVariables ? Object.keys(pageStyles.cssVariables).length : 0,
        tokenCount: pageStyles.tokens ? pageStyles.tokens.length : 0,
      };
    });

    return { cssVariables, tokens: Array.from(tokens).sort(), pages: pageSummaries };
  });

  server.get("/styles/element", async (request, reply) => {
    const { projectId, elementId } = request.query as {
      projectId?: string;
      elementId?: string;
    };

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });
    if (!elementId) return reply.status(400).send({ error: "elementId is required" });
    if (!isValidId(projectId) || !isValidId(elementId)) {
      return reply.status(400).send({ error: "Invalid projectId or elementId" });
    }

    const elementRow = db
      .select()
      .from(elements)
      .where(and(eq(elements.id, toId(elementId)), eq(elements.projectId, toId(projectId))))
      .get();

    if (!elementRow) return reply.status(404).send({ error: "Element not found" });

    return { element: serializeElement(elementRow) };
  });

  // ── Inventory ─────────────────────────────────────────────────────────────

  server.post("/inventory/prepare/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });
    if (!projectExists(projectId)) return reply.status(404).send({ error: "Project not found" });

    const job = await crawlQueue.add("inventory-prepare", {
      type: "inventory-prepare",
      projectId,
    });

    return {
      message: "Inventory workspace prepare job queued.",
      type: "inventory-prepare",
      projectId,
      jobId: job.id,
    };
  });

  server.get("/inventory/overview", async (request, reply) => {
    const { projectId } = request.query as { projectId?: string };

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });
    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });
    if (!projectExists(projectId)) return reply.status(404).send({ error: "Project not found" });

    try {
      const payload = await getWorkspaceStatus(projectId);
      devValidate("InventoryOverview", InventoryOverviewSchema, payload);
      return payload;
    } catch (error) {
      request.log.error(`Failed to build inventory overview: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({ error: "Failed to build inventory overview" });
    }
  });

  server.get("/inventory/decisions/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });
    if (!projectExists(projectId)) return reply.status(404).send({ error: "Project not found" });

    try {
      const payload = await getWorkspaceDecisionPayload(projectId);
      devValidate("InventoryDecisions", InventoryDecisionsSchema, payload);
      return payload;
    } catch (error) {
      request.log.error(`Failed to load inventory decisions: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({ error: "Failed to load inventory decisions" });
    }
  });

  server.get("/inventory/render-data/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });
    if (!projectExists(projectId)) return reply.status(404).send({ error: "Project not found" });

    try {
      const payload = await buildInventoryRenderData(projectId, requestBaseUrl(request));
      devValidate("InventoryRenderData", InventoryRenderDataSchema, payload);
      return payload;
    } catch (error) {
      request.log.error(`Failed to load inventory render data: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({ error: "Failed to load inventory render data" });
    }
  });

  server.get("/inventory/tokens", async (request, reply) => {
    const { projectId } = request.query as { projectId?: string };

    if (!projectId) return reply.status(400).send({ error: "projectId is required" });
    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });
    if (!projectExists(projectId)) return reply.status(404).send({ error: "Project not found" });

    try {
      return await getInventoryTokens(projectId);
    } catch (error) {
      request.log.error(`Failed to build inventory tokens: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({ error: "Failed to build inventory tokens" });
    }
  });

  // ── Discovery ─────────────────────────────────────────────────────────────

  server.post("/discovery/start", async (request, reply) => {
    const body = request.body as {
      projectId?: string;
      startUrl?: string;
      seedUrls?: string[];
      maxCandidates?: number;
      pageBudget?: number;
      includeSubdomains?: boolean;
      includeBlog?: boolean;
      includeSupport?: boolean;
    };

    const { projectId, startUrl } = body;
    if (!projectId) return reply.status(400).send({ error: "projectId is required" });
    if (!isValidId(projectId)) return reply.status(400).send({ error: "Invalid projectId" });
    if (!startUrl) return reply.status(400).send({ error: "startUrl is required" });
    if (!projectExists(projectId)) return reply.status(404).send({ error: "Project not found" });

    try {
      const result = await runDiscovery({
        projectId,
        startUrl,
        seedUrls: body.seedUrls,
        maxCandidates: body.maxCandidates,
        pageBudget: body.pageBudget,
        includeSubdomains: body.includeSubdomains,
        includeBlog: body.includeBlog,
        includeSupport: body.includeSupport,
      });

      return {
        discoveryRunId: result.discoveryRunId,
        status: result.status,
        summary: result.summary,
        recommended: result.recommended.map((c) => ({
          id: String(c.id ?? 0),
          url: c.url,
          normalizedUrl: c.normalizedUrl,
          host: c.host,
          pageType: c.pageType,
          patternKey: c.patternKey,
          score: c.score,
          reasons: c.reasons,
          source: c.source,
        })),
      };
    } catch (error) {
      request.log.error(`Discovery start failed: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({ error: "Discovery failed" });
    }
  });

  server.get("/discovery/:runId", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    if (!isValidId(runId)) return reply.status(400).send({ error: "Invalid runId" });

    const run = db
      .select()
      .from(discoveryRuns)
      .where(eq(discoveryRuns.id, toId(runId)))
      .get();

    if (!run) return reply.status(404).send({ error: "Discovery run not found" });

    const candidates = db
      .select()
      .from(discoveryCandidates)
      .where(eq(discoveryCandidates.discoveryRunId, run.id))
      .all();

    return {
      discoveryRunId: String(run.id),
      projectId: String(run.projectId),
      status: run.status,
      startUrl: run.startUrl,
      summary: {
        totalCandidates: candidates.length,
        recommendedCount: candidates.filter((c) => c.isRecommended).length,
        approvedCount: candidates.filter((c) => c.isApproved).length,
        byPageType: candidates.reduce((acc, c) => {
          acc[c.pageType] = (acc[c.pageType] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byHost: candidates.reduce((acc, c) => {
          acc[c.host] = (acc[c.host] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      candidates: candidates.map((c) => ({
        id: String(c.id),
        url: c.url,
        normalizedUrl: c.normalizedUrl,
        host: c.host,
        pageType: c.pageType,
        patternKey: c.patternKey,
        score: c.score,
        reasons: JSON.parse(c.reasonsJson) as string[],
        source: c.source,
        isRecommended: Boolean(c.isRecommended),
        isApproved: Boolean(c.isApproved),
        isExcluded: Boolean(c.isExcluded),
      })),
    };
  });

  server.post("/discovery/:runId/approval", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const body = request.body as {
      approvedCandidateIds?: string[];
      manualUrls?: string[];
      excludedCandidateIds?: string[];
    };

    if (!isValidId(runId)) return reply.status(400).send({ error: "Invalid runId" });

    const run = db
      .select()
      .from(discoveryRuns)
      .where(eq(discoveryRuns.id, toId(runId)))
      .get();

    if (!run) return reply.status(404).send({ error: "Discovery run not found" });

    const approvedIds = (body.approvedCandidateIds ?? [])
      .filter(isValidId)
      .map(toId);
    const excludedIds = (body.excludedCandidateIds ?? [])
      .filter(isValidId)
      .map(toId);

    // Treat each approval submission as the current selection, not an additive history.
    db.update(discoveryCandidates)
      .set({ isApproved: false })
      .where(eq(discoveryCandidates.discoveryRunId, run.id))
      .run();

    // Mark approved
    for (const cid of approvedIds) {
      db.update(discoveryCandidates)
        .set({ isApproved: true })
        .where(
          and(
            eq(discoveryCandidates.id, cid),
            eq(discoveryCandidates.discoveryRunId, run.id)
          )
        )
        .run();
    }

    // Mark excluded
    for (const cid of excludedIds) {
      db.update(discoveryCandidates)
        .set({ isExcluded: true })
        .where(
          and(
            eq(discoveryCandidates.id, cid),
            eq(discoveryCandidates.discoveryRunId, run.id)
          )
        )
        .run();
    }

    // Add manual URLs as new approved candidates
    const manualUrls = (body.manualUrls ?? []).filter((u) => typeof u === "string");
    const now = new Date();
    for (const rawUrl of manualUrls) {
      const norm = normalizeUrl(rawUrl);
      if (!norm) continue;
      const classification = classifyPage(norm.path);
      try {
        db.insert(discoveryCandidates)
          .values({
            discoveryRunId: run.id,
            projectId: run.projectId,
            url: rawUrl,
            normalizedUrl: norm.url,
            host: norm.host,
            path: norm.path,
            source: "manual",
            pageType: classification.pageType,
            patternKey: classification.patternKey,
            score: 0,
            reasonsJson: JSON.stringify(["manual"]),
            isRecommended: false,
            isApproved: true,
            isExcluded: false,
            createdAt: now,
          })
          .run();
      } catch (err) {
        // Unique constraint on (runId, normalizedUrl) — manual URL may already exist
        if (err && typeof err === "object" && (err as any).message?.includes("UNIQUE")) {
          // Update existing to approved
          db.update(discoveryCandidates)
            .set({ isApproved: true })
            .where(
              and(
                eq(discoveryCandidates.discoveryRunId, run.id),
                eq(discoveryCandidates.normalizedUrl, norm.url)
              )
            )
            .run();
        } else {
          throw err;
        }
      }
    }

    // Update run approved count
    const approvedCount = db
      .select({ count: discoveryCandidates.id })
      .from(discoveryCandidates)
      .where(
        and(
          eq(discoveryCandidates.discoveryRunId, run.id),
          eq(discoveryCandidates.isApproved, true)
        )
      )
      .all().length;

    db.update(discoveryRuns)
      .set({ approvedCount })
      .where(eq(discoveryRuns.id, run.id))
      .run();

    const approvedRows = db
      .select({ url: discoveryCandidates.normalizedUrl })
      .from(discoveryCandidates)
      .where(
        and(
          eq(discoveryCandidates.discoveryRunId, run.id),
          eq(discoveryCandidates.isApproved, true)
        )
      )
      .all();
    const approvedUrls = dedupeEffectiveCaptureUrls(approvedRows.map((r) => r.url));

    return {
      ok: true,
      approvedUrls,
    };
  });

  return server;
}
