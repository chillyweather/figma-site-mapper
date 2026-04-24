import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  InventoryDecisions,
  InventoryOverview,
  InventoryPrepareJob,
} from "../types";

interface InventoryTabProps {
  activeProjectId: string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatWorkspacePath(path: string | undefined): string {
  if (!path) return "Workspace path unavailable";
  return path;
}

function countDecisionKeys(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.length;
  return Object.values(value as Record<string, unknown>).reduce((count, item) => {
    if (Array.isArray(item)) return count + item.length;
    return count;
  }, 0);
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ activeProjectId }) => {
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [decisions, setDecisions] = useState<InventoryDecisions | null>(null);
  const [prepareJob, setPrepareJob] = useState<InventoryPrepareJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const command = useMemo(
    () => (activeProjectId ? `/ds-inventory ${activeProjectId}` : "/ds-inventory <projectId>"),
    [activeProjectId]
  );

  const loadInventory = useCallback(() => {
    if (!activeProjectId) {
      setOverview(null);
      setDecisions(null);
      setPrepareJob(null);
      setError(null);
      setIsLoading(false);
      setIsPreparing(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    parent.postMessage(
      {
        pluginMessage: {
          type: "load-inventory-overview",
          projectId: activeProjectId,
        },
      },
      "*"
    );
  }, [activeProjectId]);

  const prepareInventory = useCallback(() => {
    if (!activeProjectId || isPreparing) return;

    setError(null);
    setIsPreparing(true);
    setPrepareJob({
      jobId: "",
      projectId: activeProjectId,
      status: "pending",
      stage: "Queueing inventory workspace",
      progress: 0,
    });

    parent.postMessage(
      {
        pluginMessage: {
          type: "prepare-inventory",
          projectId: activeProjectId,
        },
      },
      "*"
    );
  }, [activeProjectId, isPreparing]);

  const copyCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus(null), 1600);
    } catch {
      setCopyStatus("Copy unavailable");
      window.setTimeout(() => setCopyStatus(null), 1600);
    }
  }, [command]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      const matchesProject = !activeProjectId || msg.projectId === activeProjectId;
      if (!matchesProject) return;

      if (msg.type === "inventory-overview-loaded") {
        setOverview(msg.overview as InventoryOverview);
        setDecisions((msg.decisions as InventoryDecisions | undefined) ?? null);
        setIsLoading(false);
        setError(null);
      }

      if (msg.type === "inventory-overview-error") {
        setIsLoading(false);
        setError(typeof msg.error === "string" ? msg.error : "Failed to load inventory status.");
      }

      if (msg.type === "inventory-prepare-started") {
        setIsPreparing(true);
        setPrepareJob({
          jobId: String(msg.jobId ?? ""),
          projectId: String(msg.projectId ?? activeProjectId ?? ""),
          status: "pending",
          stage: "Inventory workspace job queued",
          progress: 0,
        });
      }

      if (msg.type === "inventory-prepare-status") {
        setIsPreparing(msg.status !== "completed" && msg.status !== "failed");
        setPrepareJob({
          jobId: String(msg.jobId ?? ""),
          projectId: String(msg.projectId ?? activeProjectId ?? ""),
          status: msg.status === "completed" || msg.status === "failed"
            ? msg.status
            : msg.status === "processing"
            ? "processing"
            : "pending",
          stage: typeof msg.stage === "string" ? msg.stage : "Preparing inventory workspace",
          progress: typeof msg.progress === "number" ? msg.progress : 0,
        });
      }

      if (msg.type === "inventory-prepare-completed") {
        setIsPreparing(false);
        setPrepareJob((current) =>
          current
            ? { ...current, status: "completed", progress: 100, stage: "Workspace ready" }
            : null
        );
      }

      if (msg.type === "inventory-prepare-error") {
        setIsPreparing(false);
        setPrepareJob((current) =>
          current
            ? { ...current, status: "failed", progress: 100, stage: "Workspace preparation failed" }
            : null
        );
        setError(typeof msg.error === "string" ? msg.error : "Failed to prepare inventory workspace.");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeProjectId]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  if (!activeProjectId) {
    return (
      <div className="container">
        <div className="status-display status-warning">
          Select a project before preparing an inventory workspace.
        </div>
      </div>
    );
  }

  const hasWorkspace = overview?.hasWorkspace === true;
  const decisionSummary = overview?.decisionSummary;
  const rawDecisionCount =
    countDecisionKeys(decisions?.clusters) +
    countDecisionKeys(decisions?.tokens) +
    countDecisionKeys(decisions?.inconsistencies) +
    countDecisionKeys(decisions?.templates);

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h4 className="section-header" style={{ marginBottom: 0 }}>
          Inventory Workspace
        </h4>
        <button
          onClick={loadInventory}
          disabled={isLoading || isPreparing}
          className={`button-secondary ${isLoading || isPreparing ? "button-flow-disabled" : ""}`}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="status-display status-error">{error}</div>}

      <div className={`status-display ${hasWorkspace ? "status-success" : "status-warning"}`}>
        <div style={{ fontWeight: 600, marginBottom: "6px" }}>
          {hasWorkspace ? "Workspace ready" : "No prepared workspace"}
        </div>
        <div>Pages: {overview?.pageCount ?? 0}</div>
        <div>Elements: {overview?.elementCount ?? 0}</div>
        <div>Last built: {formatDate(overview?.lastBuiltAt)}</div>
        <div style={{ marginTop: "6px", fontSize: "11px", wordBreak: "break-word" }}>
          {formatWorkspacePath(overview?.workspaceRoot)}
        </div>
      </div>

      <div style={{ marginTop: "16px" }}>
        <button
          onClick={prepareInventory}
          disabled={isPreparing}
          className={`button-primary ${isPreparing ? "button-flow-disabled" : ""}`}
          style={{ width: "100%" }}
        >
          {isPreparing ? "Preparing Inventory..." : hasWorkspace ? "Rebuild Inventory Workspace" : "Prepare Inventory"}
        </button>
      </div>

      {prepareJob && (
        <div className={`status-display ${prepareJob.status === "failed" ? "status-error" : prepareJob.status === "completed" ? "status-success" : "status-info"}`} style={{ marginTop: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "6px" }}>
            Prepare job {prepareJob.jobId || "pending"}
          </div>
          <div>Status: {prepareJob.status}</div>
          <div>{prepareJob.stage}</div>
          <div style={{ height: "6px", background: "#e5e7eb", borderRadius: "999px", marginTop: "8px", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(0, Math.min(100, prepareJob.progress))}%`,
                height: "100%",
                background: prepareJob.status === "failed" ? "#dc3545" : "#28a745",
              }}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: "24px" }}>
        <h4 className="section-header">Agent Handoff</h4>
        <div className="status-display status-info">
          <div style={{ marginBottom: "8px" }}>
            After the workspace is ready, run this in Claude Code from the repo root:
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              padding: "8px",
              borderRadius: "4px",
              background: "#f3f4f6",
              color: "#111827",
              wordBreak: "break-word",
            }}
          >
            {command}
          </div>
          <button
            onClick={copyCommand}
            className="button-secondary"
            style={{ marginTop: "8px" }}
          >
            {copyStatus ?? "Copy Command"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <h4 className="section-header">Decision Status</h4>
        <div className={`status-display ${decisionSummary?.hasDecisions ? "status-success" : "status-neutral"}`}>
          {decisionSummary?.hasDecisions ? (
            <div>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>Agent decisions found</div>
              <div>Clusters: {decisionSummary.clusterCount}</div>
              <div>Tokens: {decisionSummary.tokenCount}</div>
              <div>Inconsistencies: {decisionSummary.inconsistencyCount}</div>
              <div>Templates: {decisionSummary.templateCount}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>Waiting for agent decisions</div>
              <div>Run the handoff command after preparation. The plugin will show counts here after decisions are written.</div>
              {rawDecisionCount > 0 && (
                <div style={{ marginTop: "6px" }}>
                  Raw decision entries found: {rawDecisionCount}. Refresh after export/status rebuild if counts look stale.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <h4 className="section-header">Render Boards</h4>
        <div className="status-display status-neutral">
          Figma board rendering is intentionally deferred until the decision files are validated.
        </div>
      </div>
    </div>
  );
};
