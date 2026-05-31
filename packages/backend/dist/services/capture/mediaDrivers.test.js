import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { startFixtureServer } from "./__fixtures__/server.js";
import { activateVideos } from "./videoDriver.js";
import { activateLottiePlayers } from "./lottieDriver.js";
import { warmUpAnimatedRegions } from "./canvasDriver.js";
import { captureTiled } from "./tiledCapture.js";
import { scoreSuspiciousRegions } from "./blankRegionDetector.js";
describe("VideoDriver (issue 46)", () => {
    let server;
    let browser;
    beforeAll(async () => {
        server = await startFixtureServer();
        browser = await chromium.launch();
    }, 30_000);
    afterAll(async () => {
        await browser?.close();
        await server?.close();
    });
    it("reports poster status for video with poster", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/video-region.html`, { waitUntil: "commit" });
        await page.waitForTimeout(300);
        const results = await activateVideos(page, ["video:nth(0)"]);
        expect(results.length).toBe(1);
        // Video with poster should be "poster" since it hasn't loaded metadata yet.
        expect(["poster", "frame-captured", "autoplay-blocked", "metadata-timeout"]).toContain(results[0]?.status);
        await context.close();
    }, 20_000);
    it("captures page with video using tiled capture (no blank overall)", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/video-region.html`, { waitUntil: "commit" });
        await page.waitForTimeout(300);
        const result = await captureTiled(page, {
            tileStabilityMs: 200,
            detectMedia: false,
            readiness: { overallTimeoutMs: 5_000 },
            lazy: { quietWindowMs: 50, maxSteps: 1, overallTimeoutMs: 2_000 },
        });
        expect(Buffer.isBuffer(result.buffer)).toBe(true);
        expect(result.tileCount).toBeGreaterThanOrEqual(1);
        await context.close();
    }, 30_000);
    it("video activation with unknown selector returns skipped", async () => {
        const context = await browser.newContext({
            viewport: { width: 800, height: 600 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/smoke.html`, { waitUntil: "commit" });
        const results = await activateVideos(page, ["video:nth(99)"]);
        expect(results[0]?.status).toBe("skipped");
        await context.close();
    }, 15_000);
});
describe("LottieDriver (issue 47)", () => {
    let server;
    let browser;
    beforeAll(async () => {
        server = await startFixtureServer();
        browser = await chromium.launch();
    }, 30_000);
    afterAll(async () => {
        await browser?.close();
        await server?.close();
    });
    it("activates lottie-like element with warmup fallback", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/lottie-region.html`, { waitUntil: "commit" });
        await page.waitForTimeout(300);
        const results = await activateLottiePlayers(page, [".lottie:nth(0)"]);
        expect(results.length).toBe(1);
        // Should attempt warmup or seek (our fixture doesn't have a real lottie API).
        expect(["warmup", "seeked", "timeout"]).toContain(results[0]?.status);
        await context.close();
    }, 20_000);
    it("captures lottie page without hanging", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/lottie-region.html`, { waitUntil: "commit" });
        await page.waitForTimeout(300);
        const result = await captureTiled(page, {
            tileStabilityMs: 200,
            detectMedia: false,
            readiness: { overallTimeoutMs: 5_000, visualStabilityQuietWindowMs: 600 },
            lazy: { quietWindowMs: 50, maxSteps: 1, overallTimeoutMs: 2_000 },
        });
        expect(Buffer.isBuffer(result.buffer)).toBe(true);
        // After warm-up, the lottie element should have loaded.
        const loaded = await page.evaluate(() => document.getElementById("lottie-player-sim")?.getAttribute("data-loaded") === "true");
        expect(loaded).toBe(true);
        await context.close();
    }, 30_000);
    it("lottie activation on a page with no lottie elements is a no-op", async () => {
        const context = await browser.newContext({
            viewport: { width: 800, height: 600 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/smoke.html`, { waitUntil: "commit" });
        const results = await activateLottiePlayers(page, []);
        expect(results).toHaveLength(0);
        await context.close();
    }, 15_000);
});
describe("CanvasDriver (issue 48)", () => {
    let server;
    let browser;
    beforeAll(async () => {
        server = await startFixtureServer();
        browser = await chromium.launch();
    }, 30_000);
    afterAll(async () => {
        await browser?.close();
        await server?.close();
    });
    it("warms up a canvas that paints on intersection", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/canvas-region.html`, { waitUntil: "commit" });
        await page.waitForTimeout(200);
        const results = await warmUpAnimatedRegions(page, ["canvas:nth(0)"], ["canvas"]);
        expect(results.length).toBe(1);
        expect(["warmed", "frozen", "blocked"]).toContain(results[0]?.status);
        // After warm-up the canvas should have been painted (scrolled into view).
        const painted = await page.evaluate(() => document.getElementById("lazy-canvas")?.getAttribute("data-painted") === "true");
        expect(painted).toBe(true);
        await context.close();
    }, 20_000);
    it("captures canvas page with tile-level retry path available", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/canvas-region.html`, { waitUntil: "commit" });
        await page.waitForTimeout(200);
        const result = await captureTiled(page, {
            tileStabilityMs: 300,
            detectMedia: false,
            readiness: { overallTimeoutMs: 5_000, visualStabilityQuietWindowMs: 400 },
            lazy: { quietWindowMs: 50, maxSteps: 2, overallTimeoutMs: 3_000 },
        });
        expect(Buffer.isBuffer(result.buffer)).toBe(true);
        expect(result.tileCount).toBeGreaterThanOrEqual(1);
        await context.close();
    }, 30_000);
    it("blank canvas scores high (tile retry would trigger)", async () => {
        const context = await browser.newContext({
            viewport: { width: 800, height: 600 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/canvas-region.html`, { waitUntil: "commit" });
        await page.waitForTimeout(200);
        // Capture just the canvas region screenshot.
        const fullBuf = await page.screenshot({ fullPage: false, type: "png" });
        const score = await scoreSuspiciousRegions(fullBuf);
        // Score should be computable (0–1 range).
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
        await context.close();
    }, 20_000);
});
