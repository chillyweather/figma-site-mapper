/**
 * Flow Board Renderer
 *
 * Creates a horizontal storyboard on a single Figma page showing the sequence
 * of screens and transitions in a user flow.
 *
 * Layout per step:
 *   [Source screen panel + element highlight]  →  [Arrow + label]  →  ...
 *   [Final target screen panel]
 *
 * Screens are rendered as scaled-down viewport crops.
 * Rerenders are idempotent: the page is cleared and rebuilt each time.
 */

import type { FlowDraftStep } from "../types";
import { BACKEND_URL } from "../plugin/constants";

// ─── Layout constants ────────────────────────────────────────────────────────

const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 480;  // viewport-crop height
const ARROW_WIDTH = 80;
const STEP_GAP = 24;

const BOARD_PADDING = 40;
const STEP_V_OFFSET = 100; // vertical offset for header row

// Colour tokens
const COLOR_BLUE: RGB = { r: 0.1, g: 0.5, b: 1 };
const COLOR_BG: RGB = { r: 0.97, g: 0.97, b: 0.98 };
const COLOR_BORDER: RGB = { r: 0.84, g: 0.88, b: 0.94 };
const COLOR_MUTED: RGB = { r: 0.4, g: 0.45, b: 0.55 };
const COLOR_ARROW: RGB = { r: 0.6, g: 0.65, b: 0.72 };

// Plugin data keys
const PAGE_ID_KEY = "PAGE_ID";
const ORIGINAL_VIEWPORT_WIDTH_KEY = "ORIGINAL_VIEWPORT_WIDTH";
const FLOW_BOARD_KEY = "FLOW_BOARD_ID";
const FLOW_BOARD_STEP_KEY = "FLOW_BOARD_STEP";

const TAG = "[Flow Board]";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PageApiItem {
  _id: string;
  url: string;
  title: string;
  screenshotPaths: string[];
}

