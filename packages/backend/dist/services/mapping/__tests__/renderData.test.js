import { describe, it, expect } from "vitest";
import { buildRenderInstance, buildRenderComponents } from "../renderData.js";
// ── helpers ──────────────────────────────────────────────────────────────────
function makePageEvidence(overrides = {}) {
    return {
        id: "10",
        url: "https://example.com/",
        title: "Home",
        screenshotPaths: ["/screenshots/10a.png"],
        viewportWidth: 1440,
        candidateCount: 3,
        ...overrides,
    };
}
function makeDecision(overrides = {}) {
    return {
        type: "Buttons",
        instances: [
            {
                instanceId: "inst-1",
                pageId: "10",
                elementId: "42",
                bbox: { x: 10, y: 20, width: 100, height: 40 },
                source: "dom",
                confidence: "high",
                label: "Primary CTA",
            },
        ],
        ...overrides,
    };
}
// ── buildRenderInstance ───────────────────────────────────────────────────────
describe("buildRenderInstance", () => {
    it("enriches a DOM-backed instance with page evidence metadata", () => {
        const pageEvidence = makePageEvidence();
        const instance = makeDecision().instances[0];
        const result = buildRenderInstance(instance, pageEvidence);
        expect(result.instanceId).toBe("inst-1");
        expect(result.elementId).toBe("42");
        expect(result.pageId).toBe("10");
        expect(result.pageUrl).toBe("https://example.com/");
        expect(result.screenshotPaths).toEqual(["/screenshots/10a.png"]);
        expect(result.viewportWidth).toBe(1440);
        expect(result.bbox).toEqual({ x: 10, y: 20, width: 100, height: 40 });
        expect(result.source).toBe("dom");
        expect(result.confidence).toBe("high");
        expect(result.label).toBe("Primary CTA");
    });
    it("uses sourceUrl from the decision instance when provided", () => {
        const pageEvidence = makePageEvidence({ url: "https://example.com/canonical" });
        const instance = { ...makeDecision().instances[0], sourceUrl: "https://example.com/original" };
        const result = buildRenderInstance(instance, pageEvidence);
        expect(result.pageUrl).toBe("https://example.com/original");
    });
    it("falls back to page evidence url when sourceUrl is absent", () => {
        const pageEvidence = makePageEvidence({ url: "https://example.com/home" });
        const instance = makeDecision().instances[0];
        const result = buildRenderInstance(instance, pageEvidence);
        expect(result.pageUrl).toBe("https://example.com/home");
    });
    it("represents a vision-backed instance without a DOM elementId", () => {
        const pageEvidence = makePageEvidence();
        const instance = {
            instanceId: "v-1",
            pageId: "10",
            bbox: { x: 0, y: 0, width: 80, height: 30 },
            source: "vision",
            confidence: "medium",
            label: "Hero Banner",
        };
        const result = buildRenderInstance(instance, pageEvidence);
        expect(result.instanceId).toBe("v-1");
        expect(result.elementId).toBeUndefined();
        expect(result.source).toBe("vision");
    });
    it("synthesises instanceId from pageId when missing", () => {
        const pageEvidence = makePageEvidence();
        const instance = {
            pageId: "10",
            bbox: { x: 0, y: 0, width: 10, height: 10 },
            source: "vision",
        };
        const result = buildRenderInstance(instance, pageEvidence);
        expect(result.instanceId).toMatch(/10/);
    });
    it("applies empty defaults for missing page evidence", () => {
        const instance = makeDecision().instances[0];
        const result = buildRenderInstance(instance, null);
        expect(result.pageUrl).toBe("");
        expect(result.screenshotPaths).toEqual([]);
        expect(result.viewportWidth).toBeNull();
    });
});
// ── buildRenderComponents ─────────────────────────────────────────────────────
describe("buildRenderComponents", () => {
    it("assembles render components with enriched instances", () => {
        const pageMap = new Map([["10", makePageEvidence()]]);
        const decision = makeDecision();
        const result = buildRenderComponents([decision], pageMap);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("Buttons");
        expect(result[0].instanceCount).toBe(1);
        expect(result[0].instances[0].pageUrl).toBe("https://example.com/");
    });
    it("returns empty array for empty decisions", () => {
        const pageMap = new Map();
        expect(buildRenderComponents([], pageMap)).toEqual([]);
    });
    it("handles decisions whose pageId has no matching page evidence", () => {
        const pageMap = new Map();
        const decision = makeDecision();
        const result = buildRenderComponents([decision], pageMap);
        expect(result[0].instances[0].screenshotPaths).toEqual([]);
        expect(result[0].instances[0].viewportWidth).toBeNull();
    });
});
