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
  children: TreeNode[];
  interactiveElements?: InteractiveElement[];
  styleData?: {
    elements?: ExtractedElement[];
    cssVariables?: Record<string, unknown> | null;
    tokens?: string[] | null;
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
  maxDepth: string;
  handleMaxDepthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sampleSize: string;
  handleSampleSizeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  defaultLanguageOnly: boolean;
  fullRefresh: boolean;
  handleDefaultLanguageOnlyChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  handleFullRefreshChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showBrowser: boolean;
  handleShowBrowserChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  detectInteractiveElements: boolean;
  handleDetectInteractiveElementsChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  highlightAllElements: boolean;
  handleHighlightAllElementsChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  highlightElementFilters: ElementFilters;
  handleHighlightFilterChange: (
    elementType: keyof ElementFilters,
    checked: boolean
  ) => void;
  captureOnlyVisibleElements: boolean;
  handleCaptureOnlyVisibleElementsChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  authMethod: "none" | "manual" | "credentials" | "cookies";
  handleAuthMethodChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  authStatus: "idle" | "authenticating" | "success" | "failed" | null;
  isLoading: boolean;
  jobId: string | null;
  switchToMain: () => void;
  // Style Extraction props
  extractStyles: boolean;
  handleExtractStylesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  styleExtractionPreset: "smart" | "minimal" | "complete" | "custom";
  handleStyleExtractionPresetChange: (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => void;
  // Custom extraction options (visible when preset is "custom")
  extractInteractive: boolean;
  handleExtractInteractiveChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  extractStructural: boolean;
  handleExtractStructuralChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  extractContentBlocks: boolean;
  handleExtractContentBlocksChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  extractFormElements: boolean;
  handleExtractFormElementsChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  extractCustomComponents: boolean;
  handleExtractCustomComponentsChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  extractColors: boolean;
  handleExtractColorsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  extractTypography: boolean;
  handleExtractTypographyChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  extractSpacing: boolean;
  handleExtractSpacingChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  extractBorders: boolean;
  handleExtractBordersChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  extractLayout: boolean;
  handleExtractLayoutChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  extractCSSVariables: boolean;
  handleExtractCSSVariablesChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  detectPatterns: boolean;
  handleDetectPatternsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface MainViewProps {
  projects: Project[];
  activeProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onCreateProject: (name: string) => Promise<void>;
  onRefreshProjects: () => Promise<void>;
  isProjectLoading: boolean;
  isCreatingProject: boolean;
  projectError: string | null;
  url: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  jobId: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  status: string;
  handleClose: () => void;
  switchToSettings: () => void;
  badgeLinks: FlowLink[];
  checkedLinks: Set<string>;
  handleLinkCheck: (linkId: string, checked: boolean) => void;
  handleShowFlow: () => void;
  flowProgress: FlowProgress;
  crawlProgress: CrawlProgress;
  // Element styling props
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
}

export interface CrawlingTabProps {
  url: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  jobId: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  handleRenderSnapshot: () => void;
  status: string;
  handleClose: () => void;
  crawlProgress: CrawlProgress;
  projectSelected: boolean;
  isRenderingSnapshot: boolean;
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
