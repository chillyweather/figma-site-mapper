import { renderSitemap } from "./figmaRendering/renderSitemap";

const BACKEND_URL = 'http://localhost:3006';
let screenshotWidth = 1440; // Default screenshot width
let hasRenderedSitemap = false; // Prevent duplicate rendering

figma.showUI(__html__, { width: 320, height: 1000, themeColors: true });

// Function to scan current page for badge-with-link elements
async function scanForBadgeLinks(): Promise<Array<{id: string, text: string, url: string}>> {
  const badgeLinks: Array<{id: string, text: string, url: string}> = [];
  
  try {
    // Find all groups with name "badge-with-link"
    const badgeGroups = figma.currentPage.findAll(node => 
      node.type === 'GROUP' && node.name === 'badge-with-link'
    );
    
    for (const group of badgeGroups) {
      if (group.type === 'GROUP') {
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
            } else {
              // If no hyperlink, still show the text content
              const text = textNode.characters || 'Link';
              if (text && text.trim()) {
                badgeLinks.push({
                  id: textNode.id,
                  text: text,
                  url: `#${text.toLowerCase().replace(/\s+/g, '-')}`
                });
              }
            }
          }
        }
      }
    }
    
    console.log(`Found ${badgeLinks.length} badge-with-link elements`);
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
  updateMappingTab();
});

// Also detect when selection changes (user might navigate to different elements)
figma.on('selectionchange', () => {
  console.log('Selection changed, updating mapping tab');
  updateMappingTab();
});

// Initial scan when plugin loads
setTimeout(() => {
  updateMappingTab();
}, 1000);

figma.ui.onmessage = async (msg) => {
  if (msg.type === "start-crawl") {
    const { url, maxRequestsPerCrawl, screenshotWidth: width, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, showBrowser, auth } = msg;

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
        body: JSON.stringify({ url, publicUrl: BACKEND_URL, maxRequestsPerCrawl, deviceScaleFactor: deviceScaleFactor || 1, delay: delay || 0, requestDelay: requestDelay || 1000, maxDepth, defaultLanguageOnly: defaultLanguageOnly !== false, sampleSize, showBrowser, auth }),
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
        await renderSitemap(manifestData, screenshotWidth);
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

  if (msg.type === "close") {
    figma.closePlugin();
  }
};
