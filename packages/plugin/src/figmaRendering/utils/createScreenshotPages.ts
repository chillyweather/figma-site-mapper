import { TreeNode } from "../../types";



async function fetchImageAsUint8Array(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function isImageTooLarge(imageBytes: Uint8Array): boolean {
  const MAX_SIZE = 4 * 1024 * 1024; // 4MB limit for safety
  return imageBytes.length > MAX_SIZE;
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
      let imageBytes: Uint8Array;
      let imageUrl = page.screenshot;
      
      // First try the main screenshot
      try {
        imageBytes = await fetchImageAsUint8Array(page.screenshot);
        
        // Check if image is too large for Figma
        if (isImageTooLarge(imageBytes)) {
          console.log(`Image too large for ${page.url}, trying thumbnail...`);
          imageBytes = await fetchImageAsUint8Array(page.thumbnail);
          imageUrl = page.thumbnail;
        }
      } catch (mainError) {
        console.log(`Failed to fetch main image for ${page.url}, trying thumbnail...`);
        imageBytes = await fetchImageAsUint8Array(page.thumbnail);
        imageUrl = page.thumbnail;
      }

      const imageHash = figma.createImage(imageBytes).hash;

      const rect = figma.createRectangle();
      rect.resize(1440, 1024);
      rect.fills = [{ type: "IMAGE", scaleMode: "FIT", imageHash }];
      newPage.appendChild(rect);
      
      console.log(`Successfully created page for ${page.url} using ${imageUrl}`);
    } catch (error) {
      console.error(`Failed to place image for ${page.url}:`, error);
      figma.notify(`Error placing image for ${page.url}`, { error: true });
    }
  }

  figma.currentPage = originalPage;

  return pageIdMap;

}
