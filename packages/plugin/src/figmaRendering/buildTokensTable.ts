/**
 * Build a tokens table in Figma from CSS variables data
 */

interface CSSVariablesByCategory {
  colors: {
    primitives: Record<string, string>;
    aliases: Record<string, string>;
  };
  spacing: {
    primitives: Record<string, string>;
    aliases: Record<string, string>;
  };
  typography: {
    primitives: Record<string, string>;
    aliases: Record<string, string>;
  };
  sizing: {
    primitives: Record<string, string>;
    aliases: Record<string, string>;
  };
  borders: {
    primitives: Record<string, string>;
    aliases: Record<string, string>;
  };
  shadows: {
    primitives: Record<string, string>;
    aliases: Record<string, string>;
  };
  other: {
    primitives: Record<string, string>;
    aliases: Record<string, string>;
  };
}

const CATEGORY_NAMES: Record<keyof CSSVariablesByCategory, string> = {
  colors: "Colors",
  spacing: "Spacing",
  typography: "Typography",
  sizing: "Sizing",
  borders: "Borders",
  shadows: "Shadows",
  other: "Other",
};

/**
 * Create a text node with specific styling
 */
function createTextNode(
  text: string,
  fontSize: number = 14,
  fontWeight: "Regular" | "Medium" | "Bold" = "Regular"
): TextNode {
  const textNode = figma.createText();
  textNode.characters = text;
  textNode.fontSize = fontSize;

  // Load font before setting weight
  figma.loadFontAsync({ family: "Inter", style: fontWeight }).then(() => {
    textNode.fontName = { family: "Inter", style: fontWeight };
  });

  return textNode;
}

/**
 * Create a token row (name + value)
 */
function createTokenRow(
  name: string,
  value: string,
  width: number = 690
): FrameNode {
  const tokenFrame = figma.createFrame();
  tokenFrame.name = "token";
  tokenFrame.resize(width, 48);
  tokenFrame.layoutMode = "HORIZONTAL";
  tokenFrame.primaryAxisSizingMode = "FIXED";
  tokenFrame.counterAxisSizingMode = "FIXED";
  tokenFrame.paddingLeft = 12;
  tokenFrame.paddingRight = 12;
  tokenFrame.paddingTop = 12;
  tokenFrame.paddingBottom = 12;
  tokenFrame.itemSpacing = 12;
  tokenFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  tokenFrame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
  tokenFrame.strokeWeight = 1;
  tokenFrame.cornerRadius = 4;

  // Name field
  const nameContainer = figma.createFrame();
  nameContainer.name = "name";
  nameContainer.resize((width - 24) / 2, 24);
  nameContainer.layoutMode = "HORIZONTAL";
  nameContainer.primaryAxisSizingMode = "FIXED";
  nameContainer.counterAxisSizingMode = "FIXED";
  nameContainer.fills = [];

  const nameText = createTextNode(name, 12, "Medium");
  nameText.layoutAlign = "STRETCH";
  nameText.layoutGrow = 1;
  nameContainer.appendChild(nameText);

  // Value field
  const valueContainer = figma.createFrame();
  valueContainer.name = "value";
  valueContainer.resize((width - 24) / 2, 24);
  valueContainer.layoutMode = "HORIZONTAL";
  valueContainer.primaryAxisSizingMode = "FIXED";
  valueContainer.counterAxisSizingMode = "FIXED";
  valueContainer.fills = [];

  const valueText = createTextNode(value, 12, "Regular");
  valueText.layoutAlign = "STRETCH";
  valueText.layoutGrow = 1;
  valueContainer.appendChild(valueText);

  tokenFrame.appendChild(nameContainer);
  tokenFrame.appendChild(valueContainer);

  return tokenFrame;
}

/**
 * Create a section (Primitives or Aliases) with multiple token rows
 */
function createTokenSection(
  sectionName: string,
  tokens: Record<string, string>,
  width: number = 690
): FrameNode | null {
  const entries = Object.entries(tokens);
  if (entries.length === 0) return null;

  const sectionFrame = figma.createFrame();
  sectionFrame.name = sectionName;
  sectionFrame.resize(width + 24, 0); // Auto height
  sectionFrame.layoutMode = "VERTICAL";
  sectionFrame.primaryAxisSizingMode = "FIXED";
  sectionFrame.counterAxisSizingMode = "AUTO";
  sectionFrame.paddingLeft = 12;
  sectionFrame.paddingRight = 12;
  sectionFrame.paddingTop = 12;
  sectionFrame.paddingBottom = 12;
  sectionFrame.itemSpacing = 8;
  sectionFrame.fills = [
    { type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } },
  ];
  sectionFrame.cornerRadius = 8;

  // Section title
  const titleText = createTextNode(sectionName, 14, "Bold");
  titleText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  sectionFrame.appendChild(titleText);

  // Add token rows
  entries.forEach(([name, value]) => {
    const tokenRow = createTokenRow(name, value, width);
    sectionFrame.appendChild(tokenRow);
  });

  return sectionFrame;
}

