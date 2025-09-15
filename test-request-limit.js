const { crawlQueue } = require('./packages/backend/dist/queue');

async function testRequestLimit() {
  const job = await crawlQueue.add("crawl", {
    url: "https://crawlee.dev",
    publicUrl: "http://localhost:3001",
    maxRequestsPerCrawl: 10,
    deviceScaleFactor: 1,
    delay: 0,
    requestDelay: 1000,
    maxDepth: 0,
    defaultLanguageOnly: true,
    sampleSize: 0,
    auth: null
  });
  
  console.log("Job created:", job.id);
  process.exit(0);
}

testRequestLimit().catch(console.error);