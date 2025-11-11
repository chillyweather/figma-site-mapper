/**
 * STYLING ELEMENT HANDLERS
 *
 * Handles creating styling pages and rendering CSS variables:
 * 1. Gets URL from current page plugin data
 * 2. Creates new page with 🎨 prefix
 * 3. Crawls single page with element highlighting
 * 4. Renders global styles and element styles
 */

import { startCrawl, getJobStatus } from "../services/apiClient";
import { POLLING_CONFIG } from "../constants";
import { DEFAULT_SETTINGS } from "../../constants";
import { renderTargetPage } from "../services/targetPageRenderer";
import { loadDomainCookies } from "./uiMessageHandlers";
import { buildManifestFromProject } from "../utils/buildManifestFromProject";
import type { TreeNode } from "../../types";

async function getActiveProjectId(): Promise<string | null> {
  try {
    const stored = await figma.clientStorage.getAsync("activeProjectId");
    return stored || null;
  } catch (error) {
    console.error("Failed to load active project id", error);
    return null;
  }
}

/**
 * Extract domain from URL string
 */
function extractDomain(url: string): string | null {
  try {
    let domain = url.replace(/^https?:\/\//, "");
    domain = domain.split("/")[0];
    domain = domain.split("?")[0];
    domain = domain.split(":")[0];
    return domain;
  } catch (error) {
    console.error("Failed to extract domain from URL:", error);
    return null;
  }
}

/**
 * Load settings from client storage
 */
async function loadSettings(): Promise<any> {
  try {
    const settings = await figma.clientStorage.getAsync("pluginSettings");
    return settings || {};
  } catch (error) {
    console.error("Failed to load settings:", error);
    return {};
  }
}

/**
 * Handle get-current-page-url request from UI
 */
export async function handleGetCurrentPageUrl(): Promise<void> {
  const currentPage = figma.currentPage;
  const url = currentPage.getPluginData("URL");

  console.log("Current page URL:", url || "not set");

  figma.ui.postMessage({
    type: "current-page-url",
    url: url || null,
  });
}

/**
 * Handle show-styling-elements request from UI
 * This creates a new styling page below the current page
 */
export async function handleShowStylingElements(): Promise<void> {
  console.log("🎨 Starting styling page creation");

  try {
    const currentPage = figma.currentPage;
    const pageUrl = currentPage.getPluginData("URL");

    if (!pageUrl) {
      figma.notify("No URL found for current page", { error: true });
      return;
    }

    console.log("Creating styling page for URL:", pageUrl);

    // Load settings
    const settings = await loadSettings();
    const showBrowser = settings.showBrowser || false;

    // Try to load cached cookies for this domain
    let domainCookies = null;
    try {
      const domain = extractDomain(pageUrl);
      if (domain) {
        domainCookies = await loadDomainCookies(domain);
      }
    } catch (error) {
      console.log("Could not load domain cookies:", error);
    }

    // Build auth object if we have cookies
    let auth = null;
    if (domainCookies && domainCookies.length > 0) {
      auth = {
        method: "cookies" as const,
        cookies: domainCookies,
      };
      console.log(
        `🍪 Using ${domainCookies.length} cached cookies for authentication`
      );
    }

    // Start crawl with limit 1 and highlight elements enabled
    figma.notify("Crawling page for styling...");

    const projectId = await getActiveProjectId();
    if (!projectId) {
      figma.notify(
        "Select a project in the plugin UI before creating styling pages.",
        { error: true }
      );
      return;
    }

    const result = await startCrawl({
      url: pageUrl,
      maxRequestsPerCrawl: 1,
      screenshotWidth: 1440,
      deviceScaleFactor: 1,
      delay: 0,
      requestDelay: 1000,
      maxDepth: 0,
      defaultLanguageOnly: false,
      sampleSize: 1,
      showBrowser: showBrowser,
      detectInteractiveElements: true,
      captureOnlyVisibleElements: true,
      fullRefresh: false,
      auth: auth,
      projectId,
    });

    const jobId = result.jobId;
    console.log(`Started crawl job ${jobId} for styling page`);

    // Poll for completion
    await pollForStylingPageCompletion(jobId, currentPage, pageUrl);
  } catch (error) {
    console.error("Failed to create styling page:", error);
    figma.notify("Error creating styling page", { error: true });
  }
}

/**
 * Poll for job completion and render styling page
 */
async function pollForStylingPageCompletion(
  jobId: string,
  sourcePage: PageNode,
  pageUrl: string
): Promise<void> {
  let attempts = 0;
  const maxAttempts = POLLING_CONFIG.MAX_ATTEMPTS;

  while (attempts < maxAttempts) {
    await new Promise((resolve) =>
      setTimeout(resolve, POLLING_CONFIG.INTERVAL_MS)
    );
    attempts++;

    try {
      const status = await getJobStatus(jobId);
      console.log(`Polling attempt ${attempts}: ${status.status}`);

      if (
        status.status === "completed" &&
        status.result &&
        status.result.projectId &&
        status.result &&
        status.result.startUrl
      ) {
        console.log("Crawl completed, creating styling page");

        const detectInteractiveElements =
          status.result && status.result.detectInteractiveElements !== false;

        const manifestData = await buildManifestFromProject(
          status.result.projectId,
          status.result.startUrl,
          {
            detectInteractiveElements,
          }
        );

        const targetPageNode = findPageByUrl(manifestData.tree, pageUrl);

        if (!targetPageNode) {
          figma.notify("Could not locate crawled page in project data", {
            error: true,
          });
          return;
        }

        const manifestForPage = {
          tree: targetPageNode,
          projectId: manifestData.projectId,
          startUrl: manifestData.startUrl,
        };

        // Create new page with 🎨 prefix
        const stylingPage = figma.createPage();
        stylingPage.name = `🎨 ${sourcePage.name}`;

        // Find index of source page and insert styling page right after it
        const allPages = figma.root.children;
        const sourceIndex = allPages.indexOf(sourcePage);
        if (sourceIndex !== -1) {
          // Move styling page to position after source page
          const targetIndex = sourceIndex + 1;
          // Use appendChild then reorder
          if (targetIndex < allPages.length) {
            figma.root.insertChild(targetIndex, stylingPage);
          }
        }

        // Switch to the new styling page
        figma.currentPage = stylingPage;

        // Render the page with ALL element types highlighted
        await renderTargetPage(stylingPage, manifestForPage, 0, 0, {
          highlightAllElements: true,
          highlightElementFilters: {
            // Highlight ALL element types
            headings: true,
            buttons: true,
            inputs: true,
            textareas: true,
            selects: true,
            images: true,
            links: true,
            paragraphs: true,
            divs: true,
            other: true,
          },
        });

        figma.notify("✨ Styling page created successfully!");
        return;
      } else if (status.status === "failed") {
        figma.notify("Crawl failed", { error: true });
        return;
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }

  figma.notify("Timeout waiting for crawl to complete", { error: true });
}

function canonicalizeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch (error) {
    console.warn("Unable to canonicalize URL", url, error);
    return url;
  }
}

function findPageByUrl(
  root: TreeNode | null,
  targetUrl: string
): TreeNode | null {
  if (!root) {
    return null;
  }

  const canonicalTarget = canonicalizeUrl(targetUrl);
  const stack: TreeNode[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (canonicalizeUrl(node.url) === canonicalTarget) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      stack.push(...node.children);
    }
  }

  return null;
}

/**
 * Handle render-global-styles request from UI
 */
export async function handleRenderGlobalStylesRequest(): Promise<void> {
  console.log("🎨 Starting global styles rendering");

  try {
    const activeProjectId = await getActiveProjectId();
    if (!activeProjectId) {
      figma.notify("No active project selected", { error: true });
      return;
    }

    // Load all required fonts before creating text nodes
    await loadStylingFonts();

    // Create new page for global styles
    const globalStylesPage = figma.createPage();
    globalStylesPage.name = "🎨 Global Styles";

    // Insert page at the end
    figma.root.appendChild(globalStylesPage);
    figma.currentPage = globalStylesPage;

    // Fetch global styles data from backend
    const backendUrl = "http://localhost:3006";
    const stylesResponse = await fetch(`${backendUrl}/styles/global?projectId=${activeProjectId}`);
    const stylesData = await stylesResponse.json();

    console.log("Fetched global styles:", stylesData);

    // Create table with CSS variables
    await createGlobalStylesTable(globalStylesPage, stylesData);

    figma.notify("✨ Global styles table created!");
  } catch (error) {
    console.error("Failed to render global styles:", error);
    figma.notify("Error creating global styles page", { error: true });
  }
}

/**
 * Handle render-element-styles request from UI
 */
export async function handleRenderElementStylesRequest(elementId: string): Promise<void> {
  console.log(`🎨 Starting element styles rendering for element: ${elementId}`);

  try {
    if (!elementId) {
      figma.notify("No element selected", { error: true });
      return;
    }

    const activeProjectId = await getActiveProjectId();
    if (!activeProjectId) {
      figma.notify("No active project selected", { error: true });
      return;
    }

    // Load all required fonts before creating text nodes
    await loadStylingFonts();

    // Create new page for element styles
    const elementStylesPage = figma.createPage();
    elementStylesPage.name = `🎨 Element ${elementId.substring(0, 8)}`;

    // Insert page at the end
    figma.root.appendChild(elementStylesPage);
    figma.currentPage = elementStylesPage;

    // TODO: Implement actual element styles rendering
    // For now, just create a placeholder frame
    const frame = figma.createFrame();
    frame.name = `Element ${elementId}`;
    frame.x = 100;
    frame.y = 100;
    frame.resize(400, 300);
    frame.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.7, b: 0.7 } }];

    const text = figma.createText();
    text.characters = `Element ${elementId}\nStyles - Coming Soon`;
    text.fontSize = 16;
    text.x = 120;
    text.y = 200;

    elementStylesPage.appendChild(frame);
    elementStylesPage.appendChild(text);

    figma.notify("✨ Element styles page created!");
  } catch (error) {
    console.error("Failed to render element styles:", error);
    figma.notify("Error creating element styles page", { error: true });
  }
}

