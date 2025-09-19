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

  // Create navigation frame function (for absolute positioning)
  function createNavigationFrame(pageTitle: string, pageUrl?: string): FrameNode {
    const navFrame = figma.createFrame();
    navFrame.name = "Navigation";
    navFrame.layoutMode = "NONE"; // No autolayout for absolute positioning
    navFrame.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
    navFrame.strokes = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } }];
    navFrame.strokeWeight = 1;
    navFrame.cornerRadius = 8;
    navFrame.paddingTop = 16;
    navFrame.paddingBottom = 16;
    navFrame.paddingLeft = 16;
    navFrame.paddingRight = 16;

    // Create "← Back to Index" text
    const backText = figma.createText();
    backText.fontName = fontName;
    backText.fontSize = 14;
    backText.characters = "← Back to Index";
    backText.x = 16;
    backText.y = 16;
    // Link will be added later when we know the index page ID

    // Create separator
    const separator = figma.createText();
    separator.fontName = fontName;
    separator.fontSize = 14;
    separator.characters = "|";
    separator.x = backText.x + backText.width + 8;
    separator.y = 16;

    // Create current page title with link to source page
    const titleText = figma.createText();
    titleText.fontName = fontName;
    titleText.fontSize = 14;
    titleText.characters = pageTitle;
    titleText.x = separator.x + separator.width + 8;
    titleText.y = 16;
    
    // Add hyperlink to the source page if URL is provided
    if (pageUrl) {
      titleText.hyperlink = { type: "URL", value: pageUrl };
    }

    navFrame.appendChild(backText);
    navFrame.appendChild(separator);
    navFrame.appendChild(titleText);

    // Calculate total width needed and resize
    const totalWidth = titleText.x + titleText.width + 16; // Add right padding
    navFrame.resize(totalWidth, 48); // Fixed height for navigation

    return navFrame;
  }

  for (const page of pages) {
    const newPage = figma.createPage();
    newPage.name = page.title.substring(0, 50);
    pageIdMap.set(page.url, newPage.id);

    try {
      const screenshots = page.screenshot;

      // Create a vertical autolayout frame for screenshots only (no navigation)
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

      // Create absolute positioning overlay container for navigation and interactive elements
      const overlayContainer = figma.createFrame();
      overlayContainer.name = "Page Overlay";
      overlayContainer.x = 0;
      overlayContainer.y = 0;
      overlayContainer.fills = []; // Transparent background
      overlayContainer.strokes = []; // No border
      overlayContainer.layoutMode = "NONE"; // CRITICAL: No autolayout for absolute positioning
      overlayContainer.clipsContent = false; // Allow children to extend beyond bounds

      // Calculate the total height needed for the overlay (screenshots only, nav is above)
      let totalHeight = 0;
      for (let i = 0; i < screenshots.length; i++) {
        const screenshotUrl = screenshots[i];
        let imageBytes: Uint8Array;
        let imageUrl = screenshotUrl;

        try {
          imageBytes = await fetchImageAsUint8Array(screenshotUrl);
        } catch (sliceError) {
          console.log(`Failed to fetch slice ${i + 1} for height calculation, trying thumbnail...`);
          try {
            imageBytes = await fetchImageAsUint8Array(page.thumbnail);
            imageUrl = page.thumbnail;
          } catch (thumbError) {
            console.log(`Failed to fetch thumbnail too, skipping height calculation`);
            continue;
          }
        }

        try {
          const dimensions = await getImageDimensions(imageBytes);
          const aspectRatio = dimensions.width / dimensions.height;
          const calculatedHeight = screenshotWidth / aspectRatio;
          totalHeight += calculatedHeight;
        } catch (error) {
          console.log(`Failed to get dimensions for ${imageUrl}, using fallback height`);
          totalHeight += 1024; // fallback height
        }
      }

      overlayContainer.resize(screenshotWidth, totalHeight);

      // Define navigation height constant
      const navHeight = 48; // Fixed height for navigation frame

      // Add navigation frame to overlay (absolutely positioned above screenshots)
      const navFrame = createNavigationFrame(page.title, page.url);
      navFrame.x = 0;
      navFrame.y = -60; // Position navigation above screenshots
      navFrame.resize(screenshotWidth, navHeight);
      overlayContainer.appendChild(navFrame);

      // Add red frames around interactive elements - with absolute positioning and scaling
      if (page.interactiveElements && page.interactiveElements.length > 0) {
        console.log(`Adding ${page.interactiveElements.length} interactive element frames for ${page.url}`);
        
        // Get the original screenshot dimensions to calculate scaling factor
        let originalWidth = screenshotWidth; // fallback
        let scaleFactor = 1;
        
        if (screenshots.length > 0) {
          try {
            const firstScreenshotBytes = await fetchImageAsUint8Array(screenshots[0]);
            const dimensions = await getImageDimensions(firstScreenshotBytes);
            originalWidth = dimensions.width;
            scaleFactor = screenshotWidth / originalWidth;
            console.log(`Calculated scaling factor: ${scaleFactor} (original: ${originalWidth}px, target: ${screenshotWidth}px)`);
          } catch (error) {
            console.log(`Could not calculate scaling factor, using 1:1 scaling:`, error);
          }
        }
        
        // Add red frames for each interactive element with scaled coordinates
        for (const element of page.interactiveElements) {
          const highlightRect = figma.createRectangle();
          highlightRect.name = `${element.type}: ${element.text || element.href || 'unnamed'}`;
          
          // Scale coordinates and dimensions to match screenshot scaling
          const scaledX = element.x * scaleFactor;
          const scaledY = element.y * scaleFactor; // Position relative to screenshots (no nav offset needed)
          const scaledWidth = element.width * scaleFactor;
          const scaledHeight = element.height * scaleFactor;
          
          // Set absolute position - coordinates are scaled to match screenshot
          highlightRect.x = scaledX;
          highlightRect.y = scaledY;
          highlightRect.resize(scaledWidth, scaledHeight);
          
          // Style the highlight - red 1px stroke, no fill, 50% opacity
          highlightRect.fills = [];
          highlightRect.strokes = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }]; // Red color
          highlightRect.strokeWeight = 1;
          highlightRect.opacity = 0.5;
          
          overlayContainer.appendChild(highlightRect);
          
          console.log(`Created highlight at scaled position (${scaledX}, ${scaledY}) size ${scaledWidth}x${scaledHeight} (original: ${element.x}, ${element.y} ${element.width}x${element.height})`);
        }
        
        console.log(`Added interactive element highlights with scaled positioning for ${page.url}`);
      }

      // Add the overlay container to the page
      newPage.appendChild(overlayContainer);
      console.log(`Added absolute positioning overlay for ${page.url}`);

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
