/**
 * FIGMA PAGE EVENT HANDLERS
 *
 * Handle Figma-specific events like page changes and selection changes
 */

import { updateMappingTab } from "../services/badgeScanner";

/**
 * Handle page change event
 */
export function handlePageChange(): void {
  console.log("Page changed, updating mapping tab");
  updateMappingTab();
}

/**
 * Handle selection change event
 */
export function handleSelectionChange(): void {
  console.log("Selection changed, updating mapping tab");
  updateMappingTab();
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
