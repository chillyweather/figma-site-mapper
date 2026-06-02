import {
  TRAIL_MAGENTA,
  TRAIL_STROKE_WEIGHT,
  TRAIL_DASH_PATTERN,
  TRAIL_CORNER_RADIUS,
  MAPPING_FRAME_PADDING,
  MAPPING_ITEM_SPACING,
  MAPPING_TITLE_FONT_SIZE,
  CONTENT_ITEM_SPACING,
  ROW_ITEM_SPACING,
  ROW_NUMBER_FONT_SIZE,
  TYPE_FRAME_ITEM_SPACING,
  WRAPPER_PADDING,
  WRAPPER_CORNER_RADIUS,
  WRAPPER_DASH_PATTERN,
  WRAPPER_BORDER_COLOR,
  WRAPPER_BORDER_WEIGHT,
  LINK_COLOR,
  LINK_FONT_SIZE,
  LINK_TEXT,
  PROPS_ROW_SPACING,
  PROPS_FONT_SIZE,
  PROPS_LABEL_COLOR,
  PROPS_VALUE_COLOR,
  PROPS_LABEL_VALUE_SPACING,
  PROPS_LABEL_MIN_WIDTH,
  MAPPING_TRAIL_KEY,
  trailFrameName,
  mapperPageName,
  mappingFrameName,
} from "./tidyMapper/constants";
import { findScreenshotTargetByPageId, getScreenshotTargetScale } from "../plugin/handlers/screenshotTarget";
import type { MappingRenderData, MappingRenderComponent, MappingRenderInstance } from "../plugin/types";

const MAPPING_PAGE_ROLE = "mapping";

export interface MappingRenderProgress {
  stage: string;
  current: number;
  total: number;
}

export type MappingProgressCallback = (progress: MappingRenderProgress) => void;

export interface MappingRenderResult {
  componentTypes: number;
  totalInstances: number;
  errors: string[];
}

async function loadFontSafe(family: string, style: string): Promise<void> {
  try {
    await figma.loadFontAsync({ family, style });
  } catch {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  }
}

async function createTextNode(
  content: string,
  fontSize: number,
  color: RGB
): Promise<TextNode> {
  await loadFontSafe("Inter", fontSize > 40 ? "Bold" : "Regular");
  const node = figma.createText();
  node.fontName = { family: "Inter", style: fontSize > 40 ? "Bold" : "Regular" };
  node.fontSize = fontSize;
  node.characters = content;
  node.fills = [{ type: "SOLID", color }];
  return node;
}

function createAutoLayoutFrame(name: string, direction: "HORIZONTAL" | "VERTICAL"): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = direction;
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.fills = [];
  return frame;
}

// ── Trail creation ────────────────────────────────────────────────────────────

function findOrCreateTrailFrame(
  sourcePage: PageNode | FrameNode,
  type: string,
  instance: MappingRenderInstance,
  scale: number
): FrameNode {
  const trailName = trailFrameName(type);

  // Remove old trail with same instance key to avoid duplicates on rerender
  const instanceKey = `${instance.pageId}/${instance.elementId}`;
  const existingTrail = sourcePage.findOne(
    (n) =>
      n.type === "FRAME" &&
      n.getPluginData(MAPPING_TRAIL_KEY) === instanceKey &&
      n.name === trailName
  ) as FrameNode | null;
  if (existingTrail) existingTrail.remove();

  const frame = figma.createFrame();
  frame.name = trailName;
  frame.setPluginData(MAPPING_TRAIL_KEY, instanceKey);

  const { x, y, width, height } = instance.bbox;
  frame.x = x * scale;
  frame.y = y * scale;
  frame.resize(Math.max(4, width * scale), Math.max(4, height * scale));

  frame.fills = [];
  frame.strokes = [{ type: "SOLID", color: TRAIL_MAGENTA }];
  frame.strokeWeight = TRAIL_STROKE_WEIGHT;
  frame.strokeAlign = "INSIDE";
  frame.dashPattern = TRAIL_DASH_PATTERN;
  frame.cornerRadius = TRAIL_CORNER_RADIUS;
  frame.visible = false;

  sourcePage.appendChild(frame);
  return frame;
}

// ── Rasterized image extraction ───────────────────────────────────────────────

