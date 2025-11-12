import React, { useCallback, useState } from "react";
import { IconSettings } from "@tabler/icons-react";
import { MainViewProps } from "../types/index";
import { CrawlingTab } from "./CrawlingTab";
import { FlowsTab } from "./FlowsTab";
import { MarkupTab } from "./MarkupTab";
import { StylingTab } from "./StylingTab";
import { TokensTab } from "./TokensTab";

export const MainView: React.FC<MainViewProps> = ({
  projects,
  activeProjectId,
  onProjectChange,
  onCreateProject,
  onRefreshProjects,
  isProjectLoading,
  isCreatingProject,
  projectError,
  url,
  handleUrlChange,
  isLoading,
  jobId,
  handleSubmit,
  status,
  handleClose,
  switchToSettings,
  badgeLinks,
  checkedLinks,
  handleLinkCheck,
  handleShowFlow,
  flowProgress,
  crawlProgress,
  categorizedElements: _categorizedElements,
  elementFilters: _elementFilters,
  onElementFilterChange: _onElementFilterChange,
  handleShowStyling,
  manifestData: _manifestData,
  selectedPageUrl: _selectedPageUrl,
  onPageSelection: _onPageSelection,
  markupFilters,
  supportedMarkupFilters,
  onMarkupFilterChange,
  onRenderMarkup,
  onClearMarkup,
  isMarkupRendering,
  markupStatus,
  activeMarkupPage,
  selectedMarkupFilterCount,
  handleRenderSnapshot,
  isRenderingSnapshot,
}) => {
  // Styling state
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isRenderingGlobalStyles, setIsRenderingGlobalStyles] = useState(false);
  const [isRenderingElementStyles, setIsRenderingElementStyles] = useState(false);
  const [globalStylesStatus, setGlobalStylesStatus] = useState("");
  const [elementStylesStatus, setElementStylesStatus] = useState("");

  const [activeTab, setActiveTab] = useState<
    "crawling" | "flows" | "styling" | "markup" | "tokens"
  >("crawling");
  const [newProjectName, setNewProjectName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const projectSelected = Boolean(activeProjectId);

  // Styling handlers
  const handleRenderGlobalStyles = () => {
    setIsRenderingGlobalStyles(true);
    setGlobalStylesStatus("Rendering global styles...");
    
    parent.postMessage(
      { pluginMessage: { type: "render-global-styles" } },
      "*"
    );
    
    // Reset after a delay (actual completion handled by plugin message)
    setTimeout(() => {
      setIsRenderingGlobalStyles(false);
      setGlobalStylesStatus("");
    }, 3000);
  };

  const handleRenderElementStyles = (elementId: string) => {
    if (!elementId) return;
    
    setIsRenderingElementStyles(true);
    setElementStylesStatus("Rendering element styles...");
    
    parent.postMessage(
      { pluginMessage: { type: "render-element-styles", elementId } },
      "*"
    );
    
    // Reset after a delay (actual completion handled by plugin message)
    setTimeout(() => {
      setIsRenderingElementStyles(false);
      setElementStylesStatus("");
    }, 3000);
  };

  const handleProjectSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      onProjectChange(value ? value : null);
      setLocalError(null);
    },
    [onProjectChange]
  );

  const handleCreateProject = useCallback(
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
    <div id="main-view" style={{ fontFamily: "Inter, sans-serif" }}>
      <div
        id="main-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          padding: "16px 16px 0 16px",
        }}
      >
        <h3
          id="main-title"
          style={{ margin: "0", fontSize: "14px", fontWeight: 600 }}
        >
          Figma Site Mapper
        </h3>
        <button
          id="main-settings-button"
          onClick={switchToSettings}
          style={{
            background: "none",
            border: "1px solid #ccc",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: "12px",
            borderRadius: "3px",
          }}
        >
          <IconSettings size={16} />
        </button>
      </div>

      {/* Project-related UI moved to SettingsView */}

      {!projectSelected ? (
        <div
          style={{
            padding: "0 16px 16px 16px",
            color: "#495057",
            fontSize: "13px",
          }}
        >
          Select or create a project to enable crawling, flows, styling, and
          tokens.
        </div>
      ) : (
        <>
          <div
            id="tab-navigation"
            style={{
              display: "flex",
              marginBottom: "16px",
              borderBottom: "1px solid #e0e0e0",
              padding: "0 16px",
            }}
          >
            <button
              id="crawling-tab-button"
              onClick={() => setActiveTab("crawling")}
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: activeTab === "crawling" ? "600" : "400",
                color: activeTab === "crawling" ? "#000" : "#666",
                borderBottom:
                  activeTab === "crawling"
                    ? "2px solid #0066cc"
                    : "2px solid transparent",
              }}
            >
              Crawling
            </button>
            <button
              id="markup-tab-button"
              onClick={() => setActiveTab("markup")}
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: activeTab === "markup" ? "600" : "400",
                color: activeTab === "markup" ? "#000" : "#666",
                borderBottom:
                  activeTab === "markup"
                    ? "2px solid #0066cc"
                    : "2px solid transparent",
              }}
            >
              Markup
            </button>
            <button
              id="flows-tab-button"
              onClick={() => setActiveTab("flows")}
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: activeTab === "flows" ? "600" : "400",
                color: activeTab === "flows" ? "#000" : "#666",
                borderBottom:
                  activeTab === "flows"
                    ? "2px solid #0066cc"
                    : "2px solid transparent",
              }}
            >
              Flows
            </button>
            <button
              id="styling-tab-button"
              onClick={() => setActiveTab("styling")}
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: activeTab === "styling" ? "600" : "400",
                color: activeTab === "styling" ? "#000" : "#666",
                borderBottom:
                  activeTab === "styling"
                    ? "2px solid #0066cc"
                    : "2px solid transparent",
              }}
            >
              Styling
            </button>
            <button
              id="tokens-tab-button"
              onClick={() => setActiveTab("tokens")}
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: activeTab === "tokens" ? "600" : "400",
                color: activeTab === "tokens" ? "#000" : "#666",
                borderBottom:
                  activeTab === "tokens"
                    ? "2px solid #0066cc"
                    : "2px solid transparent",
              }}
            >
              Tokens
            </button>
          </div>

          {activeTab === "crawling" && (
            <CrawlingTab
              url={url}
              handleUrlChange={handleUrlChange}
              isLoading={isLoading}
              jobId={jobId}
              handleSubmit={handleSubmit}
              handleRenderSnapshot={handleRenderSnapshot}
              status={status}
              handleClose={handleClose}
              crawlProgress={crawlProgress}
              projectSelected={projectSelected}
              isRenderingSnapshot={isRenderingSnapshot}
            />
          )}

          {activeTab === "markup" && (
            <MarkupTab
              filters={markupFilters}
              supportedFilters={supportedMarkupFilters}
              onFilterChange={onMarkupFilterChange}
              onRender={onRenderMarkup}
              onClear={onClearMarkup}
              isRendering={isMarkupRendering}
              status={markupStatus}
              activePage={activeMarkupPage}
              selectedFilterCount={selectedMarkupFilterCount}
            />
          )}

          {activeTab === "flows" && (
            <FlowsTab
              badgeLinks={badgeLinks}
              checkedLinks={checkedLinks}
              handleLinkCheck={handleLinkCheck}
              handleShowFlow={handleShowFlow}
              flowProgress={flowProgress}
            />
          )}

          {activeTab === "styling" && (
            <StylingTab
              onRenderGlobalStyles={handleRenderGlobalStyles}
              onRenderElementStyles={handleRenderElementStyles}
              isRenderingGlobalStyles={isRenderingGlobalStyles}
              isRenderingElementStyles={isRenderingElementStyles}
              globalStylesStatus={globalStylesStatus}
              elementStylesStatus={elementStylesStatus}
              selectedElementId={selectedElementId}
            />
          )}

          {activeTab === "tokens" && <TokensTab />}
        </>
      )}
    </div>
  );
};
