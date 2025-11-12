import React from "react";
import { CrawlingTabProps } from "../types/index";
import { FocusedInput } from "./common/FocusedInput";
import { CrawlProgress } from "./CrawlProgress";

export const CrawlingTab: React.FC<CrawlingTabProps> = ({
  url,
  handleUrlChange,
  isLoading,
  jobId,
  handleSubmit,
  handleRenderSnapshot,
  status,
  handleClose,
  crawlProgress,
  projectSelected,
  isRenderingSnapshot,
}) => (
  <div id="crawling-tab" className="container">
    {!projectSelected && (
      <div
        className="status-display"
        style={{
          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          border: "1px solid #fbbf24",
          color: "#92400e",
        }}
      >
        Select or create a project to enable crawling.
      </div>
    )}
    
    <div id="crawl-form" style={{ marginBottom: "20px" }}>
      <div className="form-group">
        <label htmlFor="url-input" className="form-label">
          Website URL
        </label>
        <FocusedInput
          id="url-input"
          key="url-input"
          type="url"
          value={url}
          onChange={handleUrlChange}
          placeholder="https://example.com"
          required
          disabled={
            isLoading || isRenderingSnapshot || !!jobId || !projectSelected
          }
          className="form-input"
        />
        <div className="form-hint">
          Enter the complete URL of the website you want to crawl and map.
        </div>
      </div>

      <button
        id="start-crawl-button"
        onClick={handleSubmit}
        disabled={
          isLoading ||
          isRenderingSnapshot ||
          !!jobId ||
          !url.trim() ||
          !projectSelected
        }
        className={`button-primary ${(!url.trim() || !projectSelected || isLoading || isRenderingSnapshot || !!jobId) ? 'button-flow-disabled' : ''}`}
      >
        {isLoading
          ? "Starting..."
          : jobId
            ? "Crawl in Progress"
            : isRenderingSnapshot
              ? "Rendering Snapshot..."
              : !projectSelected
                ? "Select a Project"
                : "Start Crawl"}
      </button>

      <button
        id="render-snapshot-button"
        onClick={handleRenderSnapshot}
        disabled={
          isLoading || isRenderingSnapshot || !!jobId || !projectSelected
        }
        className={`button-secondary ${(!projectSelected || isLoading || isRenderingSnapshot || !!jobId) ? 'button-flow-disabled' : ''}`}
        style={{
          background: isRenderingSnapshot ? undefined : "linear-gradient(135deg, #374151 0%, #1f2937 100%)",
          color: "white",
          border: "none",
        }}
      >
        {isRenderingSnapshot
          ? "Rendering Snapshot..."
          : "Render Project Snapshot"}
      </button>
    </div>

    {/* Crawl Progress */}
    <CrawlProgress progress={crawlProgress} />

    {status && (
      <div
        id="crawl-status-display"
        className="status-display"
      >
        {status}
      </div>
    )}

    <button
      id="close-plugin-button"
      onClick={handleClose}
      className="button-secondary"
    >
      Close
    </button>
  </div>
);
