import { PlaywrightCrawler } from "crawlee";
import sharp from "sharp";
import fs from "fs";
import path from "path"

interface PageData {
  url: string;
  title: string;
  screenshot: string;
  thumbnail: string;
}

const screenshotDir = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
}

function getSafeFilename(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, '_');
}

function buildTree(pages: PageData[], startUrl: string): PageData | null {
  if (pages.length === 0) {
    return null;
  }

  const pageMap = new Map<string, PageData & { children: PageData[] }>();
  let root: PageData & { children: PageData[] } | null = null;
  const canonicalStartUrl = new URL(startUrl).toString();

  for (const page of pages) {
    const canonicalUrl = new URL(page.url).toString();
    pageMap.set(canonicalUrl, { ...page, children: [] });
  }

  for (const page of pages) {
    const canonicalUrl = new URL(page.url).toString();

    const node = pageMap.get(canonicalUrl)!;

    if (canonicalUrl === canonicalStartUrl) {
      root = node;
      continue;
    }

    let parentUrl = '';
    try {
      const urlObject = new URL(canonicalUrl);
      if (urlObject.pathname !== '/') {
        urlObject.pathname = urlObject.pathname.substring(0, urlObject.pathname.lastIndexOf('/')) || '/';
        parentUrl = urlObject.toString();
      }
    } catch (e) { /* Ignore invalid URLs */ }

    const parentNode = pageMap.get(parentUrl);

    if (parentNode) {
      parentNode.children.push(node);
    }
  }
  return root;
}

export async function runCrawler(startUrl: string, publicUrl: string) {
  console.log('🚀 Starting the crawler...')

  const canonicalStartUrl = new URL(startUrl).toString();

  const crawledPages: PageData[] = [];

  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, log, enqueueLinks }) {
      const title = await page.title();
      log.info(`Crawled ${request.url} - Title: ${title}`);

      const fullPageBuffer = await page.screenshot({ fullPage: true });

      const safeFileName = getSafeFilename(request.url);
      const screenshotFileName = `${safeFileName}.png`;
      const thumbnailFileName = `${safeFileName}_thumb.png`;

      const screenshotPath = path.join(screenshotDir, screenshotFileName)
      const thumbnailPath = path.join(screenshotDir, thumbnailFileName)

      await sharp(fullPageBuffer).toFile(screenshotPath); //<<<=== full page screenshot
      log.info(`Saved full screenshot to ${screenshotPath}`)

      // Create thumbnail - handle cases where image might be smaller than expected
      const thumbnailImage = sharp(fullPageBuffer);
      const thumbnailMetadata = await thumbnailImage.metadata();
      
      const imageWidth = thumbnailMetadata.width || 1280;
      const imageHeight = thumbnailMetadata.height || 520;
      
      // Ensure we don't extract dimensions larger than the actual image, and minimum 1px
      const extractWidth = Math.max(1, Math.min(imageWidth, 1280));
      const extractHeight = Math.max(1, Math.min(imageHeight, 520));
      
      await thumbnailImage
        .extract({ top: 0, left: 0, width: extractWidth, height: extractHeight })
        .resize(300, null, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
        .toFile(thumbnailPath);
      log.info(`Saved thumbnail (${extractWidth}x${extractHeight}) to ${thumbnailPath}`)


      crawledPages.push({
        url: request.url,
        title: title,
        screenshot: `${publicUrl}/screenshots/${screenshotFileName}`,
        thumbnail: `${publicUrl}/screenshots/${thumbnailFileName}`,
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

  await crawler.run([canonicalStartUrl]);

  const siteTree = buildTree(crawledPages, canonicalStartUrl);

  const manifest = {
    startUrl: canonicalStartUrl,
    crawlDate: new Date().toISOString(),
    tree: siteTree,
  }

  const manifestPath = path.join(screenshotDir, "manifest.json")
  console.log('📄 Saving manifest to:', manifestPath);

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2)
  )
  console.log('✅ Crawler finished and manifest.json created.')
}

