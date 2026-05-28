import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { startFixtureServer } from "./server.js";
describe("capture fixture harness", () => {
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
    it("serves a fixture page that Playwright can render", async () => {
        const page = await browser.newPage();
        await page.goto(`${server.baseUrl}/smoke.html`);
        const text = await page.locator('[data-testid="hello"]').textContent();
        expect(text).toBe("hello from fixture");
        await page.close();
    });
    it("applies the ?delay query param before responding", async () => {
        const page = await browser.newPage();
        const start = Date.now();
        await page.goto(`${server.baseUrl}/smoke.html?delay=200`);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(180);
        await page.close();
    });
});
