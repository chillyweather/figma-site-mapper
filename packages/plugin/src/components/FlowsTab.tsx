import React, { useEffect, useState } from "react";
import type { FlowAction, FlowDraftStep, FlowRecord } from "../types/index";

interface FlowsTabProps {
  activePage: { pageId: string; pageUrl: string; pageName: string } | null;
  actions: FlowAction[];
  actionsLoading: boolean;
  draftSteps: FlowDraftStep[];
  draftName: string;
  selectedAction: FlowAction | null;
  savedFlows: FlowRecord[];
  activeFlowId: string | null;
  capturing: boolean;
  onPreview: (action: FlowAction) => void;
  onClearPreview: () => void;
  onAddStep: (action: FlowAction) => void;
  onRemoveStep: (index: number) => void;
  onMoveStepUp: (index: number) => void;
  onMoveStepDown: (index: number) => void;
  onClearDraft: () => void;
  onDraftNameChange: (name: string) => void;
  onCaptureTarget: (step: FlowDraftStep, index: number) => void;
  onContinueFromTarget: (step: FlowDraftStep) => void;
  onSaveFlow: () => void;
  onLoadFlow: (flow: FlowRecord) => void;
  onDeleteFlow: (flowId: string) => void;
  onRenameFlow: (flowId: string, name: string) => void;
  onDuplicateFlow: (flow: FlowRecord) => void;
  onRerenderFlow: (flow: FlowRecord) => void;
  onRenderBoard: () => void;
  renderingBoard?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  captured: "Captured",
  "needs-capture": "Needs capture",
  external: "External",
  "same-page-anchor": "Same page",
  "no-target": "No target",
};

const STATUS_CLASSES: Record<string, string> = {
  captured: "flow-status-captured",
  "needs-capture": "flow-status-uncaptured",
  external: "flow-status-external",
  "same-page-anchor": "flow-status-anchor",
  "no-target": "flow-status-notarget",
};

const ActionItem: React.FC<{
  action: FlowAction;
  selected: boolean;
  onPreview: (a: FlowAction) => void;
  onAddStep: (a: FlowAction) => void;
}> = ({ action, selected, onPreview, onAddStep }) => (
  <div
    className={`flows-action-item ${selected ? "flows-action-selected" : ""}`}
    onClick={() => onPreview(action)}
  >
    <div className={`flows-action-status ${STATUS_CLASSES[action.targetStatus]}`}>
      {STATUS_LABELS[action.targetStatus]}
    </div>
    <div className="flows-action-body">
      <div className="flows-action-label" title={action.label}>
        {action.label}
      </div>
      <div className="flows-action-meta">
        <span className="flows-action-type">{action.elementType}</span>
        {action.role && <span className="flows-action-role">{action.role}</span>}
      </div>
      <div className="flows-action-url" title={action.targetUrl ?? undefined}>
        {action.targetUrl ?? "(no target)"}
      </div>
    </div>
    <div className="flows-action-actions">
      <button
        className="flows-action-preview-btn"
        onClick={(e) => { e.stopPropagation(); onPreview(action); }}
      >
        Preview
      </button>
      <button
        className="flows-action-add-btn"
        onClick={(e) => { e.stopPropagation(); onAddStep(action); }}
      >
        + Add
      </button>
    </div>
  </div>
);

