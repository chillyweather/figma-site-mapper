import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { runCrawler } from "./crawler.js";
const processor = async (job) => {
    const { url, publicUrl, maxRequestsPerCrawl } = job.data;
    console.log(`👩‍🍳 Processing job ${job.id}: Crawling ${url}`);
    try {
        await runCrawler(url, publicUrl, maxRequestsPerCrawl);
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
