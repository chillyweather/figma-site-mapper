import type { RenderCard, RenderLink, RenderSection } from "@sitemapper/shared";
import { COLORS, createText } from "./shared";
import { findOrCreateSampleAnchor, findRenderedPageByPageId } from "./sampleAnchors";

const TABLE_WIDTH = 1200;
const TABLE_PADDING = 16;
const INNER_WIDTH = TABLE_WIDTH - TABLE_PADDING * 2;
const ROW_GAP = 12;
const COL_PREVIEW = 80;
const COL_NAME = 240;
const COL_VALUE = 180;
const COL_USES = 70;
const COL_PAGES = 60;
const COL_SAMPLES = INNER_WIDTH - (COL_PREVIEW + COL_NAME + COL_VALUE + COL_USES + COL_PAGES) - ROW_GAP * 5;

type TokenCategory = "colors" | "typography" | "spacing" | "radii" | "shadows";

function categoryFromBadge(card: RenderCard): TokenCategory {
  const badge = card.badges.find(Boolean);
  if (!badge) return "colors";
  if (badge === "color" || badge === "colors") return "colors";
  if (badge === "typography") return "typography";
  if (badge === "spacing") return "spacing";
  if (badge === "radii" || badge === "radius") return "radii";
  if (badge === "shadows" || badge === "shadow") return "shadows";
  return "colors";
}

function parsePx(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function hexToRgb(hex: string): RGB | null {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const raw = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return {
    r: parseInt(raw.slice(0, 2), 16) / 255,
    g: parseInt(raw.slice(2, 4), 16) / 255,
    b: parseInt(raw.slice(4, 6), 16) / 255,
  };
}

function parseColor(value: string | undefined): RGB | null {
  if (!value) return null;
  const hex = hexToRgb(value);
  if (hex) return hex;
  const m = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (m) {
    return {
      r: parseInt(m[1], 10) / 255,
      g: parseInt(m[2], 10) / 255,
      b: parseInt(m[3], 10) / 255,
    };
  }
  return null;
}

// HUG-sized auto-layout frame: width and height grow to fit children.
function hugFrame(name: string): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.resize(100, 100);
  frame.fills = [];
  frame.clipsContent = false;
  return frame;
}

// Vertical auto-layout frame with FIXED width, AUTO height.
function verticalFrame(name: string, width: number): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.resize(width, 100);
  frame.fills = [];
  frame.clipsContent = false;
  return frame;
}

// Horizontal auto-layout frame with FIXED width, AUTO height.
function horizontalFrame(name: string, width: number): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "AUTO";
  frame.resize(width, 100);
  frame.fills = [];
  frame.clipsContent = false;
  return frame;
}

function rowDivider(): RectangleNode {
  const r = figma.createRectangle();
  r.name = "divider";
  r.resize(INNER_WIDTH, 1);
  r.fills = [{ type: "SOLID", color: { r: 0.88, g: 0.9, b: 0.93 } }];
  return r;
}

function buildPreviewCell(card: RenderCard, category: TokenCategory): FrameNode {
  const cell = figma.createFrame();
  cell.name = "Preview";
  cell.layoutMode = "HORIZONTAL";
  cell.primaryAxisAlignItems = "CENTER";
  cell.counterAxisAlignItems = "CENTER";
  cell.primaryAxisSizingMode = "FIXED";
  cell.counterAxisSizingMode = "FIXED";
  cell.resize(COL_PREVIEW, 56);
  cell.fills = [];
  cell.clipsContent = false;

  const value = card.subtitle ?? "";

  if (category === "colors") {
    const rgb = parseColor(value);
    const swatch = figma.createRectangle();
    swatch.resize(48, 32);
    swatch.cornerRadius = 6;
    swatch.fills = rgb
      ? [{ type: "SOLID", color: rgb }]
      : [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.92 } }];
    swatch.strokes = [{ type: "SOLID", color: { r: 0.84, g: 0.86, b: 0.9 } }];
    swatch.strokeWeight = 1;
    cell.appendChild(swatch);
    return cell;
  }

  if (category === "typography") {
    const isFontFamily = /[a-zA-Z]/.test(value) && !/^\d/.test(value);
    const text = createText("Aa", {
      size: isFontFamily ? 20 : Math.min(parsePx(value) ?? 14, 22),
      style: "Medium",
    });
    cell.appendChild(text);
    return cell;
  }

  if (category === "spacing") {
    const px = parsePx(value) ?? 0;
    const w = Math.max(4, Math.min(px, 56));
    const rect = figma.createRectangle();
    rect.resize(w, 8);
    rect.cornerRadius = 2;
    rect.fills = [{ type: "SOLID", color: COLORS.teal }];
    cell.appendChild(rect);
    return cell;
  }

  if (category === "radii") {
    const px = parsePx(value) ?? 0;
    const rect = figma.createRectangle();
    rect.resize(40, 40);
    rect.cornerRadius = Math.max(0, Math.min(px, 20));
    rect.fills = [];
    rect.strokes = [{ type: "SOLID", color: COLORS.ink }];
    rect.strokeWeight = 2;
    cell.appendChild(rect);
    return cell;
  }

  // shadows
  const rect = figma.createRectangle();
  rect.resize(40, 32);
  rect.cornerRadius = 6;
  rect.fills = [{ type: "SOLID", color: COLORS.white }];
  rect.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.18 },
      offset: { x: 0, y: 4 },
      radius: 10,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
      showShadowBehindNode: false,
    },
  ];
  cell.appendChild(rect);
  return cell;
}

