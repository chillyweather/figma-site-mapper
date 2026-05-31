import type {
  InteractiveElement as SharedInteractiveElement,
  TreeNode,
} from "../types";

export interface BadgeLink {
  id: string;
  text: string;
  url: string;
  badgeNumber?: number;
  elementType?: "link" | "button";
}

export interface FlowLink {
  id: string;
  text: string;
  url: string;
  badgeNumber?: number;
  elementType?: "link" | "button";
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

// ── Mapping types (shared between plugin UI and figmaRendering) ───────────────

export interface MappingRenderInstance {
  instanceId: string;
  elementId?: string;
  pageId: string;
  pageUrl: string;
  bbox: { x: number; y: number; width: number; height: number };
  source: "dom" | "vision";
  confidence?: string;
  rawLabel?: string;
  label?: string;
  notes?: string;
  screenshotPaths: string[];
  viewportWidth: number | null;
}

export interface MappingRenderComponent {
  type: string;
  instanceCount: number;
  instances: MappingRenderInstance[];
}

export interface MappingRenderData {
  projectId: string;
  hasMappingWorkspace: boolean;
  hasDecisions: boolean;
  lastPreparedAt: string | null;
  lastDecisionsAt: string | null;
  components: MappingRenderComponent[];
  warnings: string[];
}

export interface MappingOverview {
  projectId: string;
  mappingWorkspaceRoot: string;
  hasMappingWorkspace: boolean;
  hasDecisions: boolean;
  lastPreparedAt: string | null;
  lastDecisionsAt: string | null;
  pageCount: number;
  candidateCount: number;
  componentTypeCount: number;
  instanceCount: number;
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
  fullRefresh: boolean;
  sampleSize: number;
  showBrowser: boolean;
  detectInteractiveElements: boolean;
  // Whether backend should capture only visible elements (optional, forwarded)
  captureOnlyVisibleElements?: boolean;
  auth: any;
  cookieBannerHandling?: "auto" | "hide" | "off";
  captureProfile?: "standard" | "visual-complete";
  styleExtraction?: StyleExtractionSettings;
  projectId: string;
}
