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
  textNode.textAutoResize = "WIDTH_AND_HEIGHT"; // Allow hugging both dimensions
  // Ensure it does not stretch horizontally inside auto-layout parent
  textNode.layoutGrow = 0;
  textNode.layoutAlign = "MIN";

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
  tokenFrame.layoutMode = "HORIZONTAL";
  tokenFrame.primaryAxisSizingMode = "FIXED"; // Fixed width direction
  tokenFrame.counterAxisSizingMode = "AUTO"; // Hug height vertically
  tokenFrame.resize(width, tokenFrame.height); // Only fix width; height left to auto
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
  nameContainer.layoutMode = "HORIZONTAL";
  nameContainer.primaryAxisSizingMode = "AUTO"; // Hug contents horizontally
  nameContainer.counterAxisSizingMode = "AUTO"; // Hug height
  nameContainer.layoutGrow = 1;
  nameContainer.fills = [];

  const nameText = createTextNode(name, 12, "Medium");
  nameContainer.appendChild(nameText);

  // Value field
  const valueContainer = figma.createFrame();
  valueContainer.name = "value";
  valueContainer.layoutMode = "HORIZONTAL";
  valueContainer.primaryAxisSizingMode = "AUTO";
  valueContainer.counterAxisSizingMode = "AUTO";
  valueContainer.layoutGrow = 1;
  valueContainer.fills = [];

  const valueText = createTextNode(value, 12, "Regular");
  valueContainer.appendChild(valueText);

  tokenFrame.appendChild(nameContainer);
  tokenFrame.appendChild(valueContainer);

  console.log(
    "📐 tokenRow height after creation:",
    tokenFrame.height,
    "name height",
    nameContainer.height,
    "value height",
    valueContainer.height
  );
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
  sectionFrame.layoutMode = "VERTICAL";
  sectionFrame.primaryAxisSizingMode = "AUTO"; // Hug height
  sectionFrame.counterAxisSizingMode = "FIXED"; // Fixed width
  sectionFrame.resize(width + 24, sectionFrame.height);
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
  titleText.layoutGrow = 0;
  titleText.layoutAlign = "MIN";
  titleText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  sectionFrame.appendChild(titleText);

  // Add token rows
  entries.forEach(([name, value]) => {
    const tokenRow = createTokenRow(name, value, width);
    sectionFrame.appendChild(tokenRow);
    console.log(
      "📐 Added token row to section",
      sectionName,
      "row height",
      tokenRow.height
    );
  });

  console.log(
    "📐 sectionFrame height after rows:",
    sectionFrame.height,
    sectionName
  );
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
  categoryFrame.layoutMode = "VERTICAL";
  categoryFrame.primaryAxisSizingMode = "AUTO"; // Hug height
  categoryFrame.counterAxisSizingMode = "FIXED"; // Fixed width
  categoryFrame.resize(width, categoryFrame.height);
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
  titleText.layoutGrow = 0;
  titleText.layoutAlign = "MIN";
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
    console.log("📐 primitivesSection height", primitivesSection.height);
  }

  // Aliases section
  const aliasesSection = createTokenSection("Aliases", aliases, width - 24);
  if (aliasesSection) {
    categoryFrame.appendChild(aliasesSection);
    console.log("📐 aliasesSection height", aliasesSection.height);
  }

  console.log(
    "📐 categoryFrame height after sections:",
    categoryFrame.height,
    categoryName
  );
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
  console.log("🎨 buildTokensTable called");
  console.log("📍 pageUrl:", pageUrl);
  console.log("📦 cssVariables received:", cssVariables);
  console.log("📊 cssVariables type:", typeof cssVariables);
  console.log("📊 cssVariables keys:", Object.keys(cssVariables || {}));

  // Load Inter font
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  // Create main tokens frame
  const tokensFrame = figma.createFrame();
  tokensFrame.name = `Tokens - ${getPathFromUrl(pageUrl)}`;
  tokensFrame.layoutMode = "VERTICAL";
  tokensFrame.primaryAxisSizingMode = "AUTO"; // Hug height
  tokensFrame.counterAxisSizingMode = "FIXED"; // Fixed width
  tokensFrame.resize(738, tokensFrame.height);
  tokensFrame.paddingLeft = 12;
  tokensFrame.paddingRight = 12;
  tokensFrame.paddingTop = 12;
  tokensFrame.paddingBottom = 12;
  tokensFrame.itemSpacing = 20;
  tokensFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

  console.log("✅ Main tokens frame created");

  // Add page path as title
  const pagePath = getPathFromUrl(pageUrl);
  const pageTitle = createTextNode(pagePath, 16, "Bold");
  pageTitle.layoutGrow = 0;
  pageTitle.layoutAlign = "MIN";
  pageTitle.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  tokensFrame.appendChild(pageTitle);

  console.log("✅ Page title added");

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
    console.log(`\n🔍 Processing category: ${category}`);
    const categoryData = cssVariables[category];
    console.log(`  categoryData:`, categoryData);
    console.log(`  categoryData type:`, typeof categoryData);

    if (!categoryData) {
      console.log(`  ⏭️  Skipping ${category} - no data`);
      continue;
    }

    const primitives = categoryData.primitives || {};
    const aliases = categoryData.aliases || {};

    console.log(`  primitives keys:`, Object.keys(primitives));
    console.log(`  primitives count:`, Object.keys(primitives).length);
    console.log(`  aliases keys:`, Object.keys(aliases));
    console.log(`  aliases count:`, Object.keys(aliases).length);

    const categoryFrame = createCategoryFrame(
      CATEGORY_NAMES[category],
      primitives,
      aliases,
      714
    );

    if (categoryFrame) {
      console.log(`  ✅ Created frame for ${category}`);
      tokensFrame.appendChild(categoryFrame);
      hasContent = true;
      console.log("📐 categoryFrame appended height", categoryFrame.height);
    } else {
      console.log(`  ⚠️  No frame created for ${category} (empty)`);
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
  console.log("📐 tokensFrame final height", tokensFrame.height);

  // Enforce HUG height for all token frames (in case any defaulted to 100px)
  const allTokenFrames = tokensFrame.findAll(
    (n) => n.type === "FRAME" && n.name === "token"
  ) as FrameNode[];
  allTokenFrames.forEach((f) => {
    f.counterAxisSizingMode = "AUTO"; // ensure hug height
    // Optional: clear any explicit height
    // Trigger a layout update by briefly resizing width only
    f.resize(f.width, f.height);
    console.log("🔧 enforced hug height on token frame", f.name, f.height);
  });

  // Position to the right of the rightmost element on the page
  const allNodes = figma.currentPage.children.filter(
    (n) => n.id !== tokensFrame.id
  );
  let rightmostX = 0;
  let topmostY = 0;

  if (allNodes.length > 0) {
    // Find the rightmost edge and topmost position
    allNodes.forEach((node) => {
      const nodeRight = node.x + node.width;
      if (nodeRight > rightmostX) {
        rightmostX = nodeRight;
      }
      if (node.y < topmostY || topmostY === 0) {
        topmostY = node.y;
      }
    });

    // Position 200px to the right of the rightmost element, top-aligned
    tokensFrame.x = rightmostX + 200;
    tokensFrame.y = topmostY;
  } else {
    // If no other elements, place near viewport center
    tokensFrame.x = figma.viewport.center.x - tokensFrame.width / 2;
    tokensFrame.y = figma.viewport.center.y - tokensFrame.height / 2;
  }

  // Select and zoom to the frame
  figma.currentPage.selection = [tokensFrame];
  figma.viewport.scrollAndZoomIntoView([tokensFrame]);

  figma.notify("✅ Tokens table created successfully!");
}
