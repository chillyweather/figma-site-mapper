import type { RecordingState, ContentMessage, ClickPayload, RecordedFlowStep } from "./shared/types";

const STORAGE_KEY = "sitemapper_recording_state";

async function getState(): Promise<RecordingState> {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? {
    isRecording: false,
    startedAt: null,
    steps: [],
    pendingClick: null,
  };
}

async function setState(state: RecordingState): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: state });
}

async function flushPendingClick(state: RecordingState, targetUrl?: string): Promise<RecordingState> {
  if (!state.pendingClick) return state;

  const { payload } = state.pendingClick;
  const step: RecordedFlowStep = {
    index: state.steps.length,
    sourceUrl: payload.url,
    sourceTitle: payload.title,
    startedAt: payload.timestamp,
    action: payload.action,
    completedAt: new Date().toISOString(),
    targetUrl,
    navigation: targetUrl
      ? { status: targetUrl !== payload.url ? "completed" : "same-page" }
      : { status: "no-navigation" },
  };

  return { ...state, steps: [...state.steps, step], pendingClick: null };
}

function buildTrace(state: RecordingState, name: string) {
  return {
    version: 1 as const,
    name,
    origin: "chrome-extension" as const,
    startedAt: state.startedAt ?? new Date().toISOString(),
    completedAt: new Date().toISOString(),
    browser: { userAgent: navigator.userAgent },
    steps: state.steps,
  };
}

// Single onMessage listener handles all message types
chrome.runtime.onMessage.addListener((message: ContentMessage & { type: string; name?: string }, _sender, sendResponse) => {
  (async () => {
    const state = await getState();

    // ── Popup control messages ──────────────────────────────────────────────

    if (message.type === "START_RECORDING") {
      if (state.isRecording) { sendResponse({ ok: false, error: "already recording" }); return; }
      await setState({ isRecording: true, startedAt: new Date().toISOString(), steps: [], pendingClick: null });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "STOP_RECORDING") {
      const flushed = state.pendingClick ? await flushPendingClick(state) : state;
      await setState({ ...flushed, isRecording: false });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "GET_TRACE") {
      sendResponse({ state });
      return;
    }

    if (message.type === "CLEAR_RECORDING") {
      await setState({ isRecording: false, startedAt: null, steps: [], pendingClick: null });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "SEND_TO_BACKEND") {
      const trace = buildTrace(state, message.name ?? "Recorded Flow");
      try {
        const res = await fetch("http://localhost:3006/flows/import-trace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trace),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { flowId?: string };
        sendResponse({ ok: true, flowId: data.flowId });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
      return;
    }

    // ── Content script messages (only processed while recording) ───────────

    if (message.type === "GET_RECORDING_STATE") {
      sendResponse({ isRecording: state.isRecording, stepCount: state.steps.length });
      return;
    }

    if (!state.isRecording) {
      sendResponse({ ok: false });
      return;
    }

    if (message.type === "CLICK_EVENT") {
      // Flush any previous pending click that never received a navigation
      const flushed = state.pendingClick ? await flushPendingClick(state) : state;
      const updated: RecordingState = {
        ...flushed,
        pendingClick: {
          payload: message.payload as ClickPayload,
          timeoutTs: Date.now(),
        },
      };
      await setState(updated);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "SPA_NAVIGATION") {
      if (!state.pendingClick) { sendResponse({ ok: false }); return; }
      const flushed = await flushPendingClick(state, (message as any).payload.url);
      await setState(flushed);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false });
  })();
  return true; // keep channel open for async sendResponse
});

// Flush pending click when top-level navigation completes
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const state = await getState();
  if (!state.isRecording || !state.pendingClick) return;
  const flushed = await flushPendingClick(state, details.url);
  await setState(flushed);
});

export {};