function pageSlugForPageId(pageId: string): string {
  const page = findRenderedPageByPageId(pageId);
  if (!page) return `Page ${pageId}`;
  const url = page.getPluginData("URL");
  if (!url) return page.name || `Page ${pageId}`;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (!path) return parsed.hostname || "home";
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return "home";
    const tail = segments.slice(-2).join("/");
    return tail.length > 24 ? tail.slice(0, 23) + "…" : tail;
  } catch {
    return page.name || `Page ${pageId}`;
  }
}

function buildChip(label: string, anchorId: string | null): FrameNode {
  const chip = hugFrame(`chip / ${label}`);
  chip.paddingTop = 4;
  chip.paddingRight = 8;
  chip.paddingBottom = 4;
  chip.paddingLeft = 8;
  chip.cornerRadius = 999;
  chip.fills = anchorId
    ? [{ type: "SOLID", color: COLORS.teal, opacity: 0.1 }]
    : [{ type: "SOLID", color: { r: 0.93, g: 0.94, b: 0.96 } }];
  chip.strokes = [
    {
      type: "SOLID",
      color: anchorId ? COLORS.teal : { r: 0.84, g: 0.86, b: 0.9 },
      opacity: anchorId ? 0.4 : 1,
    },
  ];
  chip.strokeWeight = 1;

  const text = createText(label, {
    size: 11,
    style: "Medium",
    color: anchorId ? COLORS.teal : COLORS.muted,
  });
  if (anchorId) {
    text.textDecoration = "UNDERLINE";
    text.hyperlink = { type: "NODE", value: anchorId };
  }
  chip.appendChild(text);
  return chip;
}

function buildSamplesCell(card: RenderCard, width: number): FrameNode {
  const cell = verticalFrame("Samples", width);
  cell.itemSpacing = 6;

  const sampleLinks: RenderLink[] = card.links.filter((l) => l.target.kind === "sample");

  if (sampleLinks.length === 0) {
    cell.appendChild(createText("No occurrences captured", { size: 11, color: COLORS.muted }));
    return cell;
  }

  // Group by pageId, preserving the order links arrived in.
  const groups = new Map<string, RenderLink[]>();
  for (const link of sampleLinks) {
    if (link.target.kind !== "sample") continue;
    const list = groups.get(link.target.pageId);
    if (list) list.push(link);
    else groups.set(link.target.pageId, [link]);
  }

  for (const [pageId, links] of groups) {
    const group = verticalFrame(`page-group / ${pageId}`, width);
    group.itemSpacing = 4;

    group.appendChild(
      createText(pageSlugForPageId(pageId), {
        size: 11,
        style: "Medium",
        color: COLORS.muted,
      })
    );

    const chips = figma.createFrame();
    chips.name = "chips";
    chips.layoutMode = "HORIZONTAL";
    chips.layoutWrap = "WRAP";
    chips.resize(width, 1);
    chips.primaryAxisSizingMode = "FIXED";
    chips.counterAxisSizingMode = "AUTO";
    chips.itemSpacing = 6;
    chips.counterAxisSpacing = 6;
    chips.fills = [];
    chips.clipsContent = false;

    for (const link of links) {
      if (link.target.kind !== "sample") continue;
      const anchor = findOrCreateSampleAnchor(
        card.id,
        link.target.pageId,
        link.target.elementId,
        link.target.bbox,
        "token"
      );
      chips.appendChild(buildChip(link.label || "node", anchor ? anchor.id : null));
    }
    group.appendChild(chips);
    cell.appendChild(group);
  }

  return cell;
}

