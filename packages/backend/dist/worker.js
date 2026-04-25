import "dotenv/config";
import "./logger.js"; // must be first — redirects console.* to pino
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { connection } from "./queue.js";
import { runCrawler } from "./crawler.js";
import { connectDB, db } from "./db.js";
import { crawlRuns } from "./schema.js";
import { buildWorkspace } from "./services/workspace/index.js";
await connectDB();
const processor = async (job) => {
    if (job.data?.type === "inventory-prepare") {
        const { projectId } = job.data;
        if (!projectId) {
            throw new Error("Inventory prepare job is missing projectId");
        }
        console.log(`📦 Processing job ${job.id}: Building inventory workspace for project ${projectId}`);
        await job.updateData({
            ...job.data,
            progress: {
                stage: "building-workspace",
                progress: 10,
                timestamp: new Date().toISOString(),
            },
        });
        try {
            const result = await buildWorkspace(projectId, { verbose: true });
            await job.updateData({
                ...job.data,
                ...result,
                lastCompletedAt: new Date().toISOString(),
                progress: {
                    stage: "completed",
                    progress: 100,
                    timestamp: new Date().toISOString(),
                },
            });
            console.log(`✅ Finished inventory workspace job ${job.id}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Inventory workspace job ${job.id} failed:`, error);
            throw error;
        }
    }
    const { url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, fullRefresh, sampleSize, showBrowser, detectInteractiveElements, renderInteractiveHighlights, captureOnlyVisibleElements, highlightAllElements, projectId, auth, styleExtraction, approvedUrls, discoveryRunId, } = job.data;
    console.log(`👩‍🍳 Processing job ${job.id}: Crawling ${url}`);
    console.log(`📋 Job settings: maxDepth=${maxDepth}, defaultLanguageOnly=${defaultLanguageOnly}, fullRefresh=${fullRefresh}, sampleSize=${sampleSize}`);
    console.log(`🔗 Full job data:`, JSON.stringify(job.data, null, 2));
    if (auth) {
        console.log(`🔐 Authentication: ${auth.method}`);
    }
    if (styleExtraction?.enabled) {
        console.log(`🎨 Style Extraction: enabled (preset: ${styleExtraction.preset})`);
    }
    let crawlRunId;
    try {
        const projectNumId = projectId ? parseInt(projectId, 10) : null;
        if (projectNumId && !isNaN(projectNumId)) {
            const [row] = db
                .insert(crawlRuns)
                .values({
                projectId: projectNumId,
                jobId: String(job.id ?? ""),
                startUrl: url,
                settingsJson: JSON.stringify({
                    maxRequestsPerCrawl,
                    deviceScaleFactor,
                    delay,
                    requestDelay,
                    maxDepth,
                    defaultLanguageOnly,
                    sampleSize,
                    detectInteractiveElements,
                    renderInteractiveHighlights,
                    captureOnlyVisibleElements,
                    highlightAllElements,
                    fullRefresh,
                }),
                discoveryRunId: discoveryRunId ? parseInt(discoveryRunId, 10) : null,
                approvedUrlsJson: approvedUrls && Array.isArray(approvedUrls) ? JSON.stringify(approvedUrls) : null,
                status: "running",
                startedAt: new Date(),
            })
                .returning()
                .all();
            crawlRunId = row?.id;
        }
        const result = await runCrawler(url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor || 1, job.id, delay || 0, requestDelay || 1000, maxDepth === 0 ? undefined : maxDepth, defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements, captureOnlyVisibleElements, highlightAllElements, fullRefresh === true, projectId, auth, styleExtraction, crawlRunId, approvedUrls);
        if (crawlRunId) {
            db.update(crawlRuns)
                .set({
                status: "completed",
                pageIdsJson: JSON.stringify(result.visitedPageIds),
                pageCount: result.pageCount,
                elementCount: result.elementCount,
                completedAt: new Date(),
            })
                .where(eq(crawlRuns.id, crawlRunId))
                .run();
        }
        await job.updateData({
            ...job.data,
            visitedUrls: result.visitedUrls,
            visitedPageIds: result.visitedPageIds,
            pageCount: result.pageCount,
            lastCompletedAt: new Date().toISOString(),
        });
        console.log(`✅ Finished job ${job.id}`);
        return result;
    }
    catch (error) {
        if (crawlRunId) {
            db.update(crawlRuns)
                .set({ status: "failed", completedAt: new Date() })
                .where(eq(crawlRuns.id, crawlRunId))
                .run();
        }
        console.error(`❌ Job ${job.id} failed:`, error);
        throw error;
    }
};
const worker = new Worker("crawl-jobs", processor, {
    connection,
    autorun: true, // Keep worker running automatically
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 50 }, // Keep last 50 failed jobs
});
worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} has completed!`);
    console.log("👷 Worker ready for next job...");
});
worker.on("failed", (job, err) => {
    if (job) {
        console.error(`❌ Job ${job.id} has failed with error: ${err.message}`);
    }
    else {
        console.error(`An unknown job has failed with error: ${err.message}`);
    }
    console.log("👷 Worker ready for next job...");
});
worker.on("error", (err) => {
    console.error("Worker error:", err);
});
console.log("👷 Worker is listening for jobs...");
// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, closing worker...");
    await worker.close();
    process.exit(0);
});
process.on("SIGINT", async () => {
    console.log("SIGINT received, closing worker...");
    await worker.close();
    process.exit(0);
});
