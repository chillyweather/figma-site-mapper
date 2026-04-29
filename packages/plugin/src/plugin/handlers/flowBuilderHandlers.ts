/**
 * Flow Builder handlers for the Figma sandbox.
 *
 * Handles: active page detection, element preview highlights,
 * page switching for "Continue from Target", preview cleanup,
 * and flow board rendering.
 */

import { renderFlowBoard } from "../../figmaRendering/renderFlowBoard";
import type { FlowDraftStep } from "../../types";

const PAGE_ID_KEY = "PAGE_ID";
const PROJECT_ID_KEY = "PROJECT_ID";
const URL_KEY = "URL";
const SCREENSHOT_WIDTH_KEY = "SCREENSHOT_WIDTH";
const ORIGINAL_VIEWPORT_WIDTH_KEY = "ORIGINAL_VIEWPORT_WIDTH";
const OVERLAY_CHILD_NAME = "Page Overlay";
const FLOW_PREVIEW_KEY = "FLOW_PREVIEW";

const TAG = "[Flow Handler]";

function getPluginData(
  node: SceneNode | PageNode,
  key: string
): string | undefined {
  const value = node.getPluginData(key);
  return value ? String(value) : undefined;
}

/**
 * Find the current screenshot page by checking plugin data on each page.
 */
export async function handleGetActiveScreenshotPage(): Promise<void> {
  const pages = figma.root.children;
  const currentPage = figma.currentPage;

  console.log(`${TAG} getActiveScreenshotPage — current page: "${currentPage.name}" (id=${currentPage.id})`);

  const pageId = getPluginData(currentPage, PAGE_ID_KEY);
  const pageUrl = getPluginData(currentPage, URL_KEY);
  const projectId = getPluginData(currentPage, PROJECT_ID_KEY);

  if (pageId && pageUrl && projectId) {
    console.log(`${TAG} getActiveScreenshotPage — current page IS a screenshot page:`, { pageId, pageUrl, projectId });
    figma.ui.postMessage({
      type: "active-screenshot-page",
      payload: {
        pageId,
        pageUrl,
        pageName: currentPage.name,
        projectId,
      },
    });
    return;
  }

  console.log(`${TAG} getActiveScreenshotPage — current page has no screenshot plugin data (PAGE_ID=${pageId ?? "none"}, URL=${pageUrl ?? "none"}, PROJECT_ID=${projectId ?? "none"})`);

  // Check other pages (best-effort)
  for (const page of pages) {
    if (page.id === currentPage.id) continue;
    const pid = getPluginData(page, PAGE_ID_KEY);
    const purl = getPluginData(page, URL_KEY);
    const projId = getPluginData(page, PROJECT_ID_KEY);
    if (pid && purl && projId) {
      // This page is a screenshot page but it is not the current page —
      // logged here for diagnostics only, not selected.
      console.log(`${TAG} getActiveScreenshotPage — other screenshot page found: "${page.name}" (${pid} / ${purl})`);
    }
  }

  console.log(`${TAG} getActiveScreenshotPage — no screenshot page detected; posting null`);
  figma.ui.postMessage({
    type: "active-screenshot-page",
    payload: null,
  });
}

/**
 * Find or create the overlay container on a page.
 */
function findOrCreateOverlay(page: PageNode): FrameNode | null {
  let overlay = page.findOne((n) => n.name === OVERLAY_CHILD_NAME) as FrameNode | null;
  if (!overlay) {
    console.log(`${TAG} findOrCreateOverlay — creating new overlay on "${page.name}"`);
    overlay = figma.createFrame();
    overlay.name = OVERLAY_CHILD_NAME;
    overlay.resize(100, 100);
    overlay.clipsContent = false;
    overlay.fills = [];
    page.appendChild(overlay);
  } else {
    console.log(`${TAG} findOrCreateOverlay — reusing existing overlay on "${page.name}"`);
  }
  return overlay;
}

/**
 * Get the scale factor for mapping element coordinates to canvas coordinates.
 */