/**
 * Locates the raw "<title> Screenshots" frame within a screenshot target.
 *
 * Screenshot pages stack the captured slices in this frame and layer a
 * transparent "Page Overlay" (nav, markup, badges) as a sibling on top. A
 * page-level slice export composites the overlay, so crops come back without
 * screenshot pixels. We crop from the Screenshots frame in isolation instead.
 */
function findScreenshotsFrame(
  sourcePage: PageNode | FrameNode
): FrameNode | null {
  if (sourcePage.type === "FRAME" && sourcePage.name.endsWith("Screenshots")) {
    return sourcePage;
  }
  return sourcePage.findOne(
    (n) => n.type === "FRAME" && n.name.endsWith("Screenshots")
  ) as FrameNode | null;
}

async function exportInstanceImage(
  sourcePage: PageNode | FrameNode,
  instance: MappingRenderInstance,
  scale: number
): Promise<Uint8Array | null> {
  const { x, y, width, height } = instance.bbox;

  const scaledX = x * scale;
  const scaledY = y * scale;
  const scaledW = Math.max(4, width * scale);
  const scaledH = Math.max(4, height * scale);

  const screenshotsFrame = findScreenshotsFrame(sourcePage);
  if (!screenshotsFrame) {
    return null;
  }

  // Clone the screenshots-only frame into a clipping frame offset to the
  // target region. Cloning isolates the crop from the Page Overlay by
  // construction and spans multiple stacked screenshot slices automatically.
  let clip: FrameNode | null = null;
  try {
    clip = figma.createFrame();
    clip.name = "_mapping_crop_tmp";
    clip.clipsContent = true;
    clip.fills = [];
    clip.resize(scaledW, scaledH);

    const clone = screenshotsFrame.clone();
    clip.appendChild(clone);
    clone.x = -(scaledX - screenshotsFrame.x);
    clone.y = -(scaledY - screenshotsFrame.y);

    sourcePage.appendChild(clip);

    return await clip.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
  } catch {
    return null;
  } finally {
    if (clip) clip.remove();
  }
}

// ── Props column (issue #58) ───────────────────────────────────────────────────

async function buildPropsColumn(
  props: ReadonlyArray<{ label: string; value: string }>
): Promise<FrameNode> {
  const col = createAutoLayoutFrame("props", "VERTICAL");
  col.itemSpacing = PROPS_ROW_SPACING;
  col.counterAxisAlignItems = "MIN";

  for (const prop of props) {
    const propRow = createAutoLayoutFrame("prop", "HORIZONTAL");
    propRow.itemSpacing = PROPS_LABEL_VALUE_SPACING;
    propRow.counterAxisAlignItems = "MIN";

    const label = await createTextNode(prop.label, PROPS_FONT_SIZE, PROPS_LABEL_COLOR);
    label.textAutoResize = "HEIGHT";
    label.resize(PROPS_LABEL_MIN_WIDTH, label.height);

    const value = await createTextNode(prop.value, PROPS_FONT_SIZE, PROPS_VALUE_COLOR);

    propRow.appendChild(label);
    propRow.appendChild(value);
    col.appendChild(propRow);
  }

  return col;
}

// ── Row building ──────────────────────────────────────────────────────────────

