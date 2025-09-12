import { TreeNode } from "../../types";



async function fetchImageAsUint8Array(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function getImageDimensions(imageBytes: Uint8Array): Promise<{ width: number; height: number }> {
  // Simple PNG/JPEG dimension parser
  const data = new Uint8Array(imageBytes);
  
  // Check for PNG signature
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    // PNG: width and height are at bytes 16-23
    const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
    const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
    return { width, height };
  }
  
  // Check for JPEG signature
  if (data[0] === 0xFF && data[1] === 0xD8) {
    // JPEG: scan for SOF0 marker (0xFF 0xC0)
    for (let i = 2; i < data.length - 9; i++) {
      if (data[i] === 0xFF && data[i + 1] === 0xC0) {
        const height = (data[i + 5] << 8) | data[i + 6];
        const width = (data[i + 7] << 8) | data[i + 8];
        return { width, height };
      }
    }
  }
  
  throw new Error("Unsupported image format or could not parse dimensions");
}

function isImageTooLarge(imageBytes: Uint8Array): boolean {
  const MAX_SIZE = 4 * 1024 * 1024; // 4MB limit for safety
  return imageBytes.length > MAX_SIZE;
}

export async function createScreenshotPages(
  pages: TreeNode[],
  screenshotWidth: number = 1440
): Promise<Map<string, string>> {
  console.log(`Creating screenshot pages for ${pages.length} pages`);
  const pageIdMap = new Map<string, string>();
  const originalPage = figma.currentPage;

  // Load font for navigation frame - use Inter only
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const fontName = { family: "Inter", style: "Regular" };

  // Create navigation frame function
  function createNavigationFrame(pageTitle: string, pageUrl?: string): FrameNode {
    const navFrame = figma.createFrame();
    navFrame.name = "Navigation";
    navFrame.layoutMode = "HORIZONTAL";
    navFrame.primaryAxisAlignItems = "MIN";
    navFrame.counterAxisAlignItems = "CENTER";
    navFrame.paddingTop = 16;
    navFrame.paddingBottom = 16;
    navFrame.paddingLeft = 16;
    navFrame.paddingRight = 16;
    navFrame.itemSpacing = 8;
    navFrame.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
    navFrame.strokes = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } }];
    navFrame.strokeWeight = 1;
    navFrame.cornerRadius = 8;

    // Create "← Back to Index" text
    const backText = figma.createText();
    backText.fontName = fontName;
    backText.fontSize = 14;
    backText.characters = "← Back to Index";
    // Link will be added later when we know the index page ID

    // Create separator
    const separator = figma.createText();
    separator.fontName = fontName;
    separator.fontSize = 14;
    separator.characters = "|";

    // Create current page title with link to source page
    const titleText = figma.createText();
    titleText.fontName = fontName;
    titleText.fontSize = 14;
    titleText.characters = pageTitle;
    
    // Add hyperlink to the source page if URL is provided
    if (pageUrl) {
      titleText.hyperlink = { type: "URL", value: pageUrl };
    }

    navFrame.appendChild(backText);
    navFrame.appendChild(separator);
    navFrame.appendChild(titleText);

    // Auto-resize
    navFrame.layoutAlign = "STRETCH";
    navFrame.primaryAxisSizingMode = "AUTO";
    navFrame.counterAxisSizingMode = "AUTO";

    return navFrame;
  }

  for (const page of pages) {
    const newPage = figma.createPage();
    newPage.name = page.title.substring(0, 50);
    pageIdMap.set(page.url, newPage.id);

    try {
      const screenshots = page.screenshot;

      // Create a vertical autolayout frame for all screenshots
      const screenshotsFrame = figma.createFrame();
      screenshotsFrame.name = `${page.title} Screenshots`;
      screenshotsFrame.layoutMode = "VERTICAL";
      screenshotsFrame.primaryAxisAlignItems = "MIN";
      screenshotsFrame.counterAxisAlignItems = "MIN";
      screenshotsFrame.itemSpacing = 0; // No overlap, so no negative spacing needed
      screenshotsFrame.paddingTop = 0;
      screenshotsFrame.paddingBottom = 0;
      screenshotsFrame.paddingLeft = 0;
      screenshotsFrame.paddingRight = 0;
      screenshotsFrame.fills = [];

      // Create navigation frame for this page
      const navFrame = createNavigationFrame(page.title, page.url);
      screenshotsFrame.appendChild(navFrame);

      // Add 24px margin between navigation and screenshots
      const spacerFrame = figma.createFrame();
      spacerFrame.name = "Spacer";
      spacerFrame.resize(screenshotWidth, 24);
      spacerFrame.fills = [];
      screenshotsFrame.appendChild(spacerFrame);

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

        // Get actual image dimensions to calculate proper height
        let calculatedHeight = 1024; // fallback height
        try {
          const dimensions = await getImageDimensions(imageBytes);
          const aspectRatio = dimensions.width / dimensions.height;
          calculatedHeight = screenshotWidth / aspectRatio;
        } catch (error) {
          console.log(`Failed to get dimensions for ${imageUrl}, using fallback height:`, error);
        }

        const rect = figma.createRectangle();
        rect.resize(screenshotWidth, calculatedHeight);
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

  console.log(`Created ${pageIdMap.size} screenshot pages`);

  return pageIdMap;
}

// Function to update navigation links with index page ID
export function updateNavigationLinks(indexPageId: string) {
  // Find all pages that contain navigation frames
  for (const page of figma.root.children) {
    if (page.name === "Index") continue;
    
    const navFrame = page.findOne(node => node.name === "Navigation") as FrameNode;
    if (navFrame) {
      const backText = navFrame.findOne(node => 
        node.type === "TEXT" && node.characters.includes("← Back to Index")
      ) as TextNode;
      
      if (backText) {
        backText.hyperlink = { type: "NODE", value: indexPageId };
      }
    }
  }
}
