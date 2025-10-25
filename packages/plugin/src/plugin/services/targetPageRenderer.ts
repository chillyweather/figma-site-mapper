/**
 * TARGET PAGE RENDERER
 *
 * Renders target page screenshots with interactive elements overlay
 */

import { ManifestData, InteractiveElement } from "../types";
import { getImageDimensionsFromPNG } from "../utils/imageUtils";
import { isExternalLink } from "../utils/urlUtils";
import { BADGE_COLORS } from "../constants";

/**
 * Render target page on flow page
 */
/**
 * Render target page on flow page
 */
export async function renderTargetPage(
  flowPage: PageNode,
  manifestData: ManifestData,
  x: number,
  y: number,
  highlightAllElements: boolean = false
): Promise<void> {
  console.log("Rendering target page at", x, y);

  const pageData = manifestData.tree;

  if (!pageData) {
    figma.notify("No page data in manifest");
    return;
  }

  if (
    !pageData.screenshot ||
    !Array.isArray(pageData.screenshot) ||
    pageData.screenshot.length === 0
  ) {
    console.error("No screenshot data:", pageData);
    figma.notify("No screenshot data in manifest");
    return;
  }

  const targetFrame = figma.createFrame();
  targetFrame.name = `Target_${pageData.title || "Page"}`;
  targetFrame.x = x;
  targetFrame.y = y;
  targetFrame.clipsContent = false;

  await loadScreenshotSlices(targetFrame, pageData.screenshot);

  if (pageData.interactiveElements && pageData.interactiveElements.length > 0) {
    await addInteractiveElementsOverlay(targetFrame, pageData);
  }

  // Add highlights for all detected elements if enabled and styleData is available
  if (
    highlightAllElements &&
    pageData.styleData &&
    pageData.styleData.elements &&
    pageData.styleData.elements.length > 0
  ) {
    console.log(
      `🎨 Adding purple highlights for ${pageData.styleData.elements.length} detected elements`
    );
    await addElementHighlightsOverlay(targetFrame, pageData);
  }

  flowPage.appendChild(targetFrame);
}

/**
 * Load all screenshot slices into target frame
 */
