import { PlaywrightCrawler } from "crawlee";

const crawler = new PlaywrightCrawler({
  async requestHandler({ request, page, log
  }) {
    const title = await page.title();
    log.info(`Crawled ${request.url} - Title: ${title}`);
  },

  failedRequestHandler({ request, log }) {
    log.error(`Request ${request.url} failed.`);
  },
});

async function runCrawler() {
  console.log('🚀 Starting the crawler...')
  await crawler.run(["https://crawlee.dev"])
  console.log('✅ Crawler finished.')
}

runCrawler()
