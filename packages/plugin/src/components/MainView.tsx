import React, { useState } from "react";
import { IconSettings } from "@tabler/icons-react";
import { MainViewProps } from "../types/index";
import { CrawlingTab } from "./CrawlingTab";
import { InventoryTab } from "./InventoryTab";


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
  const [activeTab, setActiveTab] = useState<"crawling" | "inventory">(
    "crawling"
  );

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


        </>
      )}
    </div>
  );
};
