export type PluginMessageType =
  | "start-crawl"
  | "save-settings"
  | "load-settings"
  | "get-status"
  | "show-flow"
  | "show-styling-elements"
  | "close"
  | "crawl-started"
  | "settings-loaded"
  | "status-update"
  | "badge-links-update"
  | "open-auth-session";

export interface StyleExtractionSettings {
  enabled: boolean;
  preset: "smart" | "minimal" | "complete" | "custom";
  extractInteractiveElements: boolean;
  extractStructuralElements: boolean;
  extractTextElements: boolean;
  extractFormElements: boolean;
  extractMediaElements: boolean;
  extractColors: boolean;
  extractTypography: boolean;
  extractSpacing: boolean;
  extractLayout: boolean;
  extractBorders: boolean;
  includeSelectors: boolean;
  includeComputedStyles: boolean;
}

export interface CrawlStartMessage {
  type: "start-crawl";
  url: string;
  maxRequestsPerCrawl?: number;
  screenshotWidth: number;
  deviceScaleFactor: number;
  delay: number;
  requestDelay: number;
  maxDepth: number;
  defaultLanguageOnly: boolean;
  sampleSize: number;
  showBrowser: boolean;
  detectInteractiveElements: boolean;
  captureOnlyVisibleElements: boolean;
  auth: AuthData | null;
  styleExtraction?: StyleExtractionSettings;
}

export interface AuthData {
  method: "manual" | "credentials" | "cookies";
  loginUrl?: string;
  username?: string;
  password?: string;
  cookies?: Array<{ name: string; value: string }>;
}

export interface OpenAuthSessionMessage {
  type: "open-auth-session";
  url: string;
}

export interface DetailedProgress {
  stage: string;
  currentPage?: number;
  totalPages?: number;
  currentUrl?: string;
  progress?: number;
}
