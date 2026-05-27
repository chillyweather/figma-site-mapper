import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { startFixtureServer, type FixtureServer } from "./__fixtures__/server.js";
import { waitUntilStable } from "./pageReadyDetector.js";

describe("PageReadyDetector", () => {
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

  it("waits for document.fonts.ready before resolving", async () => {
    const page = await browser.newPage();
    await page.goto(`${server.baseUrl}/slow-font.html`, { waitUntil: "commit" });

    const start = Date.now();
    const report = await waitUntilStable(page);
    const elapsedMs = Date.now() - start;

    // Font load is delayed 400ms by the fixture server; if the detector
    // resolved without waiting on document.fonts.ready, elapsedMs would be
    // far below that floor.
    expect(elapsedMs).toBeGreaterThanOrEqual(350);

    const fontsStatus = await page.evaluate(() => document.fonts.status);
    expect(fontsStatus).toBe("loaded");
    expect(report.fonts).toBe("fired");

    await page.close();
  }, 15_000);

  it("waits for delayed CSS background-image to load before resolving", async () => {
    const page = await browser.newPage();
    await page.goto(`${server.baseUrl}/slow-background.html`, { waitUntil: "commit" });

    const start = Date.now();
    const report = await waitUntilStable(page);
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeGreaterThanOrEqual(400);
    expect(report.backgroundImages).toBe("fired");

    await page.close();
  }, 15_000);

  it("settles running CSS animations so the page is visually stable", async () => {
    const page = await browser.newPage();
    await page.goto(`${server.baseUrl}/running-animation.html`, { waitUntil: "commit" });

    // Sanity: before the detector runs, there should be at least one running animation.
    const beforeRunning = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running").length
    );
    expect(beforeRunning).toBeGreaterThan(0);

    const report = await waitUntilStable(page);

    const afterRunning = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running").length
    );
    expect(afterRunning).toBe(0);
    expect(report.animations).toBe("fired");

    await page.close();
  }, 15_000);

  it("waits for delayed <video> poster images before resolving", async () => {
    const page = await browser.newPage();
    await page.goto(`${server.baseUrl}/video-poster.html`, { waitUntil: "commit" });

    const start = Date.now();
    const report = await waitUntilStable(page);
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeGreaterThanOrEqual(350);
    expect(report.videos).toBe("fired");

    await page.close();
  }, 15_000);

  it("resolves request-settling N ms after the last response, ignoring long-polling requests", async () => {
    const page = await browser.newPage();
    await page.goto(`${server.baseUrl}/request-settling.html`, { waitUntil: "commit" });

    const start = Date.now();
    const report = await waitUntilStable(page, {
      // Shorter quiet window so the test runs fast. Other signals are no-ops
      // for this fixture, so the request-settling timing dominates.
      requestSettleQuietWindowMs: 400,
      // Bound the overall ceiling so a regression that blocks on /__never__
      // makes the test obviously hang against the ceiling instead of timing
      // out at vitest's outer timer.
      overallTimeoutMs: 5_000,
    });
    const elapsedMs = Date.now() - start;

    // Three 100ms-delayed responses ≈ 600ms+ to fire the burst, then a 400ms
    // quiet window. So a healthy run lands roughly 1000–1500ms.
    expect(elapsedMs).toBeGreaterThanOrEqual(700);
    expect(elapsedMs).toBeLessThan(3_000);
    expect(report.requests).toBe("fired");

    await page.close();
  }, 15_000);

  it("bounds total wait by overallTimeoutMs and returns a partial readiness report instead of throwing", async () => {
    const page = await browser.newPage();
    await page.goto(`${server.baseUrl}/never-loading-image.html`, {
      waitUntil: "commit",
    });

    const start = Date.now();
    const report = await waitUntilStable(page, {
      overallTimeoutMs: 800,
      // Short request quiet window so that signal completes quickly and
      // doesn't dominate the elapsed time.
      requestSettleQuietWindowMs: 300,
    });
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeLessThan(1_500);
    // Image never loads → that signal should report timeout.
    expect(report.images).toBe("timeout");
    // Other signals should still fire — the detector reports per-signal
    // outcomes, not a single pass/fail.
    expect(report.fonts).toBe("fired");
    expect(report.animations).toBe("fired");

    await page.close();
  }, 15_000);

  it("waits for delayed <img> elements to load and decode before resolving", async () => {
    const page = await browser.newPage();
    // The fixture image is delayed by the server (?delay=500). If the detector
    // returns before the image has loaded, the assertion below will fail —
    // proving the detector actually waited.
    await page.goto(`${server.baseUrl}/delayed-image.html`, { waitUntil: "commit" });

    const report = await waitUntilStable(page);

    const imageState = await page.evaluate(() => {
      const img = document.getElementById("hero") as HTMLImageElement | null;
      return img
        ? { complete: img.complete, naturalWidth: img.naturalWidth }
        : null;
    });

    expect(imageState).not.toBeNull();
    expect(imageState!.complete).toBe(true);
    expect(imageState!.naturalWidth).toBeGreaterThan(0);
    expect(report.images).toBe("fired");

    await page.close();
  }, 15_000);
});