function getScaleFactor(page: PageNode): number {
  const screenshotWidth = getPluginData(page, SCREENSHOT_WIDTH_KEY);
  const viewportWidth = getPluginData(page, ORIGINAL_VIEWPORT_WIDTH_KEY);
  if (screenshotWidth && viewportWidth) {
    const sw = parseFloat(screenshotWidth);
    const vw = parseFloat(viewportWidth);
    if (sw > 0 && vw > 0) {
      const scale = sw / vw;
      console.log(`${TAG} getScaleFactor — page "${page.name}": SCREENSHOT_WIDTH=${sw} ORIGINAL_VIEWPORT_WIDTH=${vw} → scale=${scale.toFixed(4)}`);
      return scale;
    }
  }
  console.warn(`${TAG} getScaleFactor — page "${page.name}" missing dimension plugin data (SCREENSHOT_WIDTH=${screenshotWidth ?? "none"}, ORIGINAL_VIEWPORT_WIDTH=${viewportWidth ?? "none"}); defaulting to 1`);
  return 1;
}

/**
 * Clear any existing flow preview from a page.
 */
function clearPreviewFromPage(page: PageNode): void {
  const overlay = page.findOne((n) => n.name === OVERLAY_CHILD_NAME) as FrameNode | null;
  if (!overlay) {
    console.log(`${TAG} clearPreviewFromPage — no overlay on "${page.name}"; nothing to clear`);
    return;
  }
  const previewNodes = overlay.findAll((n) => n.getPluginData(FLOW_PREVIEW_KEY) === "true");
  console.log(`${TAG} clearPreviewFromPage — removing ${previewNodes.length} preview node(s) from "${page.name}"`);
  for (const node of previewNodes) {
    node.remove();
  }
}

/**
 * Draw a temporary preview highlight for a selected element.
 */
export async function handlePreviewFlowElement(msg: {
  elementId: string;
  pageId?: string;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  selector?: string | null;
  label?: string | null;
  targetUrl?: string | null;
}): Promise<void> {
  const currentPage = figma.currentPage;

  console.log(`${TAG} previewFlowElement — element: ${msg.elementId}`, {
    pageId: msg.pageId,
    selector: msg.selector,
    label: msg.label,
    targetUrl: msg.targetUrl,
    bbox: msg.bbox,
    currentPage: currentPage.name,
  });

  clearPreviewFromPage(currentPage);

  if (!msg.bbox) {
    console.warn(`${TAG} previewFlowElement — no bbox for element ${msg.elementId}; cannot draw highlight`);
    figma.notify("No bounding box data for this element.", { error: true });
    return;
  }

  const overlay = findOrCreateOverlay(currentPage);
  if (!overlay) return;

  const scale = getScaleFactor(currentPage);

  // Find the top-level screenshot frame(s) to determine vertical offset
  const frames = currentPage.findAll((n) => n.type === "FRAME" && n.parent === currentPage);
  let offsetY = 0;
  if (frames.length > 0) {
    offsetY = frames[0].y;
    console.log(`${TAG} previewFlowElement — first top-level frame y=${offsetY} (${frames.length} frames total)`);
  } else {
    console.warn(`${TAG} previewFlowElement — no top-level frames found; offsetY=0`);
  }

  const x = msg.bbox.x * scale;
  const y = msg.bbox.y * scale + offsetY;
  const w = msg.bbox.width * scale;
  const h = msg.bbox.height * scale;

  console.log(`${TAG} previewFlowElement — highlight on canvas:`, {
    bboxOriginal: msg.bbox,
    scale,
    offsetY,
    canvasPos: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) },
  });

  const highlight = figma.createRectangle();
  highlight.name = "Flow Preview Highlight";
  highlight.resize(Math.max(w, 4), Math.max(h, 4));
  highlight.x = x;
  highlight.y = y;
  highlight.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.5, b: 1 }, opacity: 0.25 }];
  highlight.strokes = [{ type: "SOLID", color: { r: 0.1, g: 0.5, b: 1 } }];
  highlight.strokeWeight = 2;
  highlight.setPluginData(FLOW_PREVIEW_KEY, "true");
  overlay.appendChild(highlight);

  const labelText = msg.label || msg.selector || "Element";
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  } catch {
    // font may not be available
  }
  const text = figma.createText();
  text.name = "Flow Preview Label";
  text.characters = labelText.length > 60 ? labelText.slice(0, 57) + "..." : labelText;
  text.fontSize = 10;
  text.x = x;
  text.y = y + h + 4;
  text.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.5, b: 1 } }];
  text.setPluginData(FLOW_PREVIEW_KEY, "true");
  overlay.appendChild(text);

  if (msg.targetUrl) {
    try {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    } catch {}
    const urlText = figma.createText();
    urlText.name = "Flow Preview URL";
    const shortUrl = msg.targetUrl.length > 80 ? msg.targetUrl.slice(0, 77) + "..." : msg.targetUrl;
    urlText.characters = shortUrl;
    urlText.fontSize = 9;
    urlText.x = x;
    urlText.y = y + h + 18;
    urlText.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
    urlText.setPluginData(FLOW_PREVIEW_KEY, "true");
    overlay.appendChild(urlText);
  }

  console.log(`${TAG} previewFlowElement — highlight drawn; posting flow-preview-shown`);
  figma.ui.postMessage({ type: "flow-preview-shown", elementId: msg.elementId });
}

