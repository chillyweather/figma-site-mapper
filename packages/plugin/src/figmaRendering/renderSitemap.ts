import { TreeNode } from "../types";
import { flattenTree } from "./utils/flattenTree";
import {
  createScreenshotPages,
  updateNavigationLinks,
} from "./utils/createScreenshotPages";

async function createIndexPage(
  tree: TreeNode,
  pageIdMap: Map<string, string>
): Promise<string> {
  // Create index page as the first page
  const indexPage = figma.createPage();
  indexPage.name = "Index";

  // Move index page to the beginning
  figma.root.insertChild(0, indexPage);

  // Create main frame for the index
  const indexFrame = figma.createFrame();
  indexFrame.name = "Site Index";
  indexFrame.layoutMode = "VERTICAL";
  indexFrame.primaryAxisAlignItems = "MIN";
  indexFrame.counterAxisAlignItems = "MIN";
  indexFrame.paddingTop = 40;
  indexFrame.paddingLeft = 40;
  indexFrame.paddingRight = 40;
  indexFrame.paddingBottom = 40;
  indexFrame.itemSpacing = 14;
  indexFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  indexFrame.resize(800, 600);

  // Function to recursively create index entries
  async function createIndexEntry(
    node: TreeNode,
    depth: number = 0
  ): Promise<TextNode[]> {
    const textNodes: TextNode[] = [];

    // Create text node for current page
    const textNode = figma.createText();

    // Load font BEFORE setting characters - use Inter only
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    textNode.fontName = { family: "Inter", style: "Regular" };

    // Set font size
    textNode.fontSize = 16;

    // Add indentation based on depth (8 spaces per level)
    const indent = "        ".repeat(depth);
    textNode.characters = indent + node.title;

    // Link to the corresponding page
    const pageId = pageIdMap.get(node.url);
    if (pageId) {
      textNode.hyperlink = { type: "NODE", value: pageId };
    }

    textNodes.push(textNode);

    // Create entries for children
    for (const child of node.children) {
      const childNodes = await createIndexEntry(child, depth + 1);
      textNodes.push(...childNodes);
    }

    return textNodes;
  }

  // Generate all text nodes
  const allTextNodes = await createIndexEntry(tree);

  if (allTextNodes.length === 0) {
    console.log("No pages found to create index for");
    return indexPage.id;
  }

  // Add all text nodes to the frame
  for (const textNode of allTextNodes) {
    indexFrame.appendChild(textNode);
  }

  // Add the frame to the index page
  indexPage.appendChild(indexFrame);

  // Auto-resize the frame to fit content
  indexFrame.layoutAlign = "STRETCH";
  indexFrame.primaryAxisSizingMode = "AUTO";
  indexFrame.counterAxisSizingMode = "AUTO";

  console.log(`Created index page with ${allTextNodes.length} entries`);
  return indexPage.id;
}

export async function renderSitemap(
  manifestData: { tree: TreeNode | null },
  screenshotWidth: number = 1440,
  detectInteractiveElements: boolean = true,
  onProgress?: (stage: string, progress: number) => void
) {
  console.log("Rendering sitemap for tree:", manifestData.tree);
  console.log("Detect interactive elements:", detectInteractiveElements);

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
    detectInteractiveElements
  );

  // Notify progress: Creating index page (80-90%)
  if (onProgress) onProgress("Creating index page...", 80);

  // Create index page after screenshot pages, so we can link to them
  let indexPageId: string | undefined;
  if (manifestData.tree) {
    indexPageId = await createIndexPage(manifestData.tree, pageIdMap);
  }

  // Notify progress: Updating navigation links (90-100%)
  if (onProgress) onProgress("Finalizing...", 95);

  // Update navigation links with index page ID
  if (indexPageId) {
    updateNavigationLinks(indexPageId);
  }

  if (onProgress) onProgress("Complete!", 100);

  console.log("Sitemap rendering completed");
  figma.notify("Screenshots and index placed successfully!");
}
