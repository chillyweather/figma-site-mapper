import { PlaywrightCrawler } from "crawlee";
import sharp from "sharp";
import fs from "fs";
import path from "path";
// Language detection patterns
const LANGUAGE_PATTERNS = [
    /^\/(en|fr|de|es|it|pt|ru|ja|ko|zh)(\/|$)/i, // /en/, /fr/, etc.
    /[?&]lang=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i, // ?lang=en
    /[?&]language=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i, // ?language=en
    /[?&]locale=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i, // ?locale=en
    /[?&]l=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i, // ?l=en
];
const COMMON_LANGUAGE_CODES = new Set(['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']);
function detectLanguageFromUrl(url) {
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
    }
    catch {
        return null;
    }
}
function getDefaultLanguage(startUrl) {
    // Try to detect language from start URL
    const detected = detectLanguageFromUrl(startUrl);
    if (detected)
        return detected;
    // Default to 'en' if no language detected
    return 'en';
}
function shouldCrawlUrl(url, options) {
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
const screenshotDir = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}
function getSafeFilename(url) {
    return url.replace(/[^a-zA-Z0-9]/g, '_');
}
async function sliceScreenshot(imageBuffer, url, publicUrl, maxHeight = 4096, overlap = 0) {
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
        const slices = [];
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
            }
            catch (error) {
                console.error(`❌ Failed to create slice ${i + 1}/${numSlices}:`, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }
        return slices;
    }
    catch (error) {
        console.error(`❌ sliceScreenshot failed for ${url}:`, error instanceof Error ? error.message : String(error));
        throw error;
    }
}
function countTreeNodes(node) {
    let count = 1; // Count current node
    for (const child of node.children) {
        count += countTreeNodes(child);
    }
    return count;
}
function buildTree(pages, startUrl) {
    if (pages.length === 0) {
        return null;
    }
    const pageMap = new Map();
    let root = null;
    const canonicalStartUrl = new URL(startUrl).toString();
    for (const page of pages) {
        const canonicalUrl = new URL(page.url).toString();
        pageMap.set(canonicalUrl, { ...page, children: [] });
    }
    for (const page of pages) {
        const canonicalUrl = new URL(page.url).toString();
        const node = pageMap.get(canonicalUrl);
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
        }
        catch (e) { /* Ignore invalid URLs */ }
        const parentNode = pageMap.get(parentUrl);
        if (parentNode) {
            parentNode.children.push(node);
        }
        else {
            console.log(`⚠️  Orphaned page (no parent found): ${canonicalUrl} (looking for parent: ${parentUrl})`);
            // If no parent found, add as child of root
            if (root) {
                root.children.push(node);
            }
        }
    }
    return root;
}
export async function runCrawler(startUrl, publicUrl, maxRequestsPerCrawl, deviceScaleFactor = 1, jobId, delay = 0, requestDelay = 1000, maxDepth, defaultLanguageOnly = false, sampleSize = 3) {
    console.log('🚀 Starting the crawler...');
    // List of realistic user agents to rotate
    const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const canonicalStartUrl = new URL(startUrl).toString();
    const defaultLanguage = getDefaultLanguage(canonicalStartUrl);
    const crawledPages = [];
    let currentPage = 0;
    let totalPages = 0;
    // Track URLs by section for sampling
    const sectionUrlMap = new Map();
    const crawledUrls = new Set();
    // Calculate URL depth
    function calculateUrlDepth(url) {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
            return pathSegments.length;
        }
        catch {
            return 0;
        }
    }
    // Get section key for sampling (e.g., /blog/, /products/)
    function getSectionKey(url) {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
            if (pathSegments.length === 0)
                return 'root';
            // Use first path segment as section key, but ignore language codes
            const firstSegment = pathSegments[0];
            if (firstSegment && COMMON_LANGUAGE_CODES.has(firstSegment)) {
                return pathSegments[1] || 'root';
            }
            return firstSegment || 'root';
        }
        catch {
            return 'root';
        }
    }
    // Function to update job progress
    const updateProgress = async (stage, currentPage, totalPages, currentUrl) => {
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
            }
            catch (error) {
                console.warn(`Failed to update progress for job ${jobId}:`, error);
            }
        }
    };
    // Calculate max requests per minute based on request delay
    const maxRequestsPerMinute = requestDelay > 0 ? Math.floor(60000 / (requestDelay + 500)) : 30; // 500ms buffer for processing
    const crawler = new PlaywrightCrawler({
        launchContext: {
            launchOptions: {
                args: deviceScaleFactor > 1 ? ['--device-scale-factor=2'] : [],
                // Add additional browser arguments for better compatibility
                headless: true,
                slowMo: 100 // Small delay to allow pages to stabilize
            },
            // Set custom user agent to appear more like real browser traffic
            userAgent: randomUserAgent
        },
        // Wait for network idle before considering page loaded
        navigationTimeoutSecs: 30,
        requestHandlerTimeoutSecs: 45,
        maxConcurrency: 1, // Process one page at a time for better reliability
        // Rate limiting configuration
        maxRequestsPerMinute: maxRequestsPerMinute, // Dynamic based on request delay
        retryOnBlocked: true,
        maxRequestRetries: 3,
        // Use session pool to rotate identities
        useSessionPool: true,
        persistCookiesPerSession: true,
        async requestHandler({ request, page, log, enqueueLinks }) {
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
            }
            catch (error) {
                log.info(`Scrolling failed or not needed for ${request.url}`);
            }
            const title = await page.title();
            log.info(`Crawled ${request.url} - Title: ${title}`);
            await updateProgress('screenshot', currentPage, totalPages, request.url);
            const fullPageBuffer = await page.screenshot({ fullPage: true });
            // Slice the screenshot into manageable pieces
            await updateProgress('processing', currentPage, totalPages, request.url);
            const screenshotSlices = await sliceScreenshot(fullPageBuffer, request.url, publicUrl);
            log.info(`Generated ${screenshotSlices.length} screenshot slice(s) for ${request.url}`);
            crawledPages.push({
                url: request.url,
                title: title,
                screenshot: screenshotSlices,
            });
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
            }
            catch (error) {
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
            }
            catch (error) {
                log.error(`Failed to enqueue links from ${request.url}: ${error instanceof Error ? error.message : String(error)}`);
            }
        },
        failedRequestHandler({ request, log }) {
            log.error(`Request ${request.url} failed.`);
        },
        // Add pre-navigation hooks for random delays and better request spacing
        preNavigationHooks: [
            async ({ request, log }) => {
                // Use configured request delay with some randomization to avoid rate limiting
                const baseDelay = requestDelay;
                const randomVariation = Math.floor(Math.random() * 500) - 250; // ±250ms variation
                const totalDelay = Math.max(0, baseDelay + randomVariation);
                log.info(`Adding ${totalDelay}ms delay before navigating to ${request.url}`);
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        ],
        maxRequestsPerCrawl: maxRequestsPerCrawl || undefined,
    });
    // Get total pages count before starting
    totalPages = maxRequestsPerCrawl || 100; // Default to 100 if no limit
    await updateProgress('starting', 0, totalPages, canonicalStartUrl);
    await crawler.run([canonicalStartUrl]);
    console.log(`📊 Total pages crawled: ${crawledPages.length}`);
    console.log('📄 Crawled pages:', crawledPages.map(p => p.url));
    const siteTree = buildTree(crawledPages, canonicalStartUrl);
    console.log(`🌲 Tree built with ${siteTree ? countTreeNodes(siteTree) : 0} nodes`);
    const manifest = {
        startUrl: canonicalStartUrl,
        crawlDate: new Date().toISOString(),
        tree: siteTree,
    };
    const manifestPath = path.join(screenshotDir, "manifest.json");
    console.log('📄 Saving manifest to:', manifestPath);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('✅ Crawler finished and manifest.json created.');
}
