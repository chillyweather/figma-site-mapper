import { TreeNode } from "../types";
import { flattenTree } from "./utils/flattenTree";
import {
  createScreenshotPages,
  updateNavigationLinks,
  SINGLE_CANVAS_H_GAP,
} from "./utils/createScreenshotPages";

function findExistingIndexPage(): PageNode | null {
  const matches: PageNode[] = [];
  const pages = figma.root.children;

  for (const pageNode of pages) {
    if (pageNode.type !== "PAGE") {
      continue;
    }
    const role = pageNode.getPluginData("SITEMAP_ROLE");
    if (role === "index") {
      matches.push(pageNode);
    }
  }

  if (matches.length === 0) {
    for (const pageNode of pages) {
      if (pageNode.type === "PAGE" && pageNode.name === "Index") {
        matches.push(pageNode);
      }
    }
  }

  if (matches.length > 1) {
    for (let i = 1; i < matches.length; i++) {
      try {
        matches[i].remove();
      } catch (error) {
        console.warn(
          "Failed to remove duplicate index page:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  return matches.length > 0 ? matches[0] : null;
}

async function createIndexFrameOnCanvas(
  tree: TreeNode,
  pageIdMap: Map<string, string>,
  indexFrameWidth: number,
  projectId?: string
): Promise<string> {
  // Find the Sitemap canvas page
  let sitemapPage: PageNode | null = null;
  for (const p of figma.root.children) {
    if (
      p.type === "PAGE" &&
      p.getPluginData("SITEMAP_ROLE") === "canvas" &&
      ((projectId && p.getPluginData("PROJECT_ID") === projectId) ||
        (!projectId && !p.getPluginData("PROJECT_ID")))
    ) {
      sitemapPage = p as PageNode;
      break;
    }
  }
  if (!sitemapPage) {
    sitemapPage = figma.createPage();
    sitemapPage.name = projectId ? `Sitemap ${projectId}` : "Sitemap";
    sitemapPage.setPluginData("SITEMAP_ROLE", "canvas");
    sitemapPage.setPluginData("PROJECT_ID", projectId || "");
  }

  figma.currentPage = sitemapPage;

  // Find or create the Index frame
  let indexFrame = sitemapPage.children.find(
    (child): child is FrameNode =>
      child.type === "FRAME" &&
      (child.getPluginData("SITEMAP_INDEX_FRAME") === "true" ||
        child.name === "Site Index")
  ) ?? null;

  if (!indexFrame) {
    indexFrame = figma.createFrame();
    sitemapPage.appendChild(indexFrame);
  }

  // Position to the left of the homepage frame (x=0)
  indexFrame.x = -(indexFrameWidth + SINGLE_CANVAS_H_GAP);
  indexFrame.y = 0;

  indexFrame.name = "Site Index";
  indexFrame.setPluginData("SITEMAP_INDEX_FRAME", "true");
  indexFrame.layoutMode = "VERTICAL";
  indexFrame.primaryAxisAlignItems = "MIN";
  indexFrame.counterAxisAlignItems = "MIN";
  indexFrame.paddingTop = 40;
  indexFrame.paddingLeft = 40;
  indexFrame.paddingRight = 40;
  indexFrame.paddingBottom = 40;
  indexFrame.itemSpacing = 14;
  indexFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  indexFrame.primaryAxisSizingMode = "AUTO";
  indexFrame.counterAxisSizingMode = "FIXED";
  indexFrame.resize(indexFrameWidth, 600);

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  // Rebuild entries (same logic as per-page Index)
  const existingEntries = new Map<string, TextNode>();
  for (const child of indexFrame.children) {
    if (child.type !== "TEXT") continue;
    const textNode = child as TextNode;
    let url = textNode.getPluginData("SITEMAP_PAGE_URL");
    if (!url) {
      const hl = textNode.hyperlink as HyperlinkTarget | null;
      if (hl && hl.type === "NODE") {
        const target = figma.getNodeById(hl.value);
        if (target) {
          const storedUrl = target.getPluginData("URL");
          if (storedUrl) {
            url = storedUrl;
            textNode.setPluginData("SITEMAP_PAGE_URL", storedUrl);
          }
        }
      }
    }
    if (url) existingEntries.set(url, textNode);
  }

  const pagesFlat = flattenTree(tree);
  const seenUrls = new Set<string>();
  let newEntries = 0;

  for (const page of pagesFlat) {
    if (!page.url || seenUrls.has(page.url)) continue;
    seenUrls.add(page.url);

    const title = page.title || page.url;
    const frameId = pageIdMap.get(page.url);
    const entry = existingEntries.get(page.url);

    if (entry) {
      entry.fontName = { family: "Inter", style: "Regular" };
      entry.fontSize = 16;
      if (entry.characters !== title) entry.characters = title;
      if (frameId) entry.hyperlink = { type: "NODE", value: frameId };
      entry.setPluginData("SITEMAP_PAGE_URL", page.url);
    } else {
      const textNode = figma.createText();
      textNode.fontName = { family: "Inter", style: "Regular" };
      textNode.fontSize = 16;
      textNode.characters = title;
      if (frameId) textNode.hyperlink = { type: "NODE", value: frameId };
      textNode.setPluginData("SITEMAP_PAGE_URL", page.url);
      indexFrame.appendChild(textNode);
      newEntries += 1;
    }
  }

  console.log(`Index frame (canvas) now has ${newEntries} new entries`);
  return indexFrame.id;
}

async function createIndexPage(
  tree: TreeNode,
  pageIdMap: Map<string, string>,
  layoutMode: "per-page" | "single-canvas" = "per-page",
  indexFrameWidth: number = 400,
  projectId?: string
): Promise<string> {
  // ── Single-canvas mode: place Index as a FrameNode on the Sitemap canvas page ──
  if (layoutMode === "single-canvas") {
    return createIndexFrameOnCanvas(tree, pageIdMap, indexFrameWidth, projectId);
  }

  // ── Per-page mode (original behavior) ────────────────────────────────────────
  const existingIndexPage = findExistingIndexPage();
  const indexPage =
    existingIndexPage !== null ? existingIndexPage : figma.createPage();
  indexPage.name = "Index";
  indexPage.setPluginData("SITEMAP_ROLE", "index");

  // Keep the index page at the beginning of the document
  figma.root.insertChild(0, indexPage);

  let indexFrame = indexPage.children.find(
    (child): child is FrameNode =>
      child.type === "FRAME" &&
      (child.getPluginData("SITEMAP_INDEX_FRAME") === "true" ||
        child.name === "Site Index")
  );

  if (!indexFrame) {
    indexFrame = figma.createFrame();
    indexPage.appendChild(indexFrame);
  }

  indexFrame.name = "Site Index";
  indexFrame.setPluginData("SITEMAP_INDEX_FRAME", "true");
  indexFrame.layoutMode = "VERTICAL";
  indexFrame.primaryAxisAlignItems = "MIN";
  indexFrame.counterAxisAlignItems = "MIN";
  indexFrame.paddingTop = 40;
  indexFrame.paddingLeft = 40;
  indexFrame.paddingRight = 40;
  indexFrame.paddingBottom = 40;
  indexFrame.itemSpacing = 14;
  indexFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

  if (indexFrame.children.length === 0) {
    indexFrame.resize(800, 600);
  }

  indexFrame.layoutAlign = "STRETCH";
  indexFrame.primaryAxisSizingMode = "AUTO";
  indexFrame.counterAxisSizingMode = "AUTO";

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  const existingEntries = new Map<string, TextNode>();
  for (const child of indexFrame.children) {
    if (child.type !== "TEXT") {
      continue;
    }

    const textNode = child as TextNode;
    let url = textNode.getPluginData("SITEMAP_PAGE_URL");
    if (!url) {
      const hl = textNode.hyperlink as HyperlinkTarget | null;
      if (hl && hl.type === "NODE") {
        const target = figma.getNodeById(hl.value);
        if (target && target.type === "PAGE") {
          const storedUrl = target.getPluginData("URL");
          if (storedUrl) {
            url = storedUrl;
            textNode.setPluginData("SITEMAP_PAGE_URL", storedUrl);
          }
        }
      }
    }

    if (url) {
      existingEntries.set(url, textNode);
    }
  }

  const pages = flattenTree(tree);
  const seenUrls = new Set<string>();
  let newEntries = 0;

  for (const page of pages) {
    if (!page.url || seenUrls.has(page.url)) {
      continue;
    }
    seenUrls.add(page.url);

    const title = page.title || page.url;
    const pageId = pageIdMap.get(page.url);
    const entry = existingEntries.get(page.url);

    if (entry) {
      entry.fontName = { family: "Inter", style: "Regular" };
      entry.fontSize = 16;
      if (entry.characters !== title) {
        entry.characters = title;
      }
      if (pageId) {
        entry.hyperlink = { type: "NODE", value: pageId };
      }
      entry.setPluginData("SITEMAP_PAGE_URL", page.url);
    } else {
      const textNode = figma.createText();
      textNode.fontName = { family: "Inter", style: "Regular" };
      textNode.fontSize = 16;
      textNode.characters = title;
      if (pageId) {
        textNode.hyperlink = { type: "NODE", value: pageId };
      }
      textNode.setPluginData("SITEMAP_PAGE_URL", page.url);
      indexFrame.appendChild(textNode);
      newEntries += 1;
    }
  }

  // Remove indentation from all entries to keep a flat list
  for (const child of indexFrame.children) {
    if (child.type !== "TEXT") {
      continue;
    }
    const textNode = child as TextNode;
    const trimmed = textNode.characters.replace(/^\s+/, "");
    if (trimmed !== textNode.characters) {
      textNode.characters = trimmed;
    }
  }

  let totalEntries = 0;
  for (const child of indexFrame.children) {
    if (child.type === "TEXT") {
      totalEntries += 1;
    }
  }

  console.log(
    `Index page now contains ${totalEntries} entries (${newEntries} new)`
  );

  return indexPage.id;
}

export async function renderSitemap(
  manifestData: { tree: TreeNode | null; projectId?: string },
  screenshotWidth: number = 1440,
  detectInteractiveElements: boolean = true,
  highlightAllElements: boolean = false,
  onProgress?: (stage: string, progress: number) => void,
  highlightElementFilters?: any,
  removeStaleProjectPages: boolean = false,
  layoutMode: "per-page" | "single-canvas" = "per-page",
  singleCanvasColumns: number = 5,
  singleCanvasHorizontalGap: number = 100
) {
  console.log("Rendering sitemap for tree:", manifestData.tree);
  console.log("Detect interactive elements:", detectInteractiveElements);
  console.log("Highlight all elements:", highlightAllElements);

  // Check if tree exists
  if (!manifestData.tree) {
    console.error("Cannot render sitemap: tree is null or empty");
    figma.notify("Error: No pages were crawled", { error: true });
    return;
  }

  // Flatten the tree to get all pages
  const pages = flattenTree(manifestData.tree);
  console.log(`Found ${pages.length} pages to render`);

  // Notify progress: Creating screenshot pages (10-80%)
  if (onProgress) onProgress(`Rendering ${pages.length} pages...`, 10);

  // Create screenshot pages for each page in the tree first
  const pageIdMap = await createScreenshotPages(
    pages,
    screenshotWidth,
    detectInteractiveElements,
    highlightAllElements,
    highlightElementFilters,
    manifestData.projectId,
    removeStaleProjectPages,
    layoutMode,
    singleCanvasColumns,
    singleCanvasHorizontalGap
  );

  // Notify progress: Creating index page (80-90%)
  if (onProgress) onProgress("Creating index page...", 80);

  // Create index page after screenshot pages, so we can link to them
  let indexPageId: string | undefined;
  if (manifestData.tree) {
    indexPageId = await createIndexPage(
      manifestData.tree,
      pageIdMap,
      layoutMode,
      400,
      manifestData.projectId
    );
  }

  // Notify progress: Updating navigation links (90-100%)
  if (onProgress) onProgress("Finalizing...", 95);

  // Update navigation links with index node ID
  if (indexPageId) {
    updateNavigationLinks(indexPageId, manifestData.projectId);

    if (layoutMode === "per-page") {
      const indexPageNode = figma.getNodeById(indexPageId);
      if (indexPageNode && indexPageNode.type === "PAGE") {
        figma.currentPage = indexPageNode;
      }
    }
    // In single-canvas mode, figma.currentPage is already the Sitemap canvas page
  }

  if (onProgress) onProgress("Complete!", 100);

  console.log("Sitemap rendering completed");
  figma.notify("Screenshots and index placed successfully!");
}
