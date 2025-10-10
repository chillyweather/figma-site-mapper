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
  authMethod: "none" | "credentials" | "cookies";
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

export interface SettingsViewProps {
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
  authMethod: "none" | "credentials" | "cookies";
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
}

export interface CrawlingTabProps {
  url: string;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  jobId: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  status: string;
  handleClose: () => void;
}

export interface MappingTabProps {
  badgeLinks: BadgeLink[];
  checkedLinks: Set<string>;
  handleLinkCheck: (linkId: string, checked: boolean) => void;
  handleShowFlow: () => void;
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
