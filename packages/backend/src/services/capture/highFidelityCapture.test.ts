import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import sharp from "sharp";
import { startFixtureServer, type FixtureServer } from "./__fixtures__/server.js";
import { captureHighFidelity } from "./highFidelityCapture.js";

describe("HighFidelityCapture", () => {
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

  it("captures a page combining lazy images + web font + animation + sticky banner", async () => {
    // DPR 2 so we can verify the orchestrator's raster is the CSS viewport
    // × DPR, the same guarantee the production capture relies on.
    const context = await browser.newContext({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}/combined-capture.html`, { waitUntil: "commit" });

    const dismissBannersCalls: number[] = [];
    const dismissBanners = async () => {
      dismissBannersCalls.push(Date.now());
    };

    const result = await captureHighFidelity(page, {
      dismissBanners,
      readiness: { domQuietWindowMs: 400 },
    });

    // 1. Buffer is a real PNG with DPR 2 dimensions for our 800-wide viewport.
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(1600); // 800 CSS × DPR 2
    expect(meta.height).toBeGreaterThan(600); // full-page, includes lazy rows
    expect(result.width).toBe(meta.width);
    expect(result.height).toBe(meta.height);

    // 2. Readiness report has all signals fired (no timeouts on a healthy page).
    expect(result.readinessReport.images).toBe("fired");
    expect(result.readinessReport.fonts).toBe("fired");
    expect(result.readinessReport.animations).toBe("fired");

    // 3. dismissBanners was invoked at least once.
    expect(dismissBannersCalls.length).toBeGreaterThan(0);

    // 4. After capture, lazy images are loaded (proof the trigger ran).
    const loadedCount = await page.evaluate(
      () => Array.from(document.images).filter((i) => i.complete && i.naturalWidth > 0).length
    );
    expect(loadedCount).toBe(4);

    // 5. Sticky banner: only the topmost should remain visible.
    const visibility = await page.evaluate(() => {
      const b1 = document.querySelector('[data-testid="banner-1"]') as HTMLElement;
      const b2 = document.querySelector('[data-testid="banner-2"]') as HTMLElement;
      return {
        b1Display: b1?.style.display ?? "(unset)",
        b2Display: b2?.style.display ?? "(unset)",
      };
    });
    expect(visibility.b1Display).not.toBe("none"); // topmost preserved
    expect(visibility.b2Display).toBe("none"); // hidden by orchestrator

    // 6. Page ends scrolled to top so the screenshot starts at y=0.
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);

    await context.close();
  }, 30_000);
});
