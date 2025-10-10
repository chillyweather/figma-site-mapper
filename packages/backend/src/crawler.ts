import { PlaywrightCrawler } from "crawlee";
import sharp from "sharp";
import fs from "fs";
import path from "path"

interface InteractiveElement {
  type: 'link' | 'button';
  x: number;
  y: number;
  width: number;
  height: number;
  href?: string;
  text?: string;
}

interface PageData {
  url: string;
  title: string;
  screenshot: string[];
  interactiveElements?: InteractiveElement[];
  crawlOrder?: number; // Track the order in which pages were crawled
}

// Language detection patterns
const LANGUAGE_PATTERNS = [
  /^\/(en|fr|de|es|it|pt|ru|ja|ko|zh)(\/|$)/i,           // /en/, /fr/, etc.
  /[?&]lang=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i,      // ?lang=en
  /[?&]language=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i,  // ?language=en
  /[?&]locale=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i,    // ?locale=en
  /[?&]l=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i,         // ?l=en
];

const COMMON_LANGUAGE_CODES = new Set(['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']);

function detectLanguageFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const search = urlObj.search;
    
    // Check path patterns
    for (const pattern of LANGUAGE_PATTERNS) {
      const pathnameMatch = pathname.match(pattern);
      if (pathnameMatch && pathnameMatch[1]) {
        return pathnameMatch[1].toLowerCase();
      }
      const searchMatch = search.match(pattern);
      if (searchMatch && searchMatch[1]) {
        return searchMatch[1].toLowerCase();
      }
    }
    
    // Check subdomain patterns (en.example.com)
    const hostname = urlObj.hostname;
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0]?.toLowerCase();
      if (subdomain && COMMON_LANGUAGE_CODES.has(subdomain)) {
        return subdomain;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}



function getDefaultLanguage(startUrl: string): string {
  // Try to detect language from start URL
  const detected = detectLanguageFromUrl(startUrl);
  if (detected) return detected;
  
  // Default to 'en' if no language detected
  return 'en';
}

function shouldCrawlUrl(url: string, options: {
  startUrl: string;
  defaultLanguageOnly?: boolean;
  maxDepth?: number;
  currentDepth?: number;
}): boolean {
  // Check language filtering
  if (options.defaultLanguageOnly) {
    const defaultLanguage = getDefaultLanguage(options.startUrl);
    const urlLanguage = detectLanguageFromUrl(url);
    
    // If URL has language code, it must match default language
    if (urlLanguage && urlLanguage !== defaultLanguage) {
      return false;
    }
  }
  
  // Check depth filtering (0 or undefined means no limit)
  if (options.maxDepth !== undefined && options.maxDepth > 0 && options.currentDepth !== undefined) {
    if (options.currentDepth > options.maxDepth) {
      return false;
    }
  }
  
  return true;
}

interface CrawlOptions {
  startUrl: string;
  publicUrl: string;
  maxRequestsPerCrawl?: number;
  deviceScaleFactor?: number;
  jobId?: string;
  delay?: number;
  requestDelay?: number;
  maxDepth?: number;
  defaultLanguageOnly?: boolean;
  sampleSize?: number;
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

  // For single-page crawls, just return the first page
  if (pages.length === 1) {
    const page = pages[0]!;
    const numberedTitle = page.crawlOrder ? `${page.crawlOrder}_${page.title}` : page.title;
    return { ...page, title: numberedTitle, children: [] } as PageData & { children: PageData[] };
  }

  const pageMap = new Map<string, PageData & { children: PageData[] }>();
  let root: PageData & { children: PageData [] } | null = null;
  const canonicalStartUrl = new URL(startUrl).toString();

  // First pass: create nodes with numbered titles
  for (const page of pages) {
    const canonicalUrl = new URL(page.url).toString();
    const numberedTitle = page.crawlOrder ? `${page.crawlOrder}_${page.title}` : page.title;
    pageMap.set(canonicalUrl, { ...page, title: numberedTitle, children: [] });
  }

