import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export const connection = new Redis();

export const crawlQueue = new Queue('crawl-jobs', { connection });
