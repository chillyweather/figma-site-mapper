/**
 * Style Extraction Presets
 *
 * Defines what gets extracted for each preset mode
 */

export interface StyleExtractionConfig {
  extractInteractive: boolean;
  extractStructural: boolean;
  extractContentBlocks: boolean;
  extractFormElements: boolean;
  extractCustomComponents: boolean;
  extractColors: boolean;
  extractTypography: boolean;
  extractSpacing: boolean;
  extractBorders: boolean;
  extractLayout: boolean;
  extractCSSVariables: boolean;
  detectPatterns: boolean;
}

export const STYLE_PRESETS: Record<
  "smart" | "minimal" | "complete",
  StyleExtractionConfig
> = {
  // Smart: Interactive + Structural + Styled elements (recommended)
  smart: {
    extractInteractive: true,
    extractStructural: true,
    extractContentBlocks: true,
    extractFormElements: true,
    extractCustomComponents: false, // Skip heuristic detection
    extractColors: true,
    extractTypography: true,
    extractSpacing: true,
    extractBorders: true,
    extractLayout: true,
    extractCSSVariables: true,
    detectPatterns: true,
  },

  // Minimal: Interactive elements only (smallest data size)
  minimal: {
    extractInteractive: true,
    extractStructural: false,
    extractContentBlocks: false,
    extractFormElements: true,
    extractCustomComponents: false,
    extractColors: true,
    extractTypography: true,
    extractSpacing: true,
    extractBorders: true,
    extractLayout: false,
    extractCSSVariables: false,
    detectPatterns: false,
  },

  // Complete: All visible elements (largest data size)
  complete: {
    extractInteractive: true,
    extractStructural: true,
    extractContentBlocks: true,
    extractFormElements: true,
    extractCustomComponents: true,
    extractColors: true,
    extractTypography: true,
    extractSpacing: true,
    extractBorders: true,
    extractLayout: true,
    extractCSSVariables: true,
    detectPatterns: true,
  },
};

/**
 * Get preset configuration by name
 */
export function getPresetConfig(
  preset: "smart" | "minimal" | "complete" | "custom"
): StyleExtractionConfig | null {
  if (preset === "custom") {
    return null; // Custom means user has manually configured
  }
  return STYLE_PRESETS[preset];
}

/**
 * Estimate data size impact based on configuration
 */
export function estimateDataSize(
  config: StyleExtractionConfig,
  pageCount: number
): string {
  let sizePerPage = 0;

  // Base overhead
  sizePerPage += 5; // 5KB base

  // Element types (affects number of elements extracted)
  let elementMultiplier = 0;
  if (config.extractInteractive) elementMultiplier += 1;
  if (config.extractStructural) elementMultiplier += 0.5;
  if (config.extractContentBlocks) elementMultiplier += 1;
  if (config.extractFormElements) elementMultiplier += 0.5;
  if (config.extractCustomComponents) elementMultiplier += 2; // Expensive

  sizePerPage += elementMultiplier * 15; // ~15KB per element type category

  // Style properties
  let styleMultiplier = 0;
  if (config.extractColors) styleMultiplier += 1;
  if (config.extractTypography) styleMultiplier += 1;
  if (config.extractSpacing) styleMultiplier += 0.5;
  if (config.extractBorders) styleMultiplier += 0.5;
  if (config.extractLayout) styleMultiplier += 0.5;

  sizePerPage += styleMultiplier * 5; // ~5KB per style category

  // Additional features
  if (config.extractCSSVariables) sizePerPage += 10;
  if (config.detectPatterns) sizePerPage += 5;

  const totalSize = sizePerPage * pageCount;

  if (totalSize < 100) {
    return `~${Math.round(totalSize)}KB`;
  } else if (totalSize < 1000) {
    return `~${Math.round(totalSize / 10) * 10}KB`;
  } else {
    return `~${(totalSize / 1024).toFixed(1)}MB`;
  }
}
