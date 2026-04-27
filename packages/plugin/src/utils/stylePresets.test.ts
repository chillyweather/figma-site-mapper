import { describe, it, expect } from "vitest";
import { STYLE_PRESETS, toBackendStyleFields } from "./stylePresets";

describe("toBackendStyleFields", () => {
  it("renames extractInteractive to extractInteractiveElements", () => {
    const result = toBackendStyleFields(STYLE_PRESETS.smart);
    expect(result.extractInteractiveElements).toBe(
      STYLE_PRESETS.smart.extractInteractive
    );
  });

  it("renames extractStructural to extractStructuralElements", () => {
    const result = toBackendStyleFields(STYLE_PRESETS.smart);
    expect(result.extractStructuralElements).toBe(
      STYLE_PRESETS.smart.extractStructural
    );
  });

  it("renames extractContentBlocks to extractTextElements", () => {
    const result = toBackendStyleFields(STYLE_PRESETS.smart);
    expect(result.extractTextElements).toBe(
      STYLE_PRESETS.smart.extractContentBlocks
    );
  });

  it("renames extractCustomComponents to extractMediaElements", () => {
    const result = toBackendStyleFields(STYLE_PRESETS.smart);
    expect(result.extractMediaElements).toBe(
      STYLE_PRESETS.smart.extractCustomComponents
    );
  });

  it("passes through unchanged fields", () => {
    const result = toBackendStyleFields(STYLE_PRESETS.smart);
    expect(result.extractFormElements).toBe(STYLE_PRESETS.smart.extractFormElements);
    expect(result.extractColors).toBe(STYLE_PRESETS.smart.extractColors);
    expect(result.extractTypography).toBe(STYLE_PRESETS.smart.extractTypography);
    expect(result.extractSpacing).toBe(STYLE_PRESETS.smart.extractSpacing);
    expect(result.extractLayout).toBe(STYLE_PRESETS.smart.extractLayout);
    expect(result.extractBorders).toBe(STYLE_PRESETS.smart.extractBorders);
  });

  it("works with the minimal preset too", () => {
    const result = toBackendStyleFields(STYLE_PRESETS.minimal);
    expect(result.extractStructuralElements).toBe(false);
    expect(result.extractInteractiveElements).toBe(true);
  });
});
