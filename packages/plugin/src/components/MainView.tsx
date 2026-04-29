import React, { useState, useEffect, useCallback } from "react";
import { IconSettings } from "@tabler/icons-react";
import { MainViewProps } from "../types/index";
import { CrawlingTab } from "./CrawlingTab";
import { InventoryTab } from "./InventoryTab";
import { FlowsTab } from "./FlowsTab";
import { useImportedFlows } from "../hooks/useImportedFlows";
import { useAtom, useAtomValue } from "jotai";
import { savedFlowsAtom, activeProjectIdAtom } from "../store/atoms";
import { fetchFlows, deleteFlow, fetchFlow, addFlowStep, createFlow } from "../plugin/services/apiClient";
import type { FlowRecord, FlowDraftStep } from "../types";

const TAG = "[MainView]";

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
  const [activeTab, setActiveTab] = useState<"crawling" | "inventory" | "flows">("crawling");
  const [renderingBoard, setRenderingBoard] = useState(false);

  const { importedFlows, importTrace, removeFlow, captureAndRender } = useImportedFlows();
  const [savedFlows, setSavedFlows] = useAtom(savedFlowsAtom);
  const projectId = useAtomValue(activeProjectIdAtom);

  // Load saved flows when project changes
  useEffect(() => {
    if (!activeProjectId) return;
    fetchFlows(activeProjectId)
      .then(setSavedFlows)
      .catch((err) => console.error(`${TAG} fetchFlows failed:`, err));
  }, [activeProjectId]);

  // Listen for flow board render status from plugin sandbox
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

  const handleRerenderSaved = useCallback(async (flow: FlowRecord) => {
    if (!activeProjectId) return;
    let steps = flow.steps;
    if (!steps || steps.length === 0) {
      try {
        const full = await fetchFlow(flow._id);
        steps = full.steps ?? [];
      } catch (err) {
        console.error(`${TAG} fetchFlow failed:`, err);
        return;
      }
    }

    const draftSteps: FlowDraftStep[] = steps.map((s) => ({
      sourcePageId: s.sourcePageId,
      sourceUrl: s.sourceUrl,
      sourceTitle: s.sourceUrl,
      elementId: s.elementId ?? null,
      elementSelector: s.elementSelector ?? null,
      elementText: s.elementText ?? null,
      elementBbox: s.elementBbox ?? null,
      actionLabel: s.elementText || s.elementSelector?.split(" > ").at(-1) || "(step)",
      actionKind: s.actionKind as FlowDraftStep["actionKind"],
      targetUrl: s.targetUrl ?? null,
      targetPageId: s.targetPageId ?? null,
      targetStatus: (s.targetPageId ? "captured" : s.targetUrl ? "needs-capture" : "no-target") as FlowDraftStep["targetStatus"],
    }));

    parent.postMessage({
      pluginMessage: {
        type: "render-flow-board",
        flowName: flow.name,
        flowId: flow._id,
        projectId: activeProjectId,
        steps: draftSteps,
      },
    }, "*");
  }, [activeProjectId]);

  const handleDeleteSaved = useCallback(async (flowId: string) => {
    try {
      await deleteFlow(flowId);
      if (activeProjectId) {
        const flows = await fetchFlows(activeProjectId);
        setSavedFlows(flows);
      }
    } catch (err) {
      console.error(`${TAG} deleteFlow failed:`, err);
    }
  }, [activeProjectId, setSavedFlows]);

  const projectSelected = Boolean(activeProjectId);

  return (
    <div id="main-view">
      <div id="main-header" className="header">
        <h3 id="main-title" className="header-title">Figma Site Mapper</h3>
        <button id="main-settings-button" onClick={switchToSettings} className="settings-button">
          <IconSettings size={16} />
        </button>
      </div>

      {!projectSelected ? (
        <div className="flows-empty">
          <p>No project selected</p>
          <p className="flows-empty-hint">
            Select or create a project in Settings to enable crawling and inventory.
          </p>
        </div>
      ) : (
        <>
          <div id="tab-navigation" className="tab-navigation">
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
              projectId={projectId}
              importedFlows={importedFlows}
              savedFlows={savedFlows}
              renderingBoard={renderingBoard}
              onImportTrace={importTrace}
              onRemoveImported={removeFlow}
              onCaptureAndRender={captureAndRender}
              onRerenderSaved={handleRerenderSaved}
              onDeleteSaved={handleDeleteSaved}
            />
          )}
        </>
      )}
    </div>
  );
};
