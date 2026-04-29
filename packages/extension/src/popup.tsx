import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { RecordingState } from "./shared/types";
import "./popup.css";

type Message =
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "CLEAR_RECORDING" }
  | { type: "GET_TRACE" }
  | { type: "SEND_TO_BACKEND"; name: string };

function sendMsg<T = unknown>(msg: Message): Promise<T> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => resolve(res as T));
  });
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const Popup: React.FC = () => {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    startedAt: null,
    steps: [],
    pendingClick: null,
  });
  const [flowName, setFlowName] = useState("");
  const [msg, setMsg] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = async () => {
    const res = await sendMsg<{ state: RecordingState }>({ type: "GET_TRACE" });
    if (res?.state) setState(res.state);
  };

  useEffect(() => {
    void refresh();
    pollRef.current = setInterval(refresh, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const showMsg = (text: string, kind: "success" | "error") => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleStart = async () => {
    await sendMsg({ type: "START_RECORDING" });
    // Notify all content scripts in the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "RECORDING_STARTED" }).catch(() => {});
    }
    await refresh();
  };

  const handleStop = async () => {
    await sendMsg({ type: "STOP_RECORDING" });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "RECORDING_STOPPED" }).catch(() => {});
    }
    await refresh();
  };

  const handleExport = async () => {
    const res = await sendMsg<{ state: RecordingState }>({ type: "GET_TRACE" });
    if (!res?.state?.steps?.length) {
      showMsg("No steps recorded yet.", "error");
      return;
    }
    const name = flowName.trim() || "recorded-flow";
    const trace = {
      version: 1,
      name,
      origin: "chrome-extension",
      startedAt: res.state.startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      browser: { userAgent: navigator.userAgent },
      steps: res.state.steps,
    };
    const filename = `${name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`;
    downloadJson(trace, filename);
    showMsg("Flow exported as JSON.", "success");
  };

  const handleSendToBackend = async () => {
    const res = await sendMsg<{ state: RecordingState }>({ type: "GET_TRACE" });
    if (!res?.state?.steps?.length) {
      showMsg("No steps recorded yet.", "error");
      return;
    }
    const name = flowName.trim() || "Recorded Flow";
    const result = await sendMsg<{ ok: boolean; flowId?: string; error?: string }>({
      type: "SEND_TO_BACKEND",
      name,
    });
    if (result?.ok) {
      showMsg(`Sent to Sitemapper backend (flow ID: ${result.flowId ?? "?"}).`, "success");
    } else {
      showMsg(`Failed: ${result?.error ?? "unknown error"}`, "error");
    }
  };

  const handleClear = async () => {
    await sendMsg({ type: "CLEAR_RECORDING" });
    await refresh();
  };

  const stepCount = state.steps.length + (state.pendingClick ? 1 : 0);

  return (
    <div className="recorder">
      <div className="recorder-header">
        <div className={`dot ${state.isRecording ? "recording" : ""}`} />
        <span className="recorder-title">Flow Recorder</span>
      </div>

      <div className={`recorder-status ${state.isRecording ? "recording" : ""}`}>
        {state.isRecording ? "Recording..." : stepCount > 0 ? "Recording stopped" : "Idle"}
      </div>

      <div className="recorder-step-count">{stepCount}</div>
      <div className="recorder-step-label">step{stepCount !== 1 ? "s" : ""} recorded</div>

      <div className="recorder-name-row">
        <input
          className="recorder-name-input"
          type="text"
          placeholder="Flow name (optional)"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
        />
      </div>

      <div className="recorder-buttons">
        <button className="btn btn-start" onClick={handleStart} disabled={state.isRecording}>
          Start Recording
        </button>
        <button className="btn btn-stop" onClick={handleStop} disabled={!state.isRecording}>
          Stop Recording
        </button>
        <button className="btn btn-export" onClick={handleExport} disabled={stepCount === 0 || state.isRecording}>
          Export JSON
        </button>
        <button className="btn btn-send" onClick={handleSendToBackend} disabled={stepCount === 0 || state.isRecording}>
          Send to Sitemapper
        </button>
        <button className="btn btn-clear" onClick={handleClear} disabled={state.isRecording && stepCount === 0}>
          Clear
        </button>
      </div>

      {msg && (
        <div className={`recorder-message ${msg.kind}`}>{msg.text}</div>
      )}
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<Popup />);
}
