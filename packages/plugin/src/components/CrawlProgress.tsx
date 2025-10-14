import React from "react";
import { CrawlProgress as CrawlProgressType } from "../types/index";

interface CrawlProgressProps {
  progress: CrawlProgressType;
}

export const CrawlProgress: React.FC<CrawlProgressProps> = ({ progress }) => {
  if (progress.status === "idle") {
    return null;
  }

  // Determine progress bar color based on status
  const getProgressColor = () => {
    if (progress.status === "error") return "#dc3545";
    if (progress.status === "complete") return "#28a745";
    if (progress.status === "rendering") return "#9333ea";
    return "#0066cc";
  };

  return (
    <div
      id="crawl-progress"
      style={{
        padding: "12px",
        backgroundColor: "#f8f9fa",
        borderRadius: "4px",
        marginBottom: "16px",
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: "6px",
          backgroundColor: "#e9ecef",
          borderRadius: "3px",
          overflow: "hidden",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            width: `${progress.progress}%`,
            height: "100%",
            backgroundColor: getProgressColor(),
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Status message */}
      <div
        style={{
          fontSize: "11px",
          color: "#495057",
          marginBottom: "4px",
        }}
      >
        {progress.message}
      </div>

      {/* Current URL being crawled */}
      {progress.currentUrl && (
        <div
          style={{
            fontSize: "10px",
            color: "#6c757d",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: "4px",
          }}
        >
          {progress.currentUrl}
        </div>
      )}

      {/* Page counter */}
      {progress.currentPage && progress.totalPages && (
        <div
          style={{
            fontSize: "10px",
            color: "#6c757d",
          }}
        >
          Page {progress.currentPage} of {progress.totalPages} •{" "}
          {progress.progress}%
        </div>
      )}
    </div>
  );
};
