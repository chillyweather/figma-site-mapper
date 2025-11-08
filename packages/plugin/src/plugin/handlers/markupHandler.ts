import { fetchProjectElements } from "../services/apiClient";
import {
  transformElement,
  type ElementRecord,
} from "../utils/buildManifestFromProject";
import {
  categorizeElementType,
  elementTypeToCategoryKey,
} from "../../utils/elementCategorization";
import { ELEMENT_HIGHLIGHT_COLORS } from "../../figmaRendering/utils/createScreenshotPages";
import type { ElementFilters, ElementType } from "../../types";

type RenderMarkupRequest = {
  projectId: string | null;
  pageId?: string | null;
  pageUrl?: string | null;
  elementFilters?: ElementFilters;
};

type ClearMarkupRequest = {
  pageId?: string | null;
  pageUrl?: string | null;
};

const MARKUP_CONTAINER_NAME = "Markup Highlights";

function findPageByStoredId(pageId: string | null): PageNode | null {
  if (!pageId) {
    return null;
  }

  for (const child of figma.root.children) {
    if (child.type === "PAGE" && child.getPluginData("PAGE_ID") === pageId) {
      return child as PageNode;
    }
  }

  return null;
}

function ensureMarkupContainer(overlay: FrameNode): FrameNode {
  let container: FrameNode | null = null;

  for (const child of overlay.children) {
    if (child.type === "FRAME" && child.name === MARKUP_CONTAINER_NAME) {
      container = child;
      break;
    }
  }

  if (!container) {
    container = figma.createFrame();
    container.name = MARKUP_CONTAINER_NAME;
    container.fills = [];
    container.strokes = [];
    container.opacity = 1;
    container.layoutMode = "NONE";
    container.clipsContent = false;
    container.locked = false;
    container.x = 0;
    container.y = 0;
    container.resize(overlay.width, overlay.height);
    overlay.appendChild(container);
  } else {
    while (container.children.length > 0) {
      container.children[0].remove();
    }
    container.resize(overlay.width, overlay.height);
  }

  return container;
}

function findMarkupContainer(overlay: FrameNode): FrameNode | null {
  for (const child of overlay.children) {
    if (child.type === "FRAME" && child.name === MARKUP_CONTAINER_NAME) {
      return child;
    }
  }

  return null;
}

function getOverlayContainer(page: PageNode): FrameNode | null {
  return page.findOne(
    (node) => node.type === "FRAME" && node.name === "Page Overlay"
  ) as FrameNode | null;
}

function mapElementTypeToFilterKey(
  elementType: ElementType
): keyof ElementFilters {
  return elementTypeToCategoryKey[elementType] ?? "other";
}

function getElementColor(elementType: ElementType): RGB {
  return (
    ELEMENT_HIGHLIGHT_COLORS[elementType] || {
      r: 0.2,
      g: 0.6,
      b: 0.95,
    }
  );
}

