import { describe, it, expect } from "vitest";
import { computeGridPositions } from "./computeGridPositions";

const OPTS = {
  columns: 3,
  frameWidth: 1440,
  rowHeight: 8000,
  horizontalGap: 100,
  verticalGap: 200,
};

const pages = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ url: `https://example.com/${i}` }));

describe("computeGridPositions", () => {
  it("places the homepage at (0, 0)", () => {
    const { positions } = computeGridPositions(pages(3), OPTS);
    expect(positions[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("fills left-to-right across columns", () => {
    const { positions } = computeGridPositions(pages(3), OPTS);
    const step = OPTS.frameWidth + OPTS.horizontalGap;
    expect(positions[0]?.x).toBe(0);
    expect(positions[1]?.x).toBe(step);
    expect(positions[2]?.x).toBe(step * 2);
  });

  it("wraps to next row after filling columns", () => {
    const { positions } = computeGridPositions(pages(4), OPTS);
    const vStep = OPTS.rowHeight + OPTS.verticalGap;
    expect(positions[3]?.x).toBe(0);
    expect(positions[3]?.y).toBe(vStep);
  });

  it("computes correct row/col for arbitrary index", () => {
    const { positions } = computeGridPositions(pages(7), OPTS);
    // Index 6 → row 2, col 0
    expect(positions[6]?.x).toBe(0);
    expect(positions[6]?.y).toBe(2 * (OPTS.rowHeight + OPTS.verticalGap));
  });

  it("handles 1-column layout (all items stack vertically)", () => {
    const opts = { ...OPTS, columns: 1 };
    const { positions } = computeGridPositions(pages(3), opts);
    const vStep = OPTS.rowHeight + OPTS.verticalGap;
    expect(positions[0]).toMatchObject({ x: 0, y: 0 });
    expect(positions[1]).toMatchObject({ x: 0, y: vStep });
    expect(positions[2]).toMatchObject({ x: 0, y: vStep * 2 });
  });

  it("handles max-column layout where columns >= page count (all in one row)", () => {
    const opts = { ...OPTS, columns: 10 };
    const { positions } = computeGridPositions(pages(3), opts);
    const hStep = OPTS.frameWidth + OPTS.horizontalGap;
    expect(positions[0]).toMatchObject({ x: 0, y: 0 });
    expect(positions[1]).toMatchObject({ x: hStep, y: 0 });
    expect(positions[2]).toMatchObject({ x: hStep * 2, y: 0 });
  });

  it("returns no warning for a small grid well within safe zone", () => {
    // 3 cols × 3 rows = 3 rows × 8200 px = 24600 px < 55000 px
    const { projectedHeightWarning } = computeGridPositions(pages(9), OPTS);
    expect(projectedHeightWarning).toBe(false);
  });

  it("returns warning when projected height exceeds 55 000 px", () => {
    // 1 column × 7 rows × 8200 = 57400 px > 55000 px
    const opts = { ...OPTS, columns: 1 };
    const { projectedHeightWarning } = computeGridPositions(pages(7), opts);
    expect(projectedHeightWarning).toBe(true);
  });

  it("warning threshold is exactly at 55 000 px boundary", () => {
    // With 1 column and rowHeight=8000 + gap=200 = 8200 per row:
    // 6 rows = 49200 → no warning; 7 rows = 57400 → warning
    const opts = { ...OPTS, columns: 1 };
    expect(computeGridPositions(pages(6), opts).projectedHeightWarning).toBe(false);
    expect(computeGridPositions(pages(7), opts).projectedHeightWarning).toBe(true);
  });

  it("returns empty positions for empty input", () => {
    const { positions, projectedHeightWarning } = computeGridPositions([], OPTS);
    expect(positions).toHaveLength(0);
    expect(projectedHeightWarning).toBe(false);
  });

  it("url is preserved in output positions", () => {
    const input = [{ url: "https://example.com/about" }];
    const { positions } = computeGridPositions(input, OPTS);
    expect(positions[0]?.url).toBe("https://example.com/about");
  });
});
