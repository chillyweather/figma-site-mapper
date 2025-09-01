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
      const screenshots = page.screenshot;
      let yOffset = 0;

      // Handle multiple screenshot slices
      for (let i = 0; i < screenshots.length; i++) {
        const screenshotUrl = screenshots[i];
        let imageBytes: Uint8Array;
        let imageUrl = screenshotUrl;
        
        try {
          imageBytes = await fetchImageAsUint8Array(screenshotUrl);
          
          // Check if image is too large for Figma
          if (isImageTooLarge(imageBytes)) {
            console.log(`Image slice ${i + 1} too large for ${page.url}, trying thumbnail...`);
            imageBytes = await fetchImageAsUint8Array(page.thumbnail);
            imageUrl = page.thumbnail;
          }
        } catch (sliceError) {
          console.log(`Failed to fetch slice ${i + 1} for ${page.url}, trying thumbnail...`);
          imageBytes = await fetchImageAsUint8Array(page.thumbnail);
          imageUrl = page.thumbnail;
        }

        const imageHash = figma.createImage(imageBytes).hash;

        const rect = figma.createRectangle();
        rect.resize(1440, 1024);
        rect.fills = [{ type: "IMAGE", scaleMode: "FIT", imageHash }];
        rect.x = 0;
        rect.y = yOffset;
        newPage.appendChild(rect);
        
        yOffset += 1024; // Move down for next slice
        
        console.log(`Successfully created slice ${i + 1} for ${page.url} using ${imageUrl}`);
      }
    } catch (error) {
      console.error(`Failed to place images for ${page.url}:`, error);
      figma.notify(`Error placing images for ${page.url}`, { error: true });
    }
  }

  figma.currentPage = originalPage;

  return pageIdMap;

}
