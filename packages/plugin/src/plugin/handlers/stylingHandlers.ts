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
    const stylesResponse = await fetch(
      `${backendUrl}/styles/global?projectId=${activeProjectId}`
    );
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
export async function handleRenderElementStylesRequest(
  elementId: string
): Promise<void> {
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

    // Fetch element data from backend
    const backendUrl = "http://localhost:3006";
    const elementResponse = await fetch(
      `${backendUrl}/styles/element?projectId=${activeProjectId}&elementId=${elementId}`
    );
    
    if (!elementResponse.ok) {
      figma.notify("Failed to fetch element data", { error: true });
      return;
    }
    
    const responseData = await elementResponse.json();
    const elementData = responseData.element;
    console.log("Fetched element data:", elementData);

    // Create new page for element styles
    const elementStylesPage = figma.createPage();
    elementStylesPage.name = `🎨 ${elementData.type || 'Element'} ${elementId.substring(0, 8)}`;

    // Insert page at the end
    figma.root.appendChild(elementStylesPage);
    figma.currentPage = elementStylesPage;

    // Create element styles table
    await createElementStylesTable(elementStylesPage, elementData);

    figma.notify("✨ Element styles table created!");
  } catch (error) {
    console.error("Failed to render element styles:", error);
    figma.notify("Error creating element styles page", { error: true });
  }
}

/**
 * Handle select-element-style request from UI
 */
export async function handleSelectElementStyle(
  elementId: string | null
): Promise<void> {
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
 * Helper function to create a text node with auto-layout support
 * Note: Fonts must be loaded before calling this function
 */
function createStyledText(
  text: string,
  fontSize: number,
  fontWeight: "Regular" | "Medium" | "Bold"
): TextNode {
  const textNode = figma.createText();
  textNode.characters = text;
  textNode.fontSize = fontSize;
  textNode.textAutoResize = "WIDTH_AND_HEIGHT";
  textNode.layoutGrow = 0;
  textNode.layoutAlign = "MIN";
  // Font must already be loaded via loadStylingFonts()
  try {
    textNode.fontName = { family: "Inter", style: fontWeight };
  } catch (error) {
    console.error(`Failed to set font ${fontWeight}:`, error);
    // Fallback to Regular if the specific weight fails
    textNode.fontName = { family: "Inter", style: "Regular" };
  }
  return textNode;
}

/**
 * Helper function to create a table row with auto-layout
 */
function createVariableRow(
  variableName: string,
  variableValue: string,
  width: number
): FrameNode {
  const rowFrame = figma.createFrame();
  rowFrame.name = "variable-row";
  rowFrame.layoutMode = "HORIZONTAL";
  rowFrame.primaryAxisSizingMode = "FIXED";
  rowFrame.counterAxisSizingMode = "AUTO";
  rowFrame.resize(width, rowFrame.height);
  rowFrame.paddingLeft = 12;
  rowFrame.paddingRight = 12;
  rowFrame.paddingTop = 12;
  rowFrame.paddingBottom = 12;
  rowFrame.itemSpacing = 16;
  rowFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  rowFrame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
  rowFrame.strokeWeight = 1;
  rowFrame.cornerRadius = 4;

  // Name container (fixed width)
  const nameContainer = figma.createFrame();
  nameContainer.name = "name";
  nameContainer.layoutMode = "HORIZONTAL";
  nameContainer.primaryAxisSizingMode = "FIXED";
  nameContainer.counterAxisSizingMode = "AUTO";
  nameContainer.resize(300, nameContainer.height);
  nameContainer.fills = [];

  const nameText = createStyledText(variableName, 12, "Medium");
  nameContainer.appendChild(nameText);

  // Value container (grows to fill space)
  const valueContainer = figma.createFrame();
  valueContainer.name = "value";
  valueContainer.layoutMode = "HORIZONTAL";
  valueContainer.primaryAxisSizingMode = "FIXED";
  valueContainer.counterAxisSizingMode = "AUTO";
  valueContainer.resize(250, valueContainer.height);
  valueContainer.fills = [];

  const valueText = createStyledText(String(variableValue), 12, "Regular");
  valueText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
  valueContainer.appendChild(valueText);

  // Sample container (color preview if applicable)
  const sampleContainer = figma.createFrame();
  sampleContainer.name = "sample";
  sampleContainer.layoutMode = "HORIZONTAL";
  sampleContainer.primaryAxisSizingMode = "FIXED";
  sampleContainer.counterAxisSizingMode = "AUTO";
  sampleContainer.resize(80, sampleContainer.height);
  sampleContainer.fills = [];
  sampleContainer.primaryAxisAlignItems = "CENTER";
  sampleContainer.counterAxisAlignItems = "CENTER";

  if (isColorValue(String(variableValue))) {
    const colorSample = figma.createRectangle();
    colorSample.name = "color-preview";
    colorSample.resize(48, 24);
    colorSample.cornerRadius = 4;

    try {
      const paint = colorToPaint(String(variableValue));
      if (
        paint &&
        paint.color &&
        !isNaN(paint.color.r) &&
        !isNaN(paint.color.g) &&
        !isNaN(paint.color.b) &&
        paint.color.r >= 0 &&
        paint.color.r <= 1 &&
        paint.color.g >= 0 &&
        paint.color.g <= 1 &&
        paint.color.b >= 0 &&
        paint.color.b <= 1
      ) {
        colorSample.fills = [paint];
        colorSample.strokes = [
          { type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } },
        ];
        colorSample.strokeWeight = 1;
      } else {
        colorSample.fills = [
          { type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } },
        ];
      }
    } catch (error) {
      console.error(
        `Failed to create color for ${variableName}: ${variableValue}`,
        error
      );
      colorSample.fills = [
        { type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } },
      ];
    }

    sampleContainer.appendChild(colorSample);
  }

  rowFrame.appendChild(nameContainer);
  rowFrame.appendChild(valueContainer);
  rowFrame.appendChild(sampleContainer);

  return rowFrame;
}