  // Second pass: build parent-child relationships
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

export async function runCrawler(startUrl: string, publicUrl: string, maxRequestsPerCrawl?: number, deviceScaleFactor: number = 1, jobId?: string, delay: number = 0, requestDelay: number = 1000, maxDepth?: number, defaultLanguageOnly: boolean = false, sampleSize: number = 3, showBrowser: boolean = false, detectInteractiveElements: boolean = true, auth?: {
  method: 'credentials' | 'cookies';
  loginUrl?: string;
  username?: string;
  password?: string;
  cookies?: Array<{name: string; value: string}>;
}) {
  console.log('🚀 Starting the crawler with URL:', startUrl);
  console.log('📊 Crawler settings:', { maxRequestsPerCrawl, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements });

  // Clear only request queues to avoid conflicts with previous crawls
  // Keep session pool and other storage intact to avoid initialization errors
  const requestQueuesDir = path.join(process.cwd(), 'storage', 'request_queues');
  try {
    if (fs.existsSync(requestQueuesDir)) {
      fs.rmSync(requestQueuesDir, { recursive: true, force: true });
      console.log('🗑️  Cleared request queues');
    }
  } catch (error) {
    console.warn('⚠️  Could not clear request queues:', error);
  }

  // List of realistic user agents to rotate
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];
  
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  // Strip hash fragments from URL since they're client-side only
  const urlObj = new URL(startUrl);
  urlObj.hash = '';
  const canonicalStartUrl = urlObj.toString();
  const defaultLanguage = getDefaultLanguage(canonicalStartUrl);

  const crawledPages: PageData[] = [];
  let currentPage = 0;
  let totalPages = 0;
  let isTerminating = false; // Flag to prevent multiple termination attempts
  let pageCounter = 1; // Counter to track crawl order for numbering
  
  // Handle authentication if provided
  let authSuccess = false;
  if (auth) {
    console.log(`🔐 Attempting authentication via ${auth.method}`);
    try {
      if (auth.method === 'cookies' && auth.cookies) {
        // Cookie-based authentication
        console.log(`🍪 Setting ${auth.cookies.length} cookies for authentication`);
        // Cookies will be set in the browser context before navigation
        authSuccess = true;
      } else if (auth.method === 'credentials' && auth.loginUrl && auth.username && auth.password) {
        // Credential-based authentication - will be handled in pre-navigation hooks
        console.log(`🔑 Will attempt login at ${auth.loginUrl} for user ${auth.username}`);
        authSuccess = true;
      }
    } catch (error) {
      console.error(`❌ Authentication setup failed:`, error);
      authSuccess = false;
    }
  }
  
  // Track URLs by section for sampling
  const sectionUrlMap = new Map<string, string[]>();
  const crawledUrls = new Set<string>();
  
