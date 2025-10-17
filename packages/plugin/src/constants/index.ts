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
};

export const SETTINGS_KEY = "figma-sitemapper-settings";
export const BACKEND_URL = "http://localhost:3006";
