import "dotenv/config";
import "./logger.js"; // must be first — redirects console.* to pino
import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { connectDB } from "./db.js";
import { createJobDispatcher } from "./workers/jobDispatcher.js";
import { crawlJobHandler } from "./workers/handlers/crawlJobHandler.js";
import { inventoryPrepareHandler } from "./workers/handlers/inventoryPrepareHandler.js";
await connectDB();
const dispatch = createJobDispatcher({ "inventory-prepare": inventoryPrepareHandler }, crawlJobHandler);
const worker = new Worker("crawl-jobs", dispatch, {
    connection,
    autorun: true,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
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
