export interface GridPage {
  url: string;
}

export interface GridOptions {
  columns: number;
  frameWidth: number;
  rowHeight: number;
  horizontalGap: number;
  verticalGap: number;
}

export interface GridPosition {
  url: string;
  x: number;
  y: number;
}

export interface GridResult {
  positions: GridPosition[];
  /** True when the projected canvas height exceeds the Figma coordinate safe zone. */
  projectedHeightWarning: boolean;
}

const SAFE_HEIGHT_LIMIT_PX = 55_000;

export function computeGridPositions(
  pages: GridPage[],
  opts: GridOptions
): GridResult {
  const { columns, frameWidth, rowHeight, horizontalGap, verticalGap } = opts;
  const safeColumns = Math.max(1, Math.floor(columns));
  const positions: GridPosition[] = [];

  for (let i = 0; i < pages.length; i++) {
    const col = i % safeColumns;
    const row = Math.floor(i / safeColumns);
    positions.push({
      url: pages[i]!.url,
      x: col * (frameWidth + horizontalGap),
      y: row * (rowHeight + verticalGap),
    });
  }

  const rowCount = Math.ceil(pages.length / safeColumns);
  const projectedHeight = rowCount * (rowHeight + verticalGap);

  return {
    positions,
    projectedHeightWarning: projectedHeight > SAFE_HEIGHT_LIMIT_PX,
  };
}
