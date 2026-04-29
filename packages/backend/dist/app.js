import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import { db } from "./db.js";
import { projects, pages, elements, crawlRuns, discoveryRuns, discoveryCandidates, flows, flowSteps } from "./schema.js";
import { runDiscovery } from "./services/discovery/discoveryRunner.js";
import { normalizeUrl } from "./services/discovery/urlNormalize.js";
import { dedupeEffectiveCaptureUrls, getUrlLookupCandidates } from "./services/discovery/captureUrlNormalization.js";
import { approveDiscoveryRun } from "./services/discovery/approveDiscoveryRun.js";
import { crawlQueue } from "./queue.js";
import { openAuthSession } from "./crawler.js";
import { fastifyLoggerConfig, logger } from "./logger.js";
import { buildManifestForPageIds, serializePage, serializeElement } from "./services/manifestBuilder.js";
import { parseJson } from "./utils/parseJson.js";
import { getInventoryTokens } from "./services/inventory/index.js";
import { buildInventoryRenderModel } from "./services/inventory/renderModel.js";
import { defaultWorkspacePath, workspaceRoot, } from "./services/workspace/paths.js";
import { getWorkspaceDecisionPayload, getWorkspaceStatus, } from "./services/workspace/index.js";
import { getMappingInputs, saveMappingInputs, } from "./services/mappingInputs.js";
import { InventoryOverviewSchema, InventoryDecisionsSchema, InventoryRenderDataSchema, MappingContextSummarySchema, MappingSuggestionsSchema, } from "@sitemapper/shared";
import { getMappingContextSummary } from "./services/mappingContext/summary.js";
import { deriveSuggestionsFromDisk } from "./services/mappingContext/suggestions.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function isValidId(id) {
    if (!id)
        return false;
    const n = parseInt(id, 10);
    return !isNaN(n) && n > 0 && String(n) === id;
}
function toId(id) {
    return parseInt(id, 10);
}
function defaultInventoryStyleExtraction() {
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
function projectExists(projectId) {
    const row = db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, toId(projectId)))
        .get();
    return Boolean(row);
}
function pageBelongsToProject(pageId, projectId) {
    const row = db
        .select({ id: pages.id })
        .from(pages)
        .where(and(eq(pages.id, toId(pageId)), eq(pages.projectId, projectId)))
        .get();
    return Boolean(row);
}
function requestBaseUrl(request) {
    const host = Array.isArray(request.headers.host)
        ? request.headers.host[0]
        : request.headers.host;
    return `http://${host || "localhost:3006"}`;
}
async function readJsonFile(filePath, fallback) {
    const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
    if (!content)
        return fallback;
    try {
        return JSON.parse(content);
    }
    catch {
        return fallback;
    }
}
function devValidate(label, schema, data) {
    if (process.env.NODE_ENV === "production")
        return;
    const result = schema.safeParse(data);
    if (!result.success && result.error) {
        const issues = result.error.issues.map((issue) => `${issue.path.join(".")} — ${issue.message}`).join("; ");
        console.warn(`[dev-validation] ${label} failed: ${issues}`);
    }
}
function workspaceAssetUrl(baseUrl, projectId, relativePath) {
    if (!relativePath || relativePath.includes("undefined"))
        return null;
    return `${baseUrl}/workspace/${encodeURIComponent(projectId)}/${relativePath
        .split(path.sep)
        .map((part) => encodeURIComponent(part))
        .join("/")}`;
}
function serializeFlowStep(row) {
    return {
        _id: String(row.id),
        id: row.id,
        flowId: String(row.flowId),
        stepIndex: row.stepIndex,
        sourcePageId: String(row.sourcePageId),
        sourceUrl: row.sourceUrl,
        elementId: row.elementId != null ? String(row.elementId) : undefined,
        elementSelector: row.elementSelector ?? undefined,
        elementText: row.elementText ?? undefined,
        elementBbox: parseJson(row.elementBboxJson, undefined),
        targetUrl: row.targetUrl ?? undefined,
        targetPageId: row.targetPageId != null ? String(row.targetPageId) : undefined,
        actionKind: row.actionKind,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
export async function buildInventoryRenderData(projectId, baseUrl) {
    return buildInventoryRenderModel(projectId, baseUrl);
}
export async function buildServer() {
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
    // ── Remote logging from Figma plugin contexts ─────────────────────────────
    // Accepts log entries from the plugin sandbox and UI iframe, writing them
    // into the same pino log file used by the backend. logLevel "silent" keeps
    // the HTTP request itself out of the access log to avoid noise.
    server.post("/log", { config: { logLevel: "silent" } }, async (request, reply) => {
        const body = request.body;
        const level = typeof body.level === "string" ? body.level : "info";
        const source = typeof body.source === "string" ? body.source : "plugin";
        const msg = typeof body.msg === "string" ? body.msg : "(no message)";
        const data = body.data !== undefined ? body.data : undefined;
        const child = logger.child({ source });
        if (level === "error")
            child.error({ data }, msg);
        else if (level === "warn")
            child.warn({ data }, msg);
        else if (level === "debug")
            child.debug({ data }, msg);
        else
            child.info({ data }, msg);
        return reply.status(204).send();
    });
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
        const { name } = request.body;
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
                _id: String(row.id),
                id: row.id,
                name: row.name,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
            },
        };
    });
    server.delete("/projects/:id", async (request, reply) => {
        const { id } = request.params;
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
        const flowRows = db.select({ id: flows.id }).from(flows).where(eq(flows.projectId, pid)).all();
        if (flowRows.length > 0) {
            const flowIds = flowRows.map((f) => f.id);
            db.delete(flowSteps).where(inArray(flowSteps.flowId, flowIds)).run();
            db.delete(flows).where(eq(flows.projectId, pid)).run();
        }
        db.delete(elements).where(eq(elements.projectId, pid)).run();
        db.delete(pages).where(eq(pages.projectId, pid)).run();
        db.delete(projects).where(eq(projects.id, pid)).run();
        return { ok: true, deletedId: id };
    });
    server.get("/projects/:projectId/crawl-runs", async (request, reply) => {
        const { projectId } = request.params;
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
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
        const { jobId } = request.params;
        const { stage, currentPage, totalPages, currentUrl, progress } = request.body;
        const job = await crawlQueue.getJob(jobId);
        if (!job)
            return reply.status(404).send({ error: "Job not found" });
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
        const { jobId } = request.params;
        const job = await crawlQueue.getJob(jobId);
        if (!job)
            return reply.status(404).send({ error: "Job not found" });
        const state = await job.getState();
        const jobData = job.data;
        const detailedProgress = jobData.progress ?? null;
        let status;
        switch (state) {
            case "completed":
                status = "completed";
                break;
            case "failed":
                status = "failed";
                break;
            case "active":
                status = "processing";
                break;
            default: status = "pending";
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
                pageCount: typeof jobData.pageCount === "number"
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
        const { jobId } = request.params;
        const job = await crawlQueue.getJob(jobId);
        if (!job)
            return reply.status(404).send({ error: "Job not found" });
        const jobState = await job.getState();
        if (jobState !== "completed") {
            return reply.status(409).send({ error: "Job has not completed", state: jobState });
        }
        const jobData = job.data;
        const projectId = jobData.projectId;
        if (!isValidId(projectId)) {
            return reply.status(400).send({ error: "Job is missing a valid projectId" });
        }
        const visitedPageIds = Array.isArray(jobData.visitedPageIds)
            ? jobData.visitedPageIds.filter((v) => typeof v === "string")
            : [];
        if (visitedPageIds.length === 0) {
            return { jobId, projectId, pages: [], elements: [] };
        }
        try {
            const manifest = await buildManifestForPageIds(projectId, visitedPageIds);
            return { jobId, projectId, pages: manifest.pages, elements: manifest.elements };
        }
        catch (error) {
            request.log.error(`Failed to build manifest for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to load job pages" });
        }
    });
    // ── Crawl ─────────────────────────────────────────────────────────────────
    server.post("/crawl", async (request, reply) => {
        const { url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements, highlightAllElements, projectId, auth, styleExtraction, fullRefresh, captureOnlyVisibleElements, cookieBannerHandling, } = request.body;
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
            cookieBannerHandling: cookieBannerHandling ?? "auto",
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
        const { url, publicUrl, projectId, deviceScaleFactor, delay, requestDelay, auth, styleExtraction, captureOnlyVisibleElements, cookieBannerHandling, } = request.body;
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
            cookieBannerHandling: cookieBannerHandling ?? "auto",
            captureOnlyVisibleElements: captureOnlyVisibleElements !== false,
            highlightAllElements: false,
            projectId,
            auth,
            styleExtraction,
        });
        return { message: "Recrawl job queued", jobId: job.id };
    });
    server.post("/crawl/approved", async (request, reply) => {
        const body = request.body;
        const { projectId, discoveryRunId, approvedUrls } = body;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        if (!Array.isArray(approvedUrls) || approvedUrls.length === 0) {
            return reply.status(400).send({ error: "approvedUrls array is required" });
        }
        if (!discoveryRunId || !isValidId(discoveryRunId)) {
            return reply.status(400).send({ error: "discoveryRunId is required" });
        }
        const run = db
            .select()
            .from(discoveryRuns)
            .where(and(eq(discoveryRuns.id, toId(discoveryRunId)), eq(discoveryRuns.projectId, toId(projectId))))
            .get();
        if (!run)
            return reply.status(404).send({ error: "Discovery run not found" });
        const rawNormalizedApprovedUrls = approvedUrls
            .map((url) => normalizeUrl(url)?.url)
            .filter((url) => Boolean(url));
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
            cookieBannerHandling: body.cookieBannerHandling ?? "auto",
            renderInteractiveHighlights: false,
            captureOnlyVisibleElements: true,
            highlightAllElements: false,
            fullRefresh: body.fullRefresh === true,
            projectId,
            auth: body.auth,
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
        const { url } = request.body;
        if (!url)
            return reply.status(400).send({ error: "URL is required" });
        try {
            return await openAuthSession(url);
        }
        catch (error) {
            server.log.error(`Error in auth session: ${error}`);
            return reply.status(500).send({
                error: "Failed to open authentication session",
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });
    // ── Pages ─────────────────────────────────────────────────────────────────
    server.get("/pages/by-ids", async (request, reply) => {
        const { projectId, ids } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        let idList = [];
        if (Array.isArray(ids)) {
            idList = ids.filter((v) => typeof v === "string");
        }
        else if (typeof ids === "string") {
            idList = ids.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
        }
        if (idList.length === 0)
            return { pages: [], elements: [] };
        try {
            return await buildManifestForPageIds(projectId, idList);
        }
        catch (error) {
            request.log.error(`Failed to fetch pages by ids: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to fetch pages" });
        }
    });
    server.get("/page", async (request, reply) => {
        const { projectId, url, pageId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
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
                    conditions.push(eq(pages.url, candidates[0]));
                }
                else {
                    conditions.push(or(...candidates.map((c) => eq(pages.url, c))));
                }
            }
            const pageRow = db
                .select()
                .from(pages)
                .where(and(...conditions))
                .get();
            if (!pageRow)
                return reply.status(404).send({ error: "Page not found" });
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
        const { projectId, pageId, url } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        const projectNumId = toId(projectId);
        let resolvedPageId = null;
        if (pageId) {
            if (!isValidId(pageId))
                return reply.status(400).send({ error: "Invalid pageId" });
            resolvedPageId = toId(pageId);
        }
        else if (url) {
            const pageRow = db
                .select({ id: pages.id })
                .from(pages)
                .where(and(eq(pages.projectId, projectNumId), eq(pages.url, url)))
                .get();
            if (!pageRow)
                return reply.status(404).send({ error: "Page not found" });
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
        const { projectId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
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
        const cssVariables = {};
        const tokens = new Set();
        const pageSummaries = pageRows.map((page) => {
            const pageStyles = parseJson(page.globalStyles, {});
            if (pageStyles.cssVariables) {
                for (const [key, value] of Object.entries(pageStyles.cssVariables)) {
                    cssVariables[key] = value;
                }
            }
            if (pageStyles.tokens) {
                for (const token of pageStyles.tokens)
                    tokens.add(token);
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
        const { projectId, elementId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!elementId)
            return reply.status(400).send({ error: "elementId is required" });
        if (!isValidId(projectId) || !isValidId(elementId)) {
            return reply.status(400).send({ error: "Invalid projectId or elementId" });
        }
        const elementRow = db
            .select()
            .from(elements)
            .where(and(eq(elements.id, toId(elementId)), eq(elements.projectId, toId(projectId))))
            .get();
        if (!elementRow)
            return reply.status(404).send({ error: "Element not found" });
        return { element: serializeElement(elementRow) };
    });
    // ── Inventory ─────────────────────────────────────────────────────────────
    server.post("/inventory/prepare/:projectId", async (request, reply) => {
        const { projectId } = request.params;
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
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
        const { projectId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        try {
            const payload = await getWorkspaceStatus(projectId);
            devValidate("InventoryOverview", InventoryOverviewSchema, payload);
            return payload;
        }
        catch (error) {
            request.log.error(`Failed to build inventory overview: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to build inventory overview" });
        }
    });
    server.get("/mapping-inputs/:projectId", async (request, reply) => {
        const { projectId } = request.params;
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        try {
            return getMappingInputs(projectId);
        }
        catch (error) {
            request.log.error(`Failed to load mapping inputs: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to load mapping inputs" });
        }
    });
    server.get("/mapping-context/:projectId", async (request, reply) => {
        const { projectId } = request.params;
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        try {
            const payload = await getMappingContextSummary(projectId);
            devValidate("MappingContextSummary", MappingContextSummarySchema, payload);
            return payload;
        }
        catch (error) {
            request.log.error(`Failed to load mapping context summary: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to load mapping context summary" });
        }
    });
    server.get("/mapping-suggestions/:projectId", async (request, reply) => {
        const { projectId } = request.params;
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        try {
            const mappingContextPath = path.join(defaultWorkspacePath(projectId), "mapping-context");
            const payload = await deriveSuggestionsFromDisk(mappingContextPath, projectId, new Date().toISOString());
            devValidate("MappingSuggestions", MappingSuggestionsSchema, payload);
            return payload;
        }
        catch (error) {
            request.log.error(`Failed to load mapping suggestions: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to load mapping suggestions" });
        }
    });
    server.post("/mapping-inputs/:projectId", async (request, reply) => {
        const { projectId } = request.params;
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        try {
            return saveMappingInputs(projectId, request.body);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Failed to save mapping inputs";
            if (message.includes("branchName is required")) {
                return reply.status(400).send({ error: message });
            }
            request.log.error(`Failed to save mapping inputs: ${message}`);
            return reply.status(500).send({ error: "Failed to save mapping inputs" });
        }
    });
    server.get("/inventory/decisions/:projectId", async (request, reply) => {
        const { projectId } = request.params;
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        try {
            const payload = await getWorkspaceDecisionPayload(projectId);
            devValidate("InventoryDecisions", InventoryDecisionsSchema, payload);
            return payload;
        }
        catch (error) {
            request.log.error(`Failed to load inventory decisions: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to load inventory decisions" });
        }
    });
    server.get("/inventory/render-data/:projectId", async (request, reply) => {
        const { projectId } = request.params;
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        try {
            const payload = await buildInventoryRenderData(projectId, requestBaseUrl(request));
            devValidate("InventoryRenderData", InventoryRenderDataSchema, payload);
            return payload;
        }
        catch (error) {
            request.log.error(`Failed to load inventory render data: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to load inventory render data" });
        }
    });
    server.get("/inventory/tokens", async (request, reply) => {
        const { projectId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        try {
            return await getInventoryTokens(projectId);
        }
        catch (error) {
            request.log.error(`Failed to build inventory tokens: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to build inventory tokens" });
        }
    });
    // ── Flows ─────────────────────────────────────────────────────────────────
    server.get("/flows", async (request, reply) => {
        const { projectId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        const pid = toId(projectId);
        const flowRows = db.select().from(flows).where(eq(flows.projectId, pid)).orderBy(desc(flows.updatedAt)).all();
        const result = await Promise.all(flowRows.map(async (flow) => {
            const steps = db.select().from(flowSteps).where(eq(flowSteps.flowId, flow.id)).orderBy(flowSteps.stepIndex).all();
            return {
                _id: String(flow.id),
                id: flow.id,
                projectId: String(flow.projectId),
                name: flow.name,
                description: flow.description,
                status: flow.status,
                stepCount: steps.length,
                steps: steps.map((s) => serializeFlowStep(s)),
                createdAt: flow.createdAt.toISOString(),
                updatedAt: flow.updatedAt.toISOString(),
            };
        }));
        return { flows: result };
    });
    server.post("/flows", async (request, reply) => {
        const { projectId, name, description } = request.body;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        if (!name || !name.trim())
            return reply.status(400).send({ error: "name is required" });
        const now = new Date();
        const pid = toId(projectId);
        const [row] = db.insert(flows).values({
            projectId: pid,
            name: name.trim(),
            description: (description || "").trim(),
            status: "draft",
            createdAt: now,
            updatedAt: now,
        }).returning().all();
        return {
            flow: {
                _id: String(row.id),
                id: row.id,
                projectId: String(row.projectId),
                name: row.name,
                description: row.description,
                status: row.status,
                steps: [],
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
            },
        };
    });
    server.get("/flows/:flowId", async (request, reply) => {
        const { flowId } = request.params;
        if (!isValidId(flowId))
            return reply.status(400).send({ error: "Invalid flowId" });
        const fid = toId(flowId);
        const flow = db.select().from(flows).where(eq(flows.id, fid)).get();
        if (!flow)
            return reply.status(404).send({ error: "Flow not found" });
        const steps = db.select().from(flowSteps).where(eq(flowSteps.flowId, fid)).orderBy(flowSteps.stepIndex).all();
        return {
            flow: {
                _id: String(flow.id),
                id: flow.id,
                projectId: String(flow.projectId),
                name: flow.name,
                description: flow.description,
                status: flow.status,
                steps: steps.map(serializeFlowStep),
                createdAt: flow.createdAt.toISOString(),
                updatedAt: flow.updatedAt.toISOString(),
            },
        };
    });
    server.put("/flows/:flowId", async (request, reply) => {
        const { flowId } = request.params;
        if (!isValidId(flowId))
            return reply.status(400).send({ error: "Invalid flowId" });
        const fid = toId(flowId);
        const existing = db.select().from(flows).where(eq(flows.id, fid)).get();
        if (!existing)
            return reply.status(404).send({ error: "Flow not found" });
        const { name, description } = request.body;
        const updates = { updatedAt: new Date() };
        if (name !== undefined)
            updates.name = name.trim();
        if (description !== undefined)
            updates.description = description.trim();
        db.update(flows).set(updates).where(eq(flows.id, fid)).run();
        const updated = db.select().from(flows).where(eq(flows.id, fid)).get();
        const steps = db.select().from(flowSteps).where(eq(flowSteps.flowId, fid)).orderBy(flowSteps.stepIndex).all();
        return {
            flow: {
                _id: String(updated.id),
                id: updated.id,
                projectId: String(updated.projectId),
                name: updated.name,
                description: updated.description,
                status: updated.status,
                steps: steps.map(serializeFlowStep),
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
            },
        };
    });
    server.delete("/flows/:flowId", async (request, reply) => {
        const { flowId } = request.params;
        if (!isValidId(flowId))
            return reply.status(400).send({ error: "Invalid flowId" });
        const fid = toId(flowId);
        const existing = db.select().from(flows).where(eq(flows.id, fid)).get();
        if (!existing)
            return reply.status(404).send({ error: "Flow not found" });
        db.delete(flowSteps).where(eq(flowSteps.flowId, fid)).run();
        db.delete(flows).where(eq(flows.id, fid)).run();
        return { ok: true, deletedId: flowId };
    });
    server.post("/flows/:flowId/steps", async (request, reply) => {
        const { flowId } = request.params;
        if (!isValidId(flowId))
            return reply.status(400).send({ error: "Invalid flowId" });
        const fid = toId(flowId);
        const flow = db.select().from(flows).where(eq(flows.id, fid)).get();
        if (!flow)
            return reply.status(404).send({ error: "Flow not found" });
        const body = request.body;
        if (!body.sourcePageId)
            return reply.status(400).send({ error: "sourcePageId is required" });
        if (!body.sourceUrl)
            return reply.status(400).send({ error: "sourceUrl is required" });
        if (!body.actionKind)
            return reply.status(400).send({ error: "actionKind is required" });
        if (!isValidId(body.sourcePageId))
            return reply.status(400).send({ error: "Invalid sourcePageId" });
        if (!pageBelongsToProject(body.sourcePageId, flow.projectId)) {
            return reply.status(400).send({ error: "sourcePageId does not belong to this flow's project" });
        }
        if (body.targetPageId) {
            if (!isValidId(body.targetPageId))
                return reply.status(400).send({ error: "Invalid targetPageId" });
            if (!pageBelongsToProject(body.targetPageId, flow.projectId)) {
                return reply.status(400).send({ error: "targetPageId does not belong to this flow's project" });
            }
        }
        const existingSteps = db.select().from(flowSteps).where(eq(flowSteps.flowId, fid)).orderBy(flowSteps.stepIndex).all();
        const nextIndex = existingSteps.length > 0 ? Math.max(...existingSteps.map((s) => s.stepIndex)) + 1 : 0;
        const now = new Date();
        const values = {
            flowId: fid,
            stepIndex: nextIndex,
            sourcePageId: toId(body.sourcePageId),
            sourceUrl: body.sourceUrl,
            actionKind: body.actionKind,
            createdAt: now,
            updatedAt: now,
        };
        if (body.elementId && isValidId(body.elementId))
            values.elementId = toId(body.elementId);
        if (body.elementSelector)
            values.elementSelector = body.elementSelector;
        if (body.elementText)
            values.elementText = body.elementText;
        if (body.elementBbox)
            values.elementBboxJson = JSON.stringify(body.elementBbox);
        if (body.targetUrl)
            values.targetUrl = body.targetUrl;
        if (body.targetPageId)
            values.targetPageId = toId(body.targetPageId);
        const [row] = db.insert(flowSteps).values(values).returning().all();
        db.update(flows).set({ updatedAt: now }).where(eq(flows.id, fid)).run();
        return { step: serializeFlowStep(row) };
    });
    server.put("/flows/:flowId/steps/:stepId", async (request, reply) => {
        const { flowId, stepId } = request.params;
        if (!isValidId(flowId))
            return reply.status(400).send({ error: "Invalid flowId" });
        if (!isValidId(stepId))
            return reply.status(400).send({ error: "Invalid stepId" });
        const fid = toId(flowId);
        const sid = toId(stepId);
        const step = db.select().from(flowSteps).where(and(eq(flowSteps.flowId, fid), eq(flowSteps.id, sid))).get();
        if (!step)
            return reply.status(404).send({ error: "Step not found" });
        const body = request.body;
        const updates = { updatedAt: new Date() };
        if (body.stepIndex !== undefined)
            updates.stepIndex = body.stepIndex;
        if (body.elementSelector !== undefined)
            updates.elementSelector = body.elementSelector;
        if (body.elementText !== undefined)
            updates.elementText = body.elementText;
        if (body.targetUrl !== undefined)
            updates.targetUrl = body.targetUrl;
        if (body.targetPageId !== undefined) {
            if (body.targetPageId === null || body.targetPageId === "") {
                updates.targetPageId = null;
            }
            else if (typeof body.targetPageId === "string" && isValidId(body.targetPageId)) {
                const flow = db.select().from(flows).where(eq(flows.id, fid)).get();
                if (!flow || !pageBelongsToProject(body.targetPageId, flow.projectId)) {
                    return reply.status(400).send({ error: "targetPageId does not belong to this flow's project" });
                }
                updates.targetPageId = toId(body.targetPageId);
            }
            else {
                return reply.status(400).send({ error: "Invalid targetPageId" });
            }
        }
        db.update(flowSteps).set(updates).where(eq(flowSteps.id, sid)).run();
        const updated = db.select().from(flowSteps).where(eq(flowSteps.id, sid)).get();
        db.update(flows).set({ updatedAt: new Date() }).where(eq(flows.id, fid)).run();
        return { step: serializeFlowStep(updated) };
    });
    server.delete("/flows/:flowId/steps/:stepId", async (request, reply) => {
        const { flowId, stepId } = request.params;
        if (!isValidId(flowId))
            return reply.status(400).send({ error: "Invalid flowId" });
        if (!isValidId(stepId))
            return reply.status(400).send({ error: "Invalid stepId" });
        const fid = toId(flowId);
        const sid = toId(stepId);
        const step = db.select().from(flowSteps).where(and(eq(flowSteps.flowId, fid), eq(flowSteps.id, sid))).get();
        if (!step)
            return reply.status(404).send({ error: "Step not found" });
        db.delete(flowSteps).where(eq(flowSteps.id, sid)).run();
        const remaining = db.select().from(flowSteps).where(eq(flowSteps.flowId, fid)).orderBy(flowSteps.stepIndex).all();
        for (let i = 0; i < remaining.length; i++) {
            const item = remaining[i];
            if (item && item.stepIndex !== i) {
                db.update(flowSteps).set({ stepIndex: i, updatedAt: new Date() }).where(eq(flowSteps.id, item.id)).run();
            }
        }
        db.update(flows).set({ updatedAt: new Date() }).where(eq(flows.id, fid)).run();
        return { ok: true, deletedId: stepId };
    });
    // ── Discovery ─────────────────────────────────────────────────────────────
    server.post("/discovery/start", async (request, reply) => {
        const body = request.body;
        const { projectId, startUrl } = body;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        if (!startUrl)
            return reply.status(400).send({ error: "startUrl is required" });
        if (!projectExists(projectId))
            return reply.status(404).send({ error: "Project not found" });
        try {
            const result = await runDiscovery({
                projectId,
                startUrl,
                seedUrls: body.seedUrls,
                discoveryMode: body.discoveryMode,
                maxCandidates: body.maxCandidates,
                pageBudget: body.pageBudget,
                maxDepth: body.maxDepth,
                requestDelay: body.requestDelay,
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
                    depth: c.depth,
                })),
            };
        }
        catch (error) {
            request.log.error(`Discovery start failed: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Discovery failed" });
        }
    });
    server.get("/discovery/:runId", async (request, reply) => {
        const { runId } = request.params;
        if (!isValidId(runId))
            return reply.status(400).send({ error: "Invalid runId" });
        const run = db
            .select()
            .from(discoveryRuns)
            .where(eq(discoveryRuns.id, toId(runId)))
            .get();
        if (!run)
            return reply.status(404).send({ error: "Discovery run not found" });
        const candidates = db
            .select()
            .from(discoveryCandidates)
            .where(eq(discoveryCandidates.discoveryRunId, run.id))
            .all();
        const warnings = run.warningsJson ? JSON.parse(run.warningsJson) : [];
        return {
            discoveryRunId: String(run.id),
            projectId: String(run.projectId),
            status: run.status,
            startUrl: run.startUrl,
            summary: {
                totalCandidates: candidates.length,
                recommendedCount: candidates.filter((c) => c.isRecommended).length,
                approvedCount: candidates.filter((c) => c.isApproved).length,
                warnings,
                byPageType: candidates.reduce((acc, c) => {
                    acc[c.pageType] = (acc[c.pageType] ?? 0) + 1;
                    return acc;
                }, {}),
                byHost: candidates.reduce((acc, c) => {
                    acc[c.host] = (acc[c.host] ?? 0) + 1;
                    return acc;
                }, {}),
            },
            candidates: candidates.map((c) => ({
                id: String(c.id),
                url: c.url,
                normalizedUrl: c.normalizedUrl,
                host: c.host,
                pageType: c.pageType,
                patternKey: c.patternKey,
                score: c.score,
                reasons: JSON.parse(c.reasonsJson),
                source: c.source,
                depth: c.depth ?? undefined,
                isRecommended: Boolean(c.isRecommended),
                isApproved: Boolean(c.isApproved),
                isExcluded: Boolean(c.isExcluded),
            })),
        };
    });
    server.post("/discovery/:runId/approval", async (request, reply) => {
        const { runId } = request.params;
        const body = request.body;
        if (!isValidId(runId))
            return reply.status(400).send({ error: "Invalid runId" });
        try {
            return approveDiscoveryRun(runId, body);
        }
        catch (err) {
            if (err?.code === "NOT_FOUND")
                return reply.status(404).send({ error: "Discovery run not found" });
            throw err;
        }
    });
    return server;
}
