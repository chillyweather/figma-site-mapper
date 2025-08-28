import { TreeNode } from "../../main";

// --- Helper function with types ---

export async function createScreenshotPages(
  pages: TreeNode[]
): Promise<Map<string, string>> {
  const pageIdMap = new Map<string, string>();
  const rootPage = figma.root.children[0];

  for (const page of pages) {
    const newPage = figma.createPage();
    newPage.name = page.title || page.url;
    pageIdMap.set(page.url, newPage.id);
  }

  figma.currentPage = rootPage;
  return pageIdMap;
}