async function fetchPagesData(
  projectId: string,
  pageIds: string[]
): Promise<Map<string, PageApiItem>> {
  const unique = [...new Set(pageIds.filter(Boolean))];
  if (!unique.length) {
    console.log(`${TAG} fetchPagesData — no page IDs to fetch`);
    return new Map();
  }

  console.log(`${TAG} fetchPagesData — requesting ${unique.length} page(s):`, unique);

  const queryParts = [`projectId=${encodeURIComponent(projectId)}`];
  for (const id of unique) queryParts.push(`ids=${encodeURIComponent(id)}`);

  try {
    const url = `${BACKEND_URL}/pages/by-ids?${queryParts.join("&")}`;
    console.log(`${TAG} fetchPagesData — GET ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`${TAG} fetchPagesData — HTTP ${res.status} ${res.statusText}`);
      return new Map();
    }
    const data = (await res.json()) as { pages?: PageApiItem[] };
    const out = new Map<string, PageApiItem>();
    for (const p of data.pages ?? []) out.set(p._id, p);
    console.log(
      `${TAG} fetchPagesData — received ${out.size}/${unique.length} page(s):`,
      [...out.values()].map((p) => `${p._id} (${p.url}) screenshots=${p.screenshotPaths.length}`)
    );
    const missing = unique.filter((id) => !out.has(id));
    if (missing.length) console.warn(`${TAG} fetchPagesData — missing page IDs:`, missing);
    return out;
  } catch (err) {
    console.error(`${TAG} fetchPagesData — fetch failed:`, err);
    return new Map();
  }
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  console.log(`${TAG} fetchImageBytes — fetching: ${url}`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`${TAG} fetchImageBytes — HTTP ${res.status} for ${url}`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    console.log(`${TAG} fetchImageBytes — OK: ${bytes.length} bytes from ${url}`);
    return bytes;
  } catch (err) {
    console.error(`${TAG} fetchImageBytes — failed for ${url}:`, err);
    return null;
  }
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    i += 2 + view.getUint16(i + 2);
  }
  return null;
}

function getImageDimensions(bytes: Uint8Array): { width: number; height: number } {
  const png = parsePngDimensions(bytes);
  if (png) {
    console.log(`${TAG} getImageDimensions — PNG: ${png.width}×${png.height}`);
    return png;
  }
  const jpg = parseJpegDimensions(bytes);
  if (jpg) {
    console.log(`${TAG} getImageDimensions — JPEG: ${jpg.width}×${jpg.height}`);
    return jpg;
  }
  console.warn(`${TAG} getImageDimensions — could not parse; defaulting to 1440×900`);
  return { width: 1440, height: 900 };
}

function getFigmaPageForPageId(pageId: string): PageNode | null {
  for (const p of figma.root.children) {
    if (p.getPluginData(PAGE_ID_KEY) === pageId) return p;
  }
  return null;
}

function getOriginalViewportWidth(figmaPage: PageNode | null): number {
  if (!figmaPage) return 1440;
  const v = figmaPage.getPluginData(ORIGINAL_VIEWPORT_WIDTH_KEY);
  const n = v ? parseFloat(v) : NaN;
  return n > 0 ? n : 1440;
}

async function loadFont(): Promise<void> {
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    console.log(`${TAG} loadFont — Inter loaded`);
  } catch (err) {
    console.warn(`${TAG} loadFont — could not load Inter:`, err);
  }
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function createLabel(text: string, opts: {
  size?: number;
  color?: RGB;
  width?: number;
  bold?: boolean;
}): TextNode {
  const t = figma.createText();
  t.fontSize = opts.size ?? 12;
  t.fills = [{ type: "SOLID", color: opts.color ?? COLOR_MUTED }];
  if (opts.width) {
    t.textAutoResize = "HEIGHT";
    t.resize(opts.width, 20);
  }
  t.characters = text;
  return t;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Build one screen panel: a screenshot (or placeholder) with an optional
 * highlight rectangle for the clicked element.
 */
async function buildScreenPanel(opts: {
  pageItem: PageApiItem | null;
  stepIndex: number;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  // When set, bbox.y is viewport-relative and this is the page scroll offset.
  // The crop is positioned at scrollY instead of centering on the element.
  elementScrollY?: number;
  originalViewportWidth: number;
  label: string;
  isSource: boolean;
}): Promise<FrameNode> {
  const { pageItem, bbox, originalViewportWidth, label } = opts;
  const role = opts.isSource ? "source" : "target";
  const stepLabel = `step ${opts.stepIndex + 1} ${role}`;

  console.log(
    `${TAG} buildScreenPanel — ${stepLabel}:`,
    {
      pageId: pageItem?._id ?? "null",
      url: pageItem?.url ?? "null",
      screenshotCount: pageItem?.screenshotPaths?.length ?? 0,
      hasBbox: !!bbox,
      bbox,
      originalViewportWidth,
      label,
    }
  );

  const container = figma.createFrame();
  container.name = opts.isSource ? `Step ${opts.stepIndex + 1} Source` : `Step ${opts.stepIndex + 1} Target`;
  container.layoutMode = "VERTICAL";
  container.primaryAxisSizingMode = "AUTO";
  container.counterAxisSizingMode = "FIXED";
  container.resize(PANEL_WIDTH, 100);
  container.itemSpacing = 8;
  container.fills = [];
  container.clipsContent = false;

  // Header label
  const header = figma.createFrame();
  header.name = "header";
  header.layoutMode = "VERTICAL";
  header.primaryAxisSizingMode = "AUTO";
  header.counterAxisSizingMode = "FIXED";
  header.resize(PANEL_WIDTH, 10);
  header.itemSpacing = 2;
  header.fills = [];

  const pageName = pageItem?.title ?? (pageItem?.url ? new URL(pageItem.url).pathname || "/" : "Unknown page");
  header.appendChild(createLabel(truncate(pageName, 44), { size: 11, color: COLOR_MUTED, width: PANEL_WIDTH }));
  if (opts.isSource && label) {
    header.appendChild(createLabel(truncate(`→ ${label}`, 50), { size: 11, color: COLOR_BLUE, width: PANEL_WIDTH, bold: true }));
  }
  container.appendChild(header);

  // Screenshot frame
  const screenshotFrame = figma.createFrame();
  screenshotFrame.name = "screenshot";
  screenshotFrame.resize(PANEL_WIDTH, PANEL_HEIGHT);
  screenshotFrame.clipsContent = true;
  screenshotFrame.fills = [{ type: "SOLID", color: COLOR_BG }];
  screenshotFrame.strokes = [{ type: "SOLID", color: COLOR_BORDER }];
  screenshotFrame.strokeWeight = 1;
  screenshotFrame.cornerRadius = 8;
  screenshotFrame.setPluginData(FLOW_BOARD_STEP_KEY, String(opts.stepIndex));

  // Load screenshot image
  let imageLoaded = false;
  if (pageItem?.screenshotPaths?.length) {
    const url = pageItem.screenshotPaths[0];
    const bytes = await fetchImageBytes(url);
    if (bytes) {
      const dims = getImageDimensions(bytes);
      const imgScale = PANEL_WIDTH / dims.width;
      const imgHeight = dims.height * imgScale;

      console.log(
        `${TAG} buildScreenPanel — ${stepLabel} image:`,
        { imgScale: imgScale.toFixed(3), imgHeightPx: Math.round(imgHeight), panelHeight: PANEL_HEIGHT }
      );

      // Compute display-space element position for crop and highlight
      let cropY = 0;
      let hx = -1, hy = -1, hw = 0, hh = 0;
      if (bbox && originalViewportWidth > 0) {
        const displayScale = PANEL_WIDTH / originalViewportWidth;
        hx = bbox.x * displayScale;
        hw = Math.max(bbox.width * displayScale, 4);
        hh = Math.max(bbox.height * displayScale, 4);

        if (opts.elementScrollY !== undefined) {
          // Extension-recorded flow: bbox.y is viewport-relative, scrollY is the page offset.
          // Crop at the exact scroll position so the panel shows what the user saw.
          // highlight.y = hy - cropY = (docY * scale) - (scrollY * scale) = viewportY * scale
          // which correctly places the highlight at its viewport position inside the 480px panel.
          const docY = (bbox.y + opts.elementScrollY) * displayScale;
          hy = docY;
          cropY = Math.max(0, Math.min(opts.elementScrollY * displayScale, imgHeight - PANEL_HEIGHT));
        } else {
          // Manually built flow: bbox.y is already a document coordinate.
          // Center the element vertically in the panel.
          hy = bbox.y * displayScale;
          const elementCentre = hy + hh / 2;
          cropY = Math.max(0, Math.min(elementCentre - PANEL_HEIGHT * 0.4, imgHeight - PANEL_HEIGHT));
        }

        console.log(
          `${TAG} buildScreenPanel — ${stepLabel} crop:`,
          {
            displayScale: displayScale.toFixed(3),
            mode: opts.elementScrollY !== undefined ? "scroll-exact" : "center",
            highlight: { hx: Math.round(hx), hy: Math.round(hy), hw: Math.round(hw), hh: Math.round(hh) },
            cropY: Math.round(cropY),
            highlightInFrame: { x: Math.round(hx), y: Math.round(hy - cropY) },
          }
        );
      } else {
        console.log(`${TAG} buildScreenPanel — ${stepLabel} no bbox; showing from top (cropY=0)`);
      }

      const img = figma.createImage(bytes);
      const imgRect = figma.createRectangle();
      imgRect.name = "image";
      imgRect.resize(PANEL_WIDTH, Math.max(PANEL_HEIGHT, imgHeight));
      imgRect.y = -cropY;
      imgRect.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: img.hash }];
      screenshotFrame.appendChild(imgRect);

      if (hx >= 0 && hy >= 0) {
        const highlight = figma.createRectangle();
        highlight.name = "highlight";
        highlight.resize(hw, hh);
        highlight.x = hx;
        highlight.y = hy - cropY;
        highlight.fills = [{ type: "SOLID", color: COLOR_BLUE, opacity: 0.25 }];
        highlight.strokes = [{ type: "SOLID", color: COLOR_BLUE }];
        highlight.strokeWeight = 2;
        highlight.cornerRadius = 2;
        screenshotFrame.appendChild(highlight);
        console.log(`${TAG} buildScreenPanel — ${stepLabel} highlight placed at frame (${Math.round(hx)}, ${Math.round(hy - cropY)})`);
      } else {
        console.log(`${TAG} buildScreenPanel — ${stepLabel} no highlight (no valid bbox)`);
      }

      imageLoaded = true;
    } else {
      console.warn(`${TAG} buildScreenPanel — ${stepLabel} image fetch failed for ${url}`);
    }
  } else {
    console.warn(`${TAG} buildScreenPanel — ${stepLabel} no screenshot paths available`);
  }

  if (!imageLoaded) {
    console.warn(`${TAG} buildScreenPanel — ${stepLabel} using placeholder (no image)`);
    const placeholder = figma.createText();
    placeholder.fontSize = 12;
    placeholder.fills = [{ type: "SOLID", color: COLOR_MUTED }];
    placeholder.x = 16;
    placeholder.y = PANEL_HEIGHT / 2 - 8;
    placeholder.characters = "Screenshot unavailable";
    screenshotFrame.appendChild(placeholder);
  }

  container.appendChild(screenshotFrame);
  return container;
}

function buildArrow(label: string, stepIndex: number): FrameNode {
  const container = figma.createFrame();
  container.name = `Arrow ${stepIndex + 1}`;
  container.layoutMode = "VERTICAL";
  container.primaryAxisSizingMode = "AUTO";
  container.counterAxisSizingMode = "FIXED";
  container.resize(ARROW_WIDTH, 10);
  container.itemSpacing = 6;
  container.primaryAxisAlignItems = "CENTER";
  container.counterAxisAlignItems = "CENTER";
  container.fills = [];

  const arrowText = figma.createText();
  arrowText.fontSize = 20;
  arrowText.fills = [{ type: "SOLID", color: COLOR_ARROW }];
  arrowText.characters = "→";
  container.appendChild(arrowText);

  if (label) {
    const lbl = createLabel(truncate(label, 14), { size: 10, color: COLOR_MUTED, width: ARROW_WIDTH });
    lbl.textAlignHorizontal = "CENTER";
    container.appendChild(lbl);
  }

  return container;
}

/**
 * Find or create the Flow Board Figma page.
 * Returns the page node (cleared of prior board contents).
 */
async function getOrCreateFlowPage(flowName: string, flowBoardId: string): Promise<PageNode> {
  const pageName = `Flow - ${flowName}`;

  for (const p of figma.root.children) {
    if (p.name === pageName) {
      console.log(`${TAG} getOrCreateFlowPage — found existing page "${pageName}", clearing ${p.children.length} children`);
      await p.loadAsync();
      for (const child of [...p.children]) {
        child.remove();
      }
      return p;
    }
  }

  console.log(`${TAG} getOrCreateFlowPage — creating new page "${pageName}"`);
  const page = figma.createPage();
  page.name = pageName;
  page.setPluginData(FLOW_BOARD_KEY, flowBoardId);
  return page;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface RenderFlowBoardOptions {
  flowName: string;
  flowId: string;
  projectId: string;
  steps: FlowDraftStep[];
}

export async function renderFlowBoard(opts: RenderFlowBoardOptions): Promise<void> {
  const { flowName, flowId, projectId, steps } = opts;

  console.log(`${TAG} renderFlowBoard — START`, {
    flowName,
    flowId,
    projectId,
    stepCount: steps.length,
    steps: steps.map((s, i) => ({
      i,
      sourcePageId: s.sourcePageId,
      sourceUrl: s.sourceUrl,
      actionLabel: s.actionLabel,
      targetUrl: s.targetUrl,
      targetPageId: s.targetPageId ?? "null",
      targetStatus: s.targetStatus,
      hasBbox: !!s.elementBbox,
    })),
  });

  if (steps.length === 0) {
    console.warn(`${TAG} renderFlowBoard — aborted: no steps`);
    figma.notify("No steps to render.", { error: true });
    return;
  }

  await loadFont();

  // Collect all unique page IDs we need data for
  const pageIds: string[] = [];
  for (const step of steps) {
    if (step.sourcePageId) pageIds.push(step.sourcePageId);
    if (step.targetPageId) pageIds.push(step.targetPageId);
  }
  const uniquePageIds = [...new Set(pageIds)];
  console.log(`${TAG} renderFlowBoard — unique page IDs needed: ${uniquePageIds.length}`, uniquePageIds);

  const pageDataMap = await fetchPagesData(projectId, uniquePageIds);

  // Resolve Figma page nodes for viewport-width lookups
  for (const id of uniquePageIds) {
    const figmaPage = getFigmaPageForPageId(id);
    const vw = getOriginalViewportWidth(figmaPage);
    console.log(`${TAG} renderFlowBoard — Figma page for ${id}: ${figmaPage ? `"${figmaPage.name}" vw=${vw}` : "not found (defaulting to 1440)"}`);
  }

  // Create / clear the board page
  const boardPage = await getOrCreateFlowPage(flowName, flowId);
  console.log(`${TAG} renderFlowBoard — board page ready: "${boardPage.name}" (id=${boardPage.id})`);
  await figma.setCurrentPageAsync(boardPage);

  // Board title
  const titleText = figma.createText();
  titleText.fontSize = 20;
  titleText.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.12, b: 0.18 } }];
  titleText.x = BOARD_PADDING;
  titleText.y = BOARD_PADDING;
  titleText.characters = flowName || "Untitled Flow";
  boardPage.appendChild(titleText);

  const stepCountText = figma.createText();
  stepCountText.fontSize = 12;
  stepCountText.fills = [{ type: "SOLID", color: COLOR_MUTED }];
  stepCountText.x = BOARD_PADDING;
  stepCountText.y = BOARD_PADDING + 28;
  stepCountText.characters = `${steps.length} step${steps.length !== 1 ? "s" : ""}`;
  boardPage.appendChild(stepCountText);

  // Render steps horizontally
  let cursorX = BOARD_PADDING;
  const cursorY = BOARD_PADDING + STEP_V_OFFSET;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`${TAG} renderFlowBoard — rendering step ${i + 1}/${steps.length}: "${step.actionLabel}"`);

    const sourcePage = pageDataMap.get(step.sourcePageId) ?? null;
    const figmaSourcePage = getFigmaPageForPageId(step.sourcePageId);
    const originalViewportWidth = getOriginalViewportWidth(figmaSourcePage);

    if (!sourcePage) {
      console.warn(`${TAG} renderFlowBoard — step ${i + 1}: no API data for source page ${step.sourcePageId} — will show placeholder`);
    }

    // Source screen panel
    const sourcePanel = await buildScreenPanel({
      pageItem: sourcePage,
      stepIndex: i,
      bbox: step.elementBbox,
      elementScrollY: step.elementScrollY,
      originalViewportWidth,
      label: step.actionLabel,
      isSource: true,
    });
    sourcePanel.x = cursorX;
    sourcePanel.y = cursorY;
    sourcePanel.setPluginData(FLOW_BOARD_KEY, flowId);
    sourcePanel.setPluginData(FLOW_BOARD_STEP_KEY, String(i));
    boardPage.appendChild(sourcePanel);
    console.log(`${TAG} renderFlowBoard — step ${i + 1} source panel placed at (${cursorX}, ${cursorY})`);

    cursorX += PANEL_WIDTH + STEP_GAP;

    // Arrow
    const arrow = buildArrow(step.actionLabel, i);
    arrow.x = cursorX;
    arrow.y = cursorY + 36 + PANEL_HEIGHT / 2 - 16;
    arrow.setPluginData(FLOW_BOARD_KEY, flowId);
    boardPage.appendChild(arrow);
    console.log(`${TAG} renderFlowBoard — step ${i + 1} arrow placed at (${cursorX}, ${arrow.y})`);

    cursorX += ARROW_WIDTH + STEP_GAP;

    // On the last step, also render the target panel
    if (i === steps.length - 1) {
      if (step.targetPageId) {
        const targetPage = pageDataMap.get(step.targetPageId) ?? null;
        const figmaTargetPage = getFigmaPageForPageId(step.targetPageId);
        const targetViewportWidth = getOriginalViewportWidth(figmaTargetPage);

        if (!targetPage) {
          console.warn(`${TAG} renderFlowBoard — last step: no API data for target page ${step.targetPageId}`);
        }

        const targetPanel = await buildScreenPanel({
          pageItem: targetPage,
          stepIndex: i,
          bbox: null,
          originalViewportWidth: targetViewportWidth,
          label: "",
          isSource: false,
        });
        targetPanel.x = cursorX;
        targetPanel.y = cursorY;
        targetPanel.setPluginData(FLOW_BOARD_KEY, flowId);
        targetPanel.setPluginData(FLOW_BOARD_STEP_KEY, `${i}-target`);
        boardPage.appendChild(targetPanel);
        console.log(`${TAG} renderFlowBoard — last step target panel placed at (${cursorX}, ${cursorY})`);
        cursorX += PANEL_WIDTH + STEP_GAP;
      } else {
        console.log(`${TAG} renderFlowBoard — last step has no targetPageId; skipping target panel`);
      }
    }
  }

  console.log(`${TAG} renderFlowBoard — layout complete. Total width used: ~${cursorX}px, children on page: ${boardPage.children.length}`);

  // Zoom to fit
  try {
    figma.viewport.scrollAndZoomIntoView(boardPage.children);
    console.log(`${TAG} renderFlowBoard — viewport zoomed to fit`);
  } catch (err) {
    console.warn(`${TAG} renderFlowBoard — viewport zoom unavailable:`, err);
  }

  console.log(`${TAG} renderFlowBoard — DONE`);
}
