import { TreeNode, InteractiveElement } from "../../types";



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

function parseHostname(url: string): string | null {
  try {
    // Remove protocol
    const withoutProtocol = url.replace(/^https?:\/\//, '');
    // Get hostname part (before first slash, colon, or end)
    const hostname = withoutProtocol.split(/[\/:\?#]/)[0];
    return hostname.toLowerCase();
  } catch (error) {
    return null;
  }
}

function isExternalLink(href: string, baseUrl: string): boolean {
  try {
    // Handle relative URLs - they are internal
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      return false;
    }

    const linkHostname = parseHostname(href);
    const baseHostname = parseHostname(baseUrl);

    if (!linkHostname || !baseHostname) {
      return false;
    }

    // Compare hostnames - different hostname means external
    return linkHostname !== baseHostname;
  } catch (error) {
    // If URL parsing fails, assume it's internal (relative link)
    return false;
  }
}

export async function createScreenshotPages(
  pages: TreeNode[],
  screenshotWidth: number = 1440,
  detectInteractiveElements: boolean = true
): Promise<Map<string, string>> {
  console.log(`Creating screenshot pages for ${pages.length} pages`);
  console.log(`Interactive elements detection: ${detectInteractiveElements ? 'enabled' : 'disabled'}`);
  const pageIdMap = new Map<string, string>();
  const originalPage = figma.currentPage;

  // Load font for navigation frame - use Inter only
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const fontName = { family: "Inter", style: "Regular" };

  // Create link reference list function
  async function createLinkReferenceList(
    container: FrameNode,
    totalLinks: number,
    elements: InteractiveElement[],
    pageUrl: string
  ): Promise<void> {
    // Create reference frame
    const refFrame = figma.createFrame();
    refFrame.name = "Link References";
    refFrame.layoutMode = "VERTICAL";
    refFrame.primaryAxisAlignItems = "MIN";
    refFrame.counterAxisAlignItems = "MIN";
    refFrame.itemSpacing = 8;
    refFrame.paddingTop = 16;
    refFrame.paddingBottom = 16;
    refFrame.paddingLeft = 16;
    refFrame.paddingRight = 16;
    refFrame.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
    refFrame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
    refFrame.strokeWeight = 1;
    refFrame.cornerRadius = 8;

    // Position reference list 64px below the screenshots
    refFrame.x = 20; // 20px margin from left
    refFrame.y = container.height + 64; // 64px below the screenshots

    // Load fonts before creating text
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    // Create title
    const titleText = figma.createText();
    titleText.fontName = { family: "Inter", style: "Bold" };
    titleText.fontSize = 14;
    titleText.characters = "Link Destinations:";
    titleText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
    refFrame.appendChild(titleText);

    // Create reference entries for each link
    let linkNum = 1;
    for (const element of elements) {
      if (element.href && element.href !== '#') {
        const entryFrame = figma.createFrame();
        entryFrame.name = `Link ${linkNum} Reference`;
        entryFrame.layoutMode = "HORIZONTAL";
        entryFrame.primaryAxisAlignItems = "MIN";
        entryFrame.counterAxisAlignItems = "CENTER";
        entryFrame.itemSpacing = 8;
        entryFrame.fills = [];

        // Create badge container with absolute positioning for proper text centering
        const badgeContainer = figma.createFrame();
        badgeContainer.name = `Badge ${linkNum}`;
        badgeContainer.resize(18, 18);
        badgeContainer.fills = [];
        badgeContainer.strokes = [];
        badgeContainer.layoutMode = "NONE"; // Absolute positioning for centering

        // Determine if link is external
        const isExternal = isExternalLink(element.href, pageUrl);
        const badgeColor = isExternal
          ? { r: 0.1, g: 0.6, b: 0.7 }   // Dark cyan/turquoise for external links
          : { r: 0.9, g: 0.45, b: 0.1 }; // Brighter orange for internal links

        // Create badge icon
        const badgeIcon = figma.createEllipse();
        badgeIcon.resize(18, 18);
        badgeIcon.fills = [{ type: "SOLID", color: badgeColor }]; // Colored fill
        badgeIcon.strokes = []; // No stroke
        badgeIcon.x = 0;
        badgeIcon.y = 0;

        // Create badge number text (font already loaded)
        const badgeNumText = figma.createText();
        badgeNumText.fontName = { family: "Inter", style: "Bold" };
        badgeNumText.fontSize = 9;
        badgeNumText.characters = linkNum.toString();
        badgeNumText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]; // White text

        // Center text in badge
        badgeNumText.x = (18 - badgeNumText.width) / 2;
        badgeNumText.y = (18 - badgeNumText.height) / 2;

        // Add to badge container
        const badgeGroup = figma.group([badgeIcon, badgeNumText], figma.currentPage)
        badgeContainer.appendChild(badgeGroup)
        //badgeContainer.appendChild(badgeIcon);
        //badgeContainer.appendChild(badgeNumText);

        // Create destination text
        const destText = figma.createText();
        destText.fontName = { family: "Inter", style: "Regular" };
        destText.fontSize = 12;

        // Truncate long URLs for display
        const displayUrl = element.href.length > 60
          ? element.href.substring(0, 57) + "..."
          : element.href;

        destText.characters = displayUrl;
        destText.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];

        // Add elements to entry frame
        entryFrame.appendChild(badgeContainer);
        entryFrame.appendChild(destText);

        // Auto-resize entry frame
        entryFrame.layoutAlign = "STRETCH";
        entryFrame.primaryAxisSizingMode = "AUTO";
        entryFrame.counterAxisSizingMode = "AUTO";

        refFrame.appendChild(entryFrame);
        linkNum++;
      }
    }

    // Auto-resize reference frame
    refFrame.layoutAlign = "STRETCH";
    refFrame.primaryAxisSizingMode = "AUTO";
    refFrame.counterAxisSizingMode = "AUTO";

    container.appendChild(refFrame);
    console.log(`Created link reference list with ${totalLinks} entries`);
  }

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

      // Add red frames around interactive elements - with absolute positioning and scaling (if enabled)
      if (detectInteractiveElements && page.interactiveElements && page.interactiveElements.length > 0) {
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

        // Add red frames and numbered badges for each interactive element
        let linkCounter = 1;

        for (const element of page.interactiveElements) {
          const elementLabel = element.text || element.href || 'unnamed';
          
          // Create main highlight rectangle with numbered name
          const highlightRect = figma.createRectangle();
          
          // Scale coordinates and dimensions to match screenshot scaling
          const scaledX = element.x * scaleFactor;
          const scaledY = element.y * scaleFactor;
          const scaledWidth = element.width * scaleFactor;
          const scaledHeight = element.height * scaleFactor;

          // Set absolute position - coordinates are scaled to match screenshot
          highlightRect.x = scaledX;
          highlightRect.y = scaledY;
          highlightRect.resize(scaledWidth, scaledHeight);

          // Style the highlight - red 1px stroke, no fill, 50% opacity
          highlightRect.fills = [];
          highlightRect.strokes = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
          highlightRect.strokeWeight = 1;
          highlightRect.opacity = 0.5;

          // Add numbered badge for links with destinations
          if (element.href && element.href !== '#') {
            highlightRect.name = `link_${linkCounter}_highlight: ${elementLabel}`;
            
            // Determine if link is external
            const isExternal = isExternalLink(element.href, page.url);
            const badgeColor = isExternal
              ? { r: 0.1, g: 0.6, b: 0.7 }
              : { r: 0.9, g: 0.45, b: 0.1 };

            const badge = figma.createEllipse();
            badge.name = `link_${linkCounter}_badge_circle`;

            // Position badge in top-right corner of element
            const badgeSize = 18;
            badge.x = scaledX + scaledWidth - badgeSize - 4;
            badge.y = scaledY - 4;
            badge.resize(badgeSize, badgeSize);

            // Style badge - colored fill, no stroke
            badge.fills = [{ type: "SOLID", color: badgeColor }];
            badge.strokes = [];

            // Add number text to badge
            const badgeText = figma.createText();

            // Load font before setting properties
            await figma.loadFontAsync({ family: "Inter", style: "Bold" });
            badgeText.fontName = { family: "Inter", style: "Bold" };
            badgeText.fontSize = 9;
            badgeText.characters = linkCounter.toString();
            badgeText.name = `link_${linkCounter}_badge_text`;
            
            // Validate and sanitize URL before setting hyperlink
            try {
              let validUrl = element.href;

              // For internal links (relative URLs), prepend the base site URL
              if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://') && !validUrl.startsWith('mailto:')) {
                const baseUrl = page.url.match(/^https?:\/\/[^\/]+/)?.[0];
                if (baseUrl) {
                  if (!validUrl.startsWith('/')) {
                    validUrl = '/' + validUrl;
                  }
                  validUrl = baseUrl + validUrl;
                } else {
                  validUrl = 'https://' + validUrl;
                }
              }

              // Basic URL validation without using URL constructor
              const urlPattern = /^https?:\/\/[^\s]+$/;
              if (!urlPattern.test(validUrl)) {
                throw new Error(`Invalid URL format: ${validUrl}`);
              }

              const hyperlinkTarget: HyperlinkTarget = {
                type: "URL",
                value: validUrl
              };
              badgeText.setRangeHyperlink(0, badgeText.characters.length, hyperlinkTarget);
              console.log(`Added hyperlink: ${validUrl}`);
            } catch (urlError) {
              console.log(`Skipping invalid hyperlink for: ${element.href}`, urlError);
            }
            badgeText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

            // Center text in badge
            badgeText.x = badge.x + (badgeSize - badgeText.width) / 2;
            badgeText.y = badge.y + (badgeSize - badgeText.height) / 2;

            const badgeGroup = figma.group([badge, badgeText], figma.currentPage)
            badgeGroup.name = `link_${linkCounter}_badge`

            overlayContainer.appendChild(badgeGroup)

            console.log(`Added link badge ${linkCounter} for ${element.href}`);
            linkCounter++;
          } else {
            highlightRect.name = `${element.type}_highlight: ${elementLabel}`;
          }

          overlayContainer.appendChild(highlightRect);

          console.log(`Created highlight at scaled position (${scaledX}, ${scaledY}) size ${scaledWidth}x${scaledHeight} (original: ${element.x}, ${element.y} ${element.width}x${element.height})`);
        }

        console.log(`Added interactive element highlights with scaled positioning for ${page.url}`);

        // Create reference list for link mappings if there are links
        if (linkCounter > 1) {
          await createLinkReferenceList(overlayContainer, linkCounter - 1, page.interactiveElements, page.url);
        }
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
