import { describe, it, expect } from "vitest";
import { filterDomCandidates } from "../evidence.js";
import { isValidProjectId } from "../buildMappingWorkspace.js";

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

describe("isValidProjectId", () => {
  it("accepts positive integer strings", () => {
    expect(isValidProjectId("1")).toBe(true);
    expect(isValidProjectId("42")).toBe(true);
  });

  it("rejects non-integer strings", () => {
    expect(isValidProjectId("0")).toBe(false);
    expect(isValidProjectId("-1")).toBe(false);
    expect(isValidProjectId("abc")).toBe(false);
    expect(isValidProjectId("1.5")).toBe(false);
    expect(isValidProjectId("01")).toBe(false);
  });
});

describe("filterDomCandidates", () => {
  it("includes elements with valid bbox", () => {
    const results = filterDomCandidates([makeRow()]);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("1");
    expect(results[0]!.bbox).toEqual({ x: 10, y: 20, width: 100, height: 40 });
  });

  it("excludes elements with null bbox", () => {
    const results = filterDomCandidates([makeRow({ bbox: null })]);
    expect(results).toHaveLength(0);
  });

  it("excludes elements with invalid bbox JSON", () => {
    const results = filterDomCandidates([makeRow({ bbox: "not-json" })]);
    expect(results).toHaveLength(0);
  });

  it("excludes elements with zero-width bbox", () => {
    const results = filterDomCandidates([
      makeRow({ bbox: JSON.stringify({ x: 0, y: 0, width: 0, height: 40 }) }),
    ]);
    expect(results).toHaveLength(0);
  });

  it("excludes elements with zero-height bbox", () => {
    const results = filterDomCandidates([
      makeRow({ bbox: JSON.stringify({ x: 0, y: 0, width: 100, height: 0 }) }),
    ]);
    expect(results).toHaveLength(0);
  });

  it("excludes explicitly invisible elements", () => {
    const results = filterDomCandidates([makeRow({ isVisible: false })]);
    expect(results).toHaveLength(0);
  });

  it("includes elements where isVisible is null (unknown visibility)", () => {
    const results = filterDomCandidates([makeRow({ isVisible: null })]);
    expect(results).toHaveLength(1);
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
    const results = filterDomCandidates([
      makeRow({
        type: "div",
        tagName: "div",
        text: null,
        componentFingerprint: null,
        bbox: JSON.stringify({ x: 0, y: 0, width: 2000, height: 1600 }),
      }),
    ]);
    expect(results).toHaveLength(0);
  });
});
