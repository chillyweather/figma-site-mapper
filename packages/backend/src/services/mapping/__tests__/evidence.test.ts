import { describe, it, expect } from "vitest";
import { filterDomCandidates, buildPageEvidence } from "../evidence.js";
import type { MappingDomCandidate } from "../types.js";

// ── filterDomCandidates helpers ──────────────────────────────────────────────

const makeRow = (overrides: Partial<{
  id: number;
  pageId: number;
  projectId: number;
  type: string | null;
  selector: string | null;
  tagName: string | null;
  elementId: string | null;
  classes: string | null;
  bbox: string | null;
  text: string | null;
  href: string | null;
  ariaLabel: string | null;
  role: string | null;
  isVisible: boolean | null;
  cropPath: string | null;
  componentFingerprint: string | null;
}> = {}) => ({
  id: 1,
  pageId: 10,
  projectId: 5,
  type: "button",
  selector: ".btn",
  tagName: "button",
  elementId: null,
  classes: '["btn","btn-primary"]',
  bbox: JSON.stringify({ x: 10, y: 20, width: 100, height: 40 }),
  text: "Click me",
  href: null,
  ariaLabel: null,
  role: null,
  isVisible: true as boolean | null,
  cropPath: null,
  componentFingerprint: null,
  ...overrides,
});

const makeDomCandidate = (overrides: Partial<MappingDomCandidate> = {}): MappingDomCandidate => ({
  id: "1",
  pageId: "10",
  type: "button",
  classes: [],
  bbox: { x: 10, y: 20, width: 100, height: 40 },
  ...overrides,
});

// ── filterDomCandidates ──────────────────────────────────────────────────────

describe("filterDomCandidates", () => {
  it("includes elements with valid bbox", () => {
    const results = filterDomCandidates([makeRow()]);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("1");
    expect(results[0]!.bbox).toEqual({ x: 10, y: 20, width: 100, height: 40 });
  });

  it("excludes elements with null bbox", () => {
    expect(filterDomCandidates([makeRow({ bbox: null })])).toHaveLength(0);
  });

  it("excludes elements with invalid bbox JSON", () => {
    expect(filterDomCandidates([makeRow({ bbox: "not-json" })])).toHaveLength(0);
  });

  it("excludes elements with zero-width bbox", () => {
    expect(
      filterDomCandidates([makeRow({ bbox: JSON.stringify({ x: 0, y: 0, width: 0, height: 40 }) })])
    ).toHaveLength(0);
  });

  it("excludes elements with zero-height bbox", () => {
    expect(
      filterDomCandidates([makeRow({ bbox: JSON.stringify({ x: 0, y: 0, width: 100, height: 0 }) })])
    ).toHaveLength(0);
  });

  it("excludes explicitly invisible elements", () => {
    expect(filterDomCandidates([makeRow({ isVisible: false })])).toHaveLength(0);
  });

  it("includes elements where isVisible is null (unknown visibility)", () => {
    expect(filterDomCandidates([makeRow({ isVisible: null })])).toHaveLength(1);
  });

  it("parses classes from JSON array", () => {
    const results = filterDomCandidates([makeRow({ classes: '["foo","bar"]' })]);
    expect(results[0]!.classes).toEqual(["foo", "bar"]);
  });

  it("returns empty classes for null or invalid JSON", () => {
    const results = filterDomCandidates([makeRow({ classes: null })]);
    expect(results[0]!.classes).toEqual([]);
  });

  it("maps pageId and id as strings", () => {
    const results = filterDomCandidates([makeRow({ id: 7, pageId: 99 })]);
    expect(results[0]!.id).toBe("7");
    expect(results[0]!.pageId).toBe("99");
  });

  it("handles multiple rows filtering independently", () => {
    const rows = [
      makeRow({ id: 1, bbox: JSON.stringify({ x: 0, y: 0, width: 10, height: 10 }) }),
      makeRow({ id: 2, bbox: null }),
      makeRow({ id: 3, isVisible: false }),
      makeRow({ id: 4, bbox: JSON.stringify({ x: 5, y: 5, width: 20, height: 20 }) }),
    ];
    const results = filterDomCandidates(rows);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(["1", "4"]);
  });

  it("preserves cropPath for agent evidence", () => {
    const results = filterDomCandidates([
      makeRow({ cropPath: "http://localhost:3006/screenshots/elements/1.png" }),
    ]);
    expect(results[0]!.cropPath).toBe("http://localhost:3006/screenshots/elements/1.png");
  });

  it("excludes implausibly huge generic blocks", () => {
    expect(
      filterDomCandidates([
        makeRow({
          type: "div",
          tagName: "div",
          text: null,
          componentFingerprint: null,
          bbox: JSON.stringify({ x: 0, y: 0, width: 2000, height: 1600 }),
        }),
      ])
    ).toHaveLength(0);
  });

  it("preserves elementId in output", () => {
    const results = filterDomCandidates([makeRow({ elementId: "my-button" })]);
    expect(results[0]!.elementId).toBe("my-button");
  });

  it("preserves componentFingerprint in output", () => {
    const results = filterDomCandidates([makeRow({ componentFingerprint: "fp-abc" })]);
    expect(results[0]!.componentFingerprint).toBe("fp-abc");
  });
});

// ── buildPageEvidence ────────────────────────────────────────────────────────

describe("buildPageEvidence", () => {
  const baseRow = {
    id: 10,
    url: "https://example.com/",
    title: "Home",
    screenshotPaths: '["path/a.png","path/b.png"]',
    viewportWidth: 1440,
  };

  it("assembles url, title, screenshotPaths, viewportWidth from page row", () => {
    const result = buildPageEvidence(baseRow, []);
    expect(result.id).toBe("10");
    expect(result.url).toBe("https://example.com/");
    expect(result.title).toBe("Home");
    expect(result.screenshotPaths).toEqual(["path/a.png", "path/b.png"]);
    expect(result.viewportWidth).toBe(1440);
  });

  it("counts candidates correctly", () => {
    const candidates = [
      makeDomCandidate({ id: "1", pageId: "10" }),
      makeDomCandidate({ id: "2", pageId: "10" }),
      makeDomCandidate({ id: "3", pageId: "10" }),
    ];
    const result = buildPageEvidence(baseRow, candidates);
    expect(result.candidateCount).toBe(3);
  });

  it("returns candidateCount 0 when no candidates", () => {
    expect(buildPageEvidence(baseRow, []).candidateCount).toBe(0);
  });

  it("handles null viewportWidth", () => {
    const result = buildPageEvidence({ ...baseRow, viewportWidth: null }, []);
    expect(result.viewportWidth).toBeNull();
  });

  it("returns empty screenshotPaths for null", () => {
    const result = buildPageEvidence({ ...baseRow, screenshotPaths: null }, []);
    expect(result.screenshotPaths).toEqual([]);
  });

  it("returns empty screenshotPaths for invalid JSON", () => {
    const result = buildPageEvidence({ ...baseRow, screenshotPaths: "not-json" }, []);
    expect(result.screenshotPaths).toEqual([]);
  });

  it("handles null title", () => {
    const result = buildPageEvidence({ ...baseRow, title: null }, []);
    expect(result.title).toBeNull();
  });
});
