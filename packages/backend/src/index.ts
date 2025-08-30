import Fastify from 'fastify'
import { crawlQueue } from './queue.js'
import cors from "@fastify/cors"
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const server = Fastify({
  logger: true
})

await server.register(cors, {
  origin: "*",
})

await server.register(fastifyStatic, {
  root: path.join(__dirname, "..", "static"),
  prefix: "/static/"
})

server.get('/', async (request, reply) => {
  return { hello: 'world' }
})

server.get("/status/:jobId", async (request, reply) => {
  const { jobId } = request.params as { jobId: string }

  return {
    jobId,
    status: "completed",
    progress: 100,
    result: {
      manifestUrl: "http://localhost:3006/static/mock-manifest.json"
    }
  }
})

server.post('/crawl', async (request, reply) => {
  //add validation
  const { url, publicUrl } = request.body as { url: string, publicUrl: string };

  if (!url || !publicUrl) {
    reply.status(400).send({ error: "URL and publicUrl is required" })
    return
  }

  const job = await crawlQueue.add("crawl", { url, publicUrl });

  return { message: "Crawl job successfully queued.", jobId: job.id }
})

const start = async () => {
  try {
    await server.listen({ port: 3006 })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()  
