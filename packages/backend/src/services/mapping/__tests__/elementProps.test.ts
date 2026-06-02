import { describe, it, expect } from "vitest";
import { summarizeElementProps, rgbToHex } from "../elementProps.js";

// Realistic styles object as captured by the crawler for the "Start free trial"
// button (element 265108 in project 4).
const BUTTON_STYLES: Record<string, string> = {
  color: "rgb(255, 255, 255)",
  "background-color": "rgb(255, 23, 107)",
  "font-size": "16px",
  "font-family": "Inter, sans-serif",
  "font-weight": "500",
  "line-height": "8px",
  "letter-spacing": "normal",
  "border-width": "0px",
  "border-style": "none",
  "border-color": "rgb(229, 231, 235)",
  "border-radius": "10px",
  "box-shadow": "none",
  width: "151.188px",
  height: "42px",
};

function rowMap(styles: Record<string, string> | null, bbox?: { width: number; height: number }) {
  return Object.fromEntries(summarizeElementProps(styles, bbox).map((r) => [r.label, r.value]));
}

describe("rgbToHex", () => {
  it("converts rgb() to uppercase #RRGGBB", () => {
    expect(rgbToHex("rgb(255, 23, 107)")).toBe("#FF176B");
    expect(rgbToHex("rgb(0, 0, 0)")).toBe("#000000");
  });

  it("converts rgba() and notes sub-1 alpha", () => {
    expect(rgbToHex("rgba(0, 0, 0, 0.1)")).toBe("#000000 10%");
  });

  it("treats fully transparent colors as no color", () => {
    expect(rgbToHex("rgba(0, 0, 0, 0)")).toBeNull();
  });

  it("normalises existing hex case and leaves it intact", () => {
    expect(rgbToHex("#ff176b")).toBe("#FF176B");
  });
});

describe("summarizeElementProps", () => {
  it("produces the curated rows in order for a full styles object", () => {
    const rows = summarizeElementProps(BUTTON_STYLES, { width: 151.188, height: 42 });
    expect(rows).toEqual([
      { label: "Size", value: "151×42" },
      { label: "Radius", value: "10px" },
      { label: "Font", value: "Inter 16px / 500" },
      { label: "Line", value: "8px" },
      { label: "Text", value: "#FFFFFF" },
      { label: "Bg", value: "#FF176B" },
    ]);
  });

  it("rounds sub-pixel bbox dimensions for the Size row", () => {
    expect(rowMap(null, { width: 151.6, height: 41.6 }).Size).toBe("152×42");
  });

  it("omits the Size row when no bbox is supplied", () => {
    expect(rowMap(BUTTON_STYLES).Size).toBeUndefined();
  });

  it("drops noise values (none / normal / auto) instead of emitting rows", () => {
    const rows = rowMap({
      "border-radius": "0px",
      "border-style": "none",
      "border-width": "0px",
      "box-shadow": "none",
      "line-height": "normal",
      color: "rgb(10, 20, 30)",
    });
    expect(rows.Radius).toBeUndefined();
    expect(rows.Border).toBeUndefined();
    expect(rows.Shadow).toBeUndefined();
    expect(rows.Line).toBeUndefined();
    expect(rows.Text).toBe("#0A141E");
  });

  it("returns an empty array for null or non-object styles", () => {
    expect(summarizeElementProps(null)).toEqual([]);
    expect(summarizeElementProps(undefined, null)).toEqual([]);
    expect(summarizeElementProps({}, { width: 0, height: 0 })).toEqual([]);
  });

  it("emits only the rows for which data is present (partial styles)", () => {
    const rows = rowMap({ "font-size": "14px", "background-color": "rgb(0, 128, 255)" });
    expect(rows).toEqual({ Font: "14px", Bg: "#0080FF" });
  });

  it("drops the default 400 weight but keeps a non-default weight", () => {
    expect(rowMap({ "font-family": "Arial", "font-weight": "400" }).Font).toBe("Arial");
    expect(rowMap({ "font-family": "Arial", "font-weight": "700" }).Font).toBe("Arial / 700");
  });

  it("summarises a real border and hex-ifies its color", () => {
    const rows = rowMap({
      "border-width": "1px",
      "border-style": "solid",
      "border-color": "rgb(229, 231, 235)",
    });
    expect(rows.Border).toBe("1px solid #E5E7EB");
  });

  it("renders a box-shadow with hex colors and rounded offsets", () => {
    const rows = rowMap({ "box-shadow": "rgba(0, 0, 0, 0.1) 0px 4.4px 6px" });
    expect(rows.Shadow).toBe("#000000 10% 0px 4px 6px");
  });
});
