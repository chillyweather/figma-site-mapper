import type {
  InteractiveElement as SharedInteractiveElement,
  TreeNode,
} from "../types";

export interface BadgeLink {
  id: string;
  text: string;
  url: string;
}

export interface FlowLink {
  id: string;
  text: string;
  url: string;
}

export interface ManifestData {
  tree: TreeNode | null;
  projectId: string;
  startUrl: string;
}

export type InteractiveElement = SharedInteractiveElement;

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

export interface CrawlParams {
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
  // Whether backend should capture only visible elements (optional, forwarded)
  captureOnlyVisibleElements?: boolean;
  auth: any;
  styleExtraction?: StyleExtractionSettings;
  projectId: string;
}
