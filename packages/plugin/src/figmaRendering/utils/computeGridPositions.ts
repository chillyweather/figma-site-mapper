export interface GridPage {
  url: string;
  height: number;
}

export interface GridOptions {
  columns: number;
  frameWidth: number;
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
  projectedHeight: number;
}

const SAFE_HEIGHT_LIMIT_PX = 55_000;

export function computeGridPositions(
  pages: GridPage[],
  opts: GridOptions
): GridResult {
  const { columns, frameWidth, horizontalGap, verticalGap } = opts;
  const safeColumns = Math.max(1, Math.floor(columns));
  const positions: GridPosition[] = [];
  const rowHeights: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    const col = i % safeColumns;
    const row = Math.floor(i / safeColumns);
    if (col === 0 && row > 0) {
      const previousRowHeight = rowHeights[row - 1] ?? 0;
      const previousRowY = positions[i - safeColumns]?.y ?? 0;
      rowHeights[row] = 0;
      positions.push({
        url: pages[i]!.url,
        x: 0,
        y: previousRowY + previousRowHeight + verticalGap,
      });
    } else {
      positions.push({
        url: pages[i]!.url,
        x: col * (frameWidth + horizontalGap),
        y: row === 0 ? 0 : positions[i - col]!.y,
      });
    }

    rowHeights[row] = Math.max(rowHeights[row] ?? 0, pages[i]!.height);
  }

  const projectedHeight =
    positions.length === 0
      ? 0
      : Math.max(
          ...positions.map((position, index) => position.y + pages[index]!.height)
        );

  return {
    positions,
    projectedHeight,
    projectedHeightWarning: projectedHeight > SAFE_HEIGHT_LIMIT_PX,
  };
}
