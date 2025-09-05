import { PlaywrightCrawler } from "crawlee";
import sharp from "sharp";
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
  return url.replace(/[^a-zA-Z0-9]/g, '_');
}

function countTreeNodes(node: PageData & { children: PageData[] }): number {
  let count = 1; // Count current node
  for (const child of node.children) {
    count += countTreeNodes(child as PageData & { children: PageData[] });
  }
  return count;
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
    } else {
      console.log(`⚠️  Orphaned page (no parent found): ${canonicalUrl} (looking for parent: ${parentUrl})`);
      // If no parent found, add as child of root
      if (root) {
        root.children.push(node);
      }
    }
  }
  return root;
}

export async function runCrawler(startUrl: string, publicUrl: string, maxRequestsPerCrawl?: number) {
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

      const screenshotPath = path.join(screenshotDir, screenshotFileName)

      await sharp(fullPageBuffer).toFile(screenshotPath); //<<<=== full page screenshot
      log.info(`Saved full screenshot to ${screenshotPath}`)


      crawledPages.push({
        url: request.url,
        title: title,
        screenshot: `${publicUrl}/screenshots/${screenshotFileName}`,
      })

      await enqueueLinks({
        strategy: "same-hostname"
      })
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed.`);
    },

    maxRequestsPerCrawl: maxRequestsPerCrawl || undefined,
  });

  await crawler.run([canonicalStartUrl]);

  console.log(`📊 Total pages crawled: ${crawledPages.length}`);
  console.log('📄 Crawled pages:', crawledPages.map(p => p.url));

  const siteTree = buildTree(crawledPages, canonicalStartUrl);

  console.log(`🌲 Tree built with ${siteTree ? countTreeNodes(siteTree as PageData & { children: PageData[] }) : 0} nodes`);

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

