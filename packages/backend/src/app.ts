import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { crawlQueue } from "./queue.js";
import { openAuthSession } from "./crawler.js";
import { Types } from "mongoose";
import { Project } from "./models/Project.js";
import { Page } from "./models/Page.js";
import { Element } from "./models/Element.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: true,
  });

  await server.register(cors, {
    origin: "*",
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

  server.get("/", async () => {
    return { hello: "world" };
  });

  // Project endpoints
  server.get("/projects", async () => {
    const projects = await Project.find().sort({ createdAt: -1 });
    return { projects };
  });

  server.post("/projects", async (request, reply) => {
    const { name } = request.body as { name: string };

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: "Project name is required" });
    }

    const project = new Project({ name: name.trim() });
    await project.save();
    return { project };
  });

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
    if (!job) {
      return reply.status(404).send({ error: "Job not found" });
    }

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

    if (!job) {
      return reply.status(404).send({ error: "Job not found" });
    }

    const state = await job.getState();
    const progress = job.progress as number;

    let status: string;
    let detailedProgress: any = null;

    const jobData = job.data as any;
    if (jobData.progress) {
      detailedProgress = jobData.progress;
    }

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
      default:
        status = "pending";
    }

    return {
      jobId,
      status,
      progress:
        detailedProgress || (typeof progress === "number" ? progress : 0),
      detailedProgress,
      result: {
        projectId: jobData.projectId ?? null,
        detectInteractiveElements: jobData.detectInteractiveElements !== false,
        startUrl: jobData.url ?? null,
        fullRefresh: jobData.fullRefresh === true,
      },
    };
  });

  server.post("/crawl", async (request, reply) => {
    const {
      url,
      publicUrl,
      maxRequestsPerCrawl,
      deviceScaleFactor,
      delay,
      requestDelay,
      maxDepth,
      defaultLanguageOnly,
      sampleSize,
      showBrowser,
      detectInteractiveElements,
      highlightAllElements,
      projectId,
      auth,
      styleExtraction,
      fullRefresh,
    } = request.body as {
      url: string;
      publicUrl: string;
      maxRequestsPerCrawl?: number;
      deviceScaleFactor?: number;
      delay?: number;
      requestDelay?: number;
      maxDepth?: number;
      defaultLanguageOnly?: boolean;
      sampleSize?: number;
      fullRefresh?: boolean;
      showBrowser?: boolean;
      detectInteractiveElements?: boolean;
      highlightAllElements?: boolean;
      projectId?: string;
      auth?: {
        method: "credentials" | "cookies";
        loginUrl?: string;
        username?: string;
        password?: string;
        cookies?: Array<{ name: string; value: string }>;
      };
      styleExtraction?: {
        enabled: boolean;
        preset: string;
        extractInteractiveElements: boolean;
        extractStructuralElements: boolean;
        extractTextElements: boolean;
        extractFormElements: boolean;
        extractMediaElements: boolean;
        extractColors: boolean;
        extractTypography: boolean;
        extractSpacing: boolean;
        extractLayout: boolean;
        extractBorders: boolean;
        includeSelectors: boolean;
        includeComputedStyles: boolean;
      };
    };

    if (!url || !publicUrl) {
      reply.status(400).send({ error: "URL and publicUrl are required" });
      return;
    }

    if (!projectId) {
      reply.status(400).send({ error: "projectId is required" });
      return;
    }

    if (!Types.ObjectId.isValid(projectId)) {
      reply.status(400).send({ error: "Invalid projectId" });
      return;
    }

    const projectExists = await Project.exists({ _id: projectId });
    if (!projectExists) {
      reply.status(404).send({ error: "Project not found" });
      return;
    }

    const job = await crawlQueue.add("crawl", {
      url,
      publicUrl,
      maxRequestsPerCrawl,
      deviceScaleFactor: deviceScaleFactor || 1,
      delay: delay || 0,
      requestDelay: requestDelay || 1000,
      maxDepth: maxDepth === undefined ? 0 : maxDepth,
      defaultLanguageOnly,
      sampleSize,
      showBrowser,
      detectInteractiveElements: detectInteractiveElements !== false,
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
      url,
      publicUrl,
      projectId,
      deviceScaleFactor,
      delay,
      requestDelay,
      auth,
      styleExtraction,
    } = request.body as {
      url: string;
      publicUrl: string;
      projectId?: string;
      deviceScaleFactor?: number;
      delay?: number;
      requestDelay?: number;
      auth?: {
        method: "credentials" | "cookies";
        loginUrl?: string;
        username?: string;
        password?: string;
        cookies?: Array<{ name: string; value: string }>;
      };
      styleExtraction?: {
        enabled: boolean;
        preset: string;
        extractInteractiveElements: boolean;
        extractStructuralElements: boolean;
        extractTextElements: boolean;
        extractFormElements: boolean;
        extractMediaElements: boolean;
        extractColors: boolean;
        extractTypography: boolean;
        extractSpacing: boolean;
        extractLayout: boolean;
        extractBorders: boolean;
        includeSelectors: boolean;
        includeComputedStyles: boolean;
      };
    };

    if (!url || !publicUrl) {
      reply.status(400).send({ error: "URL and publicUrl are required" });
      return;
    }

    if (!projectId) {
      reply.status(400).send({ error: "projectId is required" });
      return;
    }

    if (!Types.ObjectId.isValid(projectId)) {
      reply.status(400).send({ error: "Invalid projectId" });
      return;
    }

    const projectExists = await Project.exists({ _id: projectId });
    if (!projectExists) {
      reply.status(404).send({ error: "Project not found" });
      return;
    }

    const job = await crawlQueue.add("recrawl-page", {
      url,
      publicUrl,
      maxRequestsPerCrawl: 1,
      deviceScaleFactor: deviceScaleFactor || 1,
      delay: delay || 0,
      requestDelay: requestDelay || 1000,
      maxDepth: 0,
      defaultLanguageOnly: false,
      sampleSize: 0,
      showBrowser: false,
      detectInteractiveElements: true,
      highlightAllElements: false,
      projectId,
      auth,
      styleExtraction,
    });

    return { message: "Recrawl job queued", jobId: job.id };
  });

  server.post("/auth-session", async (request, reply) => {
    const { url } = request.body as { url: string };

    if (!url) {
      reply.status(400).send({ error: "URL is required" });
      return;
    }

    try {
      const result = await openAuthSession(url);
      return result;
    } catch (error) {
      server.log.error(`Error in auth session: ${error}`);
      return reply.status(500).send({
        error: "Failed to open authentication session",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  server.get("/page", async (request, reply) => {
    const { projectId, url, pageId } = request.query as {
      projectId?: string;
      url?: string;
      pageId?: string;
    };

    if (!projectId) {
      reply.status(400).send({ error: "projectId is required" });
      return;
    }

    if (!Types.ObjectId.isValid(projectId)) {
      reply.status(400).send({ error: "Invalid projectId" });
      return;
    }

    const projectObjectId = new Types.ObjectId(projectId);

    if (url || pageId) {
      const query: Record<string, unknown> = { projectId: projectObjectId };
      if (url) {
        query.url = url;
      }
      if (pageId) {
        if (!Types.ObjectId.isValid(pageId)) {
          reply.status(400).send({ error: "Invalid pageId" });
          return;
        }
        query._id = new Types.ObjectId(pageId);
      }

      const pageDoc = await Page.findOne(query);
      if (!pageDoc) {
        return reply.status(404).send({ error: "Page not found" });
      }

      return { page: pageDoc };
    }

    const pages = await Page.find({ projectId: projectObjectId }).sort({
      createdAt: -1,
    });
    return { pages };
  });

  server.get("/elements", async (request, reply) => {
    const { projectId, pageId, url } = request.query as {
      projectId?: string;
      pageId?: string;
      url?: string;
    };

    if (!projectId) {
      reply.status(400).send({ error: "projectId is required" });
      return;
    }

    if (!Types.ObjectId.isValid(projectId)) {
      reply.status(400).send({ error: "Invalid projectId" });
      return;
    }

    const projectObjectId = new Types.ObjectId(projectId);

    let resolvedPageId: Types.ObjectId | null = null;

    if (pageId) {
      if (!Types.ObjectId.isValid(pageId)) {
        reply.status(400).send({ error: "Invalid pageId" });
        return;
      }
      resolvedPageId = new Types.ObjectId(pageId);
    } else if (url) {
      const pageDoc = await Page.findOne({
        projectId: projectObjectId,
        url,
      }).select({ _id: 1 });

      if (!pageDoc) {
        return reply.status(404).send({ error: "Page not found" });
      }

      resolvedPageId = pageDoc._id as Types.ObjectId;
    }

    const query: Record<string, unknown> = {
      projectId: projectObjectId,
    };

    if (resolvedPageId) {
      query.pageId = resolvedPageId;
    }

    const elements = await Element.find(query).sort({ createdAt: 1 });
    return { elements };
  });

  server.get("/styles/global", async (request, reply) => {
    const { projectId } = request.query as { projectId?: string };

    if (!projectId) {
      reply.status(400).send({ error: "projectId is required" });
      return;
    }

    if (!Types.ObjectId.isValid(projectId)) {
      reply.status(400).send({ error: "Invalid projectId" });
      return;
    }

    const projectObjectId = new Types.ObjectId(projectId);

    const pages = await Page.find({ projectId: projectObjectId }).select({
      url: 1,
      title: 1,
      globalStyles: 1,
    });

    const cssVariables: Record<string, string> = {};
    const tokens = new Set<string>();

    const pageSummaries = pages.map((page) => {
      const pageStyles = (page.globalStyles ?? {}) as {
        cssVariables?: Record<string, string>;
        tokens?: string[];
      };

      if (pageStyles.cssVariables) {
        for (const [key, value] of Object.entries(pageStyles.cssVariables)) {
          cssVariables[key] = value;
        }
      }

      if (pageStyles.tokens) {
        for (const token of pageStyles.tokens) {
          tokens.add(token);
        }
      }

      return {
        pageId: page._id,
        url: page.url,
        title: page.title,
        cssVariableCount: pageStyles.cssVariables
          ? Object.keys(pageStyles.cssVariables).length
          : 0,
        tokenCount: pageStyles.tokens ? pageStyles.tokens.length : 0,
      };
    });

    return {
      cssVariables,
      tokens: Array.from(tokens).sort(),
      pages: pageSummaries,
    };
  });

  server.get("/styles/element", async (request, reply) => {
    const { projectId, elementId } = request.query as {
      projectId?: string;
      elementId?: string;
    };

    if (!projectId) {
      reply.status(400).send({ error: "projectId is required" });
      return;
    }

    if (!elementId) {
      reply.status(400).send({ error: "elementId is required" });
      return;
    }

    if (
      !Types.ObjectId.isValid(projectId) ||
      !Types.ObjectId.isValid(elementId)
    ) {
      reply.status(400).send({ error: "Invalid projectId or elementId" });
      return;
    }

    const projectObjectId = new Types.ObjectId(projectId);
    const elementObjectId = new Types.ObjectId(elementId);

    const element = await Element.findOne({
      _id: elementObjectId,
      projectId: projectObjectId,
    });

    if (!element) {
      return reply.status(404).send({ error: "Element not found" });
    }

    return { element };
  });

  return server;
}
