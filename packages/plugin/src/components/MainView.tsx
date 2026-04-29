import React, { useState, useEffect, useCallback } from "react";
import { IconSettings } from "@tabler/icons-react";
import { MainViewProps } from "../types/index";
import { CrawlingTab } from "./CrawlingTab";
import { InventoryTab } from "./InventoryTab";
import { FlowsTab } from "./FlowsTab";
import { useFlowBuilder } from "../hooks/useFlowBuilder";


export const MainView: React.FC<MainViewProps> = ({
  activeProjectId,
  url,
  handleUrlChange,
  isLoading,
  jobId,
  status,
  switchToSettings,
  crawlProgress,
  isRenderingSnapshot,
}) => {
  const [activeTab, setActiveTab] = useState<"crawling" | "inventory" | "flows">(
    "crawling"
  );

  const flowBuilder = useFlowBuilder();
  const [renderingBoard, setRenderingBoard] = useState(false);

  // Auto-load saved flows when project changes
  useEffect(() => {
    if (activeProjectId) {
      flowBuilder.loadSavedFlows();
    }
  }, [activeProjectId]);

  // Listen for flow board render responses from plugin sandbox
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;
      if (msg.type === "flow-board-render-started") setRenderingBoard(true);
      if (msg.type === "flow-board-render-complete") setRenderingBoard(false);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const projectSelected = Boolean(activeProjectId);

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
            Select or create a project in Settings to enable crawling and inventory.
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
              id="inventory-tab-button"
              onClick={() => setActiveTab("inventory")}
              className={`tab-button ${activeTab === "inventory" ? "tab-button-active" : "tab-button-inactive"}`}
            >
              Inventory
            </button>
            <button
              id="flows-tab-button"
              onClick={() => setActiveTab("flows")}
              className={`tab-button ${activeTab === "flows" ? "tab-button-active" : "tab-button-inactive"}`}
            >
              Flows
            </button>
          </div>

          {activeTab === "crawling" && (
            <CrawlingTab
              url={url}
              handleUrlChange={handleUrlChange}
              isLoading={isLoading}
              jobId={jobId}
              status={status}
              crawlProgress={crawlProgress}
              projectSelected={projectSelected}
              isRenderingSnapshot={isRenderingSnapshot}
            />
          )}

          {activeTab === "inventory" && (
            <InventoryTab activeProjectId={activeProjectId} />
          )}

          {activeTab === "flows" && (
            <FlowsTab
              activePage={flowBuilder.activePage}
              actions={flowBuilder.actions}
              actionsLoading={flowBuilder.actionsLoading}
              draftSteps={flowBuilder.draftSteps}
              draftName={flowBuilder.draftName}
              selectedAction={flowBuilder.selectedAction}
              savedFlows={flowBuilder.savedFlows}
              activeFlowId={flowBuilder.activeFlowId}
              capturing={flowBuilder.capturing}
              onPreview={flowBuilder.previewAction}
              onClearPreview={flowBuilder.clearPreview}
              onAddStep={flowBuilder.addStep}
              onRemoveStep={flowBuilder.removeStep}
              onMoveStepUp={flowBuilder.moveStepUp}
              onMoveStepDown={flowBuilder.moveStepDown}
              onClearDraft={flowBuilder.clearDraft}
              onDraftNameChange={flowBuilder.setDraftName}
              onCaptureTarget={flowBuilder.captureTarget}
              onContinueFromTarget={flowBuilder.continueFromTarget}
              onSaveFlow={flowBuilder.saveFlow}
              onLoadFlow={flowBuilder.loadFlowIntoDraft}
              onDeleteFlow={flowBuilder.deleteSavedFlow}
              onRenameFlow={flowBuilder.renameFlow}
              onDuplicateFlow={flowBuilder.duplicateFlow}
              onRerenderFlow={flowBuilder.rerenderSavedFlow}
              onRenderBoard={flowBuilder.renderBoard}
              renderingBoard={renderingBoard}
            />
          )}


        </>
      )}
    </div>
  );
};
