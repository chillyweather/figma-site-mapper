import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
export const connection = new Redis({ maxRetriesPerRequest: null });
export const crawlQueue = new Queue('crawl-jobs', { connection });
