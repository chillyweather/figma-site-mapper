import React, { useState, useCallback } from "react";
import {
  IconKey,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { SettingsViewProps } from "../types/index";
import { FocusedInput } from "./common/FocusedInput";

export const SettingsView: React.FC<SettingsViewProps> = ({
  url,
  screenshotWidth,
  handleScreenshotWidthChange,
  deviceScaleFactor,
  handleDeviceScaleFactorChange,
  delay,
  handleDelayChange,
  requestDelay,
  handleRequestDelayChange,
  maxRequests,
  handleMaxRequestsChange,
  defaultLanguageOnly,
  handleDefaultLanguageOnlyChange,
  fullRefresh,
  handleFullRefreshChange,
  showBrowser,
  handleShowBrowserChange,
  authMethod,
  handleAuthMethodChange,
  cookieBannerHandling,
  handleCookieBannerHandlingChange,
  authStatus,
  isLoading,
  jobId,
  switchToMain,
  // Project-related props
  projects,
  activeProjectId,
  onProjectChange,
  onCreateProject,
  onDeleteProject,
  onRefreshProjects,
  isProjectLoading,
  isCreatingProject,
  isDeletingProject,
  projectError,
}) => {
  const [newProjectName, setNewProjectName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleProjectSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      onProjectChange(value ? value : null);
      setLocalError(null);
    },
    [onProjectChange]
  );

  const handleCreateProjectWrapper = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const trimmed = newProjectName.trim();
      if (!trimmed) {
        setLocalError("Project name is required.");
        return;
      }

      try {
        setLocalError(null);
        await onCreateProject(trimmed);
        setNewProjectName("");
      } catch (error) {
        setLocalError(
          error instanceof Error
            ? error.message
            : "Unable to create project right now."
        );
      }
    },
    [newProjectName, onCreateProject]
  );

  const handleDeleteProject = useCallback(async () => {
    if (!activeProjectId) return;
    const project = projects.find((p) => p._id === activeProjectId);
    const name = project?.name || "this project";
    const confirmed = window.confirm(
      `Delete "${name}"? All pages and elements for this project will be permanently removed.`
    );
    if (!confirmed) return;
    try {
      setLocalError(null);
      await onDeleteProject(activeProjectId);
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Unable to delete project right now."
      );
    }
  }, [activeProjectId, projects, onDeleteProject]);

  return (
    <div id="settings-view" className="container">
      <div id="settings-header" className="settings-header">
        <button
          id="settings-back-button"
          onClick={switchToMain}
          className="back-button"
        >
          ← Back
        </button>
        <h3 id="settings-title" className="settings-title">
          Settings
        </h3>
      </div>

      {/* Project Selection Section */}
      <div id="project-selection-section" className="settings-section">
        <label className="form-label">
          Project
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <select
            id="project-select"
            value={activeProjectId ? activeProjectId : ""}
            onChange={handleProjectSelect}
            disabled={isProjectLoading}
            className="form-select"
          >
            <option value="">Select a project…</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              void onRefreshProjects();
            }}
            disabled={isProjectLoading}
            className="button-secondary"
            style={{ width: "auto", marginBottom: 0 }}
          >
            {isProjectLoading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleDeleteProject}
            disabled={!activeProjectId || isDeletingProject}
            className="button-secondary"
            style={{ width: "auto", marginBottom: 0 }}
            title={activeProjectId ? "Delete selected project" : "Select a project to delete"}
          >
            {isDeletingProject ? "Deleting…" : "Delete"}
          </button>
        </div>

        <form
          onSubmit={handleCreateProjectWrapper}
          style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
        >
          <input
            type="text"
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            placeholder="New project name"
            disabled={isCreatingProject}
            className="form-input"
            style={{ marginBottom: 0 }}
          />
          <button
            type="submit"
            disabled={isCreatingProject}
            className="button-primary"
            style={{ width: "auto", marginBottom: 0, whiteSpace: "nowrap" }}
          >
            {isCreatingProject ? "Creating…" : "Create Project"}
          </button>
        </form>

        {(projectError || localError) && (
          <div className="status-display status-error">
            {projectError || localError}
          </div>
        )}

        {!projects.length && !isProjectLoading && !activeProjectId && (
          <div className="status-display status-neutral">
            Create your first project to start crawling.
          </div>
        )}
      </div>

    <div id="screenshot-settings-section" className="settings-section">
      <label className="form-label">
        Screenshot Settings
      </label>
      <FocusedInput
        id="screenshot-width-input"
        key="screenshot-width-input"
        type="number"
        value={screenshotWidth}
        onChange={handleScreenshotWidthChange}
        placeholder="Screenshot width (1440)"
        disabled={isLoading || !!jobId}
        className="form-input"
        min="320"
        max="3840"
      />
      <div className="settings-description">
        Screenshot width in pixels (320-3840px)
      </div>
      <select
        id="device-scale-factor-select"
        value={deviceScaleFactor}
        onChange={handleDeviceScaleFactorChange}
        disabled={isLoading || !!jobId}
        className="form-select"
      >
        <option value="1">1x Resolution</option>
        <option value="2">2x Resolution (Higher Quality)</option>
      </select>
      <div className="settings-description">
        Higher resolution screenshots take longer to process
      </div>
    </div>

    <div id="crawl-performance-section" className="settings-section">
      <label className="form-label">
        Crawl Performance
      </label>
      <FocusedInput
        id="delay-input"
        key="delay-input"
        type="number"
        value={delay}
        onChange={handleDelayChange}
        placeholder="Delay in seconds (0)"
        disabled={isLoading || !!jobId}
        className="form-input"
        min="0"
        max="60"
      />
      <div className="settings-description">
        Additional delay after page load (0-60 seconds)
      </div>
      <FocusedInput
        id="request-delay-input"
        key="request-delay-input"
        type="number"
        value={requestDelay}
        onChange={handleRequestDelayChange}
        placeholder="Delay between requests in ms (1000)"
        disabled={isLoading || !!jobId}
        className="form-input"
        min="0"
        max="10000"
      />
      <div className="settings-description">
        Delay between requests to avoid rate limiting (0-10000ms)
      </div>
    </div>

    <div id="crawl-limits-section" className="settings-section">
      <label className="form-label">
        Crawl Limits
      </label>
      <FocusedInput
        id="max-requests-input"
        key="max-requests-input"
        type="number"
        value={maxRequests}
        onChange={handleMaxRequestsChange}
        placeholder="Max requests (10)"
        disabled={isLoading || !!jobId}
        className="form-input"
        min="0"
      />
      <div className="settings-description">
        Leave empty, 0, or ≥999 for unlimited requests
      </div>
      <label className="settings-label">
        <input
          id="default-language-only-checkbox"
          type="checkbox"
          checked={defaultLanguageOnly}
          onChange={handleDefaultLanguageOnlyChange}
          disabled={isLoading || !!jobId}
        />
        Crawl only default language pages
      </label>
      <div className="settings-description">
        Detects language from URL patterns like /en/, /fr/, ?lang=de, etc.
      </div>
      <label className="settings-label">
        <input
          id="full-refresh-checkbox"
          type="checkbox"
          checked={fullRefresh}
          onChange={handleFullRefreshChange}
          disabled={isLoading || !!jobId}
        />
        Treat this crawl as a full refresh
      </label>
      <div className="settings-description">
        When enabled, pages not visited in this crawl are removed from the
        project.
      </div>
      <label className="settings-label">
        <input
          id="show-browser-checkbox"
          type="checkbox"
          checked={showBrowser}
          onChange={handleShowBrowserChange}
          disabled={isLoading || !!jobId}
        />
        Show browser window during crawl
      </label>
      <div className="settings-description">
        Keep browser visible for manual intervention (CAPTCHA, login, etc.)
      </div>
    </div>

    <div id="authentication-section" className="settings-section">
      <label className="form-label">
        Authentication
      </label>
      <select
        id="auth-method-select"
        value={authMethod}
        onChange={handleAuthMethodChange}
        disabled={isLoading || !!jobId}
        className="form-select"
        style={{ marginBottom: "8px" }}
      >
        <option value="none">No Authentication</option>
        <option value="manual">Manual (Browser Session)</option>
      </select>

      {authMethod === "manual" && (
        <div id="auth-manual-section" style={{ marginBottom: "8px" }}>
          <div className="settings-description" style={{ lineHeight: 1.4 }}>
            <div>Opens a browser where you can manually log in or solve CAPTCHA.</div>
            <div>
              Close the browser window (Cmd+Q / Ctrl+Q) once authenticated so cookies
              can be captured automatically.
            </div>
            <div>
              You can also start this flow from the Crawling tab using the new
              <span style={{ fontWeight: 600 }}> Authorize</span> button.
            </div>
          </div>

          <button
            id="open-auth-browser-button"
            type="button"
            onClick={() => {
              if (!url.trim()) {
                alert("Please enter a URL first (in the main view)");
                return;
              }
              parent.postMessage(
                {
                  pluginMessage: {
                    type: "open-auth-session",
                    url: url.trim(),
                  },
                },
                "*"
              );
            }}
            disabled={isLoading || !!jobId || !url.trim()}
            className="button-primary"
            style={{ width: "100%" }}
          >
            {authStatus === "authenticating"
              ? "Browser Open - Complete auth and close..."
              : "Open Authentication Browser"}
          </button>
          {authStatus === "success" && (
            <div className="status-display status-success" style={{ marginTop: "4px" }}>
              <IconCheck size={12} />
              Authentication successful - cookies captured
            </div>
          )}
          {authStatus === "failed" && (
            <div className="status-display status-error" style={{ marginTop: "4px" }}>
              <IconX size={12} />
              Authentication failed
            </div>
          )}
        </div>
      )}
    </div>

    <div id="cookie-banner-section" className="settings-section">
      <label className="form-label">
        Cookie Banners
      </label>
      <select
        id="cookie-banner-handling-select"
        value={cookieBannerHandling}
        onChange={handleCookieBannerHandlingChange}
        disabled={isLoading || !!jobId}
        className="form-select"
        style={{ marginBottom: "8px" }}
      >
        <option value="auto">Auto accept or hide common banners</option>
        <option value="hide">Hide common banners only</option>
        <option value="off">Leave banners visible</option>
      </select>
      <div className="settings-description">
        Applied before screenshots are captured. Use manual authorization first for sites
        that require a real consent cookie.
      </div>
    </div>

</div>
  );
};
