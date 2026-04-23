import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { eq, and, or, desc } from "drizzle-orm";
import { db } from "./db.js";
import { projects, pages, elements } from "./schema.js";
import { crawlQueue } from "./queue.js";
import { openAuthSession } from "./crawler.js";
import { fastifyLoggerConfig } from "./logger.js";
import { buildManifestForPageIds, serializePage, serializeElement } from "./services/manifestBuilder.js";
import { getInventoryOverview, getInventoryTokens, getInventoryClusters, getInventoryInconsistencies, getInventoryRegions, } from "./services/inventory/index.js";
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
function getUrlLookupCandidates(rawUrl) {
    const candidates = new Set();
    const add = (value) => {
        if (value && value.trim())
            candidates.add(value.trim());
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
            }
            else {
                parsed.pathname = `${originalPath}/`;
            }
            add(parsed.toString());
        }
    }
    catch {
        // Keep the raw candidate only for non-URL values.
    }
    return Array.from(candidates);
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
        db.delete(elements).where(eq(elements.projectId, pid)).run();
        db.delete(pages).where(eq(pages.projectId, pid)).run();
        db.delete(projects).where(eq(projects.id, pid)).run();
        return { ok: true, deletedId: id };
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
        return {
            jobId,
            status,
            progress: detailedProgress ?? (typeof job.progress === "number" ? job.progress : 0),
            detailedProgress,
            result: {
                projectId: jobData.projectId ?? null,
                detectInteractiveElements: jobData.detectInteractiveElements !== false,
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
        const { url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements, highlightAllElements, projectId, auth, styleExtraction, fullRefresh, captureOnlyVisibleElements, } = request.body;
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
        const { url, publicUrl, projectId, deviceScaleFactor, delay, requestDelay, auth, styleExtraction, captureOnlyVisibleElements, } = request.body;
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
            const pageStyles = (page.globalStyles ? JSON.parse(page.globalStyles) : {});
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
    server.get("/inventory/overview", async (request, reply) => {
        const { projectId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        try {
            return await getInventoryOverview(projectId);
        }
        catch (error) {
            request.log.error(`Failed to build inventory overview: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to build inventory overview" });
        }
    });
    server.get("/inventory/tokens", async (request, reply) => {
        const { projectId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        try {
            return await getInventoryTokens(projectId);
        }
        catch (error) {
            request.log.error(`Failed to build inventory tokens: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to build inventory tokens" });
        }
    });
    server.get("/inventory/clusters", async (request, reply) => {
        const { projectId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        try {
            return await getInventoryClusters(projectId);
        }
        catch (error) {
            request.log.error(`Failed to build inventory clusters: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to build inventory clusters" });
        }
    });
    server.get("/inventory/inconsistencies", async (request, reply) => {
        const { projectId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        try {
            return await getInventoryInconsistencies(projectId);
        }
        catch (error) {
            request.log.error(`Failed to build inventory inconsistencies: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to build inventory inconsistencies" });
        }
    });
    server.get("/inventory/regions", async (request, reply) => {
        const { projectId } = request.query;
        if (!projectId)
            return reply.status(400).send({ error: "projectId is required" });
        if (!isValidId(projectId))
            return reply.status(400).send({ error: "Invalid projectId" });
        try {
            return await getInventoryRegions(projectId);
        }
        catch (error) {
            request.log.error(`Failed to build inventory regions: ${error instanceof Error ? error.message : String(error)}`);
            return reply.status(500).send({ error: "Failed to build inventory regions" });
        }
    });
    return server;
}
