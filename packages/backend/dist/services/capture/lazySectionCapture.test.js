import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import sharp from "sharp";
import { startFixtureServer } from "./__fixtures__/server.js";
import { captureHighFidelity } from "./highFidelityCapture.js";
import { scoreSuspiciousRegions } from "./blankRegionDetector.js";
describe("LazySectionCapture", () => {
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
    it("captures all cards after visual stability wait", async () => {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/lazy-section.html`, { waitUntil: "commit" });
        const result = await captureHighFidelity(page, {
            readiness: { visualStabilityQuietWindowMs: 1200 },
            lazy: { quietWindowMs: 25, maxSteps: 1, overallTimeoutMs: 100 },
        });
        // Visual stability should have fired (not timed out).
        expect(result.readinessReport.visualStability).toBe("fired");
        // All cards should be loaded in the DOM.
        const cardsLoaded = await page.evaluate(() => document.body.getAttribute("data-cards-loaded") === "true");
        expect(cardsLoaded).toBe(true);
        // The screenshot should not have a large blank run (cards are colored).
        const score = await scoreSuspiciousRegions(result.buffer);
        expect(score).toBeLessThan(0.15);
        await context.close();
    }, 30_000);
    it("blank region detector scores a plain white image near 1.0", async () => {
        // Synthetic 800×600 white image → should score very high (near-blank).
        const whiteBuffer = await sharp({
            create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 255, b: 255 } },
        })
            .png()
            .toBuffer();
        const score = await scoreSuspiciousRegions(whiteBuffer);
        expect(score).toBeGreaterThan(0.9);
    });
    it("blank region detector scores a varied image low", async () => {
        const width = 800;
        const height = 600;
        const pixels = Buffer.alloc(width * height * 3);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const offset = (y * width + x) * 3;
                pixels[offset] = (x * 13 + y * 7) % 256;
                pixels[offset + 1] = (x * 5 + y * 17) % 256;
                pixels[offset + 2] = (x * 29 + y * 3) % 256;
            }
        }
        const variedBuffer = await sharp(pixels, {
            raw: { width, height, channels: 3 },
        }).png().toBuffer();
        const variedScore = await scoreSuspiciousRegions(variedBuffer);
        expect(variedScore).toBeLessThan(0.15);
    });
});