async function buildRow(
  rowNumber: number,
  type: string,
  instance: MappingRenderInstance,
  trailFrameId: string | null,
  imageBytes: Uint8Array | null,
  scale: number
): Promise<FrameNode> {
  const row = createAutoLayoutFrame("row", "HORIZONTAL");
  row.itemSpacing = ROW_ITEM_SPACING;
  row.counterAxisAlignItems = "CENTER";

  // Row number
  const numText = await createTextNode(String(rowNumber), ROW_NUMBER_FONT_SIZE, { r: 0, g: 0, b: 0 });
  row.appendChild(numText);

  // Type frame containing wrapper + link
  const typeFrame = createAutoLayoutFrame(type, "HORIZONTAL");
  typeFrame.itemSpacing = TYPE_FRAME_ITEM_SPACING;
  typeFrame.counterAxisAlignItems = "CENTER";

  // Wrapper with dashed border
  const wrapper = figma.createFrame();
  wrapper.name = "wrapper";
  wrapper.layoutMode = "VERTICAL";
  wrapper.primaryAxisSizingMode = "AUTO";
  wrapper.counterAxisSizingMode = "AUTO";
  wrapper.paddingTop = WRAPPER_PADDING;
  wrapper.paddingRight = WRAPPER_PADDING;
  wrapper.paddingBottom = WRAPPER_PADDING;
  wrapper.paddingLeft = WRAPPER_PADDING;
  wrapper.fills = [];
  wrapper.strokes = [{ type: "SOLID", color: WRAPPER_BORDER_COLOR }];
  wrapper.strokeWeight = WRAPPER_BORDER_WEIGHT;
  wrapper.strokeAlign = "INSIDE";
  wrapper.dashPattern = WRAPPER_DASH_PATTERN;
  wrapper.cornerRadius = WRAPPER_CORNER_RADIUS;

  // Inner image frame
  const imgWidth = Math.max(32, instance.bbox.width);
  const imgHeight = Math.max(32, instance.bbox.height);
  if (imageBytes) {
    const image = figma.createImage(imageBytes);
    const imageRect = figma.createRectangle();
    imageRect.name = type;
    imageRect.resize(Math.max(32, imgWidth * scale), Math.max(32, imgHeight * scale));
    imageRect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
    wrapper.appendChild(imageRect);
  } else {
    const imgFrame = figma.createFrame();
    imgFrame.name = `${type} crop unavailable`;
    imgFrame.resize(imgWidth, imgHeight);
    imgFrame.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
    wrapper.appendChild(imgFrame);
  }
  typeFrame.appendChild(wrapper);

  // Props column — extracted element properties (DOM instances only)
  if (instance.props && instance.props.length > 0) {
    const propsColumn = await buildPropsColumn(instance.props);
    typeFrame.appendChild(propsColumn);
  }

  // Source back-link
  if (trailFrameId) {
    const linkText = await createTextNode(LINK_TEXT, LINK_FONT_SIZE, LINK_COLOR);
    linkText.hyperlink = { type: "NODE", value: trailFrameId };
    typeFrame.appendChild(linkText);
  }

  row.appendChild(typeFrame);
  return row;
}

// ── Mapper page creation ──────────────────────────────────────────────────────

async function findOrCreateMapperPage(type: string): Promise<PageNode> {
  const pageName = mapperPageName(type);
  const existing = figma.root.children.find(
    (p) => p.type === "PAGE" && p.name === pageName
  ) as PageNode | undefined;
  if (existing) return existing;
  const page = figma.createPage();
  page.name = pageName;
  page.setPluginData("SITEMAP_ROLE", MAPPING_PAGE_ROLE);
  page.setPluginData("MAPPING_COMPONENT_TYPE", type);
  return page;
}

async function getOrCreateMappingFrame(page: PageNode, type: string): Promise<{
  mappingFrame: FrameNode;
  contentFrame: FrameNode;
  existingRowCount: number;
}> {
  const frameName = mappingFrameName(type);
  let mappingFrame = page.findOne(
    (n) => n.type === "FRAME" && n.name === frameName
  ) as FrameNode | null;

  if (mappingFrame) {
    let contentFrame = mappingFrame.findOne(
      (n) => n.type === "FRAME" && n.name === "content"
    ) as FrameNode | null;
    if (!contentFrame) {
      contentFrame = createAutoLayoutFrame("content", "VERTICAL");
      contentFrame.itemSpacing = CONTENT_ITEM_SPACING;
      mappingFrame.appendChild(contentFrame);
    }
    const existingRowCount = contentFrame.children.filter((c) => c.name === "row").length;
    return { mappingFrame, contentFrame, existingRowCount };
  }

  // Create new mapping frame
  mappingFrame = figma.createFrame();
  mappingFrame.name = frameName;
  mappingFrame.layoutMode = "VERTICAL";
  mappingFrame.primaryAxisSizingMode = "AUTO";
  mappingFrame.counterAxisSizingMode = "AUTO";
  mappingFrame.paddingTop = MAPPING_FRAME_PADDING;
  mappingFrame.paddingRight = MAPPING_FRAME_PADDING;
  mappingFrame.paddingBottom = MAPPING_FRAME_PADDING;
  mappingFrame.paddingLeft = MAPPING_FRAME_PADDING;
  mappingFrame.itemSpacing = MAPPING_ITEM_SPACING;
  mappingFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  mappingFrame.x = 0;
  mappingFrame.y = 0;

  // Title row
  const titleRow = createAutoLayoutFrame("titleRow", "HORIZONTAL");
  const titleText = await createTextNode(`${type} Mapping`, MAPPING_TITLE_FONT_SIZE, { r: 0, g: 0, b: 0 });
  titleRow.appendChild(titleText);
  mappingFrame.appendChild(titleRow);

  // Content frame
  const contentFrame = createAutoLayoutFrame("content", "VERTICAL");
  contentFrame.itemSpacing = CONTENT_ITEM_SPACING;
  mappingFrame.appendChild(contentFrame);

  page.appendChild(mappingFrame);
  return { mappingFrame, contentFrame, existingRowCount: 0 };
}

