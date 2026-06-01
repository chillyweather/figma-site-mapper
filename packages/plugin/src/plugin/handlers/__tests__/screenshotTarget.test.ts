import { describe, it, expect } from "vitest";
import {
  writeScreenshotTargetMetadata,
  getScreenshotTargetScale,
  getActiveScreenshotTarget,
  findScreenshotTargetByPageId,
} from "../screenshotTarget.js";

// ── Fake node helpers ────────────────────────────────────────────────────────

function makeFakeNode(initialData: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initialData };
  return {
    type: "PAGE" as const,
    getPluginData: (key: string) => data[key] ?? "",
    setPluginData: (key: string, value: string) => { data[key] = value; },
    children: [] as unknown[],
    selection: [] as unknown[],
  };
}

function makeFakeFrame(initialData: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initialData };
  return {
    type: "FRAME" as const,
    getPluginData: (key: string) => data[key] ?? "",
    setPluginData: (key: string, value: string) => { data[key] = value; },
  };
}

function makeFakeCanvasPage(children: ReturnType<typeof makeFakeFrame>[]) {
  const data: Record<string, string> = { SITEMAP_ROLE: "canvas" };
  return {
    type: "PAGE" as const,
    getPluginData: (key: string) => data[key] ?? "",
    setPluginData: (key: string, value: string) => { data[key] = value; },
    children: children as unknown[],
    selection: [] as unknown[],
  };
}

// ── writeScreenshotTargetMetadata ────────────────────────────────────────────

describe("writeScreenshotTargetMetadata", () => {
  it("writes all five plugin-data keys to the node", () => {
    const node = makeFakeNode();
    writeScreenshotTargetMetadata(node, {
      pageId: "42",
      projectId: "7",
      url: "https://example.com/about",
      screenshotWidth: 2880,
      originalViewportWidth: 1440,
    });
    expect(node.getPluginData("PAGE_ID")).toBe("42");
    expect(node.getPluginData("PROJECT_ID")).toBe("7");
    expect(node.getPluginData("URL")).toBe("https://example.com/about");
    expect(node.getPluginData("SCREENSHOT_WIDTH")).toBe("2880");
    expect(node.getPluginData("ORIGINAL_VIEWPORT_WIDTH")).toBe("1440");
  });

  it("stores numeric widths as strings", () => {
    const node = makeFakeNode();
    writeScreenshotTargetMetadata(node, {
      pageId: "1",
      projectId: "1",
      url: "https://x.com",
      screenshotWidth: 1920,
      originalViewportWidth: 1280,
    });
    expect(typeof node.getPluginData("SCREENSHOT_WIDTH")).toBe("string");
    expect(typeof node.getPluginData("ORIGINAL_VIEWPORT_WIDTH")).toBe("string");
  });
});

// ── getScreenshotTargetScale ─────────────────────────────────────────────────

describe("getScreenshotTargetScale", () => {
  it("returns screenshotWidth / originalViewportWidth when both are valid", () => {
    const node = makeFakeNode({
      SCREENSHOT_WIDTH: "2880",
      ORIGINAL_VIEWPORT_WIDTH: "1440",
    });
    expect(getScreenshotTargetScale(node)).toBe(2);
  });

  it("returns 1 when originalViewportWidth is 0", () => {
    const node = makeFakeNode({
      SCREENSHOT_WIDTH: "1440",
      ORIGINAL_VIEWPORT_WIDTH: "0",
    });
    expect(getScreenshotTargetScale(node)).toBe(1);
  });

  it("returns 1 when SCREENSHOT_WIDTH is missing", () => {
    const node = makeFakeNode({ ORIGINAL_VIEWPORT_WIDTH: "1440" });
    expect(getScreenshotTargetScale(node)).toBe(1);
  });

  it("returns 1 when ORIGINAL_VIEWPORT_WIDTH is missing", () => {
    const node = makeFakeNode({ SCREENSHOT_WIDTH: "2880" });
    expect(getScreenshotTargetScale(node)).toBe(1);
  });

  it("returns 1 when keys contain non-numeric values", () => {
    const node = makeFakeNode({
      SCREENSHOT_WIDTH: "auto",
      ORIGINAL_VIEWPORT_WIDTH: "auto",
    });
    expect(getScreenshotTargetScale(node)).toBe(1);
  });

  it("returns 1 when both keys are empty strings", () => {
    const node = makeFakeNode();
    expect(getScreenshotTargetScale(node)).toBe(1);
  });
});

