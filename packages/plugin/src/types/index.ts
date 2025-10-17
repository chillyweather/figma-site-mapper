export interface PluginSettings {
  url: string;
  maxRequests: string;
  screenshotWidth: string;
  deviceScaleFactor: string;
  delay: string;
  requestDelay: string;
  maxDepth: string;
  defaultLanguageOnly: boolean;
  sampleSize: string;
  showBrowser: boolean;
  detectInteractiveElements: boolean;
  captureOnlyVisibleElements: boolean;
  authMethod: "none" | "manual" | "credentials" | "cookies";
  loginUrl: string;
  username: string;
  password: string;
  cookies: string;
}

export interface BadgeLink {
  id: string;
  text: string;
  url: string;
}

export interface FlowProgress {
  status: "idle" | "building" | "complete" | "error";
  message: string;
  progress: number;
  currentStep: number;
  totalSteps: number;
  steps: FlowStep[];
}

export interface FlowStep {
  name: string;
  status: "pending" | "in-progress" | "complete" | "error";
}

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
  handleDefaultLanguageOnlyChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  showBrowser: boolean;
  handleShowBrowserChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  detectInteractiveElements: boolean;
  handleDetectInteractiveElementsChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  captureOnlyVisibleElements: boolean;
  handleCaptureOnlyVisibleElementsChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  authMethod: "none" | "manual" | "credentials" | "cookies";
  handleAuthMethodChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  loginUrl: string;
  handleLoginUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  username: string;
  handleUsernameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  password: string;
  handlePasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cookies: string;
  handleCookiesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  authStatus: "idle" | "authenticating" | "success" | "failed";
  isLoading: boolean;
  jobId: string | null;
  switchToMain: () => void;
}

export interface MainViewProps {
  url: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  jobId: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  status: string;
  handleClose: () => void;
  switchToSettings: () => void;
  badgeLinks: BadgeLink[];
  checkedLinks: Set<string>;
  handleLinkCheck: (linkId: string, checked: boolean) => void;
  handleShowFlow: () => void;
  flowProgress: FlowProgress;
  crawlProgress: CrawlProgress;
}

export interface CrawlingTabProps {
  url: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  jobId: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  status: string;
  handleClose: () => void;
  crawlProgress: CrawlProgress;
}

export interface MappingTabProps {
  badgeLinks: BadgeLink[];
  checkedLinks: Set<string>;
  handleLinkCheck: (linkId: string, checked: boolean) => void;
  handleShowFlow: () => void;
  flowProgress: FlowProgress;
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
