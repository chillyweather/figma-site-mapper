import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import sharp from "sharp";
import { startFixtureServer, type FixtureServer } from "./__fixtures__/server.js";
import { captureTiled } from "./tiledCapture.js";
import { scoreSuspiciousRegions } from "./blankRegionDetector.js";

describe("TiledCapture", () => {
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    server = await startFixtureServer();
    browser = await chromium.launch();
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("produces a full-page buffer taller than one viewport", async () => {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 500 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}/tiled-lazy-below-fold.html`, { waitUntil: "commit" });

    const result = await captureTiled(page, {
      readiness: { visualStabilityQuietWindowMs: 600 },
      lazy: { quietWindowMs: 50, maxSteps: 5, overallTimeoutMs: 5_000 },
      tileStabilityMs: 200,
    });

    // Buffer is a real PNG.
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe("png");

    // Full-page height should exceed one viewport (three 500px sections + footer).
    expect(result.height).toBeGreaterThan(500);
    expect(result.width).toBe(1200);

    // tileCount reflects the plan (at least 2 for a page taller than viewport).
    expect(result.tileCount).toBeGreaterThanOrEqual(2);

    // Final stitched image should not be mostly blank.
    const score = await scoreSuspiciousRegions(result.buffer);
    expect(score).toBeLessThan(0.5);

    await context.close();
  }, 45_000);

  it("captures below-fold lazy content after scroll trigger", async () => {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 500 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}/tiled-lazy-below-fold.html`, { waitUntil: "commit" });

    await captureTiled(page, {
      readiness: { visualStabilityQuietWindowMs: 600 },
      lazy: { quietWindowMs: 50, maxSteps: 5, overallTimeoutMs: 5_000 },
      tileStabilityMs: 300,
    });

    // After tiled capture, below-fold sections should have been intersected.
    const midLoaded = await page.evaluate(
      () => document.getElementById("mid-section")?.getAttribute("data-loaded") === "true"
    );
    const belowLoaded = await page.evaluate(
      () => document.getElementById("below-section")?.getAttribute("data-loaded") === "true"
    );
    expect(midLoaded).toBe(true);
    expect(belowLoaded).toBe(true);

    await context.close();
  }, 45_000);

  it("keeps the primary sticky header in the first tile without repeating it", async () => {
    const context = await browser.newContext({
      viewport: { width: 800, height: 400 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}/sticky-hero.html`, { waitUntil: "commit" });
    await page.evaluate(() => {
      const action = document.createElement("button");
      action.setAttribute("aria-label", "Header action");
      Object.assign(action.style, {
        position: "fixed",
        top: "12px",
        right: "20px",
        width: "80px",
        height: "36px",
        background: "rgb(255, 0, 0)",
        border: "0",
        zIndex: "20",
      });
      document.body.appendChild(action);
    });

    const result = await captureTiled(page, {
      detectMedia: false,
      readiness: { overallTimeoutMs: 5_000, visualStabilityQuietWindowMs: 200 },
      lazy: { quietWindowMs: 50, maxSteps: 5, overallTimeoutMs: 2_000 },
      tileStabilityMs: 100,
    });

    const topHeaderPixel = await readPixel(result.buffer, 500, 30);
    const secondTileHeaderPixel = await readPixel(result.buffer, 500, 430);
    const topActionPixel = await readPixel(result.buffer, 740, 30);
    const secondTileActionPixel = await readPixel(result.buffer, 740, 430);

    expect(result.tileCount).toBeGreaterThan(1);
    expect(topHeaderPixel).toEqual({ r: 0, g: 0, b: 128, a: 255 });
    expect(secondTileHeaderPixel).not.toEqual({ r: 0, g: 0, b: 128, a: 255 });
    expect(topActionPixel).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(secondTileActionPixel).not.toEqual({ r: 255, g: 0, b: 0, a: 255 });

    await context.close();
  }, 45_000);

  it("returns tileCount=1 for a page that fits in one viewport", async () => {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 4000 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    // Use smoke.html which is a small page.
    await page.goto(`${server.baseUrl}/smoke.html`, { waitUntil: "commit" });

    const result = await captureTiled(page, {
      tileStabilityMs: 100,
    });

    expect(result.tileCount).toBe(1);
    expect(Buffer.isBuffer(result.buffer)).toBe(true);

    await context.close();
  }, 30_000);

  it("result matches CaptureResult shape", async () => {
    const context = await browser.newContext({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}/smoke.html`, { waitUntil: "commit" });

    const result = await captureTiled(page, { tileStabilityMs: 100 });

    expect(typeof result.width).toBe("number");
    expect(typeof result.height).toBe("number");
    expect(typeof result.suspiciousRegionScore).toBe("number");
    expect(typeof result.retryCount).toBe("number");
    expect(result.readinessReport).toBeDefined();
    // DPR 2 → width should be 1600 (800 CSS × 2).
    expect(result.width).toBe(1600);

    await context.close();
  }, 30_000);
});

async function readPixel(
  buffer: Buffer,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number; a: number }> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const index = (y * info.width + x) * 4;
  return {
    r: data[index]!,
    g: data[index + 1]!,
    b: data[index + 2]!,
    a: data[index + 3]!,
  };
}
