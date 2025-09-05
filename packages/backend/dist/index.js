import Fastify from 'fastify';
import { crawlQueue } from './queue.js';
import cors from "@fastify/cors";
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const server = Fastify({
    logger: true
});
await server.register(cors, {
    origin: "*",
});
await server.register(fastifyStatic, {
    root: path.join(__dirname, "..", "static"),
    prefix: "/static/"
});
await server.register(async function (fastify) {
    await fastify.register(fastifyStatic, {
        root: path.join(__dirname, "..", "screenshots"),
        prefix: "/screenshots/"
    });
});
server.get('/', async (request, reply) => {
    return { hello: 'world' };
});
server.get("/status/:jobId", async (request, reply) => {
    const { jobId } = request.params;
    const manifestPath = path.join(__dirname, "..", "screenshots", "manifest.json");
    try {
        const job = await crawlQueue.getJob(jobId);
        if (!job) {
            // Check if manifest file exists as fallback
            const fs = await import('fs/promises');
            try {
                await fs.access(manifestPath);
                // Manifest exists, assume job completed
                return {
                    jobId,
                    status: 'completed',
                    progress: 100,
                    result: {
                        manifestUrl: `http://localhost:3006/screenshots/manifest.json`
                    }
                };
            }
            catch {
                return reply.status(404).send({ error: "Job not found" });
            }
        }
        const state = await job.getState();
        const progress = job.progress;
        let status;
        let result = null;
        switch (state) {
            case 'completed':
                status = 'completed';
                result = {
                    manifestUrl: `http://localhost:3006/screenshots/manifest.json`
                };
                break;
            case 'failed':
                status = 'failed';
                break;
            case 'active':
                status = 'processing';
                break;
            default:
                status = 'pending';
        }
        return {
            jobId,
            status,
            progress: typeof progress === 'number' ? progress : 0,
            result
        };
    }
    catch (error) {
        server.log.error(`Error getting job status: ${error}`);
        return reply.status(500).send({ error: "Internal server error" });
    }
});
server.post('/crawl', async (request, reply) => {
    //add validation
    const { url, publicUrl, maxRequestsPerCrawl } = request.body;
    if (!url || !publicUrl) {
        reply.status(400).send({ error: "URL and publicUrl is required" });
        return;
    }
    const job = await crawlQueue.add("crawl", { url, publicUrl, maxRequestsPerCrawl });
    return { message: "Crawl job successfully queued.", jobId: job.id };
});
const start = async () => {
    try {
        await server.listen({ port: 3006 });
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
