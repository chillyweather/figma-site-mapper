const { crawlQueue } = require('./dist/queue');

async function testRequestLimit() {
  try {
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
  } catch (error) {
    console.error("Error creating job:", error);
    process.exit(1);
  }
}

testRequestLimit();