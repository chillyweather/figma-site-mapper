import { renderSitemap } from "./figmaRendering/renderSitemap";

const BACKEND_URL = 'http://localhost:3006';
let screenshotWidth = 1440; // Default screenshot width
let hasRenderedSitemap = false; // Prevent duplicate rendering

figma.showUI(__html__, { width: 480, height: 1200, themeColors: true });

// Helper function to parse hostname from URL
function parseHostname(url: string): string | null {
  try {
    // Remove protocol
    const withoutProtocol = url.replace(/^https?:\/\//, '');
    // Get hostname part (before first slash, colon, or end)
    const hostname = withoutProtocol.split(/[\/:\?#]/)[0];
    return hostname.toLowerCase();
  } catch (error) {
    return null;
  }
}

// Helper function to check if link is external
function isExternalLink(href: string, baseUrl: string): boolean {
  try {
    // Handle relative URLs - they are internal
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      return false;
    }

    const linkHostname = parseHostname(href);
    const baseHostname = parseHostname(baseUrl);

    if (!linkHostname || !baseHostname) {
      return false;
    }

    // Compare hostnames - different hostname means external
    return linkHostname !== baseHostname;
  } catch (error) {
    // If URL parsing fails, assume it's internal (relative link)
    return false;
  }
}

// Function to get the base URL from current page title (contains the crawled URL)
function getPageBaseUrl(): string | null {
  try {
    // Look for the "Page Overlay" frame which has the page URL in its name or find navigation frame
    const overlayFrame = figma.currentPage.findOne(node => node.name === 'Page Overlay') as FrameNode;
    if (overlayFrame) {
      // Find the navigation frame to get the URL
      const navFrame = overlayFrame.findOne(node => node.name === 'Navigation') as FrameNode;
      if (navFrame) {
        // Find the text node with hyperlink that contains the page URL
        const textNodes = navFrame.findAll(node => node.type === 'TEXT') as TextNode[];
        for (const textNode of textNodes) {
          if (textNode.hyperlink && typeof textNode.hyperlink === 'object' && 'type' in textNode.hyperlink) {
            if (textNode.hyperlink.type === 'URL') {
              return (textNode.hyperlink as any).value || null;
            }
          }
        }
      }
    }

    // Fallback: try to extract from page name (format: "number_title")
    // Page names look like "1_Page Title" where the original URL would be in the navigation
    return null;
  } catch (error) {
    console.error('Error getting page base URL:', error);
    return null;
  }
}

// Function to scan current page for badge-with-link elements (only internal links)
async function scanForBadgeLinks(): Promise<Array<{ id: string, text: string, url: string }>> {
  const badgeLinks: Array<{ id: string, text: string, url: string }> = [];

  try {
    // Find all groups with name starting with "link_" and ending with "_badge"
    const badgeGroups = figma.currentPage.findAll((node: SceneNode) =>
      node.type === 'GROUP' && node.name.startsWith('link_') && node.name.endsWith('_badge')
    );

    for (const group of badgeGroups) {
      if (group.type === 'GROUP') {
        // Check badge color to filter internal vs external links
        // Orange badge = internal link, Cyan badge = external link
        const ellipseNodes = group.findAll((node: SceneNode) => node.type === 'ELLIPSE');

        let isInternalLink = false;
        for (const node of ellipseNodes) {
          if (node.type === 'ELLIPSE' && node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
            const fill = node.fills[0];
            if (fill.type === 'SOLID') {
              const color = fill.color;
              // Orange internal link badge: { r: 0.9, g: 0.45, b: 0.1 }
              // Check if color is close to orange (allow for small floating point differences)
              if (Math.abs(color.r - 0.9) < 0.1 && Math.abs(color.g - 0.45) < 0.1 && Math.abs(color.b - 0.1) < 0.1) {
                isInternalLink = true;
                break;
              }
            }
          }
        }

        // Skip external links (cyan badges)
        if (!isInternalLink) {
          continue;
        }

        // Look for text nodes within the group that have hyperlinks
        const textNodes = group.findAll((node: SceneNode) => node.type === 'TEXT');

        for (const node of textNodes) {
          if (node.type === 'TEXT') {
            const textNode = node;
            // Check if the text node has hyperlink data
            if (textNode.hyperlink) {
              try {
                // Extract hyperlink information
                const hyperlink = textNode.hyperlink;
                let url = '';
                let text = textNode.characters || 'Link';

                // Handle different hyperlink types
                if (typeof hyperlink === 'object' && hyperlink !== null) {
                  if ('type' in hyperlink && hyperlink.type === 'URL') {
                    url = (hyperlink as any).value || '';
                  } else if ('value' in hyperlink) {
                    url = (hyperlink as any).value || '';
                  }
                }

                if (url) {
                  badgeLinks.push({
                    id: textNode.id,
                    text: text,
                    url: url
                  });
                }
              } catch (e) {
                console.warn('Failed to extract hyperlink from text node:', e);
                continue;
              }
            }
          }
        }
      }
    }

    console.log(`Found ${badgeLinks.length} internal badge links (filtered out external links by badge color)`);
    return badgeLinks;
  } catch (error) {
    console.error('Error scanning for badge links:', error);
    return [];
  }
}

// Function to send badge links to UI
async function updateMappingTab() {
  const badgeLinks = await scanForBadgeLinks();
  figma.ui.postMessage({
    type: 'badge-links-update',
    badgeLinks: badgeLinks
  });
}

// Set up page change detection
figma.on('currentpagechange', () => {
  console.log('Page changed, updating mapping tab');
  // Don't scan for badges on flow pages (pages with 🧭 emoji)
  if (!figma.currentPage.name.includes('🧭')) {
    updateMappingTab();
  } else {
    console.log('Skipping badge scan on flow page');
  }
});

// Also detect when selection changes (user might navigate to different elements)
figma.on('selectionchange', () => {
  console.log('Selection changed, updating mapping tab');
  // Don't scan for badges on flow pages
  if (!figma.currentPage.name.includes('🧭')) {
    updateMappingTab();
  }
});

// Initial scan when plugin loads
setTimeout(() => {
  updateMappingTab();
}, 1000);

figma.ui.onmessage = async (msg) => {
  if (msg.type === "start-crawl") {
    const { url, maxRequestsPerCrawl, screenshotWidth: width, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements, auth } = msg;

    console.log('📡 Main.ts received crawl request for URL:', url);

    // Store the screenshot width for later use
    screenshotWidth = width || 1440;
    hasRenderedSitemap = false; // Reset flag for new crawl

    try {
      const response = await fetch(`${BACKEND_URL}/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, publicUrl: BACKEND_URL, maxRequestsPerCrawl, deviceScaleFactor: deviceScaleFactor || 1, delay: delay || 0, requestDelay: requestDelay || 1000, maxDepth, defaultLanguageOnly: defaultLanguageOnly !== false, sampleSize, showBrowser, detectInteractiveElements: detectInteractiveElements !== false, auth }),
      });

      const result = await response.json();

      figma.ui.postMessage({
        type: "crawl-started",
        jobId: result.jobId,
      });
    } catch (error) {
      console.error("Failed to start crawl:", error);
      figma.notify("Error: Could not connect to the backend server.", {
        error: true,
      });
    }
  }

  if (msg.type === "save-settings") {
    try {
      await figma.clientStorage.setAsync("settings", msg.settings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  if (msg.type === "load-settings") {
    try {
      const settings = await figma.clientStorage.getAsync("settings");
      figma.ui.postMessage({
        type: "settings-loaded",
        settings: settings || null,
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
      figma.ui.postMessage({
        type: "settings-loaded",
        settings: null,
      });
    }
  }

  if (msg.type === "get-status") {
    const { jobId } = msg;

    try {

      const response = await fetch(`${BACKEND_URL}/status/${jobId}`);
      const result = await response.json();

      if (result.status === "completed" && result.result?.manifestUrl && !hasRenderedSitemap) {
        hasRenderedSitemap = true; // Prevent duplicate rendering
        console.log("🎉 Job completed, rendering sitemap (first time)");

        console.log(
          "Job complete! Fetching manifest from:",
          result.result.manifestUrl
        );

        const manifestResponse = await fetch(result.result.manifestUrl);

        if (!manifestResponse.ok) {
          console.error("Failed to fetch manifest:", manifestResponse.status, manifestResponse.statusText);
          figma.notify("Error: Could not fetch manifest from backend.", { error: true });
          return;
        }

        const manifestData = await manifestResponse.json();

        console.log("Successfully fetched manifest: ", manifestData);

        figma.notify("Crawl complete and manifest fetched!");
        const detectInteractiveElements = result.result?.detectInteractiveElements !== false;
        await renderSitemap(manifestData, screenshotWidth, detectInteractiveElements);
      } else if (result.status === "completed" && hasRenderedSitemap) {
        console.log("⚠️  Skipping duplicate sitemap rendering");
      }

      figma.ui.postMessage({
        type: "status-update",
        jobId,
        status: result.status,
        progress: result.progress,
        detailedProgress: result.detailedProgress,
        manifestUrl: result.result?.manifestUrl,
      });
    } catch (error) {
      console.error("Failed to get job status: ", error);
      figma.notify("Error: Could not get job status.", { error: true });
    }
  }

  if (msg.type === "show-flow") {
    const { selectedLinks } = msg;
    console.log('📊 Show flow requested for links:', selectedLinks);

    try {
      await handleShowFlow(selectedLinks);
    } catch (error) {
      console.error("Failed to create flow:", error);
      figma.notify("Error: Could not create flow visualization.", { error: true });
    }
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};

// Handler for creating flow visualization
async function handleShowFlow(selectedLinks: Array<{ id: string, text: string, url: string }>) {
  if (selectedLinks.length === 0) {
    figma.notify("No links selected");
    return;
  }

  // For now, handle only single selection
  if (selectedLinks.length > 1) {
    figma.notify("Multiple flow visualization not yet implemented. Please select one link.");
    return;
  }

  const selectedLink = selectedLinks[0];
  console.log('Creating flow for:', selectedLink);

  // Get the current page
  const currentPage = figma.currentPage;
  const currentPageName = currentPage.name;
  
  // Extract hierarchy and title from current page name
  // Format can be: "3_Title" or "  3-14_Title" or "    3-14-15_Title"
  const pageMatch = currentPageName.match(/^(\s*)([\d-]+)_(.*)/);
  if (!pageMatch) {
    figma.notify("Could not parse current page name");
    return;
  }

  const currentIndent = pageMatch[1]; // Leading spaces
  const currentHierarchy = pageMatch[2]; // e.g., "3" or "3-14"
  const pageTitle = pageMatch[3];
  
  // Calculate new hierarchy and indent
  const newHierarchy = `${currentHierarchy}-${selectedLink.text}`;
  const currentLevel = currentHierarchy.split('-').length;
  const newLevel = currentLevel + 1;
  const newIndent = '  '.repeat(Math.max(0, newLevel - 1)); // 2 spaces per level, starting from level 2

  // Create flow page name with hierarchy and target page title (we'll update after crawl)
  const flowPageName = `${newIndent}${newHierarchy}_Loading...`;

  // Check if flow page already exists
  let flowPage = figma.root.children.find(p => p.name === flowPageName) as PageNode | undefined;

  if (!flowPage) {
    // Create new flow page
    flowPage = figma.createPage();
    flowPage.name = flowPageName;

    // Find the index of the current page and insert the flow page right after it
    const currentPageIndex = figma.root.children.indexOf(currentPage);
    figma.root.insertChild(currentPageIndex + 1, flowPage);

    console.log(`Created flow page: ${flowPageName}`);
  } else {
    console.log(`Flow page already exists: ${flowPageName}`);
  }

  // Create the flow visualization (will switch to flow page internally)
  await createFlowVisualization(flowPage, selectedLink, currentPage);

  figma.notify(`Flow visualization started for link ${selectedLink.text}`);
}

// Create flow visualization on the flow page
async function createFlowVisualization(
  flowPage: PageNode,
  selectedLink: { id: string, text: string, url: string },
  sourcePage: PageNode
) {
  console.log('Creating flow visualization for:', selectedLink);

  // Make sure we're on the source page when looking for elements
  const previousPage = figma.currentPage;
  figma.currentPage = sourcePage;

  // Step 1: Find the badge element on the source page
  const badgeElement = await figma.getNodeByIdAsync(selectedLink.id);

  if (!badgeElement || badgeElement.type !== 'TEXT') {
    console.error(`Could not find badge element with ID: ${selectedLink.id}`);
    figma.notify("Could not find badge element");
    figma.currentPage = previousPage;
    return;
  }

  console.log('Found badge element:', badgeElement.name);

  // Get the parent group (badge-with-link)
  const badgeGroup = badgeElement.parent;
  if (!badgeGroup || badgeGroup.type !== 'GROUP') {
    console.error('Badge element has unexpected structure');
    figma.notify("Badge element has unexpected structure");
    figma.currentPage = previousPage;
    return;
  }

  console.log('Found badge group:', badgeGroup.name);

  // Step 2: Find the screenshot frame and overlay container
  const screenshotFrames = sourcePage.findAll((node: SceneNode) =>
    node.type === 'FRAME' && node.name.includes('Screenshots')
  ) as FrameNode[];

  if (screenshotFrames.length === 0) {
    console.error('Could not find Screenshots frame');
    figma.notify("Could not find Screenshots frame");
    figma.currentPage = previousPage;
    return;
  }

  const screenshotFrame = screenshotFrames[0];
  console.log('Found screenshot frame:', screenshotFrame.name);

  // Find the overlay container
  let overlayContainer: FrameNode | null = null;
  const overlayFrames = sourcePage.findAll((node: SceneNode) =>
    node.type === 'FRAME' && node.name === 'Page Overlay'
  ) as FrameNode[];

  if (overlayFrames.length > 0) {
    overlayContainer = overlayFrames[0];
    console.log('Found overlay container at position:', overlayContainer.x, overlayContainer.y);
    console.log('Screenshot frame at position:', screenshotFrame.x, screenshotFrame.y);
  }

  // Step 3: Find and store the selected highlight rectangle info (before switching pages)
  let highlightRect: RectangleNode | null = null;
  let highlightX = 0;
  let highlightY = 0;
  
  if (overlayContainer) {
    const linkNumber = badgeElement.characters;
    const highlightNamePattern = `link_${linkNumber}_highlight:`;

    console.log(`Looking for highlight with name starting with: ${highlightNamePattern}`);
    console.log(`Overlay container has ${overlayContainer.children.length} children`);

    // Debug: list all rectangles in overlay
    const allRectangles = overlayContainer.findAll((node: SceneNode) =>
      node.type === 'RECTANGLE'
    ) as RectangleNode[];
    console.log(`Found ${allRectangles.length} rectangles in overlay:`);
    allRectangles.forEach(rect => console.log(`  - ${rect.name}`));

    const allHighlights = overlayContainer.findAll((node: SceneNode) =>
      node.type === 'RECTANGLE' && node.name.startsWith(highlightNamePattern)
    ) as RectangleNode[];

    if (allHighlights.length > 0) {
      highlightRect = allHighlights[0];
      highlightX = highlightRect.x;
      highlightY = highlightRect.y;
      console.log(`Found highlight rectangle: ${highlightRect.name} at position (${highlightX}, ${highlightY})`);
    } else {
      console.warn(`Could not find highlight rectangle for link ${linkNumber}. Expected name pattern: ${highlightNamePattern}`);
    }
  }

  // Switch to flow page before creating elements
  figma.currentPage = flowPage;

  // Step 4: Clone the entire screenshot frame
  const sourceScreenshotClone = screenshotFrame.clone();
  sourceScreenshotClone.name = `Source_${selectedLink.text}`;
  sourceScreenshotClone.x = 100;
  sourceScreenshotClone.y = 100;
  flowPage.appendChild(sourceScreenshotClone);

  // Step 5: Clone the selected highlight rectangle on top of screenshot
  if (highlightRect) {
    const selectedHighlight = highlightRect.clone();
    // Since both overlay container and screenshot frame are positioned at (0, 0) on the page,
    // the highlight position is already correct relative to the screenshot
    selectedHighlight.x = sourceScreenshotClone.x + highlightX;
    selectedHighlight.y = sourceScreenshotClone.y + highlightY;
    flowPage.appendChild(selectedHighlight);
    console.log(`Cloned highlight rectangle to flow page at (${selectedHighlight.x}, ${selectedHighlight.y})`);
    console.log(`Screenshot position: (${sourceScreenshotClone.x}, ${sourceScreenshotClone.y})`);
    console.log(`Original highlight position: (${highlightX}, ${highlightY})`);
    console.log(`Final highlight size: ${selectedHighlight.width}x${selectedHighlight.height}`);
  }

  console.log('Source screenshot and highlight created');

// Step 6: Create simple red arrow between source and target frames
  const arrow = figma.createVector();
  arrow.name = "Flow Arrow";
  
  // Position arrow top-aligned with source frame
  arrow.x = sourceScreenshotClone.x + sourceScreenshotClone.width + 20;
  arrow.y = sourceScreenshotClone.y - 15; // Top-aligned with source frame
  
  // Create bold red arrow shape with red stroke
  arrow.vectorPaths = [{
    windingRule: 'NONZERO',
    data: 'M 0 15 L 80 15 L 80 5 L 100 15 L 80 25 L 80 15 Z'
  }];
  arrow.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]; // Red fill
  arrow.strokes = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]; // Red stroke
  arrow.strokeWeight = 4; // 4px stroke weight

  flowPage.appendChild(arrow);

  // Step 7: Fetch and render target page
  // Position target page top-aligned with source frame
  const finalTargetX = arrow.x + 120;
  const finalTargetY = sourceScreenshotClone.y; // Top-aligned with source frame

  figma.notify(`Crawling target page: ${selectedLink.url}...`);

  // Trigger a crawl for the target URL
  const BACKEND_URL = 'http://localhost:3006';

  try {
    const response = await fetch(`${BACKEND_URL}/crawl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: selectedLink.url,
        publicUrl: BACKEND_URL,
        maxRequestsPerCrawl: 1, // Only crawl this one page
        deviceScaleFactor: 1,
        delay: 0,
        requestDelay: 1000,
        maxDepth: 0, // No depth - just this page
        defaultLanguageOnly: false,
        sampleSize: 1,
        showBrowser: false,
        detectInteractiveElements: true
      }),
    });

    const result = await response.json();
    const jobId = result.jobId;

    console.log(`Started crawl job ${jobId} for target page`);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max

    const pollInterval = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        clearInterval(pollInterval);
        figma.notify("Target page crawl timed out", { error: true });
        return;
      }

      try {
        const statusResponse = await fetch(`${BACKEND_URL}/status/${jobId}`);
        const statusResult = await statusResponse.json();

        if (statusResult.status === 'completed' && statusResult.result?.manifestUrl) {
          clearInterval(pollInterval);

          // Fetch manifest
          const manifestResponse = await fetch(statusResult.result.manifestUrl);
          const manifestData = await manifestResponse.json();

          console.log('Target page crawl completed, rendering...');
          
          // Update flow page name with target page title
          if (manifestData.tree && manifestData.tree.title) {
            const targetTitle = manifestData.tree.title;
            // Remove the crawl order number if present (e.g., "1_Title" -> "Title")
            const cleanTitle = targetTitle.replace(/^\d+_/, '');
            flowPage.name = flowPage.name.replace('_Loading...', `_${cleanTitle}`);
            console.log('Updated flow page name to:', flowPage.name);
          }

          // Render the target page on the flow page
          await renderTargetPage(flowPage, manifestData, finalTargetX, finalTargetY);

          figma.notify("Flow visualization complete!");
        }
      } catch (error) {
        console.error('Error polling for target page status:', error);
      }
    }, 3000);

  } catch (error) {
    console.error("Failed to crawl target page:", error);
    figma.notify("Error: Could not crawl target page.", { error: true });
  }
}

