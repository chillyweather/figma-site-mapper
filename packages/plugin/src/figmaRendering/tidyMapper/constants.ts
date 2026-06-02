// Vendored from tidy-dev-team/tidy-ds-toolbox@big-ai-refactoring, May 2026
// (src/plugins/tidy-mapper — constants.ts, sliceProcessor.ts, trailMarker.ts, createMappingPage.ts)
// Pin the upstream commit in this comment before production use.

// ── Trail frame (left on source screenshot page) ─────────────────────────────

export const TRAIL_MAGENTA: RGB = { r: 0.98, g: 0, b: 1 };
export const TRAIL_STROKE_WEIGHT = 1;
export const TRAIL_DASH_PATTERN: number[] = [8, 8];
export const TRAIL_CORNER_RADIUS = 4;

// ── Mapper page layout ────────────────────────────────────────────────────────

export const MAPPING_FRAME_PADDING = 80;
export const MAPPING_ITEM_SPACING = 120;
export const MAPPING_TITLE_FONT_SIZE = 80;
export const CONTENT_ITEM_SPACING = 40;

// ── Row layout ────────────────────────────────────────────────────────────────

export const ROW_ITEM_SPACING = 56;
export const ROW_NUMBER_FONT_SIZE = 48;

// ── Component type frame (inside each row) ────────────────────────────────────

export const TYPE_FRAME_ITEM_SPACING = 16;
export const WRAPPER_PADDING = 40;
export const WRAPPER_CORNER_RADIUS = 4;
export const WRAPPER_DASH_PATTERN: number[] = [4, 4];
export const WRAPPER_BORDER_COLOR: RGB = { r: 0.6, g: 0.6, b: 0.6 };
export const WRAPPER_BORDER_WEIGHT = 1;

// ── Rasterized image ──────────────────────────────────────────────────────────

export const IMAGE_SCALE = 2;

// ── Props column (issue #58) ──────────────────────────────────────────────────

export const PROPS_ROW_SPACING = 6;
export const PROPS_FONT_SIZE = 16;
export const PROPS_LABEL_COLOR: RGB = { r: 0.55, g: 0.55, b: 0.55 };
export const PROPS_VALUE_COLOR: RGB = { r: 0.1, g: 0.1, b: 0.1 };
export const PROPS_LABEL_VALUE_SPACING = 12;
export const PROPS_LABEL_MIN_WIDTH = 72;

// ── Link ──────────────────────────────────────────────────────────────────────

export const LINK_COLOR: RGB = { r: 0, g: 0.45, b: 0.9 };
export const LINK_FONT_SIZE = 16;
export const LINK_TEXT = "🔗 Link";

// ── Plugin-data key written on generated trail frames ─────────────────────────

export const MAPPING_TRAIL_KEY = "MAPPING_TRAIL";

// ── Page/frame name convention ────────────────────────────────────────────────

export function trailFrameName(type: string): string {
  return `${type} trail`;
}

export function mapperPageName(type: string): string {
  return type;
}

export function mappingFrameName(type: string): string {
  return `${type} mapping`;
}