async function loadScreenshotSlices(
  targetFrame: FrameNode,
  screenshotSlices: string[]
): Promise<void> {
  let currentY = 0;
  let totalWidth = 1280;

  for (let i = 0; i < screenshotSlices.length; i++) {
    const screenshotUrl = screenshotSlices[i];
    console.log(`Fetching screenshot ${i} from:`, screenshotUrl);

    try {
      const imageResponse = await fetch(screenshotUrl);

      if (!imageResponse.ok) {
        throw new Error(`HTTP error! status: ${imageResponse.status}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const imageData = new Uint8Array(imageBuffer);
      const dimensions = getImageDimensionsFromPNG(imageData);

      totalWidth = dimensions.width;
      const imageHeight = dimensions.height;

      const figmaImage = figma.createImage(imageData);
      const image = figma.createRectangle();
      image.name = `Screenshot_Slice_${i}`;

      const imageFills: ImagePaint[] = [
        {
          type: "IMAGE",
          scaleMode: "FILL",
          imageHash: figmaImage.hash,
        },
      ];

      image.resize(totalWidth, imageHeight);
      image.fills = imageFills;
      image.x = 0;
      image.y = currentY;

      targetFrame.appendChild(image);
      currentY += imageHeight;

      console.log(
        `✅ Successfully loaded screenshot slice ${i}: ${totalWidth}x${imageHeight}`
      );
    } catch (error) {
      console.error(`❌ Failed to load screenshot slice ${i}:`, error);
      figma.notify(`Error loading screenshot: ${error}`, { error: true });
    }
  }

  if (currentY > 0 && totalWidth > 0) {
    targetFrame.resize(totalWidth, currentY);
  }
}

/**
 * Add interactive elements overlay to target page
 */
async function addInteractiveElementsOverlay(
  targetFrame: FrameNode,
  pageData: any
): Promise<void> {
  const overlayContainer = figma.createFrame();
  overlayContainer.name = "Page Overlay";
  overlayContainer.resize(targetFrame.width, targetFrame.height);
  overlayContainer.x = 0;
  overlayContainer.y = 0;
  overlayContainer.fills = [];
  overlayContainer.clipsContent = false;

  let linkCounter = 1;

  for (const element of pageData.interactiveElements) {
    const elementLabel = element.text || element.href || "unnamed";

    const highlightRect = createHighlightRect(element);

    if (element.href && element.href !== "#") {
      highlightRect.name = `link_${linkCounter}_highlight: ${elementLabel}`;

      const badge = await createBadge(element, pageData.url, linkCounter);

      overlayContainer.appendChild(badge);
      linkCounter++;
    } else {
      highlightRect.name = `${element.type}_highlight: ${elementLabel}`;
    }

    overlayContainer.appendChild(highlightRect);
  }

  targetFrame.appendChild(overlayContainer);
}

/**
 * Create highlight rectangle for interactive element
 */
function createHighlightRect(element: InteractiveElement): RectangleNode {
  const highlightRect = figma.createRectangle();
  highlightRect.x = element.x;
  highlightRect.y = element.y;
  highlightRect.resize(element.width, element.height);
  highlightRect.fills = [];
  highlightRect.strokes = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
  highlightRect.strokeWeight = 1;
  highlightRect.opacity = 0.5;

  return highlightRect;
}

/**
 * Create badge for link element
 */
async function createBadge(
  element: InteractiveElement,
  pageUrl: string,
  linkCounter: number
): Promise<GroupNode> {
  const isExternal = isExternalLink(element.href!, pageUrl);
  const badgeColor = isExternal ? BADGE_COLORS.EXTERNAL : BADGE_COLORS.INTERNAL;

  const badge = figma.createEllipse();
  badge.name = `link_${linkCounter}_badge_circle`;

  const badgeSize = 18;
  badge.x = element.x + element.width - badgeSize - 4;
  badge.y = element.y - 4;
  badge.resize(badgeSize, badgeSize);
  badge.fills = [{ type: "SOLID", color: badgeColor }];
  badge.strokes = [];

  const badgeText = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  badgeText.fontName = { family: "Inter", style: "Bold" };
  badgeText.fontSize = 9;
  badgeText.characters = linkCounter.toString();
  badgeText.name = `link_${linkCounter}_badge_text`;

  // Add hyperlink
  try {
    let validUrl = normalizeUrl(element.href!, pageUrl);
    const urlPattern = /^https?:\/\/[^\s]+$/;

    if (urlPattern.test(validUrl)) {
      const hyperlinkTarget: HyperlinkTarget = {
        type: "URL",
        value: validUrl,
      };
      badgeText.setRangeHyperlink(
        0,
        badgeText.characters.length,
        hyperlinkTarget
      );
    }
  } catch (error) {
    console.log(`Skipping hyperlink for: ${element.href}`);
  }

  badgeText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  badgeText.x = badge.x + (badgeSize - badgeText.width) / 2;
  badgeText.y = badge.y + (badgeSize - badgeText.height) / 2;

  const badgeGroup = figma.group([badge, badgeText], figma.currentPage);
  badgeGroup.name = `link_${linkCounter}_badge`;

  return badgeGroup;
}

/**
 * Normalize URL for hyperlink
 */
function normalizeUrl(href: string, pageUrl: string): string {
  let validUrl = href;

  if (
    !validUrl.startsWith("http://") &&
    !validUrl.startsWith("https://") &&
    !validUrl.startsWith("mailto:")
  ) {
    const baseUrl = pageUrl.match(/^https?:\/\/[^\/]+/)?.[0];
    if (baseUrl) {
      if (!validUrl.startsWith("/")) {
        validUrl = "/" + validUrl;
      }
      validUrl = baseUrl + validUrl;
    } else {
      validUrl = "https://" + validUrl;
    }
  }

  return validUrl;
}

/**
 * Add purple highlights overlay for all detected elements from styleData
 */
async function addElementHighlightsOverlay(
  targetFrame: FrameNode,
  pageData: any
): Promise<void> {
  const overlayContainer = figma.createFrame();
  overlayContainer.name = "element_highlights_overlay";
  overlayContainer.resize(targetFrame.width, targetFrame.height);
  overlayContainer.x = 0;
  overlayContainer.y = 0;
  overlayContainer.fills = [];
  overlayContainer.clipsContent = false;

  const purpleColor = { r: 0.44, g: 0.26, b: 0.76 }; // Purple color (#6f42c1)
  let elementCounter = 1;

  for (const element of pageData.styleData.elements) {
    // Skip elements without valid bounding box
    if (
      !element.boundingBox ||
      element.boundingBox.width <= 0 ||
      element.boundingBox.height <= 0
    ) {
      continue;
    }

    const highlightRect = figma.createRectangle();
    highlightRect.x = element.boundingBox.x;
    highlightRect.y = element.boundingBox.y;
    highlightRect.resize(element.boundingBox.width, element.boundingBox.height);
    highlightRect.fills = [];
    highlightRect.strokes = [{ type: "SOLID", color: purpleColor }];
    highlightRect.strokeWeight = 2;
    highlightRect.opacity = 0.6;

    const elementLabel =
      element.text ||
      element.value ||
      element.type ||
      `element_${elementCounter}`;
    highlightRect.name = `${element.type}_highlight: ${elementLabel.substring(0, 50)}`;

    // Create badge for element
    const badge = await createElementBadge(
      element,
      elementCounter,
      purpleColor
    );

    overlayContainer.appendChild(highlightRect);
    overlayContainer.appendChild(badge);
    elementCounter++;
  }

  targetFrame.appendChild(overlayContainer);
}

/**
 * Create purple badge for detected element
 */
async function createElementBadge(
  element: any,
  counter: number,
  color: RGB
): Promise<GroupNode> {
  const badge = figma.createEllipse();
  badge.name = `element_${counter}_badge_circle`;

  const badgeSize = 16;
  const x = element.boundingBox.x + element.boundingBox.width - badgeSize - 2;
  const y = element.boundingBox.y - 2;

  badge.x = x;
  badge.y = y;
  badge.resize(badgeSize, badgeSize);
  badge.fills = [{ type: "SOLID", color }];
  badge.strokes = [];

  const badgeText = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  badgeText.fontName = { family: "Inter", style: "Bold" };
  badgeText.fontSize = 8;
  badgeText.characters = counter.toString();
  badgeText.name = `element_${counter}_badge_text`;
  badgeText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  badgeText.x = badge.x + (badgeSize - badgeText.width) / 2;
  badgeText.y = badge.y + (badgeSize - badgeText.height) / 2;

  const badgeGroup = figma.group([badge, badgeText], figma.currentPage);
  badgeGroup.name = `element_${counter}_badge`;

  return badgeGroup;
}
