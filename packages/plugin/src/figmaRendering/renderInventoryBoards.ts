import type { InventoryRenderData, RenderBoard, RenderSection, RenderCard, RenderAsset } from "@sitemapper/shared";
import {
  loadFonts,
  createText,
  createFrame,
  createBadge,
  createMissingImageNote,
  createImageRect,
  hexToPaint,
  addSectionTitle,
  createGrid,
  findOrCreateInventoryPage,
  createSampleLink,
  COLORS,
  KIND_COLORS,
} from "./inventory/shared";
import { findOrCreateSampleAnchor } from "./inventory/sampleAnchors";
import { buildTokenTable } from "./inventory/tokenTable";

async function createAssetRow(assets: RenderAsset[]): Promise<FrameNode | null> {
  const imageAssets = assets.filter((a): a is RenderAsset & { kind: "image"; url: string } => a.kind === "image" && Boolean(a.url));
  if (imageAssets.length === 0) return null;

  const row = figma.createFrame();
  row.name = "Asset Row";
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "AUTO";
  row.counterAxisSizingMode = "AUTO";
  row.itemSpacing = 8;
  row.fills = [];

  for (let index = 0; index < imageAssets.length; index += 1) {
    const rect = await createImageRect(imageAssets[index].url, `Asset ${index + 1}`);
    if (rect) row.appendChild(rect);
  }

  return row.children.length > 0 ? row : null;
}

async function buildCard(card: RenderCard, accent: RGB): Promise<FrameNode> {
  const frame = createFrame(card.title, 360);
  frame.cornerRadius = 14;
  frame.paddingTop = 18;
  frame.paddingRight = 18;
  frame.paddingBottom = 18;
  frame.paddingLeft = 18;
  frame.itemSpacing = 8;
  frame.fills = [{ type: "SOLID", color: COLORS.panel }];
  frame.appendChild(createBadge(card.title, accent));

  if (card.subtitle) {
    frame.appendChild(createText(card.subtitle, { size: 12, color: COLORS.muted, width: 324 }));
  }

  // Assets
  const assetRow = await createAssetRow(card.assets);
  if (assetRow) {
    frame.insertChild(1, assetRow);
  } else if (card.assets.some((a) => a.kind === "image")) {
    frame.insertChild(1, createMissingImageNote());
  }

  // Color swatches
  for (const asset of card.assets) {
    if (asset.kind === "color" && asset.color) {
      const paint = hexToPaint(asset.color);
      if (paint) {
        const swatch = figma.createRectangle();
        swatch.name = `Swatch / ${asset.color}`;
        swatch.resize(324, 56);
        swatch.cornerRadius = 10;
        swatch.fills = [paint];
        frame.insertChild(1, swatch);
      }
    }
  }

  // Body lines
  for (const line of card.body.filter(Boolean)) {
    frame.appendChild(createText(line, { size: 12, color: COLORS.muted, width: 324 }));
  }

  // Links
  for (const link of card.links) {
    if (link.target.kind === "sample") {
      const anchor = findOrCreateSampleAnchor(
        card.id,
        link.target.pageId,
        link.target.elementId,
        link.target.bbox
      );
      frame.appendChild(createSampleLink(anchor));
    }
  }

  return frame;
}

async function buildSection(section: RenderSection): Promise<FrameNode> {
  if (section.kind === "tokens") {
    return buildTokenTable(section);
  }

  const accent = KIND_COLORS[section.kind] ?? COLORS.blue;
  const container = createFrame(section.title, 1200);
  addSectionTitle(container, section.title, `${section.cards.length} items`);
  const grid = createGrid(`${section.kind} Cards`);

  for (const card of section.cards) {
    const cardNode = await buildCard(card, accent);
    grid.appendChild(cardNode);
  }

  container.appendChild(grid);
  return container;
}

async function buildBoard(
  board: RenderBoard,
  onProgress?: (stage: string) => void
): Promise<FrameNode> {
  const container = createFrame(board.title, 1280);
  container.paddingTop = 40;
  container.paddingBottom = 40;
  container.itemSpacing = 24;
  container.fills = [{ type: "SOLID", color: { r: 0.93, g: 0.95, b: 0.98 } }];
  container.appendChild(createText(board.title, { size: 32, style: "Bold", width: 1200 }));

  for (let i = 0; i < board.sections.length; i += 1) {
    const section = board.sections[i];
    onProgress?.(`${board.title} → ${section.title}`);
    // Yield to the event loop so the UI thread can pick up the progress message.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    container.appendChild(await buildSection(section));
  }

  return container;
}

export interface RenderInventoryProgress {
  stage: string;
  current: number;
  total: number;
}

export async function renderInventoryBoards(
  renderData: InventoryRenderData,
  onProgress?: (progress: RenderInventoryProgress) => void
): Promise<void> {
  onProgress?.({ stage: "Loading fonts", current: 0, total: renderData.boards.length });
  await loadFonts();

  const page = findOrCreateInventoryPage();
  page.name = "DS Inventory";
  figma.currentPage = page;

  while (page.children.length > 0) {
    page.children[0].remove();
  }

  const wrapper = figma.createFrame();
  wrapper.name = `DS Inventory / Project ${renderData.projectId}`;
  wrapper.layoutMode = "VERTICAL";
  wrapper.primaryAxisSizingMode = "AUTO";
  wrapper.counterAxisSizingMode = "AUTO";
  wrapper.resize(100, 100);
  wrapper.paddingTop = 56;
  wrapper.paddingRight = 40;
  wrapper.paddingBottom = 56;
  wrapper.paddingLeft = 40;
  wrapper.itemSpacing = 28;
  wrapper.fills = [{ type: "SOLID", color: { r: 0.93, g: 0.95, b: 0.98 } }];
  page.appendChild(wrapper);

  wrapper.appendChild(createText("Design-System Inventory", { size: 40, style: "Bold", width: 1120 }));
  wrapper.appendChild(
    createText(
      `Project ${renderData.projectId}${renderData.build.isWorkspaceStale ? " • Workspace stale" : ""}`,
      { size: 14, color: COLORS.muted, width: 1120 }
    )
  );

  for (let i = 0; i < renderData.boards.length; i += 1) {
    const board = renderData.boards[i];
    onProgress?.({
      stage: `Rendering ${board.title}`,
      current: i + 1,
      total: renderData.boards.length,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    wrapper.appendChild(
      await buildBoard(board, (stage) =>
        onProgress?.({ stage, current: i + 1, total: renderData.boards.length })
      )
    );
  }

  figma.viewport.scrollAndZoomIntoView([wrapper]);
}
