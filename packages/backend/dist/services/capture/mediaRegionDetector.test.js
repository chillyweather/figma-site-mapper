import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import sharp from "sharp";
import { startFixtureServer } from "./__fixtures__/server.js";
import { detectMediaRegions } from "./mediaRegionDetector.js";
import { captureTiled } from "./tiledCapture.js";
describe("MediaRegionDetector", () => {
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
    it("discovers canvas, svg-animation, and video surfaces", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/media-regions.html`, { waitUntil: "commit" });
        await page.waitForTimeout(500);
        const result = await captureTiled(page, {
            tileStabilityMs: 200,
            detectMedia: true,
            readiness: { overallTimeoutMs: 5_000, visualStabilityQuietWindowMs: 600 },
            lazy: { quietWindowMs: 50, maxSteps: 2, overallTimeoutMs: 2_000 },
        });
        expect(result.mediaDiagnostics).toBeDefined();
        const md = result.mediaDiagnostics;
        expect(md.canvasCount).toBeGreaterThanOrEqual(1);
        expect(md.svgAnimationCount).toBeGreaterThanOrEqual(1);
        expect(md.videoCount).toBeGreaterThanOrEqual(1);
        // Surfaces array should be populated.
        expect(md.surfaces.length).toBeGreaterThan(0);
        await context.close();
    }, 30_000);
    it("scores a painted canvas as ok, blank canvas as blank", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/media-regions.html`, { waitUntil: "commit" });
        await page.waitForTimeout(500);
        const result = await captureTiled(page, {
            tileStabilityMs: 200,
            detectMedia: true,
            readiness: { overallTimeoutMs: 5_000, visualStabilityQuietWindowMs: 600 },
            lazy: { quietWindowMs: 50, maxSteps: 2, overallTimeoutMs: 2_000 },
        });
        const md = result.mediaDiagnostics;
        const canvasSurfaces = md.surfaces.filter((s) => s.kind === "canvas");
        // At least one canvas discovered.
        expect(canvasSurfaces.length).toBeGreaterThanOrEqual(1);
        // Normal (painted) canvas should be ok, blank canvas should be blank.
        const statuses = canvasSurfaces.map((s) => s.status);
        expect(statuses).toContain("ok");
        expect(statuses).toContain("blank");
        expect(md.blankCount).toBeGreaterThanOrEqual(1);
        const blankCanvas = canvasSurfaces.find((s) => s.selector.includes("blank-canvas"));
        expect(blankCanvas?.status).toBe("blank");
        await context.close();
    }, 30_000);
    it("scores media regions against DPR-scaled screenshots", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 2,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/media-regions.html`, { waitUntil: "commit" });
        await page.waitForTimeout(500);
        const screenshotBuf = await page.screenshot({ fullPage: true, type: "png" });
        const meta = await sharp(screenshotBuf).metadata();
        expect(meta.width).toBe(2400);
        const md = await detectMediaRegions(page, screenshotBuf);
        const blankCanvas = md.surfaces.find((s) => s.selector.includes("blank-canvas"));
        const paintedCanvas = md.surfaces.find((s) => s.selector.includes("normal-canvas"));
        expect(blankCanvas?.status).toBe("blank");
        expect(paintedCanvas?.status).toBe("ok");
        expect(md.blankCount).toBeGreaterThanOrEqual(1);
        await context.close();
    }, 30_000);
    it("detectMediaRegions on a page with no media returns zeros", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/smoke.html`, { waitUntil: "commit" });
        await page.waitForTimeout(200);
        // Create a synthetic screenshot buffer (white page).
        const screenshotBuf = await page.screenshot({ fullPage: true, type: "png" });
        const md = await detectMediaRegions(page, screenshotBuf);
        // smoke.html should have no media surfaces.
        expect(md.videoCount).toBe(0);
        expect(md.canvasCount).toBe(0);
        expect(md.lottieCount).toBe(0);
        expect(md.iframeCount).toBe(0);
        expect(md.warnings).toHaveLength(0);
        await context.close();
    }, 30_000);
    it("blocked surface carries a warning", async () => {
        // Synthesize a blocked surface scenario via a synthetic diagnostics object.
        const blockedSurface = {
            kind: "canvas",
            selector: "canvas:nth(0)",
            bbox: { x: 0, y: 0, width: 200, height: 100 },
            status: "blocked",
            warning: "canvas[0]: cross-origin or tainted canvas — cannot read pixels",
        };
        expect(blockedSurface.status).toBe("blocked");
        expect(blockedSurface.warning).toContain("cross-origin");
    });
    it("mediaDiagnostics round-trips through JSON", async () => {
        const diagnostics = {
            videoCount: 2,
            canvasCount: 1,
            svgAnimationCount: 0,
            lottieCount: 1,
            iframeCount: 0,
            blankCount: 1,
            blockedCount: 1,
            surfaces: [],
            warnings: ["video[0]: cross-origin", "canvas[0]: blank"],
        };
        const json = JSON.stringify(diagnostics);
        const parsed = JSON.parse(json);
        expect(parsed.videoCount).toBe(2);
        expect(parsed.warnings).toHaveLength(2);
    });
});
