import React from "react";
import { IconCheck, IconKey, IconX } from "@tabler/icons-react";
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
  authStatus,
  authMethod,
  onAuthorize,
}) => {
  const disableActions =
    isLoading || isRenderingSnapshot || !!jobId || !projectSelected;
  const trimmedUrl = url.trim();
  const authorizeDisabled = disableActions || !trimmedUrl;

  const authorizeLabel = (() => {
    if (authStatus === "authenticating") {
      return "Browser Open – Complete auth...";
    }
    if (authStatus === "success") {
      return "Reauthorize";
    }
    if (authStatus === "failed") {
      return "Retry Authorization";
    }
    return "Authorize";
  })();

  const renderAuthStatus = () => {
    if (authStatus === "authenticating") {
      return (
        <div className="auth-status auth-status-authenticating">
          <IconKey size={12} />
          Authentication browser is open — complete login/CAPTCHA, then close
          the window.
        </div>
      );
    }

    if (authStatus === "success") {
      return (
        <div className="auth-status auth-status-success">
          <IconCheck size={12} /> Authentication successful — cookies saved for
          this domain.
        </div>
      );
    }

    if (authStatus === "failed") {
      return (
        <div className="auth-status auth-status-failed">
          <IconX size={12} /> Authentication failed — try again or update your
          credentials.
        </div>
      );
    }

    return null;
  };

  const manualReminder =
    authMethod === "manual" && authStatus !== "success" ? (
      <div className="form-hint-small">
        Manual auth is selected. Run <strong>Authorize</strong> before starting a
        crawl so the backend can reuse your session cookies.
      </div>
    ) : null;

  return (
    <div id="crawling-tab" className="container">
      {!projectSelected && (
        <div className="status-display status-warning">
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
            disabled={disableActions}
            className="form-input"
          />
          <div className="form-hint">
            Enter the complete URL of the website you want to crawl and map.
          </div>
        </div>

        <div className="form-group">
          <button
            id="authorize-button"
            type="button"
            onClick={onAuthorize}
            disabled={authorizeDisabled}
            className={`button-secondary ${authorizeDisabled ? "button-flow-disabled" : ""}`}
          >
            {authorizeLabel}
          </button>
          <div className="form-hint">
            Opens a dedicated browser so you can log in or solve CAPTCHA before
            crawling. When finished, close the browser window (Cmd+Q / Ctrl+Q)
            so cookies can be captured.
          </div>
          {renderAuthStatus()}
          {manualReminder}
        </div>

        <button
          id="start-crawl-button"
          onClick={handleSubmit}
          disabled={
            disableActions ||
            !trimmedUrl
          }
          className={`button-primary ${(!trimmedUrl || disableActions) ? "button-flow-disabled" : ""}`}
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
          disabled={disableActions}
          className={`button-secondary ${disableActions ? "button-flow-disabled" : ""}`}
        >
          {isRenderingSnapshot
            ? "Rendering Snapshot..."
            : "Render Project Snapshot"}
        </button>
      </div>


      {/* Crawl Progress */}
      <CrawlProgress progress={crawlProgress} />

      {status && (
        <div id="crawl-status-display" className="status-display">
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
};
