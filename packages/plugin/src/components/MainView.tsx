import React, { useState } from "react";
import { IconSettings } from "@tabler/icons-react";
import { MainViewProps } from "../types/index";
import { CrawlingTab } from "./CrawlingTab";
import { MappingTab } from "./MappingTab";

export const MainView: React.FC<MainViewProps> = ({
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
}) => {
  const [activeTab, setActiveTab] = useState<"crawling" | "mapping">(
    "crawling"
  );

  return (
    <div
      id="main-view"
      style={{ padding: "16px", fontFamily: "Inter, sans-serif" }}
    >
      <div
        id="main-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
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

      {/* Tab Navigation */}
      <div
        id="tab-navigation"
        style={{
          display: "flex",
          marginBottom: "16px",
          borderBottom: "1px solid #e0e0e0",
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
          id="flows-tab-button"
          onClick={() => setActiveTab("mapping")}
          style={{
            background: "none",
            border: "none",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: activeTab === "mapping" ? "600" : "400",
            color: activeTab === "mapping" ? "#000" : "#666",
            borderBottom:
              activeTab === "mapping"
                ? "2px solid #0066cc"
                : "2px solid transparent",
          }}
        >
          Flows
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "crawling" && (
        <CrawlingTab
          url={url}
          handleUrlChange={handleUrlChange}
          isLoading={isLoading}
          jobId={jobId}
          handleSubmit={handleSubmit}
          status={status}
          handleClose={handleClose}
        />
      )}

      {activeTab === "mapping" && (
        <MappingTab
          badgeLinks={badgeLinks}
          checkedLinks={checkedLinks}
          handleLinkCheck={handleLinkCheck}
          handleShowFlow={handleShowFlow}
        />
      )}
    </div>
  );
};