export async function handleRenderMarkupRequest({
  projectId,
  pageId: requestedPageId,
  pageUrl,
  elementFilters,
}: RenderMarkupRequest): Promise<void> {
  if (!projectId) {
    figma.ui.postMessage({
      type: "markup-render-error",
      error: "Select a project before rendering markup.",
    });
    figma.notify("Select a project before rendering markup.", {
      error: true,
    });
    return;
  }

  const filterMap: ElementFilters = Object.assign({}, elementFilters);

  const currentPageId = figma.currentPage.getPluginData("PAGE_ID") || null;
  const pageId = requestedPageId ?? currentPageId;
  const targetPage = pageId ? findPageByStoredId(pageId) : figma.currentPage;

  if (!targetPage || targetPage.type !== "PAGE") {
    figma.ui.postMessage({
      type: "markup-render-error",
      error: "Open a generated screenshot page before rendering markup.",
    });
    figma.notify("Open a generated screenshot page before rendering markup.", {
      error: true,
    });
    return;
  }

  const overlay = getOverlayContainer(targetPage);

  if (!overlay) {
    figma.ui.postMessage({
      type: "markup-render-error",
      error: "This page does not have an overlay container for highlights.",
    });
    figma.notify("No overlay container found on this page.", { error: true });
    return;
  }

  const markupContainer = ensureMarkupContainer(overlay);

  const storedScreenshotWidth = Number(
    targetPage.getPluginData("SCREENSHOT_WIDTH")
  );
  const storedOriginalWidth = Number(
    targetPage.getPluginData("ORIGINAL_VIEWPORT_WIDTH")
  );

  const screenshotWidth = Number.isFinite(storedScreenshotWidth)
    ? storedScreenshotWidth
    : overlay.width;
  const originalWidth = Number.isFinite(storedOriginalWidth)
    ? storedOriginalWidth
    : screenshotWidth;

  const scaleFactor = originalWidth > 0 ? screenshotWidth / originalWidth : 1;

  figma.ui.postMessage({
    type: "markup-render-started",
    message: "Fetching elements from database...",
  });

  try {
    const rawElements = (await fetchProjectElements(projectId, {
      pageId: pageId ?? undefined,
      url: pageUrl ?? undefined,
    })) as ElementRecord[];

    const includedElements = rawElements
      .map((record) => {
        const transformed = transformElement(record);
        if (!transformed) {
          return null;
        }

        const elementType = categorizeElementType(
          transformed.tagName || "",
          transformed.type || ""
        );
        const filterKey = mapElementTypeToFilterKey(elementType);

        if (!filterMap[filterKey]) {
          return null;
        }

        return {
          record,
          transformed,
          elementType,
          filterKey,
        };
      })
      .filter(
        (
          item
        ): item is {
          record: ElementRecord;
          transformed: NonNullable<ReturnType<typeof transformElement>>;
          elementType: ElementType;
          filterKey: keyof ElementFilters;
        } => Boolean(item)
      );

    markupContainer.name = MARKUP_CONTAINER_NAME;

    let created = 0;
    let badgeFontLoaded = false;
    const badgeFont: FontName = { family: "Inter", style: "Bold" };

    for (const item of includedElements) {
      const { transformed, elementType, record } = item;
      const { boundingBox } = transformed;
      const scaledX = boundingBox.x * scaleFactor;
      const scaledY = boundingBox.y * scaleFactor;
      const scaledWidth = Math.max(1, boundingBox.width * scaleFactor);
      const scaledHeight = Math.max(1, boundingBox.height * scaleFactor);
      const highlightNumber = created + 1;

      const highlightRect = figma.createRectangle();
      highlightRect.name = `markup_${elementType}_${highlightNumber}`;
      highlightRect.x = scaledX;
      highlightRect.y = scaledY;
      highlightRect.resize(scaledWidth, scaledHeight);
      highlightRect.fills = [];
      highlightRect.strokes = [
        { type: "SOLID", color: getElementColor(elementType) },
      ];
      highlightRect.strokeWeight = 2;
      highlightRect.opacity = 0.7;

      const metadata = {
        elementId: record._id,
        type: elementType,
        tagName: transformed.tagName,
        selector: transformed.selector,
        href: transformed.href,
        text: transformed.text,
        pageId,
      };

      highlightRect.setPluginData("MARKUP_ELEMENT", JSON.stringify(metadata));
      highlightRect.setPluginData("PAGE_ID", pageId ?? "");

      markupContainer.appendChild(highlightRect);

      const badgeSize = 16;
      const badgeColor = getElementColor(elementType);
      const badgeCircle = figma.createEllipse();
      badgeCircle.name = `markup_badge_${highlightNumber}_circle`;
      badgeCircle.x = scaledX + scaledWidth - badgeSize - 2;
      badgeCircle.y = scaledY - 2;
      badgeCircle.resize(badgeSize, badgeSize);
      badgeCircle.fills = [{ type: "SOLID", color: badgeColor }];
      badgeCircle.strokes = [];

      if (!badgeFontLoaded) {
        try {
          await figma.loadFontAsync(badgeFont);
          badgeFontLoaded = true;
        } catch (fontError) {
          console.warn(
            "Unable to load Inter Bold font for markup badges",
            fontError
          );
        }
      }

      let badgeText: TextNode | null = null;
      if (badgeFontLoaded) {
        badgeText = figma.createText();
        badgeText.fontName = badgeFont;
        badgeText.fontSize = 9;
        badgeText.characters = highlightNumber.toString();
        badgeText.name = `markup_badge_${highlightNumber}_label`;
        badgeText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        badgeText.x = badgeCircle.x + (badgeSize - badgeText.width) / 2;
        badgeText.y = badgeCircle.y + (badgeSize - badgeText.height) / 2;
      }

      const badgeNodes: SceneNode[] = badgeText
        ? [badgeCircle, badgeText]
        : [badgeCircle];

      const badgeGroup = figma.group(badgeNodes, figma.currentPage);
      badgeGroup.name = `markup_badge_${highlightNumber}`;
      badgeGroup.setPluginData(
        "MARKUP_ELEMENT",
        JSON.stringify(Object.assign({}, metadata, { kind: "badge" }))
      );
      badgeGroup.setPluginData("PAGE_ID", pageId ?? "");

      markupContainer.appendChild(badgeGroup);

      created += 1;
    }

    const message = created
      ? `Rendered ${created} highlight${created === 1 ? "" : "s"}.`
      : "No elements matched the selected filters.";

    figma.ui.postMessage({
      type: "markup-render-complete",
      message,
      count: created,
    });

    if (created) {
      figma.notify(message, { timeout: 2000 });
    } else {
      figma.notify(message, { timeout: 2000 });
    }
  } catch (error) {
    console.error("Failed to render markup", error);
    figma.ui.postMessage({
      type: "markup-render-error",
      error:
        error instanceof Error ? error.message : "Unable to render highlights.",
    });
    figma.notify("Failed to render highlights.", { error: true });
  }
}

export async function handleClearMarkupRequest({
  pageId: requestedPageId,
}: ClearMarkupRequest): Promise<void> {
  const currentPageId = figma.currentPage.getPluginData("PAGE_ID") || null;
  const pageId = requestedPageId ?? currentPageId;
  const targetPage = pageId ? findPageByStoredId(pageId) : figma.currentPage;

  if (!targetPage || targetPage.type !== "PAGE") {
    figma.ui.postMessage({
      type: "markup-clear-error",
      error: "Open a generated screenshot page before clearing highlights.",
    });
    figma.notify(
      "Open a generated screenshot page before clearing highlights.",
      {
        error: true,
      }
    );
    return;
  }

  const overlay = getOverlayContainer(targetPage);

  if (!overlay) {
    figma.ui.postMessage({
      type: "markup-clear-error",
      error: "This page does not have an overlay container for highlights.",
    });
    figma.notify("No overlay container found on this page.", { error: true });
    return;
  }

  const markupContainer = findMarkupContainer(overlay);

  if (!markupContainer || markupContainer.children.length === 0) {
    figma.ui.postMessage({
      type: "markup-clear-complete",
      message: "No highlights to clear.",
      count: 0,
    });
    return;
  }

  while (markupContainer.children.length > 0) {
    markupContainer.children[0].remove();
  }

  figma.ui.postMessage({
    type: "markup-clear-complete",
    message: "Cleared highlights.",
    count: 0,
  });

  figma.notify("Cleared highlights.", { timeout: 1500 });
}
