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
  captureOnlyVisibleElements: boolean;
  auth: any;
}
