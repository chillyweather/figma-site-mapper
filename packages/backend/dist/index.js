import Fastify from "fastify";
import { crawlQueue } from "./queue.js";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
server.get("/", async (request, reply) => {
    return { hello: "world" };
});
server.post("/progress/:jobId", async (request, reply) => {
    const { jobId } = request.params;
    const { stage, currentPage, totalPages, currentUrl, progress } = request.body;
    try {
        const job = await crawlQueue.getJob(jobId);
        if (!job) {
            return reply.status(404).send({ error: "Job not found" });
        }
        // Store progress data in job data
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
    }
    catch (error) {
        server.log.error(`Error updating progress: ${error}`);
        return reply.status(500).send({ error: "Internal server error" });
    }
});
server.get("/status/:jobId", async (request, reply) => {
    const { jobId } = request.params;
    const manifestPath = path.join(__dirname, "..", "screenshots", `manifest-${jobId}.json`);
    try {
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
            }
            catch {
                return reply.status(404).send({ error: "Job not found" });
            }
        }
        const state = await job.getState();
        const progress = job.progress;
        let status;
        let result = null;
        let detailedProgress = null;
        // Get detailed progress from job data
        const jobData = job.data;
        if (jobData.progress) {
            detailedProgress = jobData.progress;
        }
        switch (state) {
            case "completed":
                status = "completed";
                result = {
                    manifestUrl: `http://localhost:3006/screenshots/manifest-${jobId}.json`,
                    detectInteractiveElements: jobData.detectInteractiveElements !== false,
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
            progress: detailedProgress || (typeof progress === "number" ? progress : 0),
            result,
            detailedProgress,
        };
    }
    catch (error) {
        server.log.error(`Error getting job status: ${error}`);
        return reply.status(500).send({ error: "Internal server error" });
    }
});
server.post("/crawl", async (request, reply) => {
    //add validation
    const { url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements, captureOnlyVisibleElements, auth, } = request.body;
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
        maxDepth: maxDepth === undefined ? 0 : maxDepth, // 0 means no limit, undefined defaults to no limit
        defaultLanguageOnly: defaultLanguageOnly !== false, // Default to true
        sampleSize: sampleSize === undefined ? 3 : sampleSize, // 0 means no limit
        showBrowser: showBrowser !== false, // Default to false (headless)
        detectInteractiveElements: detectInteractiveElements !== false, // Default to true
        captureOnlyVisibleElements: captureOnlyVisibleElements !== false, // Default to true
        auth,
    });
    return { message: "Crawl job successfully queued.", jobId: job.id };
});
server.post("/auth-session", async (request, reply) => {
    const { url } = request.body;
    if (!url) {
        reply.status(400).send({ error: "URL is required" });
        return;
    }
    try {
        // Import the auth session function
        const { openAuthSession } = await import("./crawler.js");
        const cookies = await openAuthSession(url);
        return {
            message: "Authentication session completed",
            cookies: cookies,
            count: cookies.length
        };
    }
    catch (error) {
        server.log.error(`Error in auth session: ${error}`);
        return reply.status(500).send({
            error: "Authentication session failed",
            message: error instanceof Error ? error.message : String(error)
        });
    }
});
const start = async () => {
    try {
        await server.listen({ port: 3006 });
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
