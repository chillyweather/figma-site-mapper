/**
 * Resolves the active screenshot target node regardless of layout mode.
 *
 * Per-page mode: the current Figma PageNode is the screenshot target (plugin
 * data lives on the page itself).
 *
 * Single-canvas mode: plugin data lives on FrameNodes inside the Sitemap
 * canvas page. This helper looks at the current selection first, then falls
 * back to the first matching frame on the page.
 */
export function getActiveScreenshotTarget(): PageNode | FrameNode | null {
  const current = figma.currentPage;

  // Per-page mode: the current page carries PAGE_ID directly
  if (current.getPluginData("PAGE_ID")) {
    return current;
  }

  // Single-canvas mode: look for a FrameNode with PAGE_ID on the Sitemap canvas
  if (current.getPluginData("SITEMAP_ROLE") === "canvas") {
    for (const node of figma.currentPage.selection) {
      if (node.type === "FRAME" && node.getPluginData("PAGE_ID")) {
        return node as FrameNode;
      }
    }
    // Fall back to the first matching frame
    for (const child of current.children) {
      if (child.type === "FRAME" && child.getPluginData("PAGE_ID")) {
        return child as FrameNode;
      }
    }
  }

  return null;
}

/**
 * Finds a screenshot target node by PAGE_ID, searching both per-page
 * PageNodes and single-canvas FrameNodes.
 */
export function findScreenshotTargetByPageId(
  pageId: string
): PageNode | FrameNode | null {
  // Per-page: search PageNodes in the document root
  for (const page of figma.root.children) {
    if (page.type === "PAGE" && page.getPluginData("PAGE_ID") === pageId) {
      return page as PageNode;
    }
  }

  // Single-canvas: search FrameNodes inside any Sitemap canvas page
  for (const page of figma.root.children) {
    if (page.type !== "PAGE" || page.getPluginData("SITEMAP_ROLE") !== "canvas") {
      continue;
    }
    for (const child of page.children) {
      if (child.type === "FRAME" && child.getPluginData("PAGE_ID") === pageId) {
        return child as FrameNode;
      }
    }
  }

  return null;
}
