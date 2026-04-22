/**
 * FIGMA PAGE EVENT HANDLERS
 *
 * Handle Figma-specific events like page changes and selection changes
 */

import { updateMappingTab } from "../services/badgeScanner";

function notifyActiveScreenshotPage(): void {
  const currentPage = figma.currentPage;
  const pageId = currentPage.getPluginData("PAGE_ID") || null;
  const pageUrl = currentPage.getPluginData("URL") || null;
  const isScreenshot = Boolean(pageId || pageUrl);

  let screenshotWidth: number | null = null;
  let originalWidth: number | null = null;

  const storedScreenshotWidth = currentPage.getPluginData("SCREENSHOT_WIDTH");
  const storedOriginalWidth = currentPage.getPluginData(
    "ORIGINAL_VIEWPORT_WIDTH"
  );

  try {
    const overlay = currentPage.findOne(
      (node) => node.type === "FRAME" && node.name === "Page Overlay"
    );
    console.log(
      `🧭 Markup Debug -> page:"${currentPage.name}" pageId:${pageId} url:${pageUrl} overlay:${overlay ? "yes" : "no"} screenshotWidth:${storedScreenshotWidth} originalWidth:${storedOriginalWidth}`
    );
  } catch (error) {
    console.warn("🧭 Markup Debug -> failed to inspect overlay", error);
  }

  if (storedScreenshotWidth) {
    const parsed = Number(storedScreenshotWidth);
    screenshotWidth = Number.isFinite(parsed) ? parsed : null;
  }

  if (storedOriginalWidth) {
    const parsed = Number(storedOriginalWidth);
    originalWidth = Number.isFinite(parsed) ? parsed : null;
  }

  figma.ui.postMessage({
    type: "active-screenshot-page",
    pageId,
    pageUrl,
    pageName: currentPage.name,
    isScreenshot,
    screenshotWidth,
    originalWidth,
  });
}

/**
 * Notify UI about element selection for styling
 */
function notifyElementSelection(): void {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({
      type: "element-selection-changed",
      elementId: null,
      elementInfo: null,
    });
    return;
  }

  // Look for selected node with dbId in pluginData
  const selectedNode = selection.find(node => {
    const dbId = node.getPluginData("dbId");
    return dbId && dbId.length > 0;
  });

  if (selectedNode) {
    const dbId = selectedNode.getPluginData("dbId");
    const elementType = selectedNode.getPluginData("elementType") || selectedNode.type;
    const elementText = selectedNode.getPluginData("elementText") || 
                       (selectedNode.type === "TEXT" ? (selectedNode as TextNode).characters?.substring(0, 50) : "");

    figma.ui.postMessage({
      type: "element-selection-changed",
      elementId: dbId,
      elementInfo: {
        id: dbId,
        type: elementType,
        text: elementText,
      },
    });
  } else {
    figma.ui.postMessage({
      type: "element-selection-changed",
      elementId: null,
      elementInfo: null,
    });
  }
}

/**
 * Handle page change event
 */
export function handlePageChange(): void {
  console.log("Page changed, updating mapping tab");
  updateMappingTab();
  notifyActiveScreenshotPage();
}

/**
 * Notify UI when a link_N_badge or button_N_badge group is selected on canvas.
 */
const BADGE_NAME_PATTERN = /(?:link|button)_(\d+)_badge$/;

function notifyBadgeSelection(): void {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return;

  const node = selection[0];
  // Direct selection of the badge group
  if (node.type === "GROUP" && node.name.endsWith("_badge")) {
    const match = node.name.match(BADGE_NAME_PATTERN);
    if (match) {
      figma.ui.postMessage({ type: "badge-selected", badgeNumber: parseInt(match[1], 10) });
      return;
    }
  }
  // Selection of a child inside the badge group (badge circle or text)
  const parent = (node as SceneNode & { parent?: BaseNode }).parent;
  if (parent && parent.type === "GROUP" && (parent as GroupNode).name.endsWith("_badge")) {
    const match = (parent as GroupNode).name.match(BADGE_NAME_PATTERN);
    if (match) {
      figma.ui.postMessage({ type: "badge-selected", badgeNumber: parseInt(match[1], 10) });
    }
  }
}

/**
 * Handle selection change event
 */
export function handleSelectionChange(): void {
  console.log("Selection changed, updating mapping tab");
  updateMappingTab();
  notifyActiveScreenshotPage();
  notifyElementSelection();
  notifyBadgeSelection();
}

/**
 * Handle get-element-selection request from UI
 */
export function handleGetElementSelection(): void {
  notifyElementSelection();
}

/**
 * Initialize all page event listeners
 */
export function initializePageEventListeners(): void {
  figma.on("currentpagechange", handlePageChange);
  figma.on("selectionchange", handleSelectionChange);

  // Initial scan when plugin loads
  setTimeout(() => {
    updateMappingTab();
    notifyActiveScreenshotPage();
    notifyElementSelection();
  }, 1000);
}
