export interface PluginSettings {
  url: string;
  maxRequests: string;
  screenshotWidth: string;
  deviceScaleFactor: string;
  delay: string;
  requestDelay: string;
  maxDepth: string;
  defaultLanguageOnly: boolean;
  fullRefresh: boolean;
  sampleSize: string;
  showBrowser: boolean;
  detectInteractiveElements: boolean;
  highlightAllElements: boolean;
  highlightElementFilters: ElementFilters;
  captureOnlyVisibleElements: boolean;
  authMethod: "none" | "manual" | "credentials" | "cookies";
  loginUrl: string;
  username: string;
  password: string;
  cookies: string;
  cookieBannerHandling: "auto" | "hide" | "off";
  // Style Extraction Settings
  extractStyles: boolean;
  styleExtractionPreset: "smart" | "minimal" | "complete" | "custom";
  // Custom options (when preset is "custom")
  extractInteractive: boolean;
  extractStructural: boolean;
  extractContentBlocks: boolean;
  extractFormElements: boolean;
  extractCustomComponents: boolean;
  extractColors: boolean;
  extractTypography: boolean;
  extractSpacing: boolean;
  extractBorders: boolean;
  extractLayout: boolean;
  extractCSSVariables: boolean;
  detectPatterns: boolean;
}

export interface Project {
  _id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export type {
  InventoryCategory,
  InventoryTokenGroup,
  InventoryDecisionSummary,
  InventoryOverview,
  InventoryDecisions,
  MappingContextSummary,
  MappingSuggestions,
} from "@sitemapper/shared";

export interface MappingInputs {
  projectId: string;
  repoPath: string;
  branchName: string;
  storybookUrl: string;
  storybookPath: string;
  uiLibrary: string;
  tokenSources: string[];
  notes: string;
}

export interface InventoryPrepareJob {
  jobId: string;
  projectId: string;
  status: "pending" | "processing" | "completed" | "failed";
  stage?: string;
  progress: number;
}

export interface FlowProgress {
  status: "idle" | "building" | "complete" | "error";
  message: string;
  progress: number;
  currentStep?: number; // Optional pointer to current step index
  totalSteps: number;
  steps: FlowStep[];
}

export interface FlowStep {
  name: string;
  status: "pending" | "in-progress" | "complete" | "error";
}

export type ElementType =
  | "heading"
  | "button"
  | "input"
  | "textarea"
  | "select"
  | "image"
  | "link"
  | "paragraph"
  | "div"
  | "other";

export interface CrawlProgress {
  status: "idle" | "crawling" | "rendering" | "complete" | "error";
  message: string;
  progress: number;
  currentPage?: number;
  totalPages?: number;
  currentUrl?: string;
  stage?: string;
}

export interface FlowLink {
  id: string;
  text: string;
  url: string;
  badgeNumber?: number;
  elementType?: "link" | "button";
}

// Mode for the Mapping/Flows view
export type ElementMode = "flow" | "styling";

export interface InteractiveElement {
  type: "link" | "button";
  x: number;
  y: number;
  width: number;
  height: number;
  href?: string;
  text?: string;
}

export interface TreeNode {
  url: string;
  title: string;
  screenshot: string[];
  thumbnail: string;
  pageId?: string;
  children: TreeNode[];
  interactiveElements?: InteractiveElement[];
  styleData?: {
    elements?: ExtractedElement[];
    cssVariables?: Record<string, unknown> | null;

  };
}

export interface ElementFilters {
  headings: boolean;
  buttons: boolean;
  inputs: boolean;
  textareas: boolean;
  selects: boolean;
  images: boolean;
  links: boolean;
  paragraphs: boolean;
  divs: boolean;
  other: boolean;
}

export interface ExtractedElement {
  selector: string;
  tagName: string;
  type: string;
  elementType?: ElementType; // Categorized type
  classes: string[];
  id?: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  styles?: {
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontFamily?: string;
    fontWeight?: string;
    lineHeight?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    borderWidth?: string;
    borderColor?: string;
    borderStyle?: string;
    display?: string;
    position?: string;
    height?: string;
  };
  text?: string;
  href?: string;
  ariaLabel?: string;
  role?: string;
  // Additional properties for future expansion
  value?: string;
  placeholder?: string;
  checked?: boolean;
  src?: string;
  alt?: string;
  styleTokens?: string[];
}

export interface CategorizedElements {
  headings: ExtractedElement[];
  buttons: ExtractedElement[];
  inputs: ExtractedElement[];
  textareas: ExtractedElement[];
  selects: ExtractedElement[];
  images: ExtractedElement[];
  links: ExtractedElement[];
  paragraphs: ExtractedElement[];
  divs: ExtractedElement[];
  other: ExtractedElement[];
}

export interface SettingsViewProps {
  url: string;
  screenshotWidth: string;
  handleScreenshotWidthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  deviceScaleFactor: string;
  handleDeviceScaleFactorChange: (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => void;
  delay: string;
  handleDelayChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  requestDelay: string;
  handleRequestDelayChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  maxRequests: string;
  handleMaxRequestsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  defaultLanguageOnly: boolean;
  fullRefresh: boolean;
  handleDefaultLanguageOnlyChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  handleFullRefreshChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showBrowser: boolean;
  handleShowBrowserChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  authMethod: "none" | "manual" | "credentials" | "cookies";
  handleAuthMethodChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  cookieBannerHandling: "auto" | "hide" | "off";
  handleCookieBannerHandlingChange: (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => void;
  authStatus: "idle" | "authenticating" | "success" | "failed" | null;
  isLoading: boolean;
  jobId: string | null;
  switchToMain: () => void;
  // Project-related props
  projects: Project[];
  activeProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onCreateProject: (name: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onRefreshProjects: () => Promise<void>;
  isProjectLoading: boolean;
  isCreatingProject: boolean;
  isDeletingProject: boolean;
  projectError: string | null;
}

export interface MainViewProps {
  activeProjectId: string | null;
  url: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  jobId: string | null;
  status: string;
  switchToSettings: () => void;
  crawlProgress: CrawlProgress;
  isRenderingSnapshot: boolean;
}

export interface CrawlingTabProps {
  url: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  jobId: string | null;
  status: string;
  crawlProgress: CrawlProgress;
  projectSelected: boolean;
  isRenderingSnapshot: boolean;
}

export interface MarkupTabProps {
  filters: ElementFilters;
  supportedFilters: Array<keyof ElementFilters>;
  onFilterChange: (filter: keyof ElementFilters, checked: boolean) => void;
  onRender: () => void;
  onClear: () => void;
  isRendering: boolean;
  status: string;
  activePage: {
    pageId: string | null;
    pageUrl: string | null;
    pageName?: string;
  } | null;
  selectedFilterCount: number;
}

export interface MappingTabProps {
  badgeLinks: FlowLink[];
  checkedLinks: Set<string>;
  handleLinkCheck: (linkId: string, checked: boolean) => void;
  handleShowFlow: () => void;
  flowProgress: FlowProgress;
  // Styling mode props
  elementMode: ElementMode;
  onElementModeChange: (mode: ElementMode) => void;
  categorizedElements: CategorizedElements | null;
  elementFilters: ElementFilters;
  onElementFilterChange: (
    elementType: keyof ElementFilters,
    checked: boolean
  ) => void;
  handleShowStyling: () => void;
  manifestData: any;
  selectedPageUrl: string;
  onPageSelection: (pageUrl: string) => void;
  handleRenderSnapshot: () => void;
  isRenderingSnapshot: boolean;
}

export interface FocusedInputProps {
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  min?: string;
  max?: string;
}

export interface FocusedTextareaProps {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// ── Discovery flow types ────────────────────────────────────────────

export type CrawlMode = "recommended" | "exact";

export type DiscoveryMode = "fast" | "full";

export type DiscoveryPhase =
  | "idle"
  | "discovering"
  | "reviewing"
  | "capturing"
  | "complete"
  | "error";

export interface DiscoveryCandidate {
  id: string;
  url: string;
  normalizedUrl: string;
  host: string;
  pageType: string;
  patternKey: string;
  score: number;
  reasons: string[];
  source: string;
  depth?: number;
  isRecommended: boolean;
  isApproved: boolean;
  isExcluded: boolean;
}

export interface DiscoveryRunSummary {
  totalCandidates: number;
  recommendedCount: number;
  byPageType: Record<string, number>;
  byHost: Record<string, number>;
  warnings?: string[];
}

export interface DiscoveryResult {
  discoveryRunId: string;
  projectId: string;
  status: string;
  candidates: DiscoveryCandidate[];
  recommended: DiscoveryCandidate[];
  summary: DiscoveryRunSummary;
}

// ── Flow Builder types ────────────────────────────────────────────────

export type TargetStatus =
  | "captured"
  | "needs-capture"
  | "external"
  | "same-page-anchor"
  | "no-target";

export type ActionKind = "link" | "button" | "input" | "other";

export interface FlowAction {
  elementId: string;
  label: string;
  elementType: string;
  tagName: string;
  targetUrl: string | null;
  targetStatus: TargetStatus;
  targetPageId: string | null;
  selector: string | null;
  regionLabel: string | null;
  role: string | null;
  bbox: { x: number; y: number; width: number; height: number } | null;
}

export interface FlowDraftStep {
  sourcePageId: string;
  sourceUrl: string;
  sourceTitle: string;
  elementId: string | null;
  elementSelector: string | null;
  elementText: string | null;
  elementBbox: { x: number; y: number; width: number; height: number } | null;
  actionLabel: string;
  actionKind: ActionKind;
  targetUrl: string | null;
  targetPageId: string | null;
  targetStatus: TargetStatus;
}

export interface FlowRecord {
  _id: string;
  id: number;
  projectId: string;
  name: string;
  description: string;
  status: string;
  stepCount?: number;
  steps?: FlowStepRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface FlowStepRecord {
  _id: string;
  id: number;
  flowId: string;
  stepIndex: number;
  sourcePageId: string;
  sourceUrl: string;
  elementId?: string;
  elementSelector?: string;
  elementText?: string;
  elementBbox?: { x: number; y: number; width: number; height: number };
  targetUrl?: string;
  targetPageId?: string;
  actionKind: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveScreenshotPage {
  pageId: string;
  pageUrl: string;
  pageName: string;
  projectId: string;
}

// ── Extension flow import types ───────────────────────────────────────────────

export interface RecordedFlowAction {
  type: "click";
  tagName: string;
  text?: string;
  ariaLabel?: string;
  role?: string;
  href?: string;
  selector?: string;
  cssPath?: string;
  elementId?: string;
  classes?: string[];
  bbox: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
}

export interface RecordedFlowStep {
  index: number;
  sourceUrl: string;
  sourceTitle?: string;
  startedAt: string;
  action: RecordedFlowAction;
  targetUrl?: string;
  completedAt?: string;
  navigation?: {
    transitionType?: string;
    transitionQualifiers?: string[];
    status: "completed" | "same-page" | "no-navigation" | "unknown";
  };
}

export interface RecordedFlowTrace {
  version: 1;
  name: string;
  origin: "chrome-extension";
  startedAt: string;
  completedAt?: string;
  browser?: {
    userAgent?: string;
    viewport?: { width: number; height: number; devicePixelRatio: number };
  };
  steps: RecordedFlowStep[];
}

export type ImportedFlowCaptureStatus =
  | "idle"
  | "capturing"
  | "complete"
  | "error";

export interface ImportedFlowEntry {
  id: string;
  name: string;
  trace: RecordedFlowTrace;
  captureStatus: ImportedFlowCaptureStatus;
  captureProgress: number;
  captureMessage?: string;
  savedFlowId?: string;
}