/**
 * Helper function to create an element styles table
 */
async function createElementStylesTable(
  page: PageNode,
  elementData: any
): Promise<void> {
  const styles = elementData.styles || {};
  const styleEntries = Object.entries(styles);

  if (styleEntries.length === 0) {
    const text = figma.createText();
    text.characters = "No styles found for this element";
    text.fontSize = 16;
    text.x = 100;
    text.y = 100;
    page.appendChild(text);
    return;
  }

  // Create main container with auto-layout
  const mainFrame = figma.createFrame();
  mainFrame.name = "Element Styles Table";
  mainFrame.layoutMode = "VERTICAL";
  mainFrame.primaryAxisSizingMode = "AUTO";
  mainFrame.counterAxisSizingMode = "FIXED";
  mainFrame.resize(740, mainFrame.height);
  mainFrame.paddingLeft = 20;
  mainFrame.paddingRight = 20;
  mainFrame.paddingTop = 20;
  mainFrame.paddingBottom = 20;
  mainFrame.itemSpacing = 16;
  mainFrame.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
  mainFrame.cornerRadius = 8;

  // Add title
  const titleText = createStyledText(
    `${elementData.type || 'Element'} Styles (${styleEntries.length} properties)`,
    18,
    "Bold"
  );
  titleText.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  mainFrame.appendChild(titleText);

  // Add element info
  if (elementData.text || elementData.selector) {
    const infoFrame = figma.createFrame();
    infoFrame.name = "element-info";
    infoFrame.layoutMode = "VERTICAL";
    infoFrame.primaryAxisSizingMode = "AUTO";
    infoFrame.counterAxisSizingMode = "FIXED";
    infoFrame.resize(700, infoFrame.height);
    infoFrame.itemSpacing = 4;
    infoFrame.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
    infoFrame.paddingLeft = 12;
    infoFrame.paddingRight = 12;
    infoFrame.paddingTop = 8;
    infoFrame.paddingBottom = 8;
    infoFrame.cornerRadius = 4;

    if (elementData.text) {
      const textLabel = createStyledText("Text:", 12, "Medium");
      textLabel.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
      const textValue = createStyledText(elementData.text, 12, "Regular");
      textValue.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
      
      infoFrame.appendChild(textLabel);
      infoFrame.appendChild(textValue);
    }

    if (elementData.selector) {
      const selectorLabel = createStyledText("Selector:", 12, "Medium");
      selectorLabel.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
      const selectorValue = createStyledText(elementData.selector, 12, "Regular");
      selectorValue.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
      
      infoFrame.appendChild(selectorLabel);
      infoFrame.appendChild(selectorValue);
    }

    mainFrame.appendChild(infoFrame);
  }

  // Add header row
  const headerFrame = figma.createFrame();
  headerFrame.name = "header";
  headerFrame.layoutMode = "HORIZONTAL";
  headerFrame.primaryAxisSizingMode = "FIXED";
  headerFrame.counterAxisSizingMode = "AUTO";
  headerFrame.resize(700, headerFrame.height);
  headerFrame.paddingLeft = 12;
  headerFrame.paddingRight = 12;
  headerFrame.paddingTop = 8;
  headerFrame.paddingBottom = 8;
  headerFrame.itemSpacing = 16;
  headerFrame.fills = [{ type: "SOLID", color: { r: 0.92, g: 0.92, b: 0.92 } }];
  headerFrame.cornerRadius = 4;

  // Header columns
  const headers = [
    { text: "Property", width: 250 },
    { text: "Value", width: 300 },
    { text: "Preview", width: 80 },
  ];

  headers.forEach(({ text: headerText, width }) => {
    const headerCol = figma.createFrame();
    headerCol.name = "header-col";
    headerCol.layoutMode = "HORIZONTAL";
    headerCol.primaryAxisSizingMode = "FIXED";
    headerCol.counterAxisSizingMode = "AUTO";
    headerCol.resize(width, headerCol.height);
    headerCol.fills = [];

    const text = createStyledText(headerText, 11, "Bold");
    text.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
    headerCol.appendChild(text);

    headerFrame.appendChild(headerCol);
  });

  mainFrame.appendChild(headerFrame);

  // Add style property rows
  styleEntries.forEach(([propertyName, propertyValue]) => {
    const row = createStylePropertyRow(propertyName, String(propertyValue), 700);
    mainFrame.appendChild(row);
  });

  // Position in viewport
  page.appendChild(mainFrame);

  // Position to the right of existing content
  const allNodes = page.children.filter((n) => n.id !== mainFrame.id);
  let rightmostX = 0;
  let topmostY = 0;

  if (allNodes.length > 0) {
    allNodes.forEach((node) => {
      const nodeRight = node.x + node.width;
      if (nodeRight > rightmostX) {
        rightmostX = nodeRight;
      }
      if (node.y < topmostY || topmostY === 0) {
        topmostY = node.y;
      }
    });
    mainFrame.x = rightmostX + 200;
    mainFrame.y = topmostY;
  } else {
    mainFrame.x = figma.viewport.center.x - mainFrame.width / 2;
    mainFrame.y = figma.viewport.center.y - mainFrame.height / 2;
  }

  // Select and zoom to the frame
  page.selection = [mainFrame];
  figma.viewport.scrollAndZoomIntoView([mainFrame]);
}

