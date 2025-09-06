import { TreeNode } from "../types";
import { flattenTree } from "./utils/flattenTree";
import { createScreenshotPages } from "./utils/createScreenshotPages";

export async function renderSitemap(manifestData: { tree: TreeNode }, screenshotWidth: number = 1440) {
  console.log("Rendering sitemap for tree:", manifestData.tree);

  // Flatten the tree to get all pages
  const pages = flattenTree(manifestData.tree);
  console.log(`Found ${pages.length} pages to render`);

  // Create screenshot pages for each page in the tree
  await createScreenshotPages(pages, screenshotWidth);

  console.log("Sitemap rendering completed");
  figma.notify("Screenshots placed successfully!");
}
