import { PlaywrightCrawler } from "crawlee";
import fs from "fs";
import path from "path"

interface PageData {
  url: string;
  title: string;
  screenshot: string;
}

const screenshotDir = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
}

function getSafeFilename(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, '_') + '.png';
}

export async function runCrawler(startUrl: string) {
  console.log('🚀 Starting the crawler...')

  const crawledPages: PageData[] = [];

  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, log, enqueueLinks }) {
      const title = await page.title();
      log.info(`Crawled ${request.url} - Title: ${title}`);

      const screenshotFilename = getSafeFilename(request.url);
      const screenshotPath = path.join(screenshotDir, screenshotFilename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      log.info(`Saved screenshot to ${screenshotPath}`)

      crawledPages.push({
        url: request.url,
        title: title,
        screenshot: screenshotFilename,
      })

      await enqueueLinks({
        strategy: "same-hostname"
      })
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed.`);
    },

    maxRequestsPerCrawl: 10,
  });

  await crawler.run([startUrl]);

  const manifest = {
    startUrl: startUrl,
    crawlDate: new Date().toISOString(),
    pages: crawledPages
  }

  fs.writeFileSync(
    path.join(screenshotDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  )
  console.log('✅ Crawler finished and manifest.json created.')
}