  // Calculate URL depth
  function calculateUrlDepth(url: string): number {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      return pathSegments.length;
    } catch {
      return 0;
    }
  }
  
  // Get section key for sampling (e.g., /blog/, /products/)
  function getSectionKey(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      if (pathSegments.length === 0) return 'root';
      
      // Use first path segment as section key, but ignore language codes
      const firstSegment = pathSegments[0];
      if (firstSegment && COMMON_LANGUAGE_CODES.has(firstSegment)) {
        return pathSegments[1] || 'root';
      }
      return firstSegment || 'root';
    } catch {
      return 'root';
    }
  }

  // Track if we've already warned about progress updates to reduce spam
  let progressUpdateWarned = false;
  
  // Function to update job progress
  const updateProgress = async (stage: string, currentPage?: number, totalPages?: number, currentUrl?: string) => {
    if (jobId) {
      try {
        const progress = totalPages && currentPage ? Math.round((currentPage / totalPages) * 100) : 0;
        // Add timeout to prevent long hangs
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        await fetch(`${publicUrl}/progress/${jobId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage,
            currentPage,
            totalPages,
            currentUrl,
            progress
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      } catch (error) {
        // Only log once per job to reduce spam
        if (!progressUpdateWarned) {
          console.warn(`Progress updates disabled for job ${jobId} (backend server not available)`);
          progressUpdateWarned = true;
        }
      }
    }
  };

  // Calculate max requests per minute based on request delay
  const maxRequestsPerMinute = requestDelay > 0 ? Math.floor(60000 / (requestDelay + 500)) : 30; // 500ms buffer for processing

  let crawler: PlaywrightCrawler; // Declare crawler variable for access in request handler

  crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
        args: [
          ...(deviceScaleFactor > 1 ? ['--device-scale-factor=2'] : []),
          // Disable automation banner that causes positioning issues
          '--disable-infobars',
          '--disable-extensions-except=',
          '--disable-extensions',
          '--no-first-run',
          '--disable-dev-shm-usage',
          // Additional arguments for better compatibility
          '--disable-blink-features=AutomationControlled'
        ],
        // Add additional browser arguments for better compatibility
        headless: !showBrowser, // Control browser visibility based on setting
        slowMo: 100, // Small delay to allow pages to stabilize
        devtools: false // Keep devtools closed to reduce resource usage
      },
      // Set custom user agent to appear more like real browser traffic
      userAgent: randomUserAgent
    },
    // Wait for network idle before considering page loaded
    navigationTimeoutSecs: 30,
    requestHandlerTimeoutSecs: 300, // 5 minutes to allow for manual login/CAPTCHA
    maxConcurrency: 1, // Process one page at a time for better reliability
    
    // Rate limiting configuration
    maxRequestsPerMinute: maxRequestsPerMinute, // Dynamic based on request delay
    retryOnBlocked: true,
    maxRequestRetries: 3,
    // Use session pool to rotate identities
    useSessionPool: true,
    persistCookiesPerSession: true,
    async requestHandler({ request, page, log, enqueueLinks }) {
      // Early termination check - skip processing if we're terminating
      if (isTerminating) {
        log.info(`Skipping ${request.url} - crawler is terminating`);
        return;
      }
      
      // Handle cookie authentication on first request
      if (auth?.method === 'cookies' && auth.cookies && !authSuccess) {
        try {
          log.info(`🍪 Setting cookies for authentication`);
          for (const cookie of auth.cookies) {
            await page.context().addCookies([{
              name: cookie.name,
              value: cookie.value,
              url: canonicalStartUrl,
              domain: new URL(canonicalStartUrl).hostname
            }]);
          }
          authSuccess = true;
          log.info(`✅ Cookies set successfully`);
        } catch (error) {
          log.error(`❌ Failed to set cookies: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Check if we should crawl this URL based on language and depth filters
      const currentDepth = calculateUrlDepth(request.url);
      
      if (!shouldCrawlUrl(request.url, {
        startUrl: canonicalStartUrl,
        defaultLanguageOnly,
        maxDepth,
        currentDepth
      })) {
        log.info(`Skipping ${request.url} due to language/depth filters`);
        return;
      }
      
      // Check section sampling - only crawl up to sampleSize pages per section (0 means no limit)
      const sectionKey = getSectionKey(request.url);
      const existingSectionUrls = sectionUrlMap.get(sectionKey) || [];
      
      if (sampleSize > 0 && existingSectionUrls.length >= sampleSize) {
        log.info(`Skipping ${request.url} - section ${sectionKey} already has ${existingSectionUrls.length} pages (max: ${sampleSize})`);
        return;
      }
      
      // Check if we've already crawled this URL
      if (crawledUrls.has(request.url)) {
        log.info(`Skipping ${request.url} - already crawled`);
        return;
      }
      
      // IMPORTANT: Don't terminate during login/authentication process
      // Check if this looks like a login page before applying limits
      const isLikelyLoginPage = request.url.includes('/login') || request.url.includes('/signin') || request.url.includes('/auth');
      
      // Check if we've reached the max requests limit (0 means no limit)
      log.info(`Current page: ${currentPage}, Max requests: ${maxRequestsPerCrawl}, Is login page: ${isLikelyLoginPage}`);
      if (maxRequestsPerCrawl && maxRequestsPerCrawl > 0 && currentPage >= maxRequestsPerCrawl && !isLikelyLoginPage) {
        log.info(`Skipping ${request.url} - reached max requests limit of ${maxRequestsPerCrawl}`);
        
        // Mark as terminating to prevent new requests
        if (currentPage >= maxRequestsPerCrawl && !isTerminating) {
          isTerminating = true;
          log.info(`🛑 Reached max requests limit of ${maxRequestsPerCrawl}, will terminate after current page`);
        }
        
        return;
      }
      
      currentPage++;
      crawledUrls.add(request.url);
      existingSectionUrls.push(request.url);
      sectionUrlMap.set(sectionKey, existingSectionUrls);
      
      await updateProgress('crawling', currentPage, totalPages, request.url);

      // Set extra headers to appear more like real browser traffic
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      });

      // Wait for page to fully load and render dynamic content
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        log.info('Network idle timeout, continuing anyway');
      });

      // CAPTCHA detection and handling
      const captchaIndicators = await page.evaluate(() => {
        const captchaSelectors = [
          '[src*="captcha"]', '[class*="captcha"]', '[id*="captcha"]',
          '[src*="shieldsquare"]', '[class*="shieldsquare"]',
          'iframe[src*="recaptcha"]', '.g-recaptcha',
          '[src*="hcaptcha"]', '.h-captcha',
          '[class*="cf-browser-verification"]', '[id*="cf-wrapper"]' // Cloudflare
        ];
        
        // Check for CAPTCHA elements
        const hasElements = captchaSelectors.some(selector => document.querySelector(selector));
        
        // Check for CAPTCHA-related text in body
        const bodyText = document.body.textContent?.toLowerCase() || '';
        const captchaTexts = ['verify you are human', 'prove you are not a robot', 'captcha', 'shieldsquare', 'security check'];
        const hasText = captchaTexts.some(text => bodyText.includes(text));
        
        // Check for CAPTCHA-related titles
        const titleText = document.title.toLowerCase();
        const hasCaptchaTitle = captchaTexts.some(text => titleText.includes(text));
        
        return hasElements || hasText || hasCaptchaTitle;
      });

      if (captchaIndicators) {
        log.info(`🚨 CAPTCHA detected on ${request.url}`);
        log.info(`👤 Please solve CAPTCHA manually in the browser window. Waiting up to 2 minutes...`);
        
        try {
          // Wait for page to change (CAPTCHA solved) or timeout
          await Promise.race([
            page.waitForNavigation({ timeout: 120000 }),
            page.waitForFunction(() => {
              const captchaElements = document.querySelectorAll([
                '[src*="captcha"]', '[class*="captcha"]', '[id*="captcha"]',
                '[src*="shieldsquare"]', '[class*="shieldsquare"]',
                'iframe[src*="recaptcha"]', '.g-recaptcha',
                '[src*="hcaptcha"]', '.h-captcha',
                '[class*="cf-browser-verification"]', '[id*="cf-wrapper"]'
              ].join(', '));
              
              // Also check if body text no longer contains CAPTCHA indicators
              const bodyText = document.body.textContent?.toLowerCase() || '';
              const captchaTexts = ['verify you are human', 'prove you are not a robot', 'security check'];
              const stillHasText = captchaTexts.some(text => bodyText.includes(text));
              
              return captchaElements.length === 0 && !stillHasText;
            }, { timeout: 120000 }),
            page.waitForTimeout(120000) // 2 minute max wait
          ]);
          
          log.info(`✅ CAPTCHA appears to be resolved, continuing with ${request.url}`);
          await page.waitForTimeout(2000); // Let page stabilize after CAPTCHA resolution
          
        } catch (error) {
          log.info(`⏰ CAPTCHA timeout on ${request.url}, skipping page`);
          return;
        }
      }

      // Login/Authentication detection and handling - DISABLED FOR NOW
      // TODO: Re-enable with stricter detection when needed
      // const loginIndicators = false; // Disabled
      
      // Additional wait for dynamic content (configurable delay)
      if (delay > 0) {
        log.info(`Waiting ${delay}ms for dynamic content to load`);
        await page.waitForTimeout(delay);
      }
      
      // FIX: Handle potential sticky headers or fixed positioning issues
      try {
        await page.evaluate(() => {
          // Hide potential sticky/fixed elements that might overlap navigation
          const stickyElements = document.querySelectorAll('[style*="position: fixed"], [style*="position: sticky"], .sticky, .fixed');
          stickyElements.forEach((el, index) => {
            if (index > 0) { // Keep first sticky element (likely main nav)
              (el as HTMLElement).style.display = 'none';
            }
          });
          
          // Remove any transform that might affect positioning
          document.documentElement.style.transform = 'none';
          document.body.style.transform = 'none';
        });
      } catch (error) {
        log.info(`Could not handle sticky elements for ${request.url}`);
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
          
          // Scroll back to top - ENSURE we're at the very top
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
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
      
      // CRITICAL FIX: Ensure page is scrolled to very top before screenshot
      // This fixes navigation bar positioning issues
      try {
        await page.evaluate(() => {
          // Multiple methods to ensure we're at the very top
          window.scrollTo({ top: 0, behavior: 'instant' });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          if (document.scrollingElement) {
            document.scrollingElement.scrollTop = 0;
          }
        });
        
        // Wait for any potential scroll animations to complete
        await page.waitForTimeout(300);
        
        // Double-check we're at the top
        const scrollPosition = await page.evaluate(() => ({
          window: window.scrollY,
          document: document.documentElement.scrollTop,
          body: document.body.scrollTop
        }));
        
        if (scrollPosition.window > 0 || scrollPosition.document > 0 || scrollPosition.body > 0) {
          log.info(`⚠️ Page still scrolled after reset: ${JSON.stringify(scrollPosition)}`);
        } else {
          log.info(`✅ Page confirmed at top position for screenshot: ${request.url}`);
        }
        
      } catch (error) {
        log.info(`⚠️ Could not ensure top position for ${request.url}: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Find interactive elements (links and buttons) with their bounding boxes (if enabled)
      // IMPORTANT: This must happen AFTER final scroll positioning to ensure accurate coordinates
      let interactiveElements: InteractiveElement[] = [];
      
      if (detectInteractiveElements) {
        log.info(`Finding interactive elements on ${request.url}`);
        interactiveElements = await page.evaluate(() => {
        const elements: Array<{
          type: 'link' | 'button';
          x: number;
          y: number;
          width: number;
          height: number;
          href?: string;
          text?: string;
        }> = [];

        // Find all links with hrefs
        const links = document.querySelectorAll('a[href]');
        links.forEach((link) => {
          const rect = link.getBoundingClientRect();
          const href = link.getAttribute('href') || '';
          const id = link.getAttribute('id') || '';
          
          // Filter out unwanted links
          const shouldSkip = 
            // Skip docusaurus skip link
            id === '__docusaurus_skipToContent_fallback' ||
            // Skip empty or javascript links
            !href || 
            href === '#' || 
            href.startsWith('javascript:') ||
            // Skip very small elements (likely decorative)
            rect.width < 10 || 
            rect.height < 10;
            
          if (shouldSkip) {
            return;
          }
          
          if (rect.width > 0 && rect.height > 0) { // Only visible elements
            elements.push({
              type: 'link',
              x: rect.left + window.scrollX,
              y: rect.top + window.scrollY,
              width: rect.width,
              height: rect.height,
              href: href || undefined,
              text: link.textContent?.trim().substring(0, 100) || undefined
            });
          }
        });

        // Find all buttons
        const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"]');
        buttons.forEach((button) => {
          const rect = button.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) { // Only visible elements
            elements.push({
              type: 'button',
              x: rect.left + window.scrollX,
              y: rect.top + window.scrollY,
              width: rect.width,
              height: rect.height,
              href: undefined,
              text: button.textContent?.trim().substring(0, 100) || (button as HTMLInputElement).value?.substring(0, 100) || undefined
            });
          }
        });

          return elements;
        });

        log.info(`Found ${interactiveElements.length} interactive elements on ${request.url}`);
      } else {
        log.info(`Skipping interactive elements detection (disabled)`);
      }

      const fullPageBuffer = await page.screenshot({ fullPage: true });

      // Slice the screenshot into manageable pieces
      await updateProgress('processing', currentPage, totalPages, request.url);
      const screenshotSlices = await sliceScreenshot(fullPageBuffer, request.url, publicUrl);
      log.info(`Generated ${screenshotSlices.length} screenshot slice(s) for ${request.url}`)

      crawledPages.push({
        url: request.url,
        title: title,
        screenshot: screenshotSlices,
        interactiveElements: interactiveElements,
        crawlOrder: pageCounter++,
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
    
    // Add pre-navigation hooks for random delays and better request spacing
    preNavigationHooks: [
      async ({ request, page, log }) => {
        // Handle credential-based authentication
        if (auth?.method === 'credentials' && auth.loginUrl && auth.username && auth.password) {
          const loginUrlNormalized = new URL(auth.loginUrl).toString();
          const currentUrlNormalized = new URL(request.url).toString();
          
          // Only attempt login when navigating to the login page
          if (currentUrlNormalized === loginUrlNormalized && !authSuccess) {
            log.info(`🔑 Attempting login at ${auth.loginUrl}`);
            try {
              // Navigate to login page
              await page.goto(auth.loginUrl, { waitUntil: 'networkidle' });
              
              // Find and fill login form
              const usernameSelector = await page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"], #username, #email').first();
              const passwordSelector = await page.locator('input[type="password"], input[name*="pass"], #password').first();
              const submitSelector = await page.locator('button[type="submit"], input[type="submit"], button:has-text("login"), button:has-text("sign in")').first();
              
              if (usernameSelector && passwordSelector) {
                await usernameSelector.fill(auth.username);
                await passwordSelector.fill(auth.password);
                
                if (submitSelector) {
                  await submitSelector.click();
                  
                  // Wait for navigation after login
                  await page.waitForLoadState('networkidle', { timeout: 10000 });
                  
                  // Check if login was successful by looking for common success indicators
                  const successIndicators = await page.locator('a[href*="logout"], button:has-text("logout"), .user-menu, .profile, [data-testid*="user"]').count();
                  if (successIndicators > 0) {
                    log.info(`✅ Login successful`);
                    authSuccess = true;
                  } else {
                    log.info(`⚠️ Login may have failed - no success indicators found`);
                  }
                } else {
                  log.info(`⚠️ Could not find submit button for login form`);
                }
              } else {
                log.info(`⚠️ Could not find username/password fields for login`);
              }
            } catch (error) {
              log.error(`❌ Login failed: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
        
        // Use configured request delay with some randomization to avoid rate limiting
        const baseDelay = requestDelay;
        const randomVariation = Math.floor(Math.random() * 500) - 250; // ±250ms variation
        const totalDelay = Math.max(0, baseDelay + randomVariation);
        log.info(`Adding ${totalDelay}ms delay before navigating to ${request.url}`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    ],
  });

  // Get total pages count before starting
  totalPages = maxRequestsPerCrawl || 100; // Default to 100 if no limit
  await updateProgress('starting', 0, totalPages, canonicalStartUrl);

  await crawler.run([canonicalStartUrl]);
  
  // Ensure proper cleanup
  try {
    await crawler.teardown();
    console.log('✅ Crawler cleaned up successfully');
  } catch (error) {
    console.error(`❌ Error cleaning up crawler: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log(`📊 Total pages crawled: ${crawledPages.length}`);
  console.log('📄 Crawled pages:', crawledPages.map(p => p.url));

  const siteTree = buildTree(crawledPages, canonicalStartUrl);

  console.log(`🌲 Tree built with ${siteTree ? countTreeNodes(siteTree as PageData & { children: PageData[] }) : 0} nodes`);

  const manifest = {
    startUrl: canonicalStartUrl,
    crawlDate: new Date().toISOString(),
    tree: siteTree,
  }

  const manifestFilename = jobId ? `manifest-${jobId}.json` : "manifest.json";
  const manifestPath = path.join(screenshotDir, manifestFilename);
  console.log('📄 Saving manifest to:', manifestPath);

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2)
  )
  console.log(`✅ Crawler finished and ${manifestFilename} created.`)
}