function buildHeaderRow(): FrameNode {
  const row = horizontalFrame("header", INNER_WIDTH);
  row.itemSpacing = ROW_GAP;
  row.paddingTop = 8;
  row.paddingBottom = 8;

  const cols: Array<[string, number]> = [
    ["Preview", COL_PREVIEW],
    ["Name", COL_NAME],
    ["Value", COL_VALUE],
    ["Uses", COL_USES],
    ["Pages", COL_PAGES],
    ["Sample locations", COL_SAMPLES],
  ];
  for (const [label, width] of cols) {
    const cell = horizontalFrame(label, width);
    cell.appendChild(createText(label, { size: 11, style: "Medium", color: COLORS.muted }));
    row.appendChild(cell);
  }
  return row;
}

function extractCounts(card: RenderCard): { uses: string; pages: string } {
  for (const line of card.body) {
    const m = line.match(/^([\d,]+)\s+uses?\s+on\s+(\d+)\s+page/);
    if (m) return { uses: m[1], pages: m[2] };
  }
  return { uses: "—", pages: "—" };
}

function buildDataRow(card: RenderCard, category: TokenCategory): FrameNode {
  const row = horizontalFrame(`row / ${card.id}`, INNER_WIDTH);
  row.itemSpacing = ROW_GAP;
  row.paddingTop = 12;
  row.paddingBottom = 12;
  row.counterAxisAlignItems = "MIN";

  // Preview cell
  row.appendChild(buildPreviewCell(card, category));

  // Name cell
  const nameCell = verticalFrame("Name", COL_NAME);
  nameCell.itemSpacing = 2;
  nameCell.appendChild(createText(card.title, { size: 13, style: "Medium", width: COL_NAME }));
  const note = card.body.find((line) => !/^[\d,]+\s+uses?\s+on/.test(line));
  if (note) {
    nameCell.appendChild(
      createText(note.length > 140 ? note.slice(0, 139) + "…" : note, {
        size: 11,
        color: COLORS.muted,
        width: COL_NAME,
      })
    );
  }
  row.appendChild(nameCell);

  // Value cell
  const valueCell = horizontalFrame("Value", COL_VALUE);
  valueCell.appendChild(
    createText(card.subtitle ?? "—", { size: 12, color: COLORS.ink, width: COL_VALUE })
  );
  row.appendChild(valueCell);

  // Counts
  const { uses, pages } = extractCounts(card);
  const usesCell = horizontalFrame("Uses", COL_USES);
  usesCell.appendChild(createText(uses, { size: 12, color: COLORS.ink }));
  row.appendChild(usesCell);

  const pagesCell = horizontalFrame("Pages", COL_PAGES);
  pagesCell.appendChild(createText(pages, { size: 12, color: COLORS.ink }));
  row.appendChild(pagesCell);

  // Samples cell
  row.appendChild(buildSamplesCell(card, COL_SAMPLES));

  return row;
}

export function buildTokenTable(section: RenderSection): FrameNode {
  const container = figma.createFrame();
  container.name = `Token Table / ${section.title}`;
  container.layoutMode = "VERTICAL";
  container.primaryAxisSizingMode = "AUTO";
  container.counterAxisSizingMode = "FIXED";
  container.resize(TABLE_WIDTH, 100);
  container.cornerRadius = 14;
  container.paddingTop = TABLE_PADDING;
  container.paddingRight = TABLE_PADDING;
  container.paddingBottom = TABLE_PADDING;
  container.paddingLeft = TABLE_PADDING;
  container.itemSpacing = 8;
  container.fills = [{ type: "SOLID", color: COLORS.white }];
  container.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.9, b: 0.93 } }];
  container.strokeWeight = 1;
  container.clipsContent = false;

  container.appendChild(
    createText(section.title, { size: 18, style: "Bold", width: INNER_WIDTH })
  );

  if (section.cards.length === 0) {
    container.appendChild(createText("No tokens in this category", { size: 12, color: COLORS.muted }));
    return container;
  }

  container.appendChild(buildHeaderRow());
  container.appendChild(rowDivider());

  const category = categoryFromBadge(section.cards[0]);

  for (let i = 0; i < section.cards.length; i += 1) {
    container.appendChild(buildDataRow(section.cards[i], category));
    if (i < section.cards.length - 1) container.appendChild(rowDivider());
  }

  return container;
}
