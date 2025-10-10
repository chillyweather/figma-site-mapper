import React from "react";
import { CrawlingTabProps } from "../types/index";
import { FocusedInput } from "./common/FocusedInput";

export const CrawlingTab: React.FC<CrawlingTabProps> = ({
  url,
  handleUrlChange,
  isLoading,
  jobId,
  handleSubmit,
  status,
  handleClose,
}) => (
  <div id="crawling-tab">
    <div id="crawl-form" style={{ marginBottom: "16px" }}>
      <FocusedInput
        id="url-input"
        key="url-input"
        type="url"
        value={url}
        onChange={handleUrlChange}
        placeholder="https://example.com"
        required
        disabled={isLoading || !!jobId}
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          marginBottom: "8px",
        }}
      />

      <button
        id="start-crawl-button"
        onClick={handleSubmit}
        disabled={isLoading || !!jobId || !url.trim()}
        style={{ width: "100%", padding: "8px 16px", marginBottom: "8px" }}
      >
        {isLoading
          ? "Starting..."
          : jobId
            ? "Crawl in Progress"
            : "Start Crawl"}
      </button>
    </div>

    {status && (
      <div
        id="crawl-status-display"
        style={{
          padding: "8px",
          backgroundColor: "#f0f0f0",
          borderRadius: "4px",
          fontSize: "11px",
          marginBottom: "12px",
          wordBreak: "break-all",
        }}
      >
        {status}
      </div>
    )}

    <button
      id="close-plugin-button"
      onClick={handleClose}
      style={{
        width: "100%",
        padding: "6px 16px",
        backgroundColor: "transparent",
        border: "1px solid #ccc",
      }}
    >
      Close
    </button>
  </div>
);
