import { PlaywrightCrawler } from "crawlee";
import fs from "fs";
import path from "path"


const screenshotDir = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
}

function getSafeFilename(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, '_') + '.png';
}

const crawler = new PlaywrightCrawler({
  async requestHandler({ request, page, log, enqueueLinks }) {
    const title = await page.title();
    log.info(`Crawled ${request.url} - Title: ${title}`);

    const screenshotPath = path.join(screenshotDir, getSafeFilename(request.url))
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log.info(`Saved screenshot to ${screenshotPath}`)

    await enqueueLinks({
      strategy: "same-hostname"
    })
  },

  failedRequestHandler({ request, log }) {
    log.error(`Request ${request.url} failed.`);
  },

  maxRequestsPerCrawl: 10,
});

export async function runCrawler(startUrl: string) {
  console.log('🚀 Starting the crawler...')
  await crawler.run([startUrl])
  console.log('✅ Crawler finished.')
}

