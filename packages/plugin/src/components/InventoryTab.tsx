import React, { useCallback, useEffect, useState } from "react";
import type { MappingOverview } from "../plugin/types";

interface InventoryTabProps {
  activeProjectId: string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value).then(() => true).catch(() => false);
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve(ok);
  } catch {
    return Promise.resolve(false);
  }
}

type MappingState =
  | "no-project"
  | "loading"
  | "no-workspace"
  | "preparing"
  | "evidence-ready"
  | "decisions-ready"
  | "rendering"
  | "rendered"
  | "error";

interface PrepareJob {
  jobId: string;
  status: string;
  stage: string;
  progress: number;
}

interface RenderResult {
  componentTypes: number;
  totalInstances: number;
  errors: string[];
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ activeProjectId }) => {
  const [overview, setOverview] = useState<MappingOverview | null>(null);
  const [mappingState, setMappingState] = useState<MappingState>("no-project");
  const [prepareJob, setPrepareJob] = useState<PrepareJob | null>(null);
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [renderProgress, setRenderProgress] = useState<{ stage: string; current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const command = activeProjectId ? `/ds-mapping ${activeProjectId}` : "/ds-mapping <projectId>";

  const deriveState = useCallback((ov: MappingOverview | null, preparing: boolean, rendering: boolean): MappingState => {
    if (!activeProjectId) return "no-project";
    if (preparing) return "preparing";
    if (rendering) return "rendering";
    if (!ov) return "loading";
    if (!ov.hasMappingWorkspace) return "no-workspace";
    if (!ov.hasDecisions) return "evidence-ready";
    if (renderResult) return "rendered";
    return "decisions-ready";
  }, [activeProjectId, renderResult]);

  const load = useCallback(() => {
    if (!activeProjectId) {
      setOverview(null);
      setMappingState("no-project");
      setError(null);
      return;
    }
    setMappingState("loading");
    setError(null);
    parent.postMessage({ pluginMessage: { type: "mapping/load", projectId: activeProjectId } }, "*");
  }, [activeProjectId]);

  const prepare = useCallback(() => {
    if (!activeProjectId || mappingState === "preparing") return;
    setError(null);
    setMappingState("preparing");
    setPrepareJob({ jobId: "", status: "pending", stage: "Queueing mapping workspace", progress: 0 });
    parent.postMessage({ pluginMessage: { type: "mapping/prepare", projectId: activeProjectId } }, "*");
  }, [activeProjectId, mappingState]);

  const render = useCallback(() => {
    if (!activeProjectId || mappingState === "rendering") return;
    setError(null);
    setRenderResult(null);
    setMappingState("rendering");
    parent.postMessage({ pluginMessage: { type: "mapping/render", projectId: activeProjectId } }, "*");
  }, [activeProjectId, mappingState]);

  const copyCommand = useCallback(async () => {
    const ok = await copyToClipboard(command);
    setCopyStatus(ok ? "Copied!" : "Copy failed");
    window.setTimeout(() => setCopyStatus(null), 1600);
  }, [command]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg || !String(msg.type ?? "").startsWith("mapping/")) return;
      if (activeProjectId && msg.projectId && msg.projectId !== activeProjectId) return;

      if (msg.type === "mapping/loaded") {
        const ov = msg.overview as MappingOverview;
        setOverview(ov);
        setMappingState(deriveState(ov, false, false));
        setError(null);
      }

      if (msg.type === "mapping/error") {
        setMappingState(overview ? (overview.hasMappingWorkspace ? (overview.hasDecisions ? "decisions-ready" : "evidence-ready") : "no-workspace") : "no-workspace");
        setError(typeof msg.error === "string" ? msg.error : "Mapping error");
      }

      if (msg.type === "mapping/prepareStarted") {
        setMappingState("preparing");
        setPrepareJob({ jobId: String(msg.jobId ?? ""), status: "pending", stage: "Job queued", progress: 0 });
      }

      if (msg.type === "mapping/prepareStatus") {
        setPrepareJob({
          jobId: String(msg.jobId ?? ""),
          status: String(msg.status ?? ""),
          stage: typeof msg.stage === "string" ? msg.stage : "Preparing",
          progress: typeof msg.progress === "number" ? msg.progress : 0,
        });
      }

      if (msg.type === "mapping/prepareCompleted") {
        const ov = msg.overview as MappingOverview;
        setOverview(ov);
        setMappingState("evidence-ready");
        setPrepareJob((j) => j ? { ...j, status: "completed", progress: 100, stage: "Evidence ready" } : null);
      }

      if (msg.type === "mapping/prepareError") {
        setMappingState(overview?.hasMappingWorkspace ? "evidence-ready" : "no-workspace");
        setPrepareJob((j) => j ? { ...j, status: "failed", stage: "Preparation failed" } : null);
        setError(typeof msg.error === "string" ? msg.error : "Preparation failed");
      }

      if (msg.type === "mapping/renderStarted") {
        setMappingState("rendering");
        setRenderProgress({ stage: "Starting", current: 0, total: 0 });
      }

      if (msg.type === "mapping/renderProgress") {
        setRenderProgress({
          stage: typeof msg.stage === "string" ? msg.stage : "Rendering",
          current: typeof msg.current === "number" ? msg.current : 0,
          total: typeof msg.total === "number" ? msg.total : 0,
        });
      }

      if (msg.type === "mapping/renderCompleted") {
        setMappingState("rendered");
        setRenderProgress(null);
        setRenderResult({
          componentTypes: typeof msg.componentTypes === "number" ? msg.componentTypes : 0,
          totalInstances: typeof msg.totalInstances === "number" ? msg.totalInstances : 0,
          errors: Array.isArray(msg.errors) ? msg.errors : [],
        });
      }

      if (msg.type === "mapping/renderError") {
        setMappingState(overview?.hasDecisions ? "decisions-ready" : "evidence-ready");
        setRenderProgress(null);
        setError(typeof msg.error === "string" ? msg.error : "Render failed");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [activeProjectId, overview, deriveState]);

  useEffect(() => { load(); }, [load]);

  if (!activeProjectId) {
    return (
      <div className="container">
        <div className="status-display status-warning">Select a project to use Mapping.</div>
      </div>
    );
  }

  const isPreparing = mappingState === "preparing";
  const isRendering = mappingState === "rendering";

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h4 className="section-header" style={{ marginBottom: 0 }}>Mapping</h4>
        <button
          onClick={load}
          disabled={isPreparing || isRendering || mappingState === "loading"}
          className={`button-secondary ${isPreparing || isRendering || mappingState === "loading" ? "button-flow-disabled" : ""}`}
        >
          {mappingState === "loading" ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="status-display status-error" style={{ marginBottom: "12px" }}>{error}</div>}

      {/* State indicator */}
      <MappingStateCard state={mappingState} overview={overview} prepareJob={prepareJob} />

      {/* Primary actions */}
      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          onClick={prepare}
          disabled={isPreparing || isRendering}
          className={`button-primary ${isPreparing || isRendering ? "button-flow-disabled" : ""}`}
          style={{ width: "100%" }}
        >
          {isPreparing
            ? "Preparing Mapping..."
            : overview?.hasMappingWorkspace
            ? "Re-prepare Mapping"
            : "Prepare Mapping"}
        </button>

        {(mappingState === "evidence-ready" || mappingState === "decisions-ready" || mappingState === "rendered") && (
          <CommandBox command={command} copyStatus={copyStatus} onCopy={copyCommand} />
        )}

        {(mappingState === "decisions-ready" || mappingState === "rendered" || mappingState === "rendering") && (
          <button
            onClick={render}
            disabled={isRendering}
            className={`button-primary ${isRendering ? "button-flow-disabled" : ""}`}
            style={{ width: "100%" }}
          >
            {isRendering ? "Rendering Mapping..." : mappingState === "rendered" ? "Re-render Mapping" : "Render Mapping"}
          </button>
        )}
      </div>

      {/* Render progress */}
      {isRendering && renderProgress && (
        <div className="status-display status-info" style={{ marginTop: "12px" }}>
          <div style={{ fontSize: "11px", color: "var(--figma-color-text-secondary, #555)" }}>
            {renderProgress.total > 0
              ? `Step ${renderProgress.current} of ${renderProgress.total} — ${renderProgress.stage}`
              : renderProgress.stage}
          </div>
          {renderProgress.total > 0 && (
            <div style={{ marginTop: "6px", height: "4px", background: "rgba(0,0,0,0.08)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, (renderProgress.current / renderProgress.total) * 100)}%`,
                background: "var(--figma-color-bg-brand, #18a0fb)",
                transition: "width 200ms linear",
              }} />
            </div>
          )}
        </div>
      )}

      {/* Render result */}
      {renderResult && mappingState === "rendered" && (
        <div className={`status-display ${renderResult.errors.length > 0 ? "status-warning" : "status-success"}`} style={{ marginTop: "12px" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
            {renderResult.errors.length > 0 ? "Rendered with warnings" : "Rendered successfully"}
          </div>
          <div style={{ fontSize: "11px" }}>
            {renderResult.componentTypes} component type{renderResult.componentTypes !== 1 ? "s" : ""},{" "}
            {renderResult.totalInstances} instance{renderResult.totalInstances !== 1 ? "s" : ""}
          </div>
          {renderResult.errors.length > 0 && (
            <div style={{ marginTop: "6px", fontSize: "11px" }}>
              {renderResult.errors.slice(0, 3).map((e, i) => <div key={i}>{e}</div>)}
              {renderResult.errors.length > 3 && <div>…and {renderResult.errors.length - 3} more</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MappingStateCard({ state, overview, prepareJob }: {
  state: MappingState;
  overview: MappingOverview | null;
  prepareJob: PrepareJob | null;
}) {
  if (state === "loading") {
    return <div className="status-display status-info">Loading mapping state…</div>;
  }

  if (state === "preparing" && prepareJob) {
    return (
      <div className={`status-display ${prepareJob.status === "failed" ? "status-error" : "status-info"}`}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>Preparing mapping workspace…</div>
        <div style={{ fontSize: "11px" }}>{prepareJob.stage}</div>
        <div style={{ height: "4px", background: "rgba(0,0,0,0.08)", borderRadius: "2px", marginTop: "8px", overflow: "hidden" }}>
          <div style={{ width: `${Math.max(0, Math.min(100, prepareJob.progress))}%`, height: "100%", background: "#18a0fb" }} />
        </div>
      </div>
    );
  }

  if (state === "no-workspace") {
    return (
      <div className="status-display status-warning">
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>No mapping workspace</div>
        <div style={{ fontSize: "11px" }}>Run <em>Prepare Mapping</em> to extract DOM candidates from captured pages.</div>
      </div>
    );
  }

  if (state === "evidence-ready") {
    return (
      <div className="status-display status-info">
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>Evidence ready</div>
        <div style={{ fontSize: "11px", lineHeight: 1.5 }}>
          <div>Pages: {overview?.pageCount ?? 0}</div>
          <div>DOM candidates: {overview?.candidateCount ?? 0}</div>
          <div>Prepared: {formatDate(overview?.lastPreparedAt)}</div>
        </div>
        <div style={{ marginTop: "8px", fontSize: "11px" }}>
          Copy the command below and run it in Claude Code to generate mapping decisions.
        </div>
      </div>
    );
  }

  if (state === "decisions-ready" || state === "rendered" || state === "rendering") {
    return (
      <div className={`status-display ${state === "rendered" ? "status-success" : "status-info"}`}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>
          {state === "rendered" ? "Mapping rendered" : "Decisions ready"}
        </div>
        <div style={{ fontSize: "11px", lineHeight: 1.5 }}>
          <div>Component types: {overview?.componentTypeCount ?? 0}</div>
          <div>Instances: {overview?.instanceCount ?? 0}</div>
          <div>Last decisions: {formatDate(overview?.lastDecisionsAt)}</div>
        </div>
        {state !== "rendered" && (
          <div style={{ marginTop: "8px", fontSize: "11px" }}>
            Click <em>Render Mapping</em> to create mapper pages in Figma.
          </div>
        )}
      </div>
    );
  }

  return null;
}

function CommandBox({ command, copyStatus, onCopy }: {
  command: string;
  copyStatus: string | null;
  onCopy: () => void;
}) {
  return (
    <div className="status-display status-info">
      <div style={{ fontSize: "11px", marginBottom: "6px" }}>
        Run in Claude Code from the repo root:
      </div>
      <div style={{
        fontFamily: "monospace",
        fontSize: "12px",
        padding: "8px",
        borderRadius: "4px",
        background: "#f3f4f6",
        color: "#111827",
        marginBottom: "8px",
        wordBreak: "break-word",
      }}>
        {command}
      </div>
      <button onClick={onCopy} className="button-secondary">
        {copyStatus ?? "Copy Command"}
      </button>
    </div>
  );
}
