/**
 * FIGMA PAGE EVENT HANDLERS
 *
 * Handle Figma-specific events like page changes and selection changes
 */

import { updateMappingTab } from "../services/badgeScanner";

/**
 * Check if page is a flow page (contains flow emoji)
 */
function isFlowPage(pageName: string): boolean {
  return pageName.includes("🧭");
}

/**
 * Handle page change event
 */
export function handlePageChange(): void {
  console.log("Page changed, updating mapping tab");

  if (!isFlowPage(figma.currentPage.name)) {
    updateMappingTab();
  } else {
    console.log("Skipping badge scan on flow page");
  }
}

/**
 * Handle selection change event
 */
export function handleSelectionChange(): void {
  console.log("Selection changed, updating mapping tab");

  if (!isFlowPage(figma.currentPage.name)) {
    updateMappingTab();
  }
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
  }, 1000);
}
