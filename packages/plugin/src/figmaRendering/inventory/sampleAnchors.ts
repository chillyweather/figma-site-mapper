import { ANCHOR_CONTAINER_NAME } from "./shared";

export function findRenderedPageByPageId(pageId: string | null | undefined): PageNode | null {
  if (!pageId) return null;
  for (const page of figma.root.children) {
    if (page.type === "PAGE" && page.getPluginData("PAGE_ID") === pageId) {
      return page;
    }
  }
  return null;
}

export function getOrCreateAnchorContainer(page: PageNode): FrameNode {
  const existing = page.findOne(
    (node) => node.type === "FRAME" && node.name === ANCHOR_CONTAINER_NAME
  ) as FrameNode | null;
  if (existing) return existing;

  const frame = figma.createFrame();
  frame.name = ANCHOR_CONTAINER_NAME;
  frame.layoutMode = "NONE";
  frame.fills = [];
  frame.strokes = [];
  frame.clipsContent = false;
  frame.locked = false;
  frame.resize(1, 1);
  page.appendChild(frame);
  return frame;
}

export type SampleAnchorKind = "component" | "token";

export function findOrCreateSampleAnchor(
  ownerId: string,
  pageId: string,
  elementId: string,
  bbox: [number, number, number, number],
  kind: SampleAnchorKind = "component"
): FrameNode | null {
  const targetPage = findRenderedPageByPageId(pageId);
  if (!targetPage) return null;

  const [x, y, width, height] = bbox;
  if (![x, y, width, height].every((value) => Number.isFinite(value))) return null;

  const storedScreenshotWidth = Number(targetPage.getPluginData("SCREENSHOT_WIDTH"));
  const storedOriginalWidth = Number(targetPage.getPluginData("ORIGINAL_VIEWPORT_WIDTH"));
  const scale =
    Number.isFinite(storedScreenshotWidth) &&
    Number.isFinite(storedOriginalWidth) &&
    storedOriginalWidth > 0
      ? storedScreenshotWidth / storedOriginalWidth
      : 1;

  const container = getOrCreateAnchorContainer(targetPage);
  const anchorName = `DS Anchor / ${kind} / ${ownerId} / ${elementId}`;
  let anchor = container.children.find(
    (child): child is FrameNode =>
      child.type === "FRAME" && child.getPluginData("DS_INVENTORY_ANCHOR") === anchorName
  );

  if (!anchor) {
    anchor = figma.createFrame();
    anchor.name = anchorName;
    anchor.setPluginData("DS_INVENTORY_ANCHOR", anchorName);
    container.appendChild(anchor);
  }

  anchor.fills = [];
  anchor.strokes = [];
  anchor.cornerRadius = 0;
  anchor.x = x * scale;
  anchor.y = y * scale;
  anchor.resize(Math.max(16, width * scale), Math.max(16, height * scale));
  anchor.locked = false;
  return anchor;
}
