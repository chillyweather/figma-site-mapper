export interface MappingDomCandidate {
  id: string;
  pageId: string;
  type: string;
  selector?: string;
  tagName?: string;
  elementId?: string;
  classes: string[];
  bbox: { x: number; y: number; width: number; height: number };
  text?: string;
  href?: string;
  ariaLabel?: string;
  role?: string;
  cropPath?: string;
  componentFingerprint?: string;
}

export interface MappingPageEvidence {
  id: string;
  url: string;
  title: string | null;
  screenshotPaths: string[];
  viewportWidth: number | null;
  candidateCount: number;
}

export interface MappingManifest {
  schemaVersion: 1;
  projectId: string;
  generatedAt: string;
  pageCount: number;
  candidateCount: number;
}

export interface MappingWorkspaceMeta {
  schemaVersion: 1;
  generatedAt: string;
  projectId: string;
}

export interface MappingWorkspaceBuildResult {
  projectId: string;
  mappingWorkspaceRoot: string;
  pageCount: number;
  candidateCount: number;
  generatedAt: string;
}

// ── Decision types ───────────────────────────────────────────────────────────

export interface MappingComponentInstance {
  instanceId?: string;
  pageId: string;
  sourceUrl?: string;
  bbox: { x: number; y: number; width: number; height: number };
  source: "dom" | "vision";
  originSelector?: string;
  originElementId?: string;
  elementId?: string;
  confidence?: "high" | "medium" | "low";
  rawLabel?: string;
  label?: string;
  notes?: string;
}

export interface MappingComponentDecision {
  type: string;
  promotedFromOther?: boolean;
  instances: MappingComponentInstance[];
}

export interface MappingDecisionFile {
  schemaVersion: 1;
  generatedAt: string;
  projectId: string;
  components: MappingComponentDecision[];
}

export interface MappingDecisionValidationResult {
  valid: MappingComponentDecision[];
  warnings: string[];
}

// ── Render data types ────────────────────────────────────────────────────────

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
  /** Curated, display-ready element properties (DOM instances only). */
  props?: ElementPropRow[];
}

export interface ElementPropRow {
  label: string;
  value: string;
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

// ── Overview types ───────────────────────────────────────────────────────────

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
