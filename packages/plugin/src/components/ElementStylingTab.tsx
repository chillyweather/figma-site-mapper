import React, { useEffect, useState } from "react";

interface ElementStylingTabProps {
  handleShowStyling: () => void;
}

export const ElementStylingTab: React.FC<ElementStylingTabProps> = ({
  handleShowStyling,
}) => {
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Request current page URL from plugin
    parent.postMessage(
      { pluginMessage: { type: "get-current-page-url" } },
      "*"
    );

    // Listen for response
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === "current-page-url") {
        setPageUrl(msg.url);
        setIsChecking(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const hasValidUrl = pageUrl !== null && pageUrl !== "";

  return (
    <div
      id="styling-tab"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100% - 108px)",
        padding: "16px",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {isChecking ? (
          <div style={{ color: "#666", fontSize: "13px" }}>
            Checking current page...
          </div>
        ) : !hasValidUrl ? (
          <div
            style={{
              textAlign: "center",
              padding: "16px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: "4px",
              maxWidth: "400px",
            }}
          >
            <div style={{ fontSize: "13px", color: "#856404", marginBottom: "8px" }}>
              ⚠️ No styling available for this page
            </div>
            <div style={{ fontSize: "11px", color: "#856404" }}>
              This page was not created by the crawler. Please select a crawled page to use styling features.
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px" }}>
              Current page: {pageUrl}
            </div>
            <button
              id="highlight-current-page-button"
              onClick={handleShowStyling}
              style={{
                padding: "12px 24px",
                backgroundColor: "#6f42c1",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              🎨 Highlight Current Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
