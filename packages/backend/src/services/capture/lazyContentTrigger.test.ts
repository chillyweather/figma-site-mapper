import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { startFixtureServer, type FixtureServer } from "./__fixtures__/server.js";
import { triggerLazyContent } from "./lazyContentTrigger.js";

describe("LazyContentTrigger", () => {
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

  it("terminates within its step budget on an infinite-scroll page", async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto(`${server.baseUrl}/infinite-scroll.html`, { waitUntil: "load" });

    const start = Date.now();
    await triggerLazyContent(page, {
      // Tight budget so the test runs fast — proves the trigger respects the
      // cap rather than scrolling forever.
      maxSteps: 5,
      quietWindowMs: 100,
      overallTimeoutMs: 5_000,
    });
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeLessThan(4_000);

    await page.close();
  }, 15_000);

  it("returns the page scrolled to the top so subsequent screenshots start at y=0", async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto(`${server.baseUrl}/lazy-images.html`, { waitUntil: "load" });

    await triggerLazyContent(page);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);

    await page.close();
  }, 15_000);

  it("scrolls the page so all lazy-loaded images end up loaded", async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto(`${server.baseUrl}/lazy-images.html`, { waitUntil: "load" });

    // Sanity: at least some lazy images should be unloaded before the trigger runs.
    const beforeLoaded = await page.evaluate(
      () => document.querySelectorAll("img").length === 0
        ? 0
        : Array.from(document.images).filter((img) => img.complete && img.naturalWidth > 0).length
    );
    const total = await page.evaluate(() => document.images.length);
    expect(total).toBe(10);
    expect(beforeLoaded).toBeLessThan(total);

    await triggerLazyContent(page);

    const afterLoaded = await page.evaluate(
      () => Array.from(document.images).filter((img) => img.complete && img.naturalWidth > 0).length
    );
    expect(afterLoaded).toBe(total);

    await page.close();
  }, 30_000);
});
