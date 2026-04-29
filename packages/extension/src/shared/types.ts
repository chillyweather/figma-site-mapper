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

// Messages between content script and background
export type ContentMessage =
  | { type: "CLICK_EVENT"; payload: ClickPayload }
  | { type: "SPA_NAVIGATION"; payload: SpaNavPayload }
  | { type: "GET_RECORDING_STATE" };

export interface ClickPayload {
  url: string;
  title: string;
  timestamp: string;
  action: RecordedFlowAction;
}

export interface SpaNavPayload {
  url: string;
  timestamp: string;
}

// Background storage state
export interface RecordingState {
  isRecording: boolean;
  startedAt: string | null;
  steps: RecordedFlowStep[];
  pendingClick: {
    payload: ClickPayload;
    timeoutTs: number;
  } | null;
}