export const FlowsTab: React.FC<FlowsTabProps> = ({
  activePage,
  actions,
  actionsLoading,
  draftSteps,
  draftName,
  selectedAction,
  savedFlows,
  activeFlowId,
  capturing,
  onPreview,
  onClearPreview,
  onAddStep,
  onRemoveStep,
  onMoveStepUp,
  onMoveStepDown,
  onClearDraft,
  onDraftNameChange,
  onCaptureTarget,
  onContinueFromTarget,
  onSaveFlow,
  onLoadFlow,
  onDeleteFlow,
  onRenameFlow,
  onDuplicateFlow,
  onRerenderFlow,
  onRenderBoard,
  renderingBoard = false,
}) => {
  const [view, setView] = useState<"builder" | "saved">("builder");
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<"all" | "captured" | "uncaptured" | "external">("all");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set());

  const toggleRegion = (region: string) => {
    setCollapsedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  const filtered = actions.filter((a) => {
    if (groupBy === "captured") return a.targetStatus === "captured";
    if (groupBy === "uncaptured") return a.targetStatus === "needs-capture";
    if (groupBy === "external") return a.targetStatus === "external";
    return true;
  }).filter((a) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      a.label.toLowerCase().includes(q) ||
      (a.targetUrl ?? "").toLowerCase().includes(q) ||
      (a.selector ?? "").toLowerCase().includes(q) ||
      (a.regionLabel ?? "").toLowerCase().includes(q)
    );
  });

  // Group filtered actions by regionLabel for display
  const regionOrder: string[] = [];
  const regionMap = new Map<string, typeof filtered>();
  for (const action of filtered) {
    const region = action.regionLabel || "Other";
    if (!regionMap.has(region)) {
      regionMap.set(region, []);
      regionOrder.push(region);
    }
    regionMap.get(region)!.push(action);
  }
  const useRegionGroups = regionOrder.length > 1 && !query.trim();

  if (!activePage) {
    return (
      <div id="flows-tab" className="flows-container">
        <div className="flows-empty">
          <p>No screenshot page open</p>
          <p className="flows-empty-hint">
            Open a generated screenshot page to build flows.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="flows-tab" className="flows-container">
      {/* View toggle */}
      <div className="flows-view-toggle">
        <button
          className={`flows-view-btn ${view === "builder" ? "flows-view-active" : ""}`}
          onClick={() => setView("builder")}
        >
          Builder
        </button>
        <button
          className={`flows-view-btn ${view === "saved" ? "flows-view-active" : ""}`}
          onClick={() => setView("saved")}
        >
          Saved ({savedFlows.length})
        </button>
      </div>

      {view === "builder" ? (
        <>
          {/* Active page info */}
          <div className="flows-page-info">
            <span className="flows-page-url">{activePage.pageUrl}</span>
          </div>

          {/* Draft indicator */}
          {draftSteps.length > 0 && (
            <div className="flows-draft-indicator">
              <span>Draft: {draftSteps.length} step{draftSteps.length !== 1 ? "s" : ""}</span>
              <div className="flows-draft-name-row">
                <input
                  className="flows-draft-name-input"
                  type="text"
                  placeholder="Flow name..."
                  value={draftName}
                  onChange={(e) => onDraftNameChange(e.target.value)}
                />
              </div>
              {activeFlowId && <span className="flows-saved-badge">Saved</span>}
            </div>
          )}

          {/* Filter / group row */}
          <div className="flows-filter-row">
            <input
              className="flows-search-input"
              type="text"
              placeholder="Filter actions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="flows-group-select"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="captured">Captured</option>
              <option value="uncaptured">Needs capture</option>
              <option value="external">External</option>
            </select>
            <span className="flows-count">{filtered.length}/{actions.length}</span>
          </div>

          {/* Loading */}
          {actionsLoading && (
            <div className="flows-loading">Loading actions...</div>
          )}

          {/* Action list */}
          {!actionsLoading && (
            <div className="flows-action-list">
              {filtered.length === 0 ? (
                <p className="flows-no-match">
                  {actions.length === 0
                    ? "No actionable elements found on this page."
                    : "No elements match the current filter."}
                </p>
              ) : useRegionGroups ? (
                regionOrder.map((region) => {
                  const items = regionMap.get(region)!;
                  const collapsed = collapsedRegions.has(region);
                  return (
                    <div key={region} className="flows-region-group">
                      <div
                        className="flows-region-header"
                        onClick={() => toggleRegion(region)}
                      >
                        <span className="flows-region-chevron">{collapsed ? "▶" : "▼"}</span>
                        <span className="flows-region-name">{region}</span>
                        <span className="flows-region-count">{items.length}</span>
                      </div>
                      {!collapsed && items.map((action, i) => (
                        <ActionItem
                          key={`${action.elementId}-${i}`}
                          action={action}
                          selected={selectedAction?.elementId === action.elementId}
                          onPreview={onPreview}
                          onAddStep={onAddStep}
                        />
                      ))}
                    </div>
                  );
                })
              ) : (
                filtered.map((action, i) => (
                  <ActionItem
                    key={`${action.elementId}-${i}`}
                    action={action}
                    selected={selectedAction?.elementId === action.elementId}
                    onPreview={onPreview}
                    onAddStep={onAddStep}
                  />
                ))
              )}
            </div>
          )}
        </>
      ) : (
        /* Saved flows view */
        <div className="flows-saved-list">
          {savedFlows.length === 0 ? (
            <div className="flows-empty">
              <p>No saved flows</p>
              <p className="flows-empty-hint">
                Build a flow in the Builder tab and save it.
              </p>
            </div>
          ) : (
            savedFlows.map((flow) => (
              <div key={flow._id} className="flows-saved-item">
                <div className="flows-saved-info">
                  {renamingId === flow._id ? (
                    <form
                      className="flows-rename-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        onRenameFlow(flow._id, renameValue);
                        setRenamingId(null);
                      }}
                    >
                      <input
                        className="flows-rename-input"
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => setRenamingId(null)}
                        onKeyDown={(e) => e.key === "Escape" && setRenamingId(null)}
                      />
                      <button type="submit" className="flows-rename-confirm">✓</button>
                    </form>
                  ) : (
                    <div
                      className="flows-saved-name"
                      title="Click to rename"
                      onClick={() => { setRenamingId(flow._id); setRenameValue(flow.name); }}
                    >
                      {flow.name}
                    </div>
                  )}
                  <div className="flows-saved-meta">
                    {flow.stepCount ?? flow.steps?.length ?? 0} steps
                    {" · "}
                    {new Date(flow.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flows-saved-actions">
                  <button
                    className="flows-saved-render-btn"
                    onClick={() => onRerenderFlow(flow)}
                    title="Re-render board"
                  >
                    Board
                  </button>
                  <button
                    className="flows-saved-duplicate-btn"
                    onClick={() => onDuplicateFlow(flow)}
                    title="Duplicate flow"
                  >
                    Copy
                  </button>
                  <button
                    className="flows-saved-load-btn"
                    onClick={() => onLoadFlow(flow)}
                  >
                    Load
                  </button>
                  <button
                    className="flows-saved-delete-btn"
                    onClick={() => onDeleteFlow(flow._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Draft step list */}
      {view === "builder" && draftSteps.length > 0 && (
        <div className="flows-draft-list">
          <div className="flows-draft-header">
            <strong>Draft Steps</strong>
            {capturing && <span className="flows-capturing">Capturing target...</span>}
          </div>
          {draftSteps.map((step, i) => (
            <div key={i} className="flows-draft-step">
              <div className="flows-draft-step-num">{i + 1}</div>
              <div className="flows-draft-step-body">
                <div className="flows-draft-step-label">{step.actionLabel}</div>
                <div className="flows-draft-step-url">
                  {step.sourceUrl.split("/").pop() || step.sourceUrl}
                  {step.targetUrl ? ` → ${step.targetUrl.split("/").pop() || step.targetUrl}` : ""}
                </div>
                <div className={`flows-draft-step-status ${STATUS_CLASSES[step.targetStatus]}`}>
                  {STATUS_LABELS[step.targetStatus]}
                </div>
              </div>
              <div className="flows-draft-step-actions">
                <button
                  className="flows-step-btn"
                  onClick={() => onMoveStepUp(i)}
                  disabled={i === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  className="flows-step-btn"
                  onClick={() => onMoveStepDown(i)}
                  disabled={i === draftSteps.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                {step.targetStatus === "needs-capture" && (
                  <button
                    className="flows-step-capture-btn"
                    onClick={() => onCaptureTarget(step, i)}
                    disabled={capturing}
                  >
                    Capture
                  </button>
                )}
                {step.targetStatus === "captured" && step.targetPageId && (
                  <button
                    className="flows-step-continue-btn"
                    onClick={() => onContinueFromTarget(step)}
                  >
                    Go
                  </button>
                )}
                <button
                  className="flows-step-remove-btn"
                  onClick={() => onRemoveStep(i)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer actions */}
      {view === "builder" && (
        <div className="flows-footer">
          <button
            className="button-flow button-flow-clear"
            onClick={onClearPreview}
            disabled={!selectedAction}
          >
            Clear Preview
          </button>
          <button
            className="button-flow button-flow-clear"
            onClick={onClearDraft}
            disabled={draftSteps.length === 0}
          >
            Clear Draft
          </button>
          <button
            className="button-flow button-flow-save"
            onClick={onSaveFlow}
            disabled={draftSteps.length === 0}
          >
            Save Flow
          </button>
          <button
            className="button-flow button-flow-render"
            onClick={onRenderBoard}
            disabled={draftSteps.length === 0 || renderingBoard}
            title="Render as Figma storyboard"
          >
            {renderingBoard ? "Rendering…" : "Render Board"}
          </button>
        </div>
      )}
    </div>
  );
};
