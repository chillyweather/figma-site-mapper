import { TreeNode } from "../types";
import { flattenTree } from "./utils/flattenTree";
import { createScreenshotPages } from "./utils/createScreenshotPages";

export async function renderSitemap(manifestData: { tree: TreeNode }, screenshotWidth: number = 1440) {
  console.log("Rendering sitemap for tree:", manifestData.tree);

  // Flatten the tree to get all pages
  const pages = flattenTree(manifestData.tree);

  // Create screenshot pages for each page in the tree
  await createScreenshotPages(pages, screenshotWidth);

  figma.notify("Screenshots placed successfully!");
}
