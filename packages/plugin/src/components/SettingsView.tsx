import React, { useState, useCallback } from "react";
import {
  IconSettings,
  IconKey,
  IconCheck,
  IconX,
  IconInfoCircle,
} from "@tabler/icons-react";
import { SettingsViewProps } from "../types/index";
import { FocusedInput } from "./common/FocusedInput";
import {
  estimateDataSize,
  getPresetConfig,
  STYLE_PRESETS,
} from "../utils/stylePresets";

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
  maxDepth,
  handleMaxDepthChange,
  sampleSize,
  handleSampleSizeChange,
  defaultLanguageOnly,
  handleDefaultLanguageOnlyChange,
  fullRefresh,
  handleFullRefreshChange,
  showBrowser,
  handleShowBrowserChange,
  detectInteractiveElements,
  handleDetectInteractiveElementsChange,
  highlightAllElements,
  handleHighlightAllElementsChange,
  highlightElementFilters,
  handleHighlightFilterChange,
  captureOnlyVisibleElements,
  handleCaptureOnlyVisibleElementsChange,
  authMethod,
  handleAuthMethodChange,
  authStatus,
  isLoading,
  jobId,
  switchToMain,
  extractStyles,
  handleExtractStylesChange,
  styleExtractionPreset,
  handleStyleExtractionPresetChange,
  extractInteractive,
  handleExtractInteractiveChange,
  extractStructural,
  handleExtractStructuralChange,
  extractContentBlocks,
  handleExtractContentBlocksChange,
  extractFormElements,
  handleExtractFormElementsChange,
  extractCustomComponents,
  handleExtractCustomComponentsChange,
  extractColors,
  handleExtractColorsChange,
  extractTypography,
  handleExtractTypographyChange,
  extractSpacing,
  handleExtractSpacingChange,
  extractBorders,
  handleExtractBordersChange,
  extractLayout,
  handleExtractLayoutChange,
  extractCSSVariables,
  handleExtractCSSVariablesChange,
  detectPatterns,
  handleDetectPatternsChange,
  // Project-related props
  projects,
  activeProjectId,
  onProjectChange,
  onCreateProject,
  onRefreshProjects,
  isProjectLoading,
  isCreatingProject,
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
      <FocusedInput
        key="max-depth-input"
        type="number"
        value={maxDepth}
        onChange={handleMaxDepthChange}
        placeholder="Max crawl depth (2)"
        disabled={isLoading || !!jobId}
        className="form-input"
        min="1"
        max="10"
      />
      <div className="settings-description">
        How many levels deep to crawl (0 or empty = no limit, 1-10)
      </div>
      <FocusedInput
        key="sample-size-input"
        type="number"
        value={sampleSize}
        onChange={handleSampleSizeChange}
        placeholder="Pages per section (3)"
        disabled={isLoading || !!jobId}
        className="form-input"
        min="1"
        max="20"
      />
      <div className="settings-description">
        Max pages to crawl per section (0 or empty = no limit, 1-20)
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
      <label className="settings-label">
        <input
          id="detect-interactive-elements-checkbox"
          type="checkbox"
          checked={detectInteractiveElements}
          onChange={handleDetectInteractiveElementsChange}
          disabled={isLoading || !!jobId}
        />
        Detect interactive elements
      </label>
      <div className="settings-description">
        Add numbered frames around links and buttons for user journey mapping
      </div>

      <label className="settings-label" style={{ marginTop: "12px" }}>
        <input
          id="highlight-all-elements-checkbox"
          type="checkbox"
          checked={highlightAllElements}
          onChange={handleHighlightAllElementsChange}
          disabled={isLoading || !!jobId || !extractStyles}
        />
        Highlight detected elements
      </label>
      <div className="settings-description">
        Create color-coded highlights for detected elements. Requires style
        extraction to be enabled.
      </div>

      {highlightAllElements && (
        <div className="settings-group">
          <div className="settings-group-title">
            Element Types to Highlight:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.buttons}
                onChange={(e) =>
                  handleHighlightFilterChange("buttons", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#28A745", marginRight: "4px" }}>●</span>{" "}
              Buttons
            </label>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.links}
                onChange={(e) =>
                  handleHighlightFilterChange("links", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#0066CC", marginRight: "4px" }}>●</span>{" "}
              Links
            </label>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.inputs}
                onChange={(e) =>
                  handleHighlightFilterChange("inputs", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#FD7E14", marginRight: "4px" }}>●</span>{" "}
              Form Inputs
            </label>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.textareas}
                onChange={(e) =>
                  handleHighlightFilterChange("textareas", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#FD7E14", marginRight: "4px" }}>●</span>{" "}
              Textareas
            </label>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.selects}
                onChange={(e) =>
                  handleHighlightFilterChange("selects", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#FD7E14", marginRight: "4px" }}>●</span>{" "}
              Selects
            </label>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.headings}
                onChange={(e) =>
                  handleHighlightFilterChange("headings", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#6F42C1", marginRight: "4px" }}>●</span>{" "}
              Headings
            </label>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.images}
                onChange={(e) =>
                  handleHighlightFilterChange("images", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#20C997", marginRight: "4px" }}>●</span>{" "}
              Images
            </label>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.paragraphs}
                onChange={(e) =>
                  handleHighlightFilterChange("paragraphs", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#6C757D", marginRight: "4px" }}>●</span>{" "}
              Paragraphs
            </label>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.divs}
                onChange={(e) =>
                  handleHighlightFilterChange("divs", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#6C757D", marginRight: "4px" }}>●</span>{" "}
              Divs
            </label>
            <label className="settings-label">
              <input
                type="checkbox"
                checked={highlightElementFilters.other}
                onChange={(e) =>
                  handleHighlightFilterChange("other", e.target.checked)
                }
                disabled={isLoading || !!jobId}
              />
              <span style={{ color: "#6C757D", marginRight: "4px" }}>●</span>{" "}
              Other
            </label>
          </div>
        </div>
      )}
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

      {authStatus === "authenticating" && (
        <div className="status-display status-warning" style={{ marginTop: "4px" }}>
          <IconKey size={12} />
          Authenticating...
        </div>
      )}
      {authStatus === "success" && (
        <div className="status-display status-success" style={{ marginTop: "4px" }}>
          <IconCheck size={12} />
          Authentication successful
        </div>
      )}
      {authStatus === "failed" && (
        <div className="status-display status-error" style={{ marginTop: "4px" }}>
          <IconX size={12} />
          Authentication failed - will crawl public pages only
        </div>
      )}
    </div>

    {/* Style Extraction Section */}
    <div id="style-extraction-section" className="settings-section" style={{ marginTop: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <label className="settings-label">
          <input
            type="checkbox"
            checked={extractStyles}
            onChange={handleExtractStylesChange}
            disabled={isLoading || !!jobId}
          />
          Extract DOM & Style Data
        </label>
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <IconInfoCircle
            size={14}
            style={{ color: "#666", cursor: "help" }}
            title="Extracts structural and styling information from pages for design token generation and component analysis"
          />
        </div>
      </div>

      {extractStyles && (
        <div className="settings-group">
          {/* Preset Selector */}
          <div style={{ marginBottom: "12px" }}>
            <label className="form-label">
              Extraction Preset
            </label>
            <select
              value={styleExtractionPreset}
              onChange={handleStyleExtractionPresetChange}
              disabled={isLoading || !!jobId}
              className="form-select"
            >
              <option value="smart">Smart (Recommended)</option>
              <option value="minimal">Minimal (Smallest)</option>
              <option value="complete">Complete (Largest)</option>
              <option value="custom">Custom...</option>
            </select>
            <div className="settings-description">
              {styleExtractionPreset === "smart" &&
                "Interactive + structural + styled elements"}
              {styleExtractionPreset === "minimal" &&
                "Interactive elements only"}
              {styleExtractionPreset === "complete" && "All visible elements"}
              {styleExtractionPreset === "custom" && "Configure options below"}
            </div>
          </div>

          {/* Custom Options */}
          {styleExtractionPreset === "custom" && (
            <div style={{ marginTop: "12px" }}>
              {/* Element Types */}
              <div style={{ marginBottom: "12px" }}>
                <div className="settings-group-title">
                  Element Types
                </div>
                <div className="settings-checkbox-list">
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractInteractive}
                      onChange={handleExtractInteractiveChange}
                      disabled={isLoading || !!jobId}
                    />
                    Interactive elements (buttons, links, inputs)
                  </label>
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractStructural}
                      onChange={handleExtractStructuralChange}
                      disabled={isLoading || !!jobId}
                    />
                    Structural components (header, nav, footer)
                  </label>
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractContentBlocks}
                      onChange={handleExtractContentBlocksChange}
                      disabled={isLoading || !!jobId}
                    />
                    Content blocks (cards, articles, lists)
                  </label>
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractFormElements}
                      onChange={handleExtractFormElementsChange}
                      disabled={isLoading || !!jobId}
                    />
                    Form elements (forms, labels, fieldsets)
                  </label>
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractCustomComponents}
                      onChange={handleExtractCustomComponentsChange}
                      disabled={isLoading || !!jobId}
                    />
                    Custom components (experimental)
                  </label>
                </div>
              </div>

              {/* Style Properties */}
              <div style={{ marginBottom: "12px" }}>
                <div className="settings-group-title">
                  Style Properties
                </div>
                <div className="settings-checkbox-list">
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractColors}
                      onChange={handleExtractColorsChange}
                      disabled={isLoading || !!jobId}
                    />
                    Colors & backgrounds
                  </label>
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractTypography}
                      onChange={handleExtractTypographyChange}
                      disabled={isLoading || !!jobId}
                    />
                    Typography (font, size, weight)
                  </label>
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractSpacing}
                      onChange={handleExtractSpacingChange}
                      disabled={isLoading || !!jobId}
                    />
                    Spacing (margin, padding)
                  </label>
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractBorders}
                      onChange={handleExtractBordersChange}
                      disabled={isLoading || !!jobId}
                    />
                    Borders & effects (shadows, radius)
                  </label>
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractLayout}
                      onChange={handleExtractLayoutChange}
                      disabled={isLoading || !!jobId}
                    />
                    Layout properties (display, flex, grid)
                  </label>
                </div>
              </div>

              {/* Additional Options */}
              <div>
                <div className="settings-group-title">
                  Additional Options
                </div>
                <div className="settings-checkbox-list">
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={extractCSSVariables}
                      onChange={handleExtractCSSVariablesChange}
                      disabled={isLoading || !!jobId}
                    />
                    Extract CSS variables (custom properties)
                  </label>
                  <label className="settings-label">
                    <input
                      type="checkbox"
                      checked={detectPatterns}
                      onChange={handleDetectPatternsChange}
                      disabled={isLoading || !!jobId}
                    />
                    Detect design patterns (auto-identify components)
                  </label>
                </div>
              </div>
            </div>
          )}


          {/* Data Size Estimate */}
          <div className="status-display status-info" style={{ marginTop: "12px", fontSize: "10px" }}>
            <IconInfoCircle size={12} />
            <span>
              Estimated data:{" "}
              {estimateDataSize(
                styleExtractionPreset === "custom"
                  ? {
                      extractInteractive,
                      extractStructural,
                      extractContentBlocks,
                      extractFormElements,
                      extractCustomComponents,
                      extractColors,
                      extractTypography,
                      extractSpacing,
                      extractBorders,
                      extractLayout,
                      extractCSSVariables,
                      detectPatterns,
                    }
                  : getPresetConfig(styleExtractionPreset as any) ||
                      STYLE_PRESETS.smart,
                parseInt(maxRequests) || 10
              )}{" "}
              for {maxRequests || 10} pages
            </span>
          </div>
        </div>
      )}
    </div>
</div>
  );
};
