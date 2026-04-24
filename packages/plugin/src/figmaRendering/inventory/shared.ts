export const PAGE_NAME = "DS Inventory";
export const ANCHOR_CONTAINER_NAME = "DS Inventory Sample Anchors";

export const COLORS = {
  ink: { r: 0.07, g: 0.09, b: 0.14 },
  muted: { r: 0.39, g: 0.43, b: 0.5 },
  panel: { r: 0.96, g: 0.97, b: 0.98 },
  white: { r: 1, g: 1, b: 1 },
  blue: { r: 0.15, g: 0.35, b: 0.93 },
  pink: { r: 1, g: 0.09, b: 0.42 },
  amber: { r: 0.92, g: 0.6, b: 0.14 },
  red: { r: 0.86, g: 0.15, b: 0.15 },
  green: { r: 0.06, g: 0.55, b: 0.34 },
};

export const KIND_COLORS: Record<string, RGB> = {
  components: COLORS.blue,
  tokens: COLORS.green,
  issues: COLORS.amber,
  templates: COLORS.blue,
  notes: COLORS.muted,
};

export async function loadFonts(): Promise<void> {
  await Promise.all([
    figma.loadFontAsync({ family: "Inter", style: "Regular" }),
    figma.loadFontAsync({ family: "Inter", style: "Medium" }),
    figma.loadFontAsync({ family: "Inter", style: "Bold" }),
  ]);
}

export function createText(
  characters: string,
  options: {
    size?: number;
    style?: "Regular" | "Medium" | "Bold";
    color?: RGB;
    width?: number;
  } = {}
): TextNode {
  const node = figma.createText();
  node.fontName = { family: "Inter", style: options.style ?? "Regular" };
  node.fontSize = options.size ?? 14;
  node.lineHeight = { unit: "PERCENT", value: 140 };
  node.fills = [{ type: "SOLID", color: options.color ?? COLORS.ink }];
  node.characters = characters;
  if (options.width) {
    node.resize(options.width, node.height);
    node.textAutoResize = "HEIGHT";
  }
  return node;
}

export function createFrame(name: string, width: number): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.resize(width, 100);
  frame.paddingTop = 24;
  frame.paddingRight = 24;
  frame.paddingBottom = 24;
  frame.paddingLeft = 24;
  frame.itemSpacing = 12;
  frame.cornerRadius = 18;
  frame.fills = [{ type: "SOLID", color: COLORS.white }];
  frame.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.9, b: 0.93 } }];
  frame.strokeWeight = 1;
  return frame;
}

export function createBadge(label: string, color: RGB = COLORS.blue): FrameNode {
  const frame = figma.createFrame();
  frame.name = `Badge / ${label}`;
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.paddingTop = 5;
  frame.paddingRight = 10;
  frame.paddingBottom = 5;
  frame.paddingLeft = 10;
  frame.cornerRadius = 999;
  frame.fills = [{ type: "SOLID", color }];
  frame.appendChild(createText(label, { size: 11, style: "Medium", color: COLORS.white }));
  return frame;
}

export function createCard(title: string, lines: string[], accent: RGB): FrameNode {
  const card = createFrame(title, 360);
  card.cornerRadius = 14;
  card.paddingTop = 18;
  card.paddingRight = 18;
  card.paddingBottom = 18;
  card.paddingLeft = 18;
  card.itemSpacing = 8;
  card.fills = [{ type: "SOLID", color: COLORS.panel }];
  card.appendChild(createBadge(title, accent));
  for (const line of lines.filter(Boolean)) {
    card.appendChild(createText(line, { size: 12, color: COLORS.muted, width: 324 }));
  }
  return card;
}

export function createSampleLink(anchor: FrameNode | null): TextNode {
  const link = createText(
    anchor ? "View sample" : "Sample page not rendered",
    {
      size: 12,
      style: "Medium",
      color: anchor ? COLORS.blue : COLORS.muted,
      width: 324,
    }
  );

  if (anchor) {
    link.textDecoration = "UNDERLINE";
    link.hyperlink = { type: "NODE", value: anchor.id };
  }

  return link;
}

export function createMissingImageNote(): FrameNode {
  const frame = figma.createFrame();
  frame.name = "No Crop Available";
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.resize(324, 56);
  frame.paddingTop = 12;
  frame.paddingRight = 12;
  frame.paddingBottom = 12;
  frame.paddingLeft = 12;
  frame.cornerRadius = 10;
  frame.fills = [{ type: "SOLID", color: { r: 0.91, g: 0.93, b: 0.96 } }];
  frame.appendChild(createText("No crop available for this cluster", { size: 11, color: COLORS.muted, width: 300 }));
  return frame;
}

export async function createImageRect(url: string, label: string): Promise<RectangleNode | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const image = figma.createImage(bytes);
    const rect = figma.createRectangle();
    rect.name = label;
    rect.resize(96, 72);
    rect.cornerRadius = 10;
    rect.fills = [
      {
        type: "IMAGE",
        scaleMode: "FIT",
        imageHash: image.hash,
      },
    ];
    rect.strokes = [{ type: "SOLID", color: { r: 0.84, g: 0.86, b: 0.9 } }];
    rect.strokeWeight = 1;
    return rect;
  } catch (error) {
    console.warn(`Failed to load inventory crop ${url}`, error);
    return null;
  }
}

export function hexToPaint(value: string): SolidPaint | null {
  const match = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1];
  return {
    type: "SOLID",
    color: {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
    },
  };
}

export function addSectionTitle(parent: FrameNode, title: string, subtitle?: string): void {
  parent.appendChild(createText(title, { size: 28, style: "Bold", width: 1120 }));
  if (subtitle) {
    parent.appendChild(createText(subtitle, { size: 14, color: COLORS.muted, width: 1120 }));
  }
}

export function createGrid(name: string): FrameNode {
  const grid = figma.createFrame();
  grid.name = name;
  grid.layoutMode = "HORIZONTAL";
  grid.primaryAxisSizingMode = "AUTO";
  grid.counterAxisSizingMode = "AUTO";
  grid.layoutWrap = "WRAP";
  grid.itemSpacing = 16;
  grid.counterAxisSpacing = 16;
  grid.fills = [];
  grid.resize(1120, 100);
  return grid;
}

export function findOrCreateInventoryPage(): PageNode {
  for (const page of figma.root.children) {
    if (page.type === "PAGE" && page.getPluginData("SITEMAP_ROLE") === "ds-inventory") {
      return page;
    }
  }
  const page = figma.createPage();
  page.name = PAGE_NAME;
  page.setPluginData("SITEMAP_ROLE", "ds-inventory");
  return page;
}
