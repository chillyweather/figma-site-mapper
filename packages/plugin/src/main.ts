import { renderSitemap } from "./figmaRendering/renderSitemap";

const BACKEND_URL = 'http://localhost:3006';
let screenshotWidth = 1440; // Default screenshot width
let hasRenderedSitemap = false; // Prevent duplicate rendering

figma.showUI(__html__, { width: 480, height: 1000, themeColors: true });

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
    // Find all groups with name "badge-with-link"
    const badgeGroups = figma.currentPage.findAll(node =>
      node.type === 'GROUP' && node.name === 'badge-with-link'
    );

    for (const group of badgeGroups) {
      if (group.type === 'GROUP') {
        // Check badge color to filter internal vs external links
        // Orange badge = internal link, Cyan badge = external link
        const ellipseNodes = group.findAll(node => node.type === 'ELLIPSE');
        
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
        const textNodes = group.findAll(node => node.type === 'TEXT');

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

    console.log(`Found ${badgeLinks.length} internal badge-with-link elements (filtered out external links by badge color)`);
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
  
  // Extract the page number and title from current page name (format: "1_Page Title")
  const pageMatch = currentPageName.match(/^(\d+)_(.*)/);
  if (!pageMatch) {
    figma.notify("Could not parse current page name");
    return;
  }
  
  const pageNumber = pageMatch[1];
  const pageTitle = pageMatch[2];
  
  // Create flow page name with compass emoji
  const flowPageName = `${pageNumber}_🧭_${pageTitle}`;
  
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
    figma.currentPage = previousPage; // Restore previous page
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
  
  // Find the overlay container and screenshot to get context
  let overlayContainer: FrameNode | null = null;
  let screenshotImage: RectangleNode | null = null;
  
  // Navigate up to find the Page Overlay frame
  let currentNode: BaseNode | null = badgeGroup.parent;
  while (currentNode) {
    if (currentNode.type === 'FRAME' && currentNode.name === 'Page Overlay') {
      overlayContainer = currentNode;
      break;
    }
    currentNode = currentNode.parent;
  }
  
  if (!overlayContainer) {
    console.error('Could not find Page Overlay container');
    figma.notify("Could not find Page Overlay container");
    figma.currentPage = previousPage;
    return;
  }
  
  console.log('Found overlay container');
  
  // Find the screenshot frame (frame containing "Screenshots" in name)
  const screenshotFrames = sourcePage.findAll(node => 
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
  
  // Get the first rectangle child (the actual screenshot image)
  const rectangles = screenshotFrame.findAll(node => node.type === 'RECTANGLE') as RectangleNode[];
  
  if (rectangles.length === 0) {
    console.error('Could not find screenshot rectangles');
    figma.notify("Could not find screenshot image");
    figma.currentPage = previousPage;
    return;
  }
  
  screenshotImage = rectangles[0];
  console.log('Found screenshot image');
  
  // Step 2: Create context screenshot (80px around the badge element)
  const CONTEXT_PADDING = 80;
  const badgeBounds = badgeGroup.absoluteBoundingBox;
  
  if (!badgeBounds) {
    console.error('Could not get badge bounds');
    figma.notify("Could not get badge bounds");
    figma.currentPage = previousPage;
    return;
  }
  
  console.log('Badge bounds:', badgeBounds);
  
  // Calculate context area
  const contextX = Math.max(0, badgeBounds.x - CONTEXT_PADDING);
  const contextY = Math.max(0, badgeBounds.y - CONTEXT_PADDING);
  const contextWidth = badgeBounds.width + (CONTEXT_PADDING * 2);
  const contextHeight = badgeBounds.height + (CONTEXT_PADDING * 2);
  
  console.log('Creating context frame with dimensions:', contextWidth, contextHeight);
  
  // Switch to flow page before creating elements
  figma.currentPage = flowPage;
  
  // Create a frame for the context screenshot
  const contextFrame = figma.createFrame();
  contextFrame.name = `Context_${selectedLink.text}`;
  contextFrame.x = 100;
  contextFrame.y = 100;
  contextFrame.resize(contextWidth, contextHeight);
  contextFrame.clipsContent = true;
  contextFrame.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
  
  // Clone the screenshot frame to get the full image
  const screenshotFrameClone = screenshotImage.parent?.type === 'FRAME' 
    ? (screenshotImage.parent as FrameNode).clone() 
    : screenshotImage.clone();
  
  // Position the cloned screenshot so the badge area is visible
  const screenshotBounds = screenshotImage.absoluteBoundingBox!;
  screenshotFrameClone.x = screenshotBounds.x - contextX;
  screenshotFrameClone.y = screenshotBounds.y - contextY;
  
  contextFrame.appendChild(screenshotFrameClone);
  
  // Clone the badge and overlay elements that are within the context area
  const badgeClone = badgeGroup.clone();
  badgeClone.x = badgeBounds.x - contextX;
  badgeClone.y = badgeBounds.y - contextY;
  contextFrame.appendChild(badgeClone);
  
  flowPage.appendChild(contextFrame);
  
  console.log('Context frame created');
  
  // Step 3: Create arrow
  const arrow = figma.createVector();
  arrow.name = "Flow Arrow";
  arrow.x = contextFrame.x + contextFrame.width + 50;
  arrow.y = contextFrame.y + (contextFrame.height / 2) - 10;
  
  // Create simple arrow shape (right-pointing)
  arrow.vectorPaths = [{
    windingRule: 'NONZERO',
    data: 'M 0 10 L 40 10 L 40 0 L 60 15 L 40 30 L 40 20 L 0 20 Z'
  }];
  arrow.fills = [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 0.8 } }];
  
  flowPage.appendChild(arrow);
  
  // Step 4: Fetch and render the target page
  const targetX = arrow.x + 120;
  const targetY = 100;
  
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
          
          // Render the target page on the flow page
          await renderTargetPage(flowPage, manifestData, targetX, targetY);
          
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

// Add interactive elements overlay to target page
async function addInteractiveElementsOverlay(targetFrame: FrameNode, pageData: any) {
  // This is similar to createScreenshotPages logic
  // Create overlay for interactive elements
  const overlayContainer = figma.createFrame();
  overlayContainer.name = 'Interactive Elements Overlay';
  overlayContainer.resize(targetFrame.width, targetFrame.height);
  overlayContainer.x = 0;
  overlayContainer.y = 0;
  overlayContainer.fills = [];
  overlayContainer.clipsContent = false;
  
  let linkCounter = 1;
  
  for (const element of pageData.interactiveElements) {
    const scaledX = element.x;
    const scaledY = element.y;
    const scaledWidth = element.width;
    const scaledHeight = element.height;
    
    // Create highlight rectangle
    const highlightRect = figma.createRectangle();
    highlightRect.name = `${element.type}_highlight`;
    highlightRect.x = scaledX;
    highlightRect.y = scaledY;
    highlightRect.resize(scaledWidth, scaledHeight);
    
    const fillColor = element.type === 'link'
      ? { r: 1, g: 0.6, b: 0 }
      : { r: 0, g: 0.6, b: 1 };
    
    highlightRect.fills = [{ type: "SOLID", color: fillColor }];
    highlightRect.strokes = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    highlightRect.strokeWeight = 2;
    highlightRect.opacity = 0.5;
    
    overlayContainer.appendChild(highlightRect);
    
    // Add numbered badge for links
    if (element.href && element.href !== '#') {
      const badge = figma.createEllipse();
      badge.name = `Link ${linkCounter}`;
      
      const badgeSize = 18;
      badge.x = scaledX + scaledWidth - badgeSize - 4;
      badge.y = scaledY - 4;
      badge.resize(badgeSize, badgeSize);
      
      const badgeColor = { r: 0.9, g: 0.45, b: 0.1 }; // Orange for internal
      badge.fills = [{ type: "SOLID", color: badgeColor }];
      badge.strokes = [];
      
      const badgeText = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
      badgeText.fontName = { family: "Inter", style: "Bold" };
      badgeText.fontSize = 9;
      badgeText.characters = linkCounter.toString();
      badgeText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      
      badgeText.x = badge.x + (badgeSize - badgeText.width) / 2;
      badgeText.y = badge.y + (badgeSize - badgeText.height) / 2;
      
      const badgeGroup = figma.group([badge, badgeText], overlayContainer);
      badgeGroup.name = "badge-with-link";
      
      linkCounter++;
    }
  }
  
  targetFrame.appendChild(overlayContainer);
}