/**
 * Create a category frame (e.g., Colors) with Primitives and Aliases sections
 */
function createCategoryFrame(
  categoryName: string,
  primitives: Record<string, string>,
  aliases: Record<string, string>,
  width: number = 714
): FrameNode | null {
  // Skip if both primitives and aliases are empty
  if (
    Object.keys(primitives).length === 0 &&
    Object.keys(aliases).length === 0
  ) {
    return null;
  }

  const categoryFrame = figma.createFrame();
  categoryFrame.name = categoryName;
  categoryFrame.resize(width, 0); // Auto height
  categoryFrame.layoutMode = "VERTICAL";
  categoryFrame.primaryAxisSizingMode = "FIXED";
  categoryFrame.counterAxisSizingMode = "AUTO";
  categoryFrame.paddingLeft = 12;
  categoryFrame.paddingRight = 12;
  categoryFrame.paddingTop = 12;
  categoryFrame.paddingBottom = 12;
  categoryFrame.itemSpacing = 12;
  categoryFrame.fills = [
    { type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } },
  ];
  categoryFrame.cornerRadius = 8;

  // Category title
  const titleText = createTextNode(categoryName, 18, "Bold");
  titleText.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  categoryFrame.appendChild(titleText);

  // Primitives section
  const primitivesSection = createTokenSection(
    "Primitives",
    primitives,
    width - 24
  );
  if (primitivesSection) {
    categoryFrame.appendChild(primitivesSection);
  }

  // Aliases section
  const aliasesSection = createTokenSection("Aliases", aliases, width - 24);
  if (aliasesSection) {
    categoryFrame.appendChild(aliasesSection);
  }

  return categoryFrame;
}

/**
 * Extract pathname from URL without using URL constructor
 */
function getPathFromUrl(url: string): string {
  try {
    // Remove protocol
    let path = url.replace(/^https?:\/\//, "");
    // Remove domain
    const slashIndex = path.indexOf("/");
    if (slashIndex === -1) return "Home";
    path = path.substring(slashIndex);
    // Remove query string and hash
    path = path.split("?")[0].split("#")[0];
    return path || "Home";
  } catch (error) {
    return "Home";
  }
}

/**
 * Main function to build the tokens table
 */
export async function buildTokensTable(
  cssVariables: CSSVariablesByCategory,
  pageUrl: string
): Promise<void> {
  // Load Inter font
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  // Create main tokens frame
  const tokensFrame = figma.createFrame();
  tokensFrame.name = `Tokens - ${getPathFromUrl(pageUrl)}`;
  tokensFrame.resize(738, 0); // Auto height
  tokensFrame.layoutMode = "VERTICAL";
  tokensFrame.primaryAxisSizingMode = "FIXED";
  tokensFrame.counterAxisSizingMode = "AUTO";
  tokensFrame.paddingLeft = 12;
  tokensFrame.paddingRight = 12;
  tokensFrame.paddingTop = 12;
  tokensFrame.paddingBottom = 12;
  tokensFrame.itemSpacing = 20;
  tokensFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

  // Add page URL as title
  const pageTitle = createTextNode(pageUrl, 16, "Bold");
  pageTitle.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  tokensFrame.appendChild(pageTitle);

  // Create category frames
  const categories: Array<keyof CSSVariablesByCategory> = [
    "colors",
    "spacing",
    "typography",
    "sizing",
    "borders",
    "shadows",
    "other",
  ];

  let hasContent = false;
  for (const category of categories) {
    const categoryData = cssVariables[category];
    if (!categoryData) continue;

    const categoryFrame = createCategoryFrame(
      CATEGORY_NAMES[category],
      categoryData.primitives || {},
      categoryData.aliases || {},
      714
    );

    if (categoryFrame) {
      tokensFrame.appendChild(categoryFrame);
      hasContent = true;
    }
  }

  if (!hasContent) {
    // If no tokens found, add a message
    const noDataText = createTextNode(
      "No CSS variables found for this page",
      14,
      "Regular"
    );
    noDataText.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
    tokensFrame.appendChild(noDataText);
  }

  // Add to current page
  figma.currentPage.appendChild(tokensFrame);

  // Position near viewport center
  tokensFrame.x = figma.viewport.center.x - tokensFrame.width / 2;
  tokensFrame.y = figma.viewport.center.y - tokensFrame.height / 2;

  // Select and zoom to the frame
  figma.currentPage.selection = [tokensFrame];
  figma.viewport.scrollAndZoomIntoView([tokensFrame]);

  figma.notify("✅ Tokens table created successfully!");
}
