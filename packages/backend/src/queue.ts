import { Queue } from "bullmq";
import Redis from "ioredis";

const connection = new Redis();

export const crawlQueue = new Queue("crawl-jobs", { connection })
