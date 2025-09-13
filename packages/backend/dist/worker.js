import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { runCrawler } from "./crawler.js";
const processor = async (job) => {
    const { url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize } = job.data;
    console.log(`👩‍🍳 Processing job ${job.id}: Crawling ${url}`);
    console.log(`📋 Job settings: maxDepth=${maxDepth}, defaultLanguageOnly=${defaultLanguageOnly}, sampleSize=${sampleSize}`);
    try {
        await runCrawler(url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor || 1, job.id, delay || 0, requestDelay || 1000, maxDepth === 0 ? undefined : maxDepth, defaultLanguageOnly, sampleSize === 0 ? undefined : sampleSize);
        console.log(`✅ Finished job ${job.id}`);
    }
    catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error);
        throw error;
    }
};
const worker = new Worker("crawl-jobs", processor, { connection });
worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} has completed!`);
});
worker.on('failed', (job, err) => {
    if (job) {
        console.error(`❌ Job ${job.id} has failed with error: ${err.message}`);
    }
    else {
        console.error(`An unknown job has failed with error: ${err.message}`);
    }
});
console.log('👷 Worker is listening for jobs...');
