import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { runCrawler } from "./crawler.js";
const processor = async (job) => {
    const { url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements, auth } = job.data;
    console.log(`👩‍🍳 Processing job ${job.id}: Crawling ${url}`);
    console.log(`📋 Job settings: maxDepth=${maxDepth}, defaultLanguageOnly=${defaultLanguageOnly}, sampleSize=${sampleSize}`);
    console.log(`🔗 Full job data:`, JSON.stringify(job.data, null, 2));
    if (auth) {
        console.log(`🔐 Authentication: ${auth.method}`);
    }
    try {
        await runCrawler(url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor || 1, job.id, delay || 0, requestDelay || 1000, maxDepth === 0 ? undefined : maxDepth, defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements, auth);
        console.log(`✅ Finished job ${job.id}`);
    }
    catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error);
        throw error;
    }
};
const worker = new Worker("crawl-jobs", processor, {
    connection,
    autorun: true, // Keep worker running automatically
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 50 } // Keep last 50 failed jobs
});
worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} has completed!`);
    console.log('👷 Worker ready for next job...');
});
worker.on('failed', (job, err) => {
    if (job) {
        console.error(`❌ Job ${job.id} has failed with error: ${err.message}`);
    }
    else {
        console.error(`An unknown job has failed with error: ${err.message}`);
    }
    console.log('👷 Worker ready for next job...');
});
worker.on('error', (err) => {
    console.error('Worker error:', err);
});
console.log('👷 Worker is listening for jobs...');
// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing worker...');
    await worker.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, closing worker...');
    await worker.close();
    process.exit(0);
});
