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
  overlap: number = 0
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

export async function runCrawler(startUrl: string, publicUrl: string, maxRequestsPerCrawl?: number, deviceScaleFactor: number = 1, jobId?: string, delay: number = 0) {
  console.log('🚀 Starting the crawler...')

  const canonicalStartUrl = new URL(startUrl).toString();

  const crawledPages: PageData[] = [];
  let currentPage = 0;
  let totalPages = 0;

  // Function to update job progress
  const updateProgress = async (stage: string, currentPage?: number, totalPages?: number, currentUrl?: string) => {
    if (jobId) {
      try {
        const progress = totalPages && currentPage ? Math.round((currentPage / totalPages) * 100) : 0;
        await fetch(`${publicUrl}/progress/${jobId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage,
            currentPage,
            totalPages,
            currentUrl,
            progress
          })
        });
      } catch (error) {
        console.warn(`Failed to update progress for job ${jobId}:`, error);
      }
    }
  };

  const crawler = new PlaywrightCrawler({
    launchContext: {
      launchOptions: {
        args: deviceScaleFactor > 1 ? ['--device-scale-factor=2'] : [],
        // Add additional browser arguments for better compatibility
        headless: true,
        slowMo: 100 // Small delay to allow pages to stabilize
      }
    },
    // Wait for network idle before considering page loaded
    navigationTimeoutSecs: 30,
    requestHandlerTimeoutSecs: 60,
    maxConcurrency: 1, // Process one page at a time for better reliability
    async requestHandler({ request, page, log, enqueueLinks }) {
      currentPage++;
      await updateProgress('crawling', currentPage, totalPages, request.url);

      // Wait for page to fully load and render dynamic content
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        log.info('Network idle timeout, continuing anyway');
      });
      
      // Additional wait for dynamic content (configurable delay)
      if (delay > 0) {
        log.info(`Waiting ${delay}ms for dynamic content to load`);
        await page.waitForTimeout(delay);
      }
      
      // Scroll through page to trigger lazy loading
      try {
        await page.evaluate(async () => {
          const scrollHeight = document.documentElement.scrollHeight;
          const viewportHeight = window.innerHeight;
          let currentPosition = 0;
          
          while (currentPosition < scrollHeight) {
            currentPosition += viewportHeight;
            window.scrollTo(0, currentPosition);
            await new Promise(resolve => setTimeout(resolve, Math.min(500, delay > 0 ? delay / 4 : 500)));
          }
          
          // Scroll back to top
          window.scrollTo(0, 0);
        });
        
        // Wait for any newly loaded content
        const scrollWaitTime = delay > 0 ? Math.min(2000, delay / 2) : 1000;
        await page.waitForTimeout(scrollWaitTime);
        log.info(`Completed scrolling through ${request.url} to trigger lazy loading`);
      } catch (error) {
        log.info(`Scrolling failed or not needed for ${request.url}`);
      }

      const title = await page.title();
      log.info(`Crawled ${request.url} - Title: ${title}`);

      await updateProgress('screenshot', currentPage, totalPages, request.url);
      const fullPageBuffer = await page.screenshot({ fullPage: true });

      // Slice the screenshot into manageable pieces
      await updateProgress('processing', currentPage, totalPages, request.url);
      const screenshotSlices = await sliceScreenshot(fullPageBuffer, request.url, publicUrl);
      log.info(`Generated ${screenshotSlices.length} screenshot slice(s) for ${request.url}`)

      crawledPages.push({
        url: request.url,
        title: title,
        screenshot: screenshotSlices,
      })
      
      // Log discovered links for debugging
      try {
        const links = await page.evaluate(() => {
          const anchors = document.querySelectorAll('a[href]');
          return Array.from(anchors).map(a => ({
            href: a.getAttribute('href'),
            text: a.textContent?.trim().substring(0, 50)
          })).slice(0, 10); // Log first 10 links
        });
        
        log.info(`Found ${links.length} links on ${request.url}: ${links.map(l => l.href).join(', ')}`);
      } catch (error) {
        log.info(`Could not extract links for debugging from ${request.url}`);
      }

      // Enhanced link discovery with multiple strategies
      try {
        // Wait a bit more for any lazy-loaded links
        await page.waitForTimeout(1000);
        
        // Enqueue links with same hostname strategy
        await enqueueLinks({
          strategy: "same-hostname",
          transformRequestFunction: (request) => {
            // Filter out common non-content URLs
            const url = new URL(request.url);
            const blockedPatterns = [
              /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)$/i,
              /\/api\//i,
              /\/assets\//i,
              /\/images\//i,
              /\/css\//i,
              /\/js\//i,
              /\#.*$/,
              /\?.*$/
            ];
            
            const shouldBlock = blockedPatterns.some(pattern => pattern.test(url.pathname));
            if (shouldBlock) {
              log.info(`Skipping URL due to blocked pattern: ${request.url}`);
              return false;
            }
            
            return request;
          }
        });
        
        log.info(`Successfully enqueued links from ${request.url}`);
      } catch (error) {
        log.error(`Failed to enqueue links from ${request.url}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed.`);
    },

    maxRequestsPerCrawl: maxRequestsPerCrawl || undefined,
  });

  // Get total pages count before starting
  totalPages = maxRequestsPerCrawl || 100; // Default to 100 if no limit
  await updateProgress('starting', 0, totalPages, canonicalStartUrl);

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

