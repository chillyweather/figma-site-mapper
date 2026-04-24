import type { InventoryDecisions } from "../types";

type JsonRecord = Record<string, unknown>;

const PAGE_NAME = "DS Inventory";

const COLORS = {
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

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object")
    : [];
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function arrayText(value: unknown, limit = 6): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => String(item))
    .filter(Boolean)
    .slice(0, limit)
    .join(", ");
}

function hexToPaint(value: string): SolidPaint | null {
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

async function loadFonts(): Promise<void> {
  await Promise.all([
    figma.loadFontAsync({ family: "Inter", style: "Regular" }),
    figma.loadFontAsync({ family: "Inter", style: "Medium" }),
    figma.loadFontAsync({ family: "Inter", style: "Bold" }),
  ]);
}

function createText(
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

function createFrame(name: string, width: number): FrameNode {
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

function createBadge(label: string, color: RGB = COLORS.blue): FrameNode {
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

function createCard(title: string, lines: string[], accent: RGB): FrameNode {
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

function createMissingImageNote(): FrameNode {
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

async function createImageRect(url: string, label: string): Promise<RectangleNode | null> {
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

async function createClusterImageRow(clusterId: string, decisions: InventoryDecisions): Promise<FrameNode | null> {
  const examples = decisions.clusterExamples?.[clusterId] ?? [];
  const urls = examples
    .map((example) => example.cropContextUrl || example.cropUrl)
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .slice(0, 3);

  if (!urls.length) return null;

  const row = figma.createFrame();
  row.name = "Cluster Crop Examples";
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "AUTO";
  row.counterAxisSizingMode = "AUTO";
  row.itemSpacing = 8;
  row.fills = [];

  for (let index = 0; index < urls.length; index += 1) {
    const rect = await createImageRect(urls[index], `Crop ${index + 1}`);
    if (rect) row.appendChild(rect);
  }

  return row.children.length > 0 ? row : null;
}

function addSectionTitle(parent: FrameNode, title: string, subtitle?: string): void {
  parent.appendChild(createText(title, { size: 28, style: "Bold", width: 1120 }));
  if (subtitle) {
    parent.appendChild(createText(subtitle, { size: 14, color: COLORS.muted, width: 1120 }));
  }
}

function createGrid(name: string): FrameNode {
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

async function buildClustersSection(decisions: InventoryDecisions): Promise<FrameNode> {
  const clusters = asArray(asRecord(decisions.clusters).clusters);
  const section = createFrame("Components", 1200);
  addSectionTitle(section, "Components", `${clusters.length} agent-defined clusters`);
  const grid = createGrid("Component Cluster Cards");

  for (const cluster of clusters) {
    const clusterId = textValue(cluster.id);
    const examples = clusterId ? decisions.clusterExamples?.[clusterId] ?? [] : [];
    const card = createCard(
      textValue(cluster.name, clusterId || "Unnamed cluster"),
      [
        `ID: ${clusterId || "-"}`,
        `Category: ${textValue(cluster.category, "-")}`,
        `Confidence: ${textValue(cluster.confidence, "-")}`,
        `Members: ${Array.isArray(cluster.memberFingerprints) ? cluster.memberFingerprints.length : 0}`,
        examples.length > 0
          ? `Examples: ${examples.map((example) => `${example.instanceCount}x`).join(" / ")}`
          : "",
        textValue(cluster.notes),
      ],
      COLORS.blue
    );
    if (clusterId) {
      const imageRow = await createClusterImageRow(clusterId, decisions);
      card.insertChild(1, imageRow ?? createMissingImageNote());
    }
    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

function buildTokensSection(decisions: InventoryDecisions): FrameNode {
  const tokenRecord = asRecord(decisions.tokens);
  const section = createFrame("Tokens", 1200);
  const tokenCount = ["colors", "typography", "spacing", "radii", "shadows"].reduce(
    (sum, key) => sum + asArray(tokenRecord[key]).length,
    0
  );
  addSectionTitle(section, "Tokens", `${tokenCount} accepted tokens`);

  const colorGrid = createGrid("Color Tokens");
  for (const token of asArray(tokenRecord.colors)) {
    const value = textValue(token.value);
    const card = createCard(
      textValue(token.name, value),
      [value, textValue(token.usage)],
      COLORS.pink
    );
    const paint = hexToPaint(value);
    if (paint) {
      const swatch = figma.createRectangle();
      swatch.name = `Swatch / ${value}`;
      swatch.resize(324, 56);
      swatch.cornerRadius = 10;
      swatch.fills = [paint];
      card.insertChild(1, swatch);
    }
    colorGrid.appendChild(card);
  }
  section.appendChild(colorGrid);

  for (const key of ["typography", "spacing", "radii", "shadows"]) {
    const tokens = asArray(tokenRecord[key]);
    if (!tokens.length) continue;
    section.appendChild(createText(key[0].toUpperCase() + key.slice(1), { size: 20, style: "Bold", width: 1120 }));
    const grid = createGrid(`${key} Tokens`);
    for (const token of tokens) {
      grid.appendChild(
        createCard(
          textValue(token.name, "Unnamed token"),
          [textValue(token.value), textValue(token.usage)],
          COLORS.green
        )
      );
    }
    section.appendChild(grid);
  }

  return section;
}

function buildIssuesSection(decisions: InventoryDecisions): FrameNode {
  const issues = asArray(asRecord(decisions.inconsistencies).issues);
  const section = createFrame("Inconsistencies", 1200);
  addSectionTitle(section, "Inconsistencies", `${issues.length} review items`);
  const grid = createGrid("Issue Cards");
  for (const issue of issues) {
    const severity = textValue(issue.severity, "review");
    grid.appendChild(
      createCard(
        textValue(issue.id, "Issue"),
        [
          `Severity: ${severity}`,
          textValue(issue.description, textValue(issue.summary)),
          `Recommendation: ${textValue(issue.recommendation, "-")}`,
        ],
        severity === "medium" ? COLORS.amber : severity === "high" ? COLORS.red : COLORS.muted
      )
    );
  }
  section.appendChild(grid);
  return section;
}

function buildTemplatesSection(decisions: InventoryDecisions): FrameNode {
  const templates = asArray(asRecord(decisions.templates).templates);
  const section = createFrame("Templates", 1200);
  addSectionTitle(section, "Templates", `${templates.length} page and section patterns`);
  const grid = createGrid("Template Cards");
  for (const template of templates) {
    grid.appendChild(
      createCard(
        textValue(template.name, textValue(template.id, "Template")),
        [
          `ID: ${textValue(template.id, "-")}`,
          `Pages: ${arrayText(template.pageIds) || "-"}`,
          `Regions: ${arrayText(template.regions) || "-"}`,
          textValue(template.notes),
        ],
        COLORS.blue
      )
    );
  }
  section.appendChild(grid);
  return section;
}

function buildNotesSection(decisions: InventoryDecisions): FrameNode {
  const section = createFrame("Notes", 1200);
  addSectionTitle(section, "Notes", "Agent-written summary and caveats");
  section.appendChild(createText(decisions.notes || "No notes written.", { size: 14, color: COLORS.muted, width: 1120 }));
  return section;
}

function findOrCreateInventoryPage(): PageNode {
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

export async function renderInventoryBoards(decisions: InventoryDecisions): Promise<void> {
  await loadFonts();

  const page = findOrCreateInventoryPage();
  page.name = PAGE_NAME;
  figma.currentPage = page;

  while (page.children.length > 0) {
    page.children[0].remove();
  }

  const board = figma.createFrame();
  board.name = `DS Inventory / Project ${decisions.projectId}`;
  board.layoutMode = "VERTICAL";
  board.primaryAxisSizingMode = "AUTO";
  board.counterAxisSizingMode = "FIXED";
  board.resize(1280, 100);
  board.paddingTop = 56;
  board.paddingRight = 40;
  board.paddingBottom = 56;
  board.paddingLeft = 40;
  board.itemSpacing = 28;
  board.fills = [{ type: "SOLID", color: { r: 0.93, g: 0.95, b: 0.98 } }];
  page.appendChild(board);

  board.appendChild(createText("Design-System Inventory", { size: 40, style: "Bold", width: 1120 }));
  board.appendChild(
    createText(
      `Project ${decisions.projectId} • Built ${decisions.lastBuiltAt ?? "unknown"} • Source: agent decisions`,
      { size: 14, color: COLORS.muted, width: 1120 }
    )
  );

  board.appendChild(await buildClustersSection(decisions));
  board.appendChild(buildTokensSection(decisions));
  board.appendChild(buildIssuesSection(decisions));
  board.appendChild(buildTemplatesSection(decisions));
  board.appendChild(buildNotesSection(decisions));

  figma.viewport.scrollAndZoomIntoView([board]);
}
