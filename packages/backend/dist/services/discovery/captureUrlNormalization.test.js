import { describe, it, expect } from "vitest";
import { effectiveCaptureUrlKey, dedupeEffectiveCaptureUrls, getUrlLookupCandidates, } from "./captureUrlNormalization.js";
describe("effectiveCaptureUrlKey", () => {
    it("strips www prefix", () => {
        expect(effectiveCaptureUrlKey("https://www.example.com/")).toBe("https://example.com/");
    });
    it("strips hash fragment", () => {
        expect(effectiveCaptureUrlKey("https://example.com/page#section")).toBe("https://example.com/page");
    });
    it("strips trailing slash from non-root paths", () => {
        expect(effectiveCaptureUrlKey("https://example.com/about/")).toBe("https://example.com/about");
    });
    it("keeps trailing slash on root path", () => {
        expect(effectiveCaptureUrlKey("https://example.com/")).toBe("https://example.com/");
    });
    it("preserves query string", () => {
        expect(effectiveCaptureUrlKey("https://example.com/search?q=test")).toBe("https://example.com/search?q=test");
    });
    it("returns raw url on parse failure", () => {
        expect(effectiveCaptureUrlKey("not-a-url")).toBe("not-a-url");
    });
});
describe("dedupeEffectiveCaptureUrls", () => {
    it("removes duplicates that differ only by www", () => {
        const result = dedupeEffectiveCaptureUrls([
            "https://example.com/about",
            "https://www.example.com/about",
        ]);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe("https://example.com/about");
    });
    it("removes duplicates that differ only by trailing slash", () => {
        const result = dedupeEffectiveCaptureUrls([
            "https://example.com/page",
            "https://example.com/page/",
        ]);
        expect(result).toHaveLength(1);
    });
    it("keeps genuinely distinct URLs", () => {
        const result = dedupeEffectiveCaptureUrls([
            "https://example.com/about",
            "https://example.com/contact",
        ]);
        expect(result).toHaveLength(2);
    });
    it("preserves first occurrence", () => {
        const result = dedupeEffectiveCaptureUrls([
            "https://example.com/page/",
            "https://example.com/page",
        ]);
        expect(result[0]).toBe("https://example.com/page/");
    });
});
describe("getUrlLookupCandidates", () => {
    it("includes the raw url", () => {
        const candidates = getUrlLookupCandidates("https://example.com/about");
        expect(candidates).toContain("https://example.com/about");
    });
    it("includes the trailing-slash variant for paths without one", () => {
        const candidates = getUrlLookupCandidates("https://example.com/about");
        expect(candidates).toContain("https://example.com/about/");
    });
    it("includes the no-trailing-slash variant for paths with one", () => {
        const candidates = getUrlLookupCandidates("https://example.com/about/");
        expect(candidates).toContain("https://example.com/about");
    });
    it("includes a hash-stripped variant alongside the raw url", () => {
        const candidates = getUrlLookupCandidates("https://example.com/about#top");
        expect(candidates).toContain("https://example.com/about#top");
        expect(candidates.some((c) => !c.includes("#"))).toBe(true);
    });
    it("returns the raw url unchanged for non-URL input", () => {
        const candidates = getUrlLookupCandidates("not-a-url");
        expect(candidates).toContain("not-a-url");
        expect(candidates).toHaveLength(1);
    });
});