/**
 * Handle select-element-style request from UI
 */
export async function handleSelectElementStyle(elementId: string | null): Promise<void> {
  console.log(`Selecting element style: ${elementId}`);

  try {
    // Store selection in plugin data for future use
    await figma.clientStorage.setAsync("selectedElementId", elementId);
    
    if (elementId) {
      figma.notify(`Selected element: ${elementId.substring(0, 8)}...`);
    } else {
      figma.notify("Element selection cleared");
    }
  } catch (error) {
    console.error("Failed to handle element selection:", error);
  }
}

/**
 * Helper function to create a global styles table
 */
async function createGlobalStylesTable(page: PageNode, stylesData: any): Promise<void> {
  const cssVariables = stylesData.cssVariables || {};
  const variables = Object.entries(cssVariables);
  
  if (variables.length === 0) {
    // Create "No styles" message
    const text = figma.createText();
    text.characters = "No CSS variables found in this project";
    text.fontSize = 16;
    text.x = 100;
    text.y = 100;
    page.appendChild(text);
    return;
  }

  // Table layout settings
  const startX = 100;
  const startY = 100;
  const rowHeight = 40;
  const colWidths = [50, 200, 150, 100]; // #, Variable, Value, Sample

  // Table header
  const headers = ["#", "Variable Name", "Variable Value", "Sample"];
  let currentY = startY;

  // Create header row background
  const headerFrame = figma.createFrame();
  headerFrame.name = "Table Header";
  headerFrame.x = startX;
  headerFrame.y = currentY;
  headerFrame.resize(colWidths.reduce((a, b) => a + b, 0), rowHeight);
  headerFrame.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
  headerFrame.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  headerFrame.strokeWeight = 1;
  page.appendChild(headerFrame);

    // Create header text
    let currentX = startX + 10;
    for (let i = 0; i < headers.length; i++) {
      const headerText = figma.createText();
      headerText.characters = headers[i];
      headerText.fontSize = 12;
      headerText.fontName = { family: "Inter", style: "Bold" };
      headerText.x = currentX;
      headerText.y = currentY + 12;
      page.appendChild(headerText);
      currentX += colWidths[i];
    }

  currentY += rowHeight;

  // Create rows for each CSS variable
  variables.forEach(([variableName, variableValue], index) => {
    const rowNumber = index + 1;

    // Create row background
    const rowFrame = figma.createFrame();
    rowFrame.name = `Row ${rowNumber}`;
    rowFrame.x = startX;
    rowFrame.y = currentY;
    rowFrame.resize(colWidths.reduce((a, b) => a + b, 0), rowHeight);
    rowFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    rowFrame.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
    rowFrame.strokeWeight = 1;
    page.appendChild(rowFrame);

    // Create row text elements
    let textX = startX + 10;
    
    // Row number
    const numberText = figma.createText();
    numberText.characters = rowNumber.toString();
    numberText.fontSize = 11;
    numberText.x = textX;
    numberText.y = currentY + 12;
    page.appendChild(numberText);
    textX += colWidths[0];

    // Variable name
    const nameText = figma.createText();
    nameText.characters = variableName;
    nameText.fontSize = 11;
    nameText.x = textX;
    nameText.y = currentY + 12;
    page.appendChild(nameText);
    textX += colWidths[1];

    // Variable value
    const valueText = figma.createText();
    valueText.characters = String(variableValue);
    valueText.fontSize = 11;
    valueText.x = textX;
    valueText.y = currentY + 12;
    page.appendChild(valueText);
    textX += colWidths[2];

    // Sample (only for colors)
    if (isColorValue(String(variableValue))) {
      // Create rectangle color sample (24x60px with 2px border radius)
      const colorSample = figma.createRectangle();
      colorSample.name = `Color Sample - ${variableName}`;
      colorSample.resize(24, 60);
      colorSample.x = textX + 8; // Center in column
      colorSample.y = currentY + 10; // Center vertically in row
      colorSample.cornerRadius = 2; // Set corner radius for all corners
      
      // Safer color creation with validation
      try {
        const paint = colorToPaint(String(variableValue));
        console.log(`Color paint for ${variableName}:`, paint);
        
        // Validate the color values before assignment
        if (paint && paint.color && 
            !isNaN(paint.color.r) && !isNaN(paint.color.g) && !isNaN(paint.color.b) &&
            paint.color.r >= 0 && paint.color.r <= 1 &&
            paint.color.g >= 0 && paint.color.g <= 1 &&
            paint.color.b >= 0 && paint.color.b <= 1) {
          colorSample.fills = [paint];
        } else {
          console.warn(`Invalid color values for ${variableName}: ${variableValue}`);
          colorSample.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
        }
      } catch (error) {
        console.error(`Failed to create color paint for ${variableName}: ${variableValue}`, error);
        colorSample.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
      }
      
      page.appendChild(colorSample);
    }
    // No element created for non-color values (empty sample column)

    currentY += rowHeight;
  });

  // Add table title
  const titleText = figma.createText();
  titleText.characters = `CSS Variables (${variables.length} variables)`;
  titleText.fontSize = 18;
  titleText.fontName = { family: "Inter", style: "Bold" };
  titleText.x = startX;
  titleText.y = startY - 40;
  page.appendChild(titleText);
}

/**
 * Helper function to check if a value is a color
 */
function isColorValue(value: string): boolean {
  const colorPatterns = [
    /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, // Hex
    /^rgb\(/, // RGB
    /^rgba\(/, // RGBA
    /^hsl\(/, // HSL
    /^hsla\(/, // HSLA
  ];
  
  return colorPatterns.some(pattern => pattern.test(value));
}

/**
 * Helper function to load all required fonts for styling pages
 */
async function loadStylingFonts(): Promise<void> {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
}

/**
 * Helper function to convert color string to Figma paint
 */
function colorToPaint(colorString: string): SolidPaint {
  // Simple hex color converter
  if (colorString.startsWith('#')) {
    let hex = colorString.substring(1);
    
    // Handle 3-character hex colors (e.g., #fff)
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    
    // Ensure we have 6 characters
    if (hex.length !== 6) {
      return { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } };
    }
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Check if parsing failed (NaN)
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } };
    }
    
    return { type: 'SOLID', color: { r: r / 255, g: g / 255, b: b / 255 } };
  }
  
  // Default to gray if can't parse
  return { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } };
}
