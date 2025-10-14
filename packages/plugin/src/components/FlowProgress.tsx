import React from "react";
import { FlowProgress as FlowProgressType } from "../types/index";

interface FlowProgressProps {
  progress: FlowProgressType;
}

export const FlowProgress: React.FC<FlowProgressProps> = ({ progress }) => {
  if (progress.status === "idle") {
    return null;
  }

  return (
    <div
      id="flow-progress"
      style={{
        padding: "16px",
        backgroundColor: "#f8f9fa",
        borderRadius: "4px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: "500" }}>
          {progress.message}
        </span>
        <span style={{ fontSize: "11px", color: "#666" }}>
          {progress.progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: "6px",
          backgroundColor: "#e9ecef",
          borderRadius: "3px",
          overflow: "hidden",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            width: `${progress.progress}%`,
            height: "100%",
            backgroundColor:
              progress.status === "error"
                ? "#dc3545"
                : progress.status === "complete"
                  ? "#28a745"
                  : "#0066cc",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Steps list */}
      <div style={{ fontSize: "11px" }}>
        {progress.steps.map((step, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "4px",
              color:
                step.status === "error"
                  ? "#dc3545"
                  : step.status === "complete"
                    ? "#28a745"
                    : step.status === "in-progress"
                      ? "#0066cc"
                      : "#6c757d",
            }}
          >
            <span style={{ marginRight: "8px", width: "16px" }}>
              {step.status === "complete"
                ? "✓"
                : step.status === "in-progress"
                  ? "⏳"
                  : step.status === "error"
                    ? "✗"
                    : "○"}
            </span>
            <span>{step.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
