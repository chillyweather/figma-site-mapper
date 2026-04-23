import React, { useCallback, useEffect, useState } from "react";
import type { InventoryOverview } from "../types";

interface InventoryTabProps {
  activeProjectId: string | null;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ activeProjectId }) => {
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(() => {
    if (!activeProjectId) {
      setOverview(null);
      setError(null);
      setIsLoading(false);
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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (
        msg.type === "inventory-overview-loaded" &&
        (!activeProjectId || msg.projectId === activeProjectId)
      ) {
        setOverview(msg.overview as InventoryOverview);
        setIsLoading(false);
        setError(null);
      }

      if (
        msg.type === "inventory-overview-error" &&
        (!activeProjectId || msg.projectId === activeProjectId)
      ) {
        setIsLoading(false);
        setError(typeof msg.error === "string" ? msg.error : "Failed to load inventory overview.");
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
          Select a project to access inventory analysis.
        </div>
      </div>
    );
  }

  const summary = overview?.summary;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h4 className="section-header" style={{ marginBottom: 0 }}>
          Inventory Overview
        </h4>
        <button
          onClick={loadInventory}
          disabled={isLoading}
          className={`button-secondary ${isLoading ? "button-flow-disabled" : ""}`}
        >
          {isLoading ? "Refreshing..." : "Refresh Inventory"}
        </button>
      </div>

      {error && <div className="status-display status-error">{error}</div>}

      <div className={`status-display ${overview ? "status-success" : "status-neutral"}`}>
        {summary ? (
          <div>
            <div style={{ fontWeight: 600, marginBottom: "6px" }}>Project Summary</div>
            <div>Pages: {summary.pageCount}</div>
            <div>Elements: {summary.elementCount}</div>
            <div>Clusters: {summary.clusterCount}</div>
            <div>Token candidates: {summary.tokenCandidateCount}</div>
            <div>Inconsistencies: {summary.inconsistencyCount}</div>
          </div>
        ) : (
          <div>{isLoading ? "Loading inventory overview..." : "No inventory data available yet."}</div>
        )}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h4 className="section-header">Top Component Candidates</h4>
        {overview?.topClusters?.length ? (
          overview.topClusters.map((cluster) => (
            <div key={cluster.clusterId} className="status-display status-info" style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>{cluster.label}</div>
              <div>Category: {cluster.category}</div>
              <div>Confidence: {formatPercent(cluster.confidence)}</div>
              <div>Instances: {cluster.instanceCount}</div>
              <div>Pages: {cluster.pageCount}</div>
              {cluster.variantHints.length > 0 && (
                <div>Variant hints: {cluster.variantHints.join(", ")}</div>
              )}
            </div>
          ))
        ) : (
          <div className="status-display status-neutral">No cluster candidates yet.</div>
        )}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h4 className="section-header">Top Token Candidates</h4>
        {overview?.topTokenCandidates?.length ? (
          overview.topTokenCandidates.map((candidate) => (
            <div key={candidate.candidateId} className="status-display status-info" style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                {candidate.group} / {candidate.property}
              </div>
              <div>Value: {candidate.value}</div>
              <div>Usage: {candidate.usageCount}</div>
              <div>Pages: {candidate.pageCount}</div>
              <div>Token-backed: {candidate.tokenBacked ? "Yes" : "No"}</div>
            </div>
          ))
        ) : (
          <div className="status-display status-neutral">No token candidates yet.</div>
        )}
      </div>

      <div style={{ marginTop: "24px" }}>
        <h4 className="section-header">Top Inconsistencies</h4>
        {overview?.topInconsistencies?.length ? (
          overview.topInconsistencies.map((item) => (
            <div key={item.inconsistencyId} className="status-display status-warning" style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>{item.summary}</div>
              <div>Type: {item.type}</div>
              <div>Category: {item.category}</div>
              <div>Impact: {item.impactScore}</div>
            </div>
          ))
        ) : (
          <div className="status-display status-neutral">No major inconsistencies detected yet.</div>
        )}
      </div>
    </div>
  );
};