/**
 * Helper function to create a style property row with auto-layout
 */
function createStylePropertyRow(
  propertyName: string,
  propertyValue: string,
  width: number
): FrameNode {
  const rowFrame = figma.createFrame();
  rowFrame.name = "style-row";
  rowFrame.layoutMode = "HORIZONTAL";
  rowFrame.primaryAxisSizingMode = "FIXED";
  rowFrame.counterAxisSizingMode = "AUTO";
  rowFrame.resize(width, rowFrame.height);
  rowFrame.paddingLeft = 12;
  rowFrame.paddingRight = 12;
  rowFrame.paddingTop = 12;
  rowFrame.paddingBottom = 12;
  rowFrame.itemSpacing = 16;
  rowFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  rowFrame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
  rowFrame.strokeWeight = 1;
  rowFrame.cornerRadius = 4;

  // Property name container (fixed width)
  const nameContainer = figma.createFrame();
  nameContainer.name = "property-name";
  nameContainer.layoutMode = "HORIZONTAL";
  nameContainer.primaryAxisSizingMode = "FIXED";
  nameContainer.counterAxisSizingMode = "AUTO";
  nameContainer.resize(250, nameContainer.height);
  nameContainer.fills = [];

  const nameText = createStyledText(propertyName, 12, "Medium");
  nameContainer.appendChild(nameText);

  // Value container (grows to fill space)
  const valueContainer = figma.createFrame();
  valueContainer.name = "property-value";
  valueContainer.layoutMode = "HORIZONTAL";
  valueContainer.primaryAxisSizingMode = "FIXED";
  valueContainer.counterAxisSizingMode = "AUTO";
  valueContainer.resize(300, valueContainer.height);
  valueContainer.fills = [];

  const valueText = createStyledText(propertyValue, 12, "Regular");
  valueText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
  valueContainer.appendChild(valueText);

  // Sample container (color preview if applicable)
  const sampleContainer = figma.createFrame();
  sampleContainer.name = "sample";
  sampleContainer.layoutMode = "HORIZONTAL";
  sampleContainer.primaryAxisSizingMode = "FIXED";
  sampleContainer.counterAxisSizingMode = "AUTO";
  sampleContainer.resize(80, sampleContainer.height);
  sampleContainer.fills = [];
  sampleContainer.primaryAxisAlignItems = "CENTER";
  sampleContainer.counterAxisAlignItems = "CENTER";

  if (isColorValue(propertyValue)) {
    const colorSample = figma.createRectangle();
    colorSample.name = "color-preview";
    colorSample.resize(48, 24);
    colorSample.cornerRadius = 4;

    try {
      const paint = colorToPaint(propertyValue);
      if (
        paint &&
        paint.color &&
        !isNaN(paint.color.r) &&
        !isNaN(paint.color.g) &&
        !isNaN(paint.color.b) &&
        paint.color.r >= 0 &&
        paint.color.r <= 1 &&
        paint.color.g >= 0 &&
        paint.color.g <= 1 &&
        paint.color.b >= 0 &&
        paint.color.b <= 1
      ) {
        colorSample.fills = [paint];
        colorSample.strokes = [
          { type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } },
        ];
        colorSample.strokeWeight = 1;
      } else {
        colorSample.fills = [
          { type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } },
        ];
      }
    } catch (error) {
      console.error(
        `Failed to create color for ${propertyName}: ${propertyValue}`,
        error
      );
      colorSample.fills = [
        { type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } },
      ];
    }

    sampleContainer.appendChild(colorSample);
  }

  rowFrame.appendChild(nameContainer);
  rowFrame.appendChild(valueContainer);
  rowFrame.appendChild(sampleContainer);

  return rowFrame;
}

