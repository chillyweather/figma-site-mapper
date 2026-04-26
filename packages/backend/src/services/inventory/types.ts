export type InventoryCategory =
  | "button"
  | "link"
  | "input"
  | "select"
  | "textarea"
  | "heading"
  | "image"
  | "text-block"
  | "other";

export type InventoryTokenGroup =
  | "color"
  | "typography"
  | "spacing"
  | "radius"
  | "shadow";

export interface ParsedInventoryPage {
  id: string;
  projectId: string;
  url: string;
  title: string;
  cssVariables: Record<string, string>;
  tokens: string[];
  annotatedScreenshotPath?: string;
}

export interface ParsedInventoryElement {
  id: string;
  pageId: string;
  projectId: string;
  type: string;
  selector?: string;
  tagName?: string;
  elementId?: string;
  classes: string[];
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  href?: string;
  text?: string;
  styles: Record<string, unknown>;
  styleTokens: string[];
  ariaLabel?: string;
  role?: string;
  parentTag?: string;
  parentSelector?: string;
  ancestryPath?: string;
  nearestInteractiveSelector?: string;
  isVisible?: boolean;
  regionLabel?: string;
  styleSignature?: string;
  componentFingerprint?: string;
  parentFingerprint?: string;
  childCount?: number;
  cropPath?: string;
  cropContextPath?: string;
  cropError?: string;
  isGlobalChrome?: boolean;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  src?: string;
  alt?: string;
}

export interface InventorySummary {
  pageCount: number;
  elementCount: number;
  clusterCount: number;
  tokenCandidateCount: number;
  inconsistencyCount: number;
}

export interface InventoryTokenCandidate {
  candidateId: string;
  group: InventoryTokenGroup;
  property: string;
  value: string;
  usageCount: number;
  pageCount: number;
  interactiveUsageCount: number;
  categoriesUsedIn: InventoryCategory[];
  tokenBacked: boolean;
  cssVariableNames: string[];
  styleTokenNames: string[];
}

export interface InventoryTokenFrequency {
  value: string;
  type: string;
  usageCount: number;
  pageCount: number;
  pageIds: string[];
  categoriesUsedIn: InventoryCategory[];
  interactiveUsageCount: number;
  tokenBacked: boolean;
  cssVariableSources: string[];
  styleTokenSources: string[];
  exampleElementIds: string[];
  representativeOccurrences: InventoryTokenOccurrence[];
}

export interface InventoryTokenOccurrence {
  pageId: string;
  elementId: string;
  bbox: [number, number, number, number];
  classKey: string;
  tagName: string;
}

export interface InventoryTokenFrequencyTable {
  colors: InventoryTokenFrequency[];
  typography: InventoryTokenFrequency[];
  spacing: InventoryTokenFrequency[];
  radii: InventoryTokenFrequency[];
  shadows: InventoryTokenFrequency[];
}

export interface InventoryCluster {
  clusterId: string;
  familyId: string;
  category: InventoryCategory;
  label: string;
  confidence: number;
  instanceCount: number;
  pageCount: number;
  signature: Record<string, string>;
  variantHints: string[];
  variantAxes: Array<{
    name: string;
    values: string[];
    currentValue?: string;
  }>;
  canonicalElementId?: string;
  canonicalCropPath?: string;
  exampleElementIds: string[];
  exampleCropPaths: string[];
  memberElementIds: string[];
  pageIds: string[];
}

export interface InventoryRegionInsight {
  regionLabel: string;
  pageCount: number;
  elementCount: number;
  prevalence: number;
  topCategories: InventoryCategory[];
}

export interface InventoryTemplateInsight {
  templateId: string;
  label: string;
  pageCount: number;
  pageIds: string[];
  sampleUrls: string[];
}

export interface InventoryInconsistency {
  inconsistencyId: string;
  type:
    | "near-duplicate-clusters"
    | "cluster-outlier"
    | "untokenized-frequent-value";
  category: InventoryCategory | "token";
  summary: string;
  impactScore: number;
  exampleElementIds: string[];
  clusterIds: string[];
  pageIds: string[];
}

export interface InventoryOverview {
  projectId: string;
  summary: InventorySummary;
  topClusters: InventoryCluster[];
  topTokenCandidates: InventoryTokenCandidate[];
  topInconsistencies: InventoryInconsistency[];
  topRegions: InventoryRegionInsight[];
  templates: InventoryTemplateInsight[];
}
