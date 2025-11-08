/**
 * TARGET PAGE RENDERER
 *
 * Renders target page screenshots with interactive elements overlay
 */

import { ManifestData, InteractiveElement } from "../types";
import type { ElementFilters, ElementType } from "../../types";
import { getImageDimensionsFromPNG } from "../utils/imageUtils";
import { isExternalLink } from "../utils/urlUtils";
import { BADGE_COLORS } from "../constants";
import { categorizeElementType } from "../../utils/elementCategorization";

const ELEMENT_HIGHLIGHT_COLORS: Record<ElementType, RGB> = {
  heading: { r: 111 / 255, g: 66 / 255, b: 193 / 255 },
  button: { r: 40 / 255, g: 167 / 255, b: 69 / 255 },
  input: { r: 253 / 255, g: 126 / 255, b: 20 / 255 },
  textarea: { r: 253 / 255, g: 126 / 255, b: 20 / 255 },
  select: { r: 253 / 255, g: 126 / 255, b: 20 / 255 },
  image: { r: 32 / 255, g: 201 / 255, b: 151 / 255 },
  link: { r: 0, g: 102 / 255, b: 204 / 255 },
  paragraph: { r: 108 / 255, g: 117 / 255, b: 125 / 255 },
  div: { r: 108 / 255, g: 117 / 255, b: 125 / 255 },
  other: { r: 108 / 255, g: 117 / 255, b: 125 / 255 },
};

const ELEMENT_TYPE_TO_FILTER_KEY: Record<ElementType, keyof ElementFilters> = {
  heading: "headings",
  button: "buttons",
  input: "inputs",
  textarea: "textareas",
  select: "selects",
  image: "images",
  link: "links",
  paragraph: "paragraphs",
  div: "divs",
  other: "other",
};

const DEFAULT_ELEMENT_FILTERS: ElementFilters = {
  headings: true,
  buttons: true,
  inputs: true,
  textareas: true,
  selects: true,
  images: true,
  links: true,
  paragraphs: false,
  divs: false,
  other: false,
};

type RenderTargetPageOptions = {
  highlightAllElements?: boolean;
  highlightElementFilters?: any;
  includeInteractiveOverlay?: boolean;
  originalViewportWidth?: number;
};