/**
 * Helper function to create a global styles table
 */
async function createGlobalStylesTable(
  page: PageNode,
  stylesData: any
): Promise<void> {
  const cssVariables = stylesData.cssVariables || {};
  const variables = Object.entries(cssVariables);

  if (variables.length === 0) {
    const text = figma.createText();
    text.characters = "No CSS variables found in this project";
    text.fontSize = 16;
    text.x = 100;
    text.y = 100;
    page.appendChild(text);
    return;
  }

  // Create main container with auto-layout
  const mainFrame = figma.createFrame();
  mainFrame.name = "Global Styles Table";
  mainFrame.layoutMode = "VERTICAL";
  mainFrame.primaryAxisSizingMode = "AUTO";
  mainFrame.counterAxisSizingMode = "FIXED";
  mainFrame.resize(740, mainFrame.height);
  mainFrame.paddingLeft = 20;
  mainFrame.paddingRight = 20;
  mainFrame.paddingTop = 20;
  mainFrame.paddingBottom = 20;
  mainFrame.itemSpacing = 16;
  mainFrame.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
  mainFrame.cornerRadius = 8;

  // Add title
  const titleText = createStyledText(
    `CSS Variables (${variables.length} total)`,
    18,
    "Bold"
  );
  titleText.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  mainFrame.appendChild(titleText);

  // Add header row
  const headerFrame = figma.createFrame();
  headerFrame.name = "header";
  headerFrame.layoutMode = "HORIZONTAL";
  headerFrame.primaryAxisSizingMode = "FIXED";
  headerFrame.counterAxisSizingMode = "AUTO";
  headerFrame.resize(700, headerFrame.height);
  headerFrame.paddingLeft = 12;
  headerFrame.paddingRight = 12;
  headerFrame.paddingTop = 8;
  headerFrame.paddingBottom = 8;
  headerFrame.itemSpacing = 16;
  headerFrame.fills = [{ type: "SOLID", color: { r: 0.92, g: 0.92, b: 0.92 } }];
  headerFrame.cornerRadius = 4;

  // Header columns
  const headers = [
    { text: "Variable Name", width: 300 },
    { text: "Value", width: 250 },
    { text: "Preview", width: 80 },
  ];

  headers.forEach(({ text: headerText, width }) => {
    const headerCol = figma.createFrame();
    headerCol.name = "header-col";
    headerCol.layoutMode = "HORIZONTAL";
    headerCol.primaryAxisSizingMode = "FIXED";
    headerCol.counterAxisSizingMode = "AUTO";
    headerCol.resize(width, headerCol.height);
    headerCol.fills = [];

    const text = createStyledText(headerText, 11, "Bold");
    text.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
    headerCol.appendChild(text);

    headerFrame.appendChild(headerCol);
  });

  mainFrame.appendChild(headerFrame);

  // Add variable rows
  variables.forEach(([variableName, variableValue]) => {
    const row = createVariableRow(variableName, String(variableValue), 700);
    mainFrame.appendChild(row);
  });

  // Position in viewport
  page.appendChild(mainFrame);

  // Position to the right of existing content
  const allNodes = page.children.filter((n) => n.id !== mainFrame.id);
  let rightmostX = 0;
  let topmostY = 0;

  if (allNodes.length > 0) {
    allNodes.forEach((node) => {
      const nodeRight = node.x + node.width;
      if (nodeRight > rightmostX) {
        rightmostX = nodeRight;
      }
      if (node.y < topmostY || topmostY === 0) {
        topmostY = node.y;
      }
    });
    mainFrame.x = rightmostX + 200;
    mainFrame.y = topmostY;
  } else {
    mainFrame.x = figma.viewport.center.x - mainFrame.width / 2;
    mainFrame.y = figma.viewport.center.y - mainFrame.height / 2;
  }

  // Select and zoom to the frame
  page.selection = [mainFrame];
  figma.viewport.scrollAndZoomIntoView([mainFrame]);
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

  return colorPatterns.some((pattern) => pattern.test(value));
}

/**
 * Helper function to load all required fonts for styling pages
 */
async function loadStylingFonts(): Promise<void> {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
}

/**
 * Helper function to convert color string to Figma paint
 */
function colorToPaint(colorString: string): SolidPaint {
  // Simple hex color converter
  if (colorString.startsWith("#")) {
    let hex = colorString.substring(1);

    // Handle 3-character hex colors (e.g., #fff)
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }

    // Ensure we have 6 characters
    if (hex.length !== 6) {
      return { type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } };
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Check if parsing failed (NaN)
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return { type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } };
    }

    return { type: "SOLID", color: { r: r / 255, g: g / 255, b: b / 255 } };
  }

  // Default to gray if can't parse
  return { type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } };
}
