export type PluginMessageType =
  | "start-crawl"
  | "save-settings"
  | "load-settings"
  | "get-status"
  | "show-flow"
  | "close"
  | "crawl-started"
  | "settings-loaded"
  | "status-update"
  | "badge-links-update";

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
  auth: AuthData | null;
}

export interface AuthData {
  method: "credentials" | "cookies";
  loginUrl?: string;
  username?: string;
  password?: string;
  cookies?: Array<{ name: string; value: string }>;
}

export interface DetailedProgress {
  stage: string;
  currentPage?: number;
  totalPages?: number;
  currentUrl?: string;
  progress?: number;
}
