import Fastify from 'fastify'
import { crawlQueue } from './queue.js'
import cors from "@fastify/cors"

const server = Fastify({
  logger: true
})

await server.register(cors, {
  origin: "*",
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
  const { url } = request.body as { url: string };

  if (!url) {
    reply.status(400).send({ error: "URL is required" })
    return
  }

  const job = await crawlQueue.add("crawl", { url });

  return { message: "Crawl jop successfully queued.", jobId: job.id }
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
