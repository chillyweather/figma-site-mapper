import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  InventoryDecisions,
  InventoryOverview,
  InventoryPrepareJob,
  MappingContextSummary,
  MappingSuggestions,
  MappingInputs,
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

function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(value)
      .then(() => true)
      .catch(() => false);
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

function summarizeRepoStatus(status: string | null | undefined): string {
  switch (status) {
    case "verified":
      return "Repo verified";
    case "branch-mismatch":
      return "Repo branch mismatch";
    case "missing-branch":
      return "Repo branch missing";
    case "missing-path":
      return "Repo path missing";
    case "not-git":
      return "Repo is not a git worktree";
    case "pending":
      return "Repo pending";
    default:
      return "Repo not configured";
  }
}

function emptyMappingDraft(): Omit<MappingInputs, "projectId"> {
  return {
    repoPath: "",
    branchName: "",
    storybookUrl: "",
    storybookPath: "",
    uiLibrary: "",
    tokenSources: [],
    notes: "",
  };
}

function toMappingDraft(value: MappingInputs | null): Omit<MappingInputs, "projectId"> {
  if (!value) return emptyMappingDraft();
  return {
    repoPath: value.repoPath,
    branchName: value.branchName,
    storybookUrl: value.storybookUrl,
    storybookPath: value.storybookPath,
    uiLibrary: value.uiLibrary,
    tokenSources: value.tokenSources,
    notes: value.notes,
  };
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ activeProjectId }) => {
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [decisions, setDecisions] = useState<InventoryDecisions | null>(null);
  const [mappingInputs, setMappingInputs] = useState<MappingInputs | null>(null);
  const [mappingContextSummary, setMappingContextSummary] = useState<MappingContextSummary | null>(null);
  const [mappingSuggestions, setMappingSuggestions] = useState<MappingSuggestions | null>(null);
  const [mappingDraft, setMappingDraft] = useState<Omit<MappingInputs, "projectId">>(emptyMappingDraft);
  const [prepareJob, setPrepareJob] = useState<InventoryPrepareJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isSavingMappingInputs, setIsSavingMappingInputs] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{ stage: string; current: number; total: number } | null>(null);
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
      setMappingInputs(null);
      setMappingContextSummary(null);
      setMappingSuggestions(null);
      setMappingDraft(emptyMappingDraft());
      setPrepareJob(null);
      setError(null);
      setIsLoading(false);
      setIsPreparing(false);
      setIsSavingMappingInputs(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    parent.postMessage(
      {
        pluginMessage: {
          type: "inventory/load",
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
          type: "inventory/prepare",
          projectId: activeProjectId,
        },
      },
      "*"
    );
  }, [activeProjectId, isPreparing]);

  const copyCommand = useCallback(async () => {
    const ok = await copyTextToClipboard(command);
    setCopyStatus(ok ? "Copied" : "Copy unavailable");
    window.setTimeout(() => setCopyStatus(null), 1600);
  }, [command]);

  const copyHandoff = useCallback(async () => {
    const handoffText = mappingContextSummary?.agentHandoffText ?? command;
    const ok = await copyTextToClipboard(handoffText);
    setCopyStatus(ok ? "Handoff copied" : "Copy unavailable");
    window.setTimeout(() => setCopyStatus(null), 1600);
  }, [command, mappingContextSummary]);

  const renderBoards = useCallback(() => {
    if (!activeProjectId || isRendering) return;
    setError(null);
    setIsRendering(true);
    parent.postMessage(
      {
        pluginMessage: {
          type: "inventory/renderBoards",
          projectId: activeProjectId,
        },
      },
      "*"
    );
  }, [activeProjectId, isRendering]);

  const saveMappingInputs = useCallback(() => {
    if (!activeProjectId || isSavingMappingInputs) return;

    setError(null);
    setIsSavingMappingInputs(true);
    parent.postMessage(
      {
        pluginMessage: {
          type: "inventory/saveMappingInputs",
          projectId: activeProjectId,
          mappingInputs: mappingDraft,
        },
      },
      "*"
    );
  }, [activeProjectId, isSavingMappingInputs, mappingDraft]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      const matchesProject = !activeProjectId || msg.projectId === activeProjectId;
      if (!matchesProject) return;

      if (msg.type === "inventory/loaded") {
        setOverview(msg.overview as InventoryOverview);
        setDecisions((msg.decisions as InventoryDecisions | undefined) ?? null);
        const nextMappingInputs = (msg.mappingInputs as MappingInputs | undefined) ?? null;
        setMappingContextSummary((msg.mappingContextSummary as MappingContextSummary | undefined) ?? null);
        setMappingSuggestions((msg.mappingSuggestions as MappingSuggestions | undefined) ?? null);
        setMappingInputs(nextMappingInputs);
        setMappingDraft(toMappingDraft(nextMappingInputs));
        setIsLoading(false);
        setError(null);
      }

      if (msg.type === "inventory/error") {
        setIsLoading(false);
        setIsSavingMappingInputs(false);
        setError(typeof msg.error === "string" ? msg.error : "Failed to load inventory status.");
      }

      if (msg.type === "inventory/prepareStarted") {
        setIsPreparing(true);
        setPrepareJob({
          jobId: String(msg.jobId ?? ""),
          projectId: String(msg.projectId ?? activeProjectId ?? ""),
          status: "pending",
          stage: "Inventory workspace job queued",
          progress: 0,
        });
      }

      if (msg.type === "inventory/prepareStatus") {
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

      if (msg.type === "inventory/prepareCompleted") {
        setIsPreparing(false);
        setPrepareJob((current) =>
          current
            ? { ...current, status: "completed", progress: 100, stage: "Workspace ready" }
            : null
        );
      }

      if (msg.type === "inventory/prepareError") {
        setIsPreparing(false);
        setPrepareJob((current) =>
          current
            ? { ...current, status: "failed", progress: 100, stage: "Workspace preparation failed" }
            : null
        );
        setError(typeof msg.error === "string" ? msg.error : "Failed to prepare inventory workspace.");
      }

      if (msg.type === "inventory/mappingInputsSaved") {
        const saved = msg.mappingInputs as MappingInputs;
        setMappingInputs(saved);
        setMappingDraft(toMappingDraft(saved));
        setIsSavingMappingInputs(false);
        setError(null);
      }

      if (msg.type === "inventory/renderStarted") {
        setIsRendering(true);
        setRenderProgress({ stage: "Starting render", current: 0, total: 0 });
        setError(null);
      }

      if (msg.type === "inventory/renderProgress") {
        setRenderProgress({
          stage: typeof msg.stage === "string" ? msg.stage : "Rendering",
          current: typeof msg.current === "number" ? msg.current : 0,
          total: typeof msg.total === "number" ? msg.total : 0,
        });
      }

      if (msg.type === "inventory/renderCompleted") {
        setIsRendering(false);
        setRenderProgress(null);
      }

      if (msg.type === "inventory/renderError") {
        setIsRendering(false);
        setRenderProgress(null);
        setError(typeof msg.error === "string" ? msg.error : "Failed to render inventory boards.");
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
  const repoBranchError = mappingDraft.repoPath.trim().length > 0 && mappingDraft.branchName.trim().length === 0;
  const mappingInputsDirty = JSON.stringify(mappingDraft) !== JSON.stringify(toMappingDraft(mappingInputs));
  const handoffWarnings = mappingContextSummary?.warnings ?? [];
  const handoffText = mappingContextSummary?.agentHandoffText ?? command;
  const repoStatusTone =
    mappingContextSummary?.repo.status === "verified"
      ? "status-success"
      : mappingContextSummary?.repo.status === "branch-mismatch" ||
        mappingContextSummary?.repo.status === "missing-branch" ||
        mappingContextSummary?.repo.status === "missing-path" ||
        mappingContextSummary?.repo.status === "not-git"
        ? "status-warning"
        : "status-info";

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

      <div className={`status-display ${hasWorkspace ? (overview?.isWorkspaceStale ? "status-warning" : "status-success") : "status-warning"}`}>
        <div style={{ fontWeight: 600, marginBottom: "6px" }}>
          {hasWorkspace
            ? overview?.isWorkspaceStale
              ? "Workspace stale — rebuild recommended"
              : "Workspace ready"
            : "No prepared workspace"}
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
        <h4 className="section-header">Mapping Inputs</h4>
        <div className="status-display status-info">
          <div style={{ marginBottom: "10px" }}>
            Save optional evidence sources for future mapping workflows. If you set a repo path, branch name is required.
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <label style={{ fontSize: "12px" }}>
              <div style={{ marginBottom: "4px", fontWeight: 600 }}>Repo Path</div>
              <input
                value={mappingDraft.repoPath}
                onChange={(e) => setMappingDraft((current) => ({ ...current, repoPath: e.target.value }))}
                className="form-input"
                placeholder="/abs/path/to/client/repo"
              />
            </label>

            <label style={{ fontSize: "12px" }}>
              <div style={{ marginBottom: "4px", fontWeight: 600 }}>Branch Name</div>
              <input
                value={mappingDraft.branchName}
                onChange={(e) => setMappingDraft((current) => ({ ...current, branchName: e.target.value }))}
                className="form-input"
                placeholder="release/marketing-q3"
              />
            </label>

            <label style={{ fontSize: "12px" }}>
              <div style={{ marginBottom: "4px", fontWeight: 600 }}>Storybook URL</div>
              <input
                value={mappingDraft.storybookUrl}
                onChange={(e) => setMappingDraft((current) => ({ ...current, storybookUrl: e.target.value }))}
                className="form-input"
                placeholder="https://storybook.example.com"
              />
            </label>

            <label style={{ fontSize: "12px" }}>
              <div style={{ marginBottom: "4px", fontWeight: 600 }}>Storybook Path</div>
              <input
                value={mappingDraft.storybookPath}
                onChange={(e) => setMappingDraft((current) => ({ ...current, storybookPath: e.target.value }))}
                className="form-input"
                placeholder="/abs/path/to/storybook-static"
              />
            </label>

            <label style={{ fontSize: "12px" }}>
              <div style={{ marginBottom: "4px", fontWeight: 600 }}>Known UI Library</div>
              <input
                value={mappingDraft.uiLibrary}
                onChange={(e) => setMappingDraft((current) => ({ ...current, uiLibrary: e.target.value }))}
                className="form-input"
                placeholder="Material UI"
              />
            </label>

            <label style={{ fontSize: "12px" }}>
              <div style={{ marginBottom: "4px", fontWeight: 600 }}>Token / Theme Paths</div>
              <textarea
                value={mappingDraft.tokenSources.join("\n")}
                onChange={(e) =>
                  setMappingDraft((current) => ({
                    ...current,
                    tokenSources: e.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                rows={3}
                className="form-input"
                style={{ resize: "vertical", fontFamily: "monospace", fontSize: "11px" }}
                placeholder={"/abs/path/to/tokens.css\n/abs/path/to/theme.ts"}
              />
            </label>

            <label style={{ fontSize: "12px" }}>
              <div style={{ marginBottom: "4px", fontWeight: 600 }}>Notes</div>
              <textarea
                value={mappingDraft.notes}
                onChange={(e) => setMappingDraft((current) => ({ ...current, notes: e.target.value }))}
                rows={3}
                className="form-input"
                style={{ resize: "vertical" }}
                placeholder="Marketing app lives under apps/web"
              />
            </label>
          </div>

          {repoBranchError && (
            <div className="status-display status-warning" style={{ marginTop: "10px" }}>
              Branch name is required when repo path is set.
            </div>
          )}

          <button
            onClick={saveMappingInputs}
            disabled={isSavingMappingInputs || !mappingInputsDirty || repoBranchError}
            className={`button-secondary ${isSavingMappingInputs || !mappingInputsDirty || repoBranchError ? "button-flow-disabled" : ""}`}
            style={{ marginTop: "12px" }}
          >
            {isSavingMappingInputs ? "Saving..." : mappingInputsDirty ? "Save Mapping Inputs" : "Saved"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <h4 className="section-header">Suggestions</h4>
        <div className="status-display status-info">
          {mappingSuggestions ? (
            <div>
              <div style={{ marginBottom: "10px", fontWeight: 600 }}>Evidence Summary</div>
              <div style={{ fontSize: "11px", lineHeight: 1.5, marginBottom: "8px" }}>
                <div>Repo status: {mappingSuggestions.repoStatus}</div>
                <div>Storybook status: {mappingSuggestions.storybookStatus}</div>
                {mappingSuggestions.uiLibraryHints.length > 0 && (
                  <div>UI library hints: {mappingSuggestions.uiLibraryHints.join(", ")}</div>
                )}
              </div>

              {mappingSuggestions.topComponentCandidates.length > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "12px" }}>
                    Top Component Candidates
                  </div>
                  <div style={{ fontSize: "11px", lineHeight: 1.5 }}>
                    {mappingSuggestions.topComponentCandidates.slice(0, 3).map((c, i) => (
                      <div key={i}>
                        {c.name}
                        <span style={{ color: "#6b7280", marginLeft: "4px" }}>
                          ({c.source}, {c.confidence})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mappingSuggestions.topTokenCandidates.length > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "12px" }}>
                    Top Token Candidates
                  </div>
                  <div style={{ fontSize: "11px", lineHeight: 1.5 }}>
                    {mappingSuggestions.topTokenCandidates.slice(0, 3).map((c, i) => (
                      <div key={i}>
                        {c.name}
                        <span style={{ color: "#6b7280", marginLeft: "4px" }}>
                          ({c.source}, {c.confidence})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mappingSuggestions.topTemplateCandidates.length > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "12px" }}>
                    Top Template Candidates
                  </div>
                  <div style={{ fontSize: "11px", lineHeight: 1.5 }}>
                    {mappingSuggestions.topTemplateCandidates.slice(0, 3).map((c, i) => (
                      <div key={i}>
                        {c.name}
                        <span style={{ color: "#6b7280", marginLeft: "4px" }}>
                          ({c.source}, {c.confidence})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mappingSuggestions.warnings.length > 0 && (
                <div className="status-display status-warning" style={{ marginTop: "8px" }}>
                  {mappingSuggestions.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              )}

              {mappingSuggestions.topComponentCandidates.length === 0 &&
                mappingSuggestions.topTokenCandidates.length === 0 &&
                mappingSuggestions.topTemplateCandidates.length === 0 && (
                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                  No suggestions available. Add mapping inputs (repo, Storybook) before preparing the workspace.
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "#6b7280" }}>
              Prepare the workspace to generate suggestions.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <h4 className="section-header">Agent Handoff</h4>
        <div className={`status-display ${mappingContextSummary?.hasMappingContext ? repoStatusTone : "status-info"}`}>
          <div style={{ marginBottom: "8px", fontWeight: 600 }}>
            {mappingContextSummary?.hasMappingContext
              ? summarizeRepoStatus(mappingContextSummary.repo.status)
              : "Prepare the workspace to generate mapping-context handoff"}
          </div>
          {mappingContextSummary?.hasMappingContext ? (
            <div style={{ fontSize: "11px", lineHeight: 1.5, marginBottom: "10px" }}>
              <div>Context built: {formatDate(mappingContextSummary.generatedAt)}</div>
              <div>Workflow mode: {mappingContextSummary.mode ?? "crawl-only"}</div>
              <div>Repo path: {mappingContextSummary.repo.path ?? "(not set)"}</div>
              <div>Requested branch: {mappingContextSummary.repo.requestedBranch ?? "(not set)"}</div>
              <div>Checked-out branch: {mappingContextSummary.repo.resolvedBranch ?? "(unknown)"}</div>
              <div>Commit SHA: {mappingContextSummary.repo.commitSha ?? "(unknown)"}</div>
              {mappingContextSummary.uiLibrary.hints.length > 0 && (
                <div>UI library hints: {mappingContextSummary.uiLibrary.hints.join(", ")}</div>
              )}
              {mappingContextSummary.tokenSources.length > 0 && (
                <div>Configured token sources: {mappingContextSummary.tokenSources.join(", ")}</div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: "10px" }}>
              After the workspace is ready, run this in Claude Code from the repo root:
            </div>
          )}
          {handoffWarnings.length > 0 && (
            <div className="status-display status-warning" style={{ marginBottom: "10px" }}>
              {handoffWarnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          )}
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
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{handoffText}</pre>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              onClick={copyHandoff}
              className="button-secondary"
            >
              {copyStatus ?? "Copy Handoff"}
            </button>
            <button
              onClick={copyCommand}
              className="button-secondary"
            >
              Copy Command Only
            </button>
          </div>
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
        <div className={`status-display ${decisionSummary?.hasDecisions ? "status-info" : "status-neutral"}`}>
          <div style={{ marginBottom: "10px" }}>
            Render a first-pass Figma board from the agent decision files.
          </div>
          <button
            onClick={renderBoards}
            disabled={!decisionSummary?.hasDecisions || isRendering}
            className={`button-primary ${!decisionSummary?.hasDecisions || isRendering ? "button-flow-disabled" : ""}`}
            style={{ width: "100%" }}
          >
            {isRendering ? "Rendering Boards..." : "Render Inventory Boards"}
          </button>
          {isRendering && renderProgress && (
            <div style={{ marginTop: "10px", fontSize: "11px", lineHeight: 1.4 }}>
              <div style={{ color: "var(--figma-color-text-secondary, #555)" }}>
                {renderProgress.total > 0
                  ? `Step ${renderProgress.current} of ${renderProgress.total} — ${renderProgress.stage}`
                  : renderProgress.stage}
              </div>
              {renderProgress.total > 0 && (
                <div
                  style={{
                    marginTop: "6px",
                    height: "4px",
                    width: "100%",
                    background: "rgba(0,0,0,0.08)",
                    borderRadius: "2px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (renderProgress.current / renderProgress.total) * 100)}%`,
                      background: "var(--figma-color-bg-brand, #18a0fb)",
                      transition: "width 200ms linear",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
