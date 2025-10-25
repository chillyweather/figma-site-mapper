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
  tree: {
    url: string;
    title: string;
    screenshot: string[];
    thumbnail: string;
    children: any[];
    interactiveElements?: InteractiveElement[];
  };
}

export interface InteractiveElement {
  type: "link" | "button";
  x: number;
  y: number;
  width: number;
  height: number;
  href?: string;
  text?: string;
}

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
}
