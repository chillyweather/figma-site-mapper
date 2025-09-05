import { PlaywrightCrawler } from "crawlee";
import sharp from "sharp";
import fs from "fs";
import path from "path"

interface PageData {
  url: string;
  title: string;
  screenshot: string[];
}

const screenshotDir = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
}

function getSafeFilename(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, '_');
}

async function sliceScreenshot(
  imageBuffer: Buffer, 
  url: string, 
  publicUrl: string,
  maxHeight: number = 4096,
  overlap: number = 100
): Promise<string[]> {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.height || !metadata.width) {
      throw new Error('Could not get image dimensions');
    }
    
    const { width, height } = metadata;
    
    console.log(`📐 Original screenshot dimensions: ${width}x${height} for ${url}`);
    
    // Validate dimensions
    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid image dimensions: ${width}x${height}`);
    }
    
    // If image is already small enough, return as single slice
    if (height <= maxHeight) {
      const safeFileName = getSafeFilename(url);
      const screenshotFileName = `${safeFileName}.png`;
      const screenshotPath = path.join(screenshotDir, screenshotFileName);
      
      await image.toFile(screenshotPath);
      return [`${publicUrl}/screenshots/${screenshotFileName}`];
    }
    
    // Fix for edge case where height is less than overlap
    if (height <= overlap) {
      console.log(`⚠️  Image height (${height}) <= overlap (${overlap}), saving as single slice`);
      const safeFileName = getSafeFilename(url);
      const screenshotFileName = `${safeFileName}.png`;
      const screenshotPath = path.join(screenshotDir, screenshotFileName);
      
      await image.toFile(screenshotPath);
      return [`${publicUrl}/screenshots/${screenshotFileName}`];
    }
    
    // More accurate calculation for number of slices
    const numSlices = Math.max(1, Math.ceil((height - maxHeight) / (maxHeight - overlap)) + 1);
    const slices: string[] = [];
    
    console.log(`🖼️  Slicing large screenshot (${width}x${height}) into ${numSlices} pieces for ${url}`);
    
    for (let i = 0; i < numSlices; i++) {
      // Calculate the starting position for this slice
      let sliceTop = i * (maxHeight - overlap);
      let sliceHeight = maxHeight;
      
      // For the last slice, adjust height to not exceed image bounds
      if (i === numSlices - 1) {
        sliceHeight = height - sliceTop;
        // If the last slice would be too small, adjust the previous slice instead
        if (sliceHeight < overlap) {
          sliceTop = height - maxHeight;
          sliceHeight = maxHeight;
        }
      }
      
      console.log(`📝 Processing slice ${i + 1}/${numSlices}: top=${sliceTop}, height=${sliceHeight}, image bounds=${height}`);
      
      console.log(`📝 Processing slice ${i + 1}/${numSlices}: top=${sliceTop}, height=${sliceHeight}`);
      
      // Validate extract bounds before attempting extraction
      if (sliceTop >= height) {
        console.error(`❌ Invalid sliceTop: ${sliceTop} >= ${height}`);
        continue;
      }
      
      if (sliceTop + sliceHeight > height) {
        console.error(`❌ Invalid extract area: ${sliceTop} + ${sliceHeight} = ${sliceTop + sliceHeight} > ${height}`);
        continue;
      }
      
      const safeFileName = getSafeFilename(url);
      const sliceFileName = `${safeFileName}_slice_${i + 1}_of_${numSlices}.png`;
      const slicePath = path.join(screenshotDir, sliceFileName);
      
      try {
        // Extract slice from original image - use clone to avoid modifying original
        await image
          .clone()
          .extract({ 
            left: 0, 
            top: sliceTop, 
            width: width, 
            height: sliceHeight 
          })
          .toFile(slicePath);
        
        slices.push(`${publicUrl}/screenshots/${sliceFileName}`);
        console.log(`📸 Created slice ${i + 1}/${numSlices}: ${width}x${sliceHeight}px at y=${sliceTop}`);
      } catch (error) {
        console.error(`❌ Failed to create slice ${i + 1}/${numSlices}:`, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
    
    return slices;
  } catch (error) {
    console.error(`❌ sliceScreenshot failed for ${url}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
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

      // Slice the screenshot into manageable pieces
      const screenshotSlices = await sliceScreenshot(fullPageBuffer, request.url, publicUrl);
      log.info(`Generated ${screenshotSlices.length} screenshot slice(s) for ${request.url}`)

      crawledPages.push({
        url: request.url,
        title: title,
        screenshot: screenshotSlices,
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

