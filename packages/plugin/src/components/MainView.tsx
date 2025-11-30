import React, { useCallback, useState, useEffect } from "react";
import { IconSettings } from "@tabler/icons-react";
import { MainViewProps } from "../types/index";
import { CrawlingTab } from "./CrawlingTab";
import { FlowsTab } from "./FlowsTab";
import { MarkupTab } from "./MarkupTab";
import { StylingTab } from "./StylingTab";


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
  authStatus,
  authMethod,
  onAuthorize,
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
  const [selectedElementInfo, setSelectedElementInfo] = useState<{ id: string; type: string; text?: string } | null>(null);
  const [isRenderingGlobalStyles, setIsRenderingGlobalStyles] = useState(false);
  const [isRenderingElementStyles, setIsRenderingElementStyles] = useState(false);
  const [globalStylesStatus, setGlobalStylesStatus] = useState("");
  const [elementStylesStatus, setElementStylesStatus] = useState("");

  const [activeTab, setActiveTab] = useState<
    "crawling" | "flows" | "styling" | "markup"
  >("crawling");
  const [newProjectName, setNewProjectName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const projectSelected = Boolean(activeProjectId);

  // Handle element selection messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === "element-selection-changed") {
        setSelectedElementId(msg.elementId || null);
        setSelectedElementInfo(msg.elementInfo || null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Request current selection on mount and tab change
  useEffect(() => {
    if (activeTab === "styling") {
      parent.postMessage(
        { pluginMessage: { type: "get-element-selection" } },
        "*"
      );
    }
  }, [activeTab]);

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
    <div id="main-view">
      <div
        id="main-header"
        className="header"
      >
        <h3
          id="main-title"
          className="header-title"
        >
          Figma Site Mapper
        </h3>
        <button
          id="main-settings-button"
          onClick={switchToSettings}
          className="settings-button"
        >
          <IconSettings size={16} />
        </button>
      </div>

      {/* Project-related UI moved to SettingsView */}

      {!projectSelected ? (
        <div className="flows-empty">
          <p>No project selected</p>
          <p className="flows-empty-hint">
            Select or create a project to enable crawling, flows, styling, and markup features.
          </p>
        </div>
      ) : (
        <>
          <div
            id="tab-navigation"
            className="tab-navigation"
          >
            <button
              id="crawling-tab-button"
              onClick={() => setActiveTab("crawling")}
              className={`tab-button ${activeTab === "crawling" ? "tab-button-active" : "tab-button-inactive"}`}
            >
              Crawling
            </button>
            <button
              id="markup-tab-button"
              onClick={() => setActiveTab("markup")}
              className={`tab-button ${activeTab === "markup" ? "tab-button-active" : "tab-button-inactive"}`}
            >
              Markup
            </button>
            <button
              id="flows-tab-button"
              onClick={() => setActiveTab("flows")}
              className={`tab-button ${activeTab === "flows" ? "tab-button-active" : "tab-button-inactive"}`}
            >
              Flows
            </button>
            <button
              id="styling-tab-button"
              onClick={() => setActiveTab("styling")}
              className={`tab-button ${activeTab === "styling" ? "tab-button-active" : "tab-button-inactive"}`}
            >
              Styling
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
              authStatus={authStatus}
              authMethod={authMethod}
              onAuthorize={onAuthorize}
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
              selectedElementInfo={selectedElementInfo}
            />
          )}


        </>
      )}
    </div>
  );
};