// ── getActiveScreenshotTarget ────────────────────────────────────────────────

describe("getActiveScreenshotTarget", () => {
  it("returns the current page in per-page mode (page carries PAGE_ID)", () => {
    const page = makeFakeNode({ PAGE_ID: "99" });
    const result = getActiveScreenshotTarget({ currentPage: page as any });
    expect(result).toBe(page);
  });

  it("returns null when current page has no PAGE_ID and no SITEMAP_ROLE", () => {
    const page = makeFakeNode();
    const result = getActiveScreenshotTarget({ currentPage: page as any });
    expect(result).toBeNull();
  });

  it("returns the selected frame in single-canvas mode", () => {
    const frame = makeFakeFrame({ PAGE_ID: "5" });
    const canvasPage = makeFakeCanvasPage([]);
    // Override selection to include the frame
    (canvasPage as any).selection = [frame];
    const result = getActiveScreenshotTarget({ currentPage: canvasPage as any });
    expect(result).toBe(frame);
  });

  it("falls back to first matching child frame in single-canvas mode when nothing is selected", () => {
    const frameA = makeFakeFrame({ PAGE_ID: "10" });
    const frameB = makeFakeFrame({ PAGE_ID: "20" });
    const canvasPage = makeFakeCanvasPage([frameA, frameB]);
    const result = getActiveScreenshotTarget({ currentPage: canvasPage as any });
    expect(result).toBe(frameA);
  });

  it("returns null in single-canvas mode when no child frame carries PAGE_ID", () => {
    const emptyFrame = makeFakeFrame();
    const canvasPage = makeFakeCanvasPage([emptyFrame]);
    const result = getActiveScreenshotTarget({ currentPage: canvasPage as any });
    expect(result).toBeNull();
  });
});

// ── findScreenshotTargetByPageId ─────────────────────────────────────────────

describe("findScreenshotTargetByPageId", () => {
  it("finds a per-page PageNode by PAGE_ID", () => {
    const page = makeFakeNode({ PAGE_ID: "42" });
    const result = findScreenshotTargetByPageId("42", { pages: [page] as any });
    expect(result).toBe(page);
  });

  it("returns null when no page matches the requested PAGE_ID", () => {
    const page = makeFakeNode({ PAGE_ID: "1" });
    const result = findScreenshotTargetByPageId("999", { pages: [page] as any });
    expect(result).toBeNull();
  });

  it("finds a FrameNode inside a single-canvas page", () => {
    const frame = makeFakeFrame({ PAGE_ID: "77" });
    const canvasPage = makeFakeCanvasPage([frame]);
    const result = findScreenshotTargetByPageId("77", { pages: [canvasPage] as any });
    expect(result).toBe(frame);
  });

  it("prefers per-page match over single-canvas frame when both exist", () => {
    const perPage = makeFakeNode({ PAGE_ID: "5" });
    const frame = makeFakeFrame({ PAGE_ID: "5" });
    const canvasPage = makeFakeCanvasPage([frame]);
    const result = findScreenshotTargetByPageId("5", { pages: [perPage, canvasPage] as any });
    expect(result).toBe(perPage);
  });

  it("returns null for empty pages list", () => {
    const result = findScreenshotTargetByPageId("1", { pages: [] });
    expect(result).toBeNull();
  });
});
