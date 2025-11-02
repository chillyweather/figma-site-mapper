import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { crawlQueue } from "./queue.js";
import { openAuthSession } from "./crawler.js";
import { Project } from "./models/Project.js";

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
    const manifestPath = path.join(
      __dirname,
      "..",
      "screenshots",
      `manifest-${jobId}.json`
    );

    const job = await crawlQueue.getJob(jobId);

    if (!job) {
      // Check if manifest file exists as fallback
      const fs = await import("fs/promises");
      try {
        await fs.access(manifestPath);
        // Manifest exists, assume job completed
        return {
          jobId,
          status: "completed",
          progress: 100,
          result: {
            manifestUrl: `http://localhost:3006/screenshots/manifest-${jobId}.json`,
          },
        };
      } catch {
        return reply.status(404).send({ error: "Job not found" });
      }
    }

    const state = await job.getState();
    const progress = job.progress as number;

    let status: string;
    let result: any = null;
    let detailedProgress: any = null;

    const jobData = job.data as any;
    if (jobData.progress) {
      detailedProgress = jobData.progress;
    }

    switch (state) {
      case "completed":
        status = "completed";
        result = {
          manifestUrl: `http://localhost:3006/screenshots/manifest-${jobId}.json`,
          detectInteractiveElements:
            jobData.detectInteractiveElements !== false,
        };
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
      result,
      detailedProgress,
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
      auth,
      styleExtraction,
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
      showBrowser?: boolean;
      detectInteractiveElements?: boolean;
      highlightAllElements?: boolean;
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
      reply.status(400).send({ error: "URL and publicUrl is required" });
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
      auth,
      styleExtraction,
    });

    return { message: "Crawl job successfully queued.", jobId: job.id };
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

  return server;
}
