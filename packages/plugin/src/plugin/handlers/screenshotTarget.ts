export interface PluginDataNode {
  getPluginData(key: string): string;
  setPluginData(key: string, value: string): void;
}

export interface ScreenshotTargetMetadata {
  pageId: string;
  projectId: string;
  url: string;
  screenshotWidth: number;
  originalViewportWidth: number;
}

export function writeScreenshotTargetMetadata(
  node: PluginDataNode,
  metadata: ScreenshotTargetMetadata
): void {
  node.setPluginData("PAGE_ID", metadata.pageId);
  node.setPluginData("PROJECT_ID", metadata.projectId);
  node.setPluginData("URL", metadata.url);
  node.setPluginData("SCREENSHOT_WIDTH", String(metadata.screenshotWidth));
  node.setPluginData("ORIGINAL_VIEWPORT_WIDTH", String(metadata.originalViewportWidth));
}

export function getScreenshotTargetScale(target: PluginDataNode): number {
  const screenshotWidth = Number(target.getPluginData("SCREENSHOT_WIDTH"));
  const originalWidth = Number(target.getPluginData("ORIGINAL_VIEWPORT_WIDTH"));
  if (
    Number.isFinite(screenshotWidth) &&
    screenshotWidth > 0 &&
    Number.isFinite(originalWidth) &&
    originalWidth > 0
  ) {
    return screenshotWidth / originalWidth;
  }
  return 1;
}

type NodeLike = {
  type: string;
  getPluginData(key: string): string;
};

type ActiveTargetDeps = {
  currentPage: NodeLike & {
    children: ReadonlyArray<NodeLike>;
    selection: ReadonlyArray<NodeLike>;
  };
};

/**
 * Resolves the active screenshot target node regardless of layout mode.
 *
 * Per-page mode: the current Figma PageNode is the screenshot target.
 * Single-canvas mode: plugin data lives on FrameNodes inside the Sitemap
 * canvas page. Checks selection first, then falls back to the first match.
 *
 * Pass `deps` to override the figma context for testing.
 */
export function getActiveScreenshotTarget(
  deps?: ActiveTargetDeps
): PageNode | FrameNode | null {
  const current = deps?.currentPage ?? figma.currentPage;

  if (current.getPluginData("PAGE_ID")) {
    return current as PageNode;
  }

  if (current.getPluginData("SITEMAP_ROLE") === "canvas") {
    const selectionSource = deps?.currentPage ?? figma.currentPage;
    for (const node of (selectionSource as any).selection ?? []) {
      if (node.type === "FRAME" && node.getPluginData("PAGE_ID")) {
        return node as FrameNode;
      }
    }
    for (const child of current.children) {
      if (child.type === "FRAME" && child.getPluginData("PAGE_ID")) {
        return child as FrameNode;
      }
    }
  }

  return null;
}

type RootDeps = {
  pages: ReadonlyArray<NodeLike & { children?: ReadonlyArray<NodeLike> }>;
};

/**
 * Finds a screenshot target node by PAGE_ID, searching both per-page
 * PageNodes and single-canvas FrameNodes.
 *
 * Pass `deps` to override the figma root for testing.
 */
export function findScreenshotTargetByPageId(
  pageId: string,
  deps?: RootDeps
): PageNode | FrameNode | null {
  const rootPages = deps?.pages ?? (figma.root.children as unknown as NodeLike[]);

  for (const page of rootPages) {
    if (page.type === "PAGE" && page.getPluginData("PAGE_ID") === pageId) {
      return page as PageNode;
    }
  }

  for (const page of rootPages) {
    if (page.type !== "PAGE" || page.getPluginData("SITEMAP_ROLE") !== "canvas") {
      continue;
    }
    for (const child of page.children ?? []) {
      if (child.type === "FRAME" && child.getPluginData("PAGE_ID") === pageId) {
        return child as FrameNode;
      }
    }
  }

  return null;
}
