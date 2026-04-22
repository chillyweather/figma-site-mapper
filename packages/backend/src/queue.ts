import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL;

export const connection = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: null })
  : new Redis({ maxRetriesPerRequest: null });

export const crawlQueue = new Queue('crawl-jobs', { connection });