// Helper function to get image dimensions from PNG data
function getImageDimensionsFromPNG(imageData: Uint8Array): { width: number; height: number } {
  // PNG format: width is at bytes 16-19, height is at bytes 20-23 (big-endian)
  if (imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4E && imageData[3] === 0x47) {
    // It's a PNG file
    const width = (imageData[16] << 24) | (imageData[17] << 16) | (imageData[18] << 8) | imageData[19];
    const height = (imageData[20] << 24) | (imageData[21] << 16) | (imageData[22] << 8) | imageData[23];
    return { width, height };
  }

  // Fallback: return default dimensions
  console.warn('Could not parse image dimensions, using default');
  return { width: 1280, height: 1000 };
}

// Render the target page screenshot on the flow page
async function renderTargetPage(
  flowPage: PageNode,
  manifestData: any,
  x: number,
  y: number
) {
  console.log('Rendering target page at', x, y);
  console.log('Manifest data:', manifestData);

  // Handle case where tree might be null (single page crawl)
  // In that case, check if we have pages array
  let pageData = manifestData.tree;

  if (!pageData) {
    console.log('Tree is null, checking for pages array');
    // Tree might be null for single-page crawls, need to check backend
    figma.notify("No page data in manifest");
    return;
  }

  if (!pageData.screenshot || !Array.isArray(pageData.screenshot) || pageData.screenshot.length === 0) {
    console.error('No screenshot data:', pageData);
    figma.notify("No screenshot data in manifest");
    return;
  }

  const screenshotSlices = pageData.screenshot;

  // Create container frame for the target page
  const targetFrame = figma.createFrame();
  targetFrame.name = `Target_${pageData.title || 'Page'}`;
  targetFrame.x = x;
  targetFrame.y = y;
  targetFrame.clipsContent = false;

  let currentY = 0;
  let totalWidth = 1280; // Default width

  // Render each screenshot slice (they are just URL strings)
  for (let i = 0; i < screenshotSlices.length; i++) {
    const screenshotUrl = screenshotSlices[i];
    console.log(`Fetching screenshot ${i} from:`, screenshotUrl);

    const image = figma.createRectangle();
    image.name = `Screenshot_Slice_${i}`;

    // Fetch the image
    try {
      const imageResponse = await fetch(screenshotUrl);

      if (!imageResponse.ok) {
        throw new Error(`HTTP error! status: ${imageResponse.status}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      console.log(`Fetched image buffer, size:`, imageBuffer.byteLength);

      const imageData = new Uint8Array(imageBuffer);

      // Get image dimensions
      console.log('Getting image dimensions...');
      const dimensions = getImageDimensionsFromPNG(imageData);
      console.log(`Image dimensions: ${dimensions.width}x${dimensions.height}`);

      totalWidth = dimensions.width;
      const imageHeight = dimensions.height;

      // Create image in Figma
      console.log('Creating Figma image...');
      const figmaImage = figma.createImage(imageData);
      const imageFills: ImagePaint[] = [{
        type: 'IMAGE',
        scaleMode: 'FILL',
        imageHash: figmaImage.hash
      }];

      image.resize(totalWidth, imageHeight);
      image.fills = imageFills;
      image.x = 0;
      image.y = currentY;

      targetFrame.appendChild(image);
      currentY += imageHeight;

      console.log(`✅ Successfully loaded screenshot slice ${i}: ${totalWidth}x${imageHeight}`);

    } catch (error) {
      console.error(`❌ Failed to load screenshot slice ${i}:`, error);
      figma.notify(`Error loading screenshot: ${error}`, { error: true });
    }
  }

  // Resize container to fit content
  if (currentY > 0 && totalWidth > 0) {
    targetFrame.resize(totalWidth, currentY);
  }

  // Add interactive element overlays if present
  if (pageData.interactiveElements && pageData.interactiveElements.length > 0) {
    await addInteractiveElementsOverlay(targetFrame, pageData);
  }

  flowPage.appendChild(targetFrame);
}

// Add interactive elements overlay to target page (matching main crawl styling)
async function addInteractiveElementsOverlay(targetFrame: FrameNode, pageData: any) {
  // Create overlay for interactive elements
  const overlayContainer = figma.createFrame();
  overlayContainer.name = 'Page Overlay';
  overlayContainer.resize(targetFrame.width, targetFrame.height);
  overlayContainer.x = 0;
  overlayContainer.y = 0;
  overlayContainer.fills = [];
  overlayContainer.clipsContent = false;

  let linkCounter = 1;

  for (const element of pageData.interactiveElements) {
    const elementLabel = element.text || element.href || 'unnamed';
    
    // Create highlight rectangle - RED stroke, no fill, 50% opacity (matching main crawl)
    const highlightRect = figma.createRectangle();
    highlightRect.x = element.x;
    highlightRect.y = element.y;
    highlightRect.resize(element.width, element.height);

    // Style the highlight - red 1px stroke, no fill, 50% opacity
    highlightRect.fills = [];
    highlightRect.strokes = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
    highlightRect.strokeWeight = 1;
    highlightRect.opacity = 0.5;

    // Add numbered badge for links with destinations
    if (element.href && element.href !== '#') {
      highlightRect.name = `link_${linkCounter}_highlight: ${elementLabel}`;
      
      // Determine if link is external
      const isExternal = isExternalLink(element.href, pageData.url);
      const badgeColor = isExternal
        ? { r: 0.1, g: 0.6, b: 0.7 }
        : { r: 0.9, g: 0.45, b: 0.1 };

      const badge = figma.createEllipse();
      badge.name = `link_${linkCounter}_badge_circle`;

      const badgeSize = 18;
      badge.x = element.x + element.width - badgeSize - 4;
      badge.y = element.y - 4;
      badge.resize(badgeSize, badgeSize);

      // Style badge - colored fill, no stroke
      badge.fills = [{ type: "SOLID", color: badgeColor }];
      badge.strokes = [];

      // Add number text to badge
      const badgeText = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
      badgeText.fontName = { family: "Inter", style: "Bold" };
      badgeText.fontSize = 9;
      badgeText.characters = linkCounter.toString();
      badgeText.name = `link_${linkCounter}_badge_text`;

      // Add hyperlink to badge text
      try {
        let validUrl = element.href;

        // For internal links (relative URLs), prepend the base site URL
        if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://') && !validUrl.startsWith('mailto:')) {
          const baseUrl = pageData.url.match(/^https?:\/\/[^\/]+/)?.[0];
          if (baseUrl) {
            if (!validUrl.startsWith('/')) {
              validUrl = '/' + validUrl;
            }
            validUrl = baseUrl + validUrl;
          } else {
            validUrl = 'https://' + validUrl;
          }
        }

        // Validate URL
        const urlPattern = /^https?:\/\/[^\s]+$/;
        if (urlPattern.test(validUrl)) {
          const hyperlinkTarget: HyperlinkTarget = {
            type: "URL",
            value: validUrl
          };
          badgeText.setRangeHyperlink(0, badgeText.characters.length, hyperlinkTarget);
        }
      } catch (error) {
        console.log(`Skipping hyperlink for: ${element.href}`);
      }

      badgeText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

      // Center text in badge
      badgeText.x = badge.x + (badgeSize - badgeText.width) / 2;
      badgeText.y = badge.y + (badgeSize - badgeText.height) / 2;

      const badgeGroup = figma.group([badge, badgeText], overlayContainer);
      badgeGroup.name = `link_${linkCounter}_badge`;

      linkCounter++;
    } else {
      highlightRect.name = `${element.type}_highlight: ${elementLabel}`;
    }

    overlayContainer.appendChild(highlightRect);
  }

  targetFrame.appendChild(overlayContainer);
}