/**
 * Clear the flow preview from the current page.
 */
export async function handleClearFlowPreview(): Promise<void> {
  console.log(`${TAG} clearFlowPreview — clearing from "${figma.currentPage.name}"`);
  clearPreviewFromPage(figma.currentPage);
  figma.ui.postMessage({ type: "flow-preview-cleared" });
}

/**
 * Switch to a target Figma page for "Continue from Target".
 */
export async function handleContinueFromTarget(msg: {
  targetPageId: string;
  targetUrl?: string | null;
}): Promise<void> {
  console.log(`${TAG} continueFromTarget — looking for pageId="${msg.targetPageId}" url="${msg.targetUrl ?? "none"}"`);

  const pages = figma.root.children;
  for (const page of pages) {
    const pid = getPluginData(page, PAGE_ID_KEY);
    if (pid === msg.targetPageId) {
      console.log(`${TAG} continueFromTarget — found page by ID: "${page.name}"`);
      await figma.setCurrentPageAsync(page);
      await handleGetActiveScreenshotPage();
      figma.ui.postMessage({ type: "flow-switch-page-result", success: true });
      return;
    }
  }

  console.log(`${TAG} continueFromTarget — page not found by ID; trying URL fallback`);

  if (msg.targetUrl) {
    for (const page of pages) {
      const url = getPluginData(page, URL_KEY);
      if (url === msg.targetUrl) {
        console.log(`${TAG} continueFromTarget — found page by URL: "${page.name}"`);
        await figma.setCurrentPageAsync(page);
        await handleGetActiveScreenshotPage();
        figma.ui.postMessage({ type: "flow-switch-page-result", success: true });
        return;
      }
    }
    console.warn(`${TAG} continueFromTarget — URL fallback also failed for "${msg.targetUrl}"`);
  }

  console.warn(`${TAG} continueFromTarget — target page not found on canvas (id=${msg.targetPageId})`);
  figma.notify("Target page not found in the canvas. Capture or render it first.", { error: true });
  figma.ui.postMessage({ type: "flow-switch-page-result", success: false });
}

/**
 * Render a flow as a horizontal storyboard on its own Figma page.
 */
export async function handleRenderFlowBoard(msg: {
  flowName: string;
  flowId: string;
  projectId: string;
  steps: FlowDraftStep[];
}): Promise<void> {
  console.log(`${TAG} renderFlowBoard — received request:`, {
    flowName: msg.flowName,
    flowId: msg.flowId,
    projectId: msg.projectId,
    stepCount: msg.steps.length,
  });

  try {
    figma.ui.postMessage({ type: "flow-board-render-started" });
    await renderFlowBoard({
      flowName: msg.flowName || "Untitled Flow",
      flowId: msg.flowId,
      projectId: msg.projectId,
      steps: msg.steps,
    });
    console.log(`${TAG} renderFlowBoard — completed successfully`);
    figma.ui.postMessage({ type: "flow-board-render-complete", success: true });
    figma.notify(`Flow board "${msg.flowName || "Untitled Flow"}" rendered.`);
  } catch (err) {
    console.error(`${TAG} renderFlowBoard — FAILED:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    figma.ui.postMessage({ type: "flow-board-render-complete", success: false, error: message });
    figma.notify("Failed to render flow board.", { error: true });
  }
}
