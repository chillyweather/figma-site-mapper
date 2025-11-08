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
 * Handle page change event
 */
export function handlePageChange(): void {
  console.log("Page changed, updating mapping tab");
  updateMappingTab();
  notifyActiveScreenshotPage();
}

/**
 * Handle selection change event
 */
export function handleSelectionChange(): void {
  console.log("Selection changed, updating mapping tab");
  updateMappingTab();
  notifyActiveScreenshotPage();
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
  }, 1000);
}
