import { PluginSettings } from "../types";

export const DEFAULT_SETTINGS: PluginSettings = {
  url: "",
  maxRequests: "10",
  screenshotWidth: "1440",
  deviceScaleFactor: "1",
  delay: "0",
  requestDelay: "1000",
  maxDepth: "2",
  defaultLanguageOnly: true,
  sampleSize: "3",
  showBrowser: false,
  detectInteractiveElements: true,
  captureOnlyVisibleElements: true,
  authMethod: "none",
  loginUrl: "",
  username: "",
  password: "",
  cookies: "",
  // Style Extraction - OFF by default, user opts in
  extractStyles: false,
  styleExtractionPreset: "smart",
  // Custom preset defaults (smart preset values)
  extractInteractive: true,
  extractStructural: true,
  extractContentBlocks: true,
  extractFormElements: true,
  extractCustomComponents: false,
  extractColors: true,
  extractTypography: true,
  extractSpacing: true,
  extractBorders: true,
  extractLayout: true,
  extractCSSVariables: true,
  detectPatterns: true,
};

export const SETTINGS_KEY = "figma-sitemapper-settings";
export const BACKEND_URL = "http://localhost:3006";
