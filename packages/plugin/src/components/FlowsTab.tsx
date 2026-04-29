import React, { useCallback, useRef, useState } from "react";
import type { ImportedFlowEntry, RecordedFlowTrace, FlowRecord } from "../types";

interface FlowsTabProps {
  projectId: string | null;
  importedFlows: ImportedFlowEntry[];
  savedFlows: FlowRecord[];
  renderingBoard: boolean;
  onImportTrace: (trace: RecordedFlowTrace) => void;
  onRemoveImported: (id: string) => void;
  onCaptureAndRender: (id: string) => void;
  onRerenderSaved: (flow: FlowRecord) => void;
  onDeleteSaved: (flowId: string) => void;
}

function parseTrace(raw: string): RecordedFlowTrace {
  const obj = JSON.parse(raw);
  if (obj.version !== 1 || obj.origin !== "chrome-extension") {
    throw new Error("Not a valid Sitemapper flow trace (expected version:1, origin:chrome-extension).");
  }
  if (!Array.isArray(obj.steps)) throw new Error("Trace has no steps array.");
  return obj as RecordedFlowTrace;
}

const ImportArea: React.FC<{ onImport: (trace: RecordedFlowTrace) => void }> = ({ onImport }) => {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const trace = parseTrace(e.target?.result as string);
        onImport(trace);
      } catch (err) {
        setError(String(err));
      }
    };
    reader.readAsText(file);
  }, [onImport]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  return (
    <div
      className={`flow-import-area ${dragging ? "flow-import-dragging" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleFileInput}
      />
      <div className="flow-import-icon">↑</div>
      <div className="flow-import-label">Drop flow JSON here or click to browse</div>
      <div className="flow-import-hint">
        Export from the Sitemapper Chrome extension
      </div>
      {error && <div className="flow-import-error">{error}</div>}
    </div>
  );
};

const CaptureBar: React.FC<{ entry: ImportedFlowEntry }> = ({ entry }) => {
  if (entry.captureStatus === "idle") return null;

  const label =
    entry.captureStatus === "capturing" ? (entry.captureMessage ?? "Capturing...") :
    entry.captureStatus === "complete" ? (entry.captureMessage ?? "Complete") :
    entry.captureMessage ?? "Error";

  return (
    <div className={`flow-capture-bar flow-capture-${entry.captureStatus}`}>
      <div className="flow-capture-label">{label}</div>
      {entry.captureStatus === "capturing" && (
        <div className="flow-capture-progress-track">
          <div
            className="flow-capture-progress-fill"
            style={{ width: `${entry.captureProgress}%` }}
          />
        </div>
      )}
    </div>
  );
};

const ImportedFlowCard: React.FC<{
  entry: ImportedFlowEntry;
  onCapture: () => void;
  onRemove: () => void;
  renderingBoard: boolean;
}> = ({ entry, onCapture, onRemove, renderingBoard }) => {
  const stepCount = entry.trace.steps.length;
  const isCapturing = entry.captureStatus === "capturing";
  const isComplete = entry.captureStatus === "complete";

  return (
    <div className="flow-card">
      <div className="flow-card-header">
        <div className="flow-card-info">
          <div className="flow-card-name">{entry.name}</div>
          <div className="flow-card-meta">{stepCount} step{stepCount !== 1 ? "s" : ""}</div>
        </div>
        <button
          className="flow-card-remove"
          onClick={onRemove}
          title="Remove"
          disabled={isCapturing}
        >
          ×
        </button>
      </div>

      <CaptureBar entry={entry} />

      <div className="flow-card-actions">
        <button
          className="btn-flow-primary"
          onClick={onCapture}
          disabled={isCapturing || renderingBoard}
        >
          {isCapturing ? "Capturing..." :
           isComplete ? "Re-render Board" :
           "Capture & Render"}
        </button>
      </div>
    </div>
  );
};

const SavedFlowCard: React.FC<{
  flow: FlowRecord;
  onRender: () => void;
  onDelete: () => void;
  renderingBoard: boolean;
}> = ({ flow, onRender, onDelete, renderingBoard }) => (
  <div className="flow-card flow-card-saved">
    <div className="flow-card-header">
      <div className="flow-card-info">
        <div className="flow-card-name">{flow.name}</div>
        <div className="flow-card-meta">
          {flow.stepCount ?? flow.steps?.length ?? 0} steps
          {" · "}
          {new Date(flow.updatedAt).toLocaleDateString()}
        </div>
      </div>
      <button
        className="flow-card-remove"
        onClick={onDelete}
        title="Delete"
      >
        ×
      </button>
    </div>
    <div className="flow-card-actions">
      <button
        className="btn-flow-secondary"
        onClick={onRender}
        disabled={renderingBoard}
      >
        {renderingBoard ? "Rendering…" : "Render Board"}
      </button>
    </div>
  </div>
);

export const FlowsTab: React.FC<FlowsTabProps> = ({
  projectId,
  importedFlows,
  savedFlows,
  renderingBoard,
  onImportTrace,
  onRemoveImported,
  onCaptureAndRender,
  onRerenderSaved,
  onDeleteSaved,
}) => {
  if (!projectId) {
    return (
      <div className="flows-container">
        <div className="flows-empty">
          <p>No project selected</p>
          <p className="flows-empty-hint">Select a project in Settings to use flows.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flows-container">
      <ImportArea onImport={onImportTrace} />

      {importedFlows.length > 0 && (
        <div className="flows-section">
          <div className="flows-section-title">Imported</div>
          {importedFlows.map((entry) => (
            <ImportedFlowCard
              key={entry.id}
              entry={entry}
              onCapture={() => onCaptureAndRender(entry.id)}
              onRemove={() => onRemoveImported(entry.id)}
              renderingBoard={renderingBoard}
            />
          ))}
        </div>
      )}

      {savedFlows.length > 0 && (
        <div className="flows-section">
          <div className="flows-section-title">Saved flows</div>
          {savedFlows.map((flow) => (
            <SavedFlowCard
              key={flow._id}
              flow={flow}
              onRender={() => onRerenderSaved(flow)}
              onDelete={() => onDeleteSaved(flow._id)}
              renderingBoard={renderingBoard}
            />
          ))}
        </div>
      )}

      {importedFlows.length === 0 && savedFlows.length === 0 && (
        <div className="flows-empty flows-empty-secondary">
          <p>No flows yet</p>
          <p className="flows-empty-hint">
            Record a flow in Chrome using the Sitemapper extension, then import the JSON above.
          </p>
        </div>
      )}
    </div>
  );
};
