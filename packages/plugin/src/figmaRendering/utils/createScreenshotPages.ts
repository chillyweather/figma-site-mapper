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
  pages: TreeNode[],
  screenshotWidth: number = 1440
): Promise<Map<string, string>> {
  const pageIdMap = new Map<string, string>();
  const originalPage = figma.currentPage;

  for (const page of pages) {
    const newPage = figma.createPage();
    newPage.name = `Screenshot: ${page.title.substring(0, 50)}`;
    pageIdMap.set(page.url, newPage.id);

    try {
      const screenshots = page.screenshot;
      
      // Create a vertical autolayout frame for all screenshots
      const screenshotsFrame = figma.createFrame();
      screenshotsFrame.name = `${page.title} Screenshots`;
      screenshotsFrame.layoutMode = "VERTICAL";
      screenshotsFrame.primaryAxisAlignItems = "MIN";
      screenshotsFrame.counterAxisAlignItems = "MIN";
      screenshotsFrame.itemSpacing = -100; // Negative spacing to compensate for overlap
      screenshotsFrame.paddingTop = 0;
      screenshotsFrame.paddingBottom = 0;
      screenshotsFrame.paddingLeft = 0;
      screenshotsFrame.paddingRight = 0;
      screenshotsFrame.fills = [];

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
        rect.resize(screenshotWidth, 1024);
        rect.fills = [{ type: "IMAGE", scaleMode: "FIT", imageHash }];
        
        screenshotsFrame.appendChild(rect);
        
        console.log(`Successfully created slice ${i + 1} for ${page.url} using ${imageUrl}`);
      }
      
      // Resize frame to fit content
      screenshotsFrame.layoutAlign = "STRETCH";
      screenshotsFrame.primaryAxisSizingMode = "AUTO";
      screenshotsFrame.counterAxisSizingMode = "AUTO";
      
      newPage.appendChild(screenshotsFrame);
      
    } catch (error) {
      console.error(`Failed to place images for ${page.url}:`, error);
      figma.notify(`Error placing images for ${page.url}`, { error: true });
    }
  }

  figma.currentPage = originalPage;

  return pageIdMap;

}
