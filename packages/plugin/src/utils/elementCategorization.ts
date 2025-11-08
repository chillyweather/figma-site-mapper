import type {
  ExtractedElement,
  CategorizedElements,
  ElementType,
} from "../types/index";

/**
 * Determines the element type category based on tag name and type
 */
export function categorizeElementType(
  tagName: string,
  type: string
): ElementType {
  const tag = tagName.toLowerCase();
  const inputType = type.toLowerCase();

  // Headings
  if (tag.match(/^h[1-6]$/)) {
    return "heading";
  }

  // Buttons
  if (tag === "button" || inputType === "button" || inputType === "submit") {
    return "button";
  }

  // Form inputs
  if (tag === "input" && !["button", "submit", "reset"].includes(inputType)) {
    return "input";
  }

  // Textareas
  if (tag === "textarea") {
    return "textarea";
  }

  // Selects
  if (tag === "select") {
    return "select";
  }

  // Images
  if (tag === "img" || tag === "picture" || tag === "svg") {
    return "image";
  }

  // Links
  if (tag === "a") {
    return "link";
  }

  // Paragraphs
  if (tag === "p") {
    return "paragraph";
  }

  // Divs
  if (tag === "div") {
    return "div";
  }

  // Everything else
  return "other";
}

/**
 * Maps ElementType to CategorizedElements keys
 */
export const elementTypeToCategoryKey: Record<
  ElementType,
  keyof CategorizedElements
> =
  {
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

/**
 * Categorizes a flat array of extracted elements into organized categories
 */
export function categorizeElements(elements: any[]): CategorizedElements {
  const categorized: CategorizedElements = {
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
    const elementType = categorizeElementType(
      element.tagName || "",
      element.type || ""
    );

    // Add elementType to the element
    const categorizedElement: ExtractedElement = Object.assign({}, element, {
      elementType,
    });

    // Add to appropriate category using the mapping
    const categoryKey = elementTypeToCategoryKey[elementType];
    categorized[categoryKey].push(categorizedElement);
  });

  return categorized;
}

/**
 * Gets element count summary for display
 */
export function getElementCountSummary(
  categorized: CategorizedElements
): Record<ElementType, number> {
  return {
    heading: categorized.headings.length,
    button: categorized.buttons.length,
    input: categorized.inputs.length,
    textarea: categorized.textareas.length,
    select: categorized.selects.length,
    image: categorized.images.length,
    link: categorized.links.length,
    paragraph: categorized.paragraphs.length,
    div: categorized.divs.length,
    other: categorized.other.length,
  };
}
