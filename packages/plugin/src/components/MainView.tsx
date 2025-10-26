import React, { useState } from "react";
import { IconSettings } from "@tabler/icons-react";
import { MainViewProps } from "../types/index";
import { CrawlingTab } from "./CrawlingTab";
import { FlowsTab } from "./FlowsTab";
import { ElementStylingTab } from "./ElementStylingTab";
import { TokensTab } from "./TokensTab";

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
  flowProgress,
  crawlProgress,
  // Element styling props
  categorizedElements,
  elementFilters,
  onElementFilterChange,
  handleShowStyling,
  manifestData,
  selectedPageUrl,
  onPageSelection,
}) => {
  const [activeTab, setActiveTab] = useState<
    "crawling" | "flows" | "styling" | "tokens"
  >("crawling");

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

      {/* Tab Navigation */}
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
          crawlProgress={crawlProgress}
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
        <ElementStylingTab handleShowStyling={handleShowStyling} />
      )}

      {activeTab === "tokens" && <TokensTab />}
    </div>
  );
};
