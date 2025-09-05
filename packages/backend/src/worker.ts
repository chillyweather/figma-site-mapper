import { Worker, Job } from "bullmq";
import { connection } from "./queue.js";
import { runCrawler } from "./crawler.js";


const processor = async (job: Job) => {
  const { url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor } = job.data;
  console.log(`👩‍🍳 Processing job ${job.id}: Crawling ${url}`);

  try {
    await runCrawler(url, publicUrl, maxRequestsPerCrawl, deviceScaleFactor || 1, job.id)
    console.log(`✅ Finished job ${job.id}`)
  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error)
    throw error;
  }
}

const worker = new Worker("crawl-jobs", processor, { connection });

worker.on('completed', (job: Job) => {
  console.log(`✅ Job ${job.id} has completed!`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  if (job) {
    console.error(`❌ Job ${job.id} has failed with error: ${err.message}`);
  } else {
    console.error(`An unknown job has failed with error: ${err.message}`);
  }
});

console.log('👷 Worker is listening for jobs...')