export async function renderTargetPage(
  flowPage: PageNode,
  manifestData: ManifestData,
  x: number,
  y: number,
  options: RenderTargetPageOptions = {}
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

  const includeInteractiveOverlay =
    options.includeInteractiveOverlay !== undefined
      ? options.includeInteractiveOverlay
      : true;

  if (pageData.pageId) {
    try {
      flowPage.setPluginData("PAGE_ID", String(pageData.pageId));
      console.log(
        `🧭 Stored PAGE_ID=${pageData.pageId} on flow page ${flowPage.name}`
      );
    } catch (error) {
      console.warn("Unable to persist PAGE_ID on flow page", error);
    }
  } else {
    console.warn(
      "Target manifest missing pageId; markup may stay disabled for this page"
    );
  }

  if (pageData.url || manifestData.startUrl) {
    try {
      const urlToPersist = pageData.url || manifestData.startUrl;
      flowPage.setPluginData("URL", urlToPersist);
      console.log(
        `🧭 Stored URL=${urlToPersist} on flow page ${flowPage.name}`
      );
    } catch (error) {
      console.warn("Unable to persist URL on flow page", error);
    }
  }

  const screenshotWidth = Number.isFinite(targetFrame.width)
    ? targetFrame.width
    : null;

  if (screenshotWidth) {
    try {
      flowPage.setPluginData("SCREENSHOT_WIDTH", String(screenshotWidth));
      console.log(
        `🧭 Stored SCREENSHOT_WIDTH=${screenshotWidth} on flow page ${flowPage.name}`
      );
    } catch (error) {
      console.warn("Unable to persist SCREENSHOT_WIDTH on flow page", error);
    }

    try {
      const originalWidth = options?.originalViewportWidth ?? screenshotWidth;
      flowPage.setPluginData("ORIGINAL_VIEWPORT_WIDTH", String(originalWidth));
      console.log(
        `🧭 Stored ORIGINAL_VIEWPORT_WIDTH=${originalWidth} on flow page ${flowPage.name}`
      );
    } catch (error) {
      console.warn(
        "Unable to persist ORIGINAL_VIEWPORT_WIDTH on flow page",
        error
      );
    }
  }

  const overlayContainer = ensurePageOverlay(targetFrame);

  if (overlayContainer.children.length > 0) {
    console.log(
      `🧭 Clearing ${overlayContainer.children.length} existing overlay nodes before rendering`
    );
    while (overlayContainer.children.length > 0) {
      overlayContainer.children[0].remove();
    }
  }

  if (
    includeInteractiveOverlay &&
    pageData.interactiveElements &&
    pageData.interactiveElements.length > 0
  ) {
    await addInteractiveElementsOverlay(
      targetFrame,
      pageData,
      overlayContainer
    );
  } else {
    console.log("🧭 Skipping interactive overlay population for target page");
  }

  if (
    options.highlightAllElements &&
    pageData.styleData &&
    pageData.styleData.elements &&
    pageData.styleData.elements.length > 0
  ) {
    console.log(
      `🎨 Adding color-coded highlights for ${pageData.styleData.elements.length} detected elements`
    );
    await addElementHighlightsOverlay(
      targetFrame,
      pageData,
      options.highlightElementFilters
    );
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
  pageData: any,
  overlayContainer?: FrameNode
): Promise<void> {
  const container = overlayContainer ?? ensurePageOverlay(targetFrame);

  let linkCounter = 1;

  for (const element of pageData.interactiveElements) {
    const elementLabel = element.text || element.href || "unnamed";

    const highlightRect = createHighlightRect(element);

    if (element.href && element.href !== "#") {
      highlightRect.name = `link_${linkCounter}_highlight: ${elementLabel}`;

      const badge = await createBadge(element, pageData.url, linkCounter);

      container.appendChild(badge);
      linkCounter++;
    } else {
      highlightRect.name = `${element.type}_highlight: ${elementLabel}`;
    }

    container.appendChild(highlightRect);
  }

  if (container.parent !== targetFrame) {
    targetFrame.appendChild(container);
  }
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
  badge.x = element.x - 4;
  badge.y = element.y + element.height - badgeSize + 4;
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
    const match = pageUrl.match(/^https?:\/\/[^\/]+/);
    const baseUrl = match ? match[0] : undefined;
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
 * Add color-coded highlights overlay for all detected elements from styleData
 */
async function addElementHighlightsOverlay(
  targetFrame: FrameNode,
  pageData: any,
  highlightElementFilters?: any
): Promise<void> {
  const overlayContainer = figma.createFrame();
  overlayContainer.name = "element_highlights_overlay";
  overlayContainer.resize(targetFrame.width, targetFrame.height);
  overlayContainer.x = 0;
  overlayContainer.y = 0;
  overlayContainer.fills = [];
  overlayContainer.clipsContent = false;

  // Color scheme for different element types (matching styling mode)
  const filters: ElementFilters = Object.assign(
    {},
    DEFAULT_ELEMENT_FILTERS,
    highlightElementFilters && typeof highlightElementFilters === "object"
      ? (highlightElementFilters as Partial<ElementFilters>)
      : {}
  );

  // Build link metadata map from interactive elements
  const linkMetadataMap = new Map<
    string,
    { linkNumber: number; href: string; isExternal: boolean }
  >();
  let linkNum = 1;
  if (pageData.interactiveElements) {
    for (const element of pageData.interactiveElements) {
      if (element.href && element.href !== "#") {
        const key = `${element.x},${element.y},${element.width},${element.height}`;
        linkMetadataMap.set(key, {
          linkNumber: linkNum,
          href: element.href,
          isExternal: isExternalLink(element.href, pageData.url),
        });
        linkNum++;
      }
    }
  }

  let elementCounter = 1;
  let linkCounter = 1;
  let filteredCount = 0;

  for (const element of pageData.styleData.elements) {
    let elementType =
      (element.elementType as ElementType | undefined) ||
      categorizeElementType(element.tagName || "", element.type || "");

    if (!elementType || !ELEMENT_TYPE_TO_FILTER_KEY[elementType]) {
      elementType = "other";
    }

    const filterKey = ELEMENT_TYPE_TO_FILTER_KEY[elementType];
    if (!filters[filterKey]) {
      filteredCount++;
      continue;
    }

    // Skip elements without valid bounding box
    if (
      !element.boundingBox ||
      element.boundingBox.width <= 0 ||
      element.boundingBox.height <= 0
    ) {
      continue;
    }

    // Skip very small elements or very large ones (likely containers)
    const MIN_SIZE = 10;
    if (
      element.boundingBox.width < MIN_SIZE ||
      element.boundingBox.height < MIN_SIZE
    ) {
      continue;
    }

    // Get color for this element type
    const elementColor = ELEMENT_HIGHLIGHT_COLORS[elementType];

    const highlightRect = figma.createRectangle();
    highlightRect.x = element.boundingBox.x;
    highlightRect.y = element.boundingBox.y;
    highlightRect.resize(element.boundingBox.width, element.boundingBox.height);
    highlightRect.fills = [];
    highlightRect.strokes = [{ type: "SOLID", color: elementColor }];
    highlightRect.strokeWeight = 2;
    highlightRect.opacity = 0.6;

    const elementLabel =
      element.text ||
      element.value ||
      element.type ||
      `element_${elementCounter}`;

    // Look up link metadata
    const elementKey = `${element.boundingBox.x},${element.boundingBox.y},${element.boundingBox.width},${element.boundingBox.height}`;
    const linkMeta = linkMetadataMap.get(elementKey);
    const isLink = !!linkMeta;
    const currentLinkNumber = isLink ? linkCounter : null;

    // Use link_X_highlight naming for links
    if (isLink && currentLinkNumber) {
      highlightRect.name = `link_${currentLinkNumber}_highlight: ${elementLabel.substring(0, 50)}`;
    } else {
      highlightRect.name = `${elementType}_highlight: ${elementLabel.substring(0, 50)}`;
    }

    // Create badge for element - links get link_X_badge naming
    const badge = await createElementBadge(
      element,
      elementCounter,
      linkMeta,
      currentLinkNumber,
      isLink
        ? linkMeta!.isExternal
          ? BADGE_COLORS.EXTERNAL
          : BADGE_COLORS.INTERNAL
        : elementColor,
      pageData.url
    );

    overlayContainer.appendChild(highlightRect);
    overlayContainer.appendChild(badge);
    elementCounter++;
    if (isLink) {
      linkCounter++;
    }
  }

  console.log(
    `🎨 Added ${elementCounter - 1} color-coded highlights (${filteredCount} filtered out)`
  );
  targetFrame.appendChild(overlayContainer);
}

function ensurePageOverlay(targetFrame: FrameNode): FrameNode {
  const existing = targetFrame.findOne(
    (node) => node.type === "FRAME" && node.name === "Page Overlay"
  ) as FrameNode | null;

  if (existing) {
    existing.resize(targetFrame.width, targetFrame.height);
    existing.x = 0;
    existing.y = 0;
    existing.fills = [];
    existing.clipsContent = false;
    return existing;
  }

  const overlayContainer = figma.createFrame();
  overlayContainer.name = "Page Overlay";
  overlayContainer.resize(targetFrame.width, targetFrame.height);
  overlayContainer.x = 0;
  overlayContainer.y = 0;
  overlayContainer.fills = [];
  overlayContainer.strokes = [];
  overlayContainer.opacity = 1;
  overlayContainer.layoutMode = "NONE";
  overlayContainer.clipsContent = false;
  overlayContainer.locked = false;
  targetFrame.appendChild(overlayContainer);

  return overlayContainer;
}

/**
 * Create badge for detected element
 */
async function createElementBadge(
  element: any,
  counter: number,
  linkMeta:
    | { linkNumber: number; href: string; isExternal: boolean }
    | undefined,
  linkNumber: number | null,
  color: RGB,
  pageUrl: string
): Promise<GroupNode> {
  const isLink = !!linkMeta;
  const badge = figma.createEllipse();

  // Use link_X_badge naming for links
  if (isLink && linkNumber) {
    badge.name = `link_${linkNumber}_badge_circle`;
  } else {
    badge.name = `element_${counter}_badge_circle`;
  }

  const badgeSize = isLink ? 18 : 16;
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
  badgeText.fontSize = isLink ? 9 : 8;
  badgeText.characters =
    isLink && linkNumber ? linkNumber.toString() : counter.toString();

  if (isLink && linkNumber) {
    badgeText.name = `link_${linkNumber}_badge_text`;
  } else {
    badgeText.name = `element_${counter}_badge_text`;
  }

  badgeText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  badgeText.x = badge.x + (badgeSize - badgeText.width) / 2;
  badgeText.y = badge.y + (badgeSize - badgeText.height) / 2;

  // Add hyperlink to badge text for links
  if (isLink && linkMeta && linkMeta.href) {
    try {
      const validUrl = normalizeUrl(linkMeta.href, pageUrl);
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
        console.log(
          `Added hyperlink to element badge ${linkNumber}: ${validUrl}`
        );
      }
    } catch (error) {
      console.log(`Skipping hyperlink for element badge: ${linkMeta.href}`);
    }
  }

  const badgeGroup = figma.group([badge, badgeText], figma.currentPage);

  if (isLink && linkNumber) {
    badgeGroup.name = `link_${linkNumber}_badge`;
  } else {
    badgeGroup.name = `element_${counter}_badge`;
  }

  return badgeGroup;
}