// ── Cleanup helpers (Issue #39) ───────────────────────────────────────────────

function removeExistingMapperPages(componentTypes: string[]): void {
  const typeSet = new Set(componentTypes.map(mapperPageName));
  const toRemove = figma.root.children.filter(
    (p) =>
      p.type === "PAGE" &&
      (p.getPluginData("SITEMAP_ROLE") === MAPPING_PAGE_ROLE || typeSet.has(p.name))
  );
  for (const page of toRemove) page.remove();
}

function removeOldTrailsFromSourcePage(sourcePage: PageNode, type?: string): void {
  const trailName = type ? trailFrameName(type) : null;
  const oldTrails = sourcePage.findAll(
    (n) =>
      n.type === "FRAME" &&
      n.getPluginData(MAPPING_TRAIL_KEY) !== "" &&
      (!trailName || n.name === trailName)
  );
  for (const trail of oldTrails) trail.remove();
}

// ── Main render entry point ───────────────────────────────────────────────────

export async function renderMapping(
  renderData: MappingRenderData,
  onProgress?: MappingProgressCallback
): Promise<MappingRenderResult> {
  const errors: string[] = [];
  let totalInstances = 0;

  const componentTypes = renderData.components.map((c) => c.type);
  const total = renderData.components.reduce((sum, c) => sum + c.instanceCount, 0) + componentTypes.length;
  let current = 0;

  const report = (stage: string) => {
    current += 1;
    onProgress?.({ stage, current, total });
  };

  // Remove previously generated mapper pages (Issue #39 — clean rerender)
  report("Removing previously generated mapper pages");
  removeExistingMapperPages(componentTypes);
  for (const page of figma.root.children) {
    if (page.type === "PAGE" && page.getPluginData("PAGE_ID")) {
      removeOldTrailsFromSourcePage(page);
    }
  }

  for (const comp of renderData.components) {
    report(`Rendering ${comp.type}`);

    const mapperPage = await findOrCreateMapperPage(comp.type);
    const { contentFrame, existingRowCount } = await getOrCreateMappingFrame(mapperPage, comp.type);

    for (let i = 0; i < comp.instances.length; i += 1) {
      const instance = comp.instances[i];
      const rowNumber = existingRowCount + i + 1;

      const sourcePage = findScreenshotTargetByPageId(instance.pageId);
      let trailFrameId: string | null = null;
      let imageBytes: Uint8Array | null = null;
      let scale = 1;

      if (sourcePage) {
        scale = getScreenshotTargetScale(sourcePage);
        try {
          const trailFrame = findOrCreateTrailFrame(sourcePage, comp.type, instance, scale);
          trailFrameId = trailFrame.id;
          imageBytes = await exportInstanceImage(sourcePage, instance, scale);
          if (!imageBytes) {
            errors.push(`Crop export failed for ${comp.type} instance ${instance.instanceId}`);
          }
        } catch (err) {
          errors.push(`Trail/crop error for ${comp.type} instance ${instance.instanceId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        errors.push(`Source page not found for pageId ${instance.pageId} (${comp.type} instance ${i + 1})`);
      }

      try {
        const row = await buildRow(rowNumber, comp.type, instance, trailFrameId, imageBytes, scale);
        contentFrame.appendChild(row);
        totalInstances += 1;
      } catch (err) {
        errors.push(`Row build error for ${comp.type} row ${rowNumber}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    componentTypes: componentTypes.length,
    totalInstances,
    errors,
  };
}
