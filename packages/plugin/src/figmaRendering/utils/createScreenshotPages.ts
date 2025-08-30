import { TreeNode } from "../../types";



async function fetchImageAsUint8Array(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);

  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function createScreenshotPages(
  pages: TreeNode[]
): Promise<Map<string, string>> {
  const pageIdMap = new Map<string, string>();
  const originalPage = figma.currentPage;

  for (const page of pages) {
    const newPage = figma.createPage();
    newPage.name = `Screenshot: ${page.title.substring(0, 50)}`;
    pageIdMap.set(page.url, newPage.id);

    try {
      const imageBytes = await fetchImageAsUint8Array(page.screenshot);
      const imageHash = figma.createImage(imageBytes).hash;

      const rect = figma.createRectangle();
      rect.resize(1440, 1024);
      rect.fills = [{ type: "IMAGE", scaleMode: "FIT", imageHash }];
      newPage.appendChild(rect)
    } catch (error) {
      console.error(`Failed to place image for ${page.url}:`, error);
      figma.notify(`Error placing image for ${page.url}`, { error: true });
    }
  }

  figma.currentPage = originalPage;

  return pageIdMap;

}
