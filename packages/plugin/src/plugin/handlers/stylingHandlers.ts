/**
 * STYLING ELEMENT HANDLERS
 *
 * Handles creating element highlights for styling mode:
 * 1. Loading categorized elements from manifest
 * 2. Creating colored highlights based on element type
 * 3. Managing element visibility based on filters
 */

import type { ElementFilters } from "../../types/index";

// Color scheme for different element types
const ELEMENT_COLORS: Record<keyof ElementFilters, RGB> = {
  links: { r: 0, g: 102 / 255, b: 204 / 255 }, // Blue #0066CC
  buttons: { r: 40 / 255, g: 167 / 255, b: 69 / 255 }, // Green #28A745
  headings: { r: 111 / 255, g: 66 / 255, b: 193 / 255 }, // Purple #6F42C1
  inputs: { r: 253 / 255, g: 126 / 255, b: 20 / 255 }, // Orange #FD7E14
  textareas: { r: 253 / 255, g: 126 / 255, b: 20 / 255 }, // Orange #FD7E14
  selects: { r: 253 / 255, g: 126 / 255, b: 20 / 255 }, // Orange #FD7E14
  images: { r: 32 / 255, g: 201 / 255, b: 151 / 255 }, // Teal #20C997
  paragraphs: { r: 108 / 255, g: 117 / 255, b: 125 / 255 }, // Gray #6C757D
  divs: { r: 108 / 255, g: 117 / 255, b: 125 / 255 }, // Gray #6C757D
  other: { r: 108 / 255, g: 117 / 255, b: 125 / 255 }, // Gray #6C757D
};

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Load the last manifest from client storage
 */
async function loadManifest(): Promise<any> {
  try {
    const manifest = await figma.clientStorage.getAsync("lastManifest");
    if (!manifest) {
      console.warn("No manifest found in storage");
      return null;
    }
    return manifest;
  } catch (error) {
    console.error("Failed to load manifest:", error);
    return null;
  }
}

/**
 * Create highlight rectangles for styling elements
 */
async function createElementHighlights(
  elements: any[],
  elementType: keyof ElementFilters,
  screenshot: FrameNode
): Promise<void> {
  const color = ELEMENT_COLORS[elementType];

  for (const element of elements) {
    const { x, y, width, height } = element.boundingBox;

    // Create rectangle for highlight
    const rect = figma.createRectangle();
    rect.name = `${String(elementType)}-highlight`;
    rect.resize(width, height);
    rect.x = screenshot.x + x;
    rect.y = screenshot.y + y;

    // Style as outline with semi-transparent fill
    rect.fills = [
      {
        type: "SOLID",
        color: color,
        opacity: 0.1,
      },
    ];
    rect.strokes = [
      {
        type: "SOLID",
        color: color,
      },
    ];
    rect.strokeWeight = 2;
    rect.cornerRadius = 2;

    // Add to current page
    figma.currentPage.appendChild(rect);

    // Optional: Add label for element type
    if (element.text || element.id) {
      const label = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      label.characters =
        element.text?.substring(0, 30) || element.id || elementType;
      label.fontSize = 10;
      label.x = rect.x;
      label.y = rect.y - 15;
      label.fills = [{ type: "SOLID", color: color }];
      figma.currentPage.appendChild(label);
    }
  }
}

/**
 * Get categorized elements from manifest
 */
function categorizeElements(
  elements: any[]
): Record<keyof ElementFilters, any[]> {
  const categorized: Record<keyof ElementFilters, any[]> = {
    headings: [],
    buttons: [],
    inputs: [],
    textareas: [],
    selects: [],
    images: [],
    links: [],
    paragraphs: [],
    divs: [],
    other: [],
  };

  elements.forEach((element) => {
    const tag = element.tagName?.toLowerCase();
    const type = element.type?.toLowerCase();

    if (tag?.match(/^h[1-6]$/)) {
      categorized.headings.push(element);
    } else if (tag === "button" || type === "button" || type === "submit") {
      categorized.buttons.push(element);
    } else if (
      tag === "input" &&
      !["button", "submit", "reset"].includes(type)
    ) {
      categorized.inputs.push(element);
    } else if (tag === "textarea") {
      categorized.textareas.push(element);
    } else if (tag === "select") {
      categorized.selects.push(element);
    } else if (tag === "img" || tag === "picture" || tag === "svg") {
      categorized.images.push(element);
    } else if (tag === "a") {
      categorized.links.push(element);
    } else if (tag === "p") {
      categorized.paragraphs.push(element);
    } else if (tag === "div") {
      categorized.divs.push(element);
    } else {
      categorized.other.push(element);
    }
  });

  return categorized;
}

/**
 * Handle show-styling-elements request from UI
 */
export async function handleShowStylingElements(
  filters: ElementFilters
): Promise<void> {
  console.log("🎨 Creating styling element highlights with filters:", filters);

  try {
    // Load manifest
    const manifest = await loadManifest();
    if (!manifest?.tree?.styleData?.elements) {
      figma.notify(
        "No element data available. Please crawl a site with style extraction enabled."
      );
      return;
    }

    // Get elements and categorize
    const allElements = manifest.tree.styleData.elements;
    const categorized = categorizeElements(allElements);

    // Find the screenshot frame
    const screenshotFrame = figma.currentPage.findOne(
      (node) => node.type === "FRAME" && node.name.includes("screenshot")
    ) as FrameNode;

    if (!screenshotFrame) {
      figma.notify(
        "No screenshot frame found. Please render the sitemap first."
      );
      return;
    }

    // Create highlights for each enabled filter
    let totalHighlights = 0;
    for (const [elementType, enabled] of Object.entries(filters) as [
      keyof ElementFilters,
      boolean,
    ][]) {
      if (enabled && categorized[elementType].length > 0) {
        await createElementHighlights(
          categorized[elementType],
          elementType,
          screenshotFrame
        );
        totalHighlights += categorized[elementType].length;
      }
    }

    if (totalHighlights === 0) {
      figma.notify("No elements found matching your filters");
    } else {
      figma.notify(`Created ${totalHighlights} element highlights`);
    }
  } catch (error) {
    console.error("Failed to create styling highlights:", error);
    figma.notify("Error creating element highlights");
  }
}
