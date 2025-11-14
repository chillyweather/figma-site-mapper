import React, { useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import { activeProjectIdAtom } from "../store/atoms";
import { BACKEND_URL } from "../plugin/constants";

interface StylingTabProps {
  onRenderGlobalStyles: () => void;
  onRenderElementStyles: (elementId: string) => void;
  isRenderingGlobalStyles: boolean;
  isRenderingElementStyles: boolean;
  globalStylesStatus: string;
  elementStylesStatus: string;
  selectedElementId: string | null;
  selectedElementInfo: { id: string; type: string; text?: string } | null;
}

interface GlobalStylesData {
  cssVariables: Record<string, string>;
  pages: Array<{
    pageId: string;
    url: string;
    title: string;
    cssVariableCount: number;
  }>;
}



export const StylingTab: React.FC<StylingTabProps> = ({
  onRenderGlobalStyles,
  onRenderElementStyles,
  isRenderingGlobalStyles,
  isRenderingElementStyles,
  globalStylesStatus,
  elementStylesStatus,
  selectedElementId,
  selectedElementInfo,
}) => {
  const activeProjectId = useAtomValue(activeProjectIdAtom);
  const [currentPageUrl, setCurrentPageUrl] = useState<string | null>(null);
  const [globalStylesData, setGlobalStylesData] = useState<GlobalStylesData | null>(null);

  // Check if we have project and styling data
  const hasProject = Boolean(activeProjectId);
  const isPageReady = Boolean(currentPageUrl);

  // Fetch current page URL
  useEffect(() => {
    parent.postMessage(
      { pluginMessage: { type: "get-current-page-url" } },
      "*"
    );

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === "current-page-url") {
        setCurrentPageUrl(msg.url);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Fetch global styles data when component mounts
  useEffect(() => {
    if (hasProject) {
      fetchGlobalStyles();
    }
  }, [hasProject]);



  const fetchGlobalStyles = async () => {
    if (!activeProjectId) return;

    try {
      const response = await fetch(`${BACKEND_URL}/styles/global?projectId=${activeProjectId}`);
      const data = await response.json();
      setGlobalStylesData(data as GlobalStylesData);
    } catch (error) {
      console.error("Failed to fetch global styles:", error);
    }
  };





  const canRenderGlobalStyles = hasProject && globalStylesData && 
    globalStylesData.cssVariables && Object.keys(globalStylesData.cssVariables).length > 0;

  const canRenderElementStyles = hasProject && selectedElementId && selectedElementInfo;

  return (
    <div className="container">
      {/* Project Status */}
      {!hasProject && (
        <div
          className="status-display"
          style={{
            background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
            border: "1px solid #fbbf24",
            color: "#92400e",
          }}
        >
          Select a project to access styling features.
        </div>
      )}

      {/* Global Styles Section */}
      <div style={{ marginBottom: "32px" }}>
        <h4 className="section-header">
          Global Styles
        </h4>
        
        <div
          className="status-display"
          style={{
            background: globalStylesData 
              ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
              : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            border: globalStylesData ? "1px solid #34d399" : "1px solid #e2e8f0",
            color: globalStylesData ? "#065f46" : "#64748b",
          }}
        >
          {globalStylesData ? (
            <div>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                CSS Variables: {Object.keys(globalStylesData.cssVariables || {}).length}
              </div>
              <div>
                Source Pages: {globalStylesData.pages?.length || 0}
              </div>
            </div>
          ) : (
            <div>Loading styles...</div>
          )}
        </div>

        <button
          onClick={onRenderGlobalStyles}
          disabled={!canRenderGlobalStyles || isRenderingGlobalStyles}
          className={`button-primary ${!canRenderGlobalStyles || isRenderingGlobalStyles ? 'button-flow-disabled' : ''}`}
          style={{
            background: canRenderGlobalStyles && !isRenderingGlobalStyles 
              ? "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
              : undefined,
          }}
        >
          {isRenderingGlobalStyles ? "Rendering..." : "Render Global Styles"}
        </button>

        {globalStylesStatus && (
          <div className="status-display" style={{ textAlign: "center" }}>
            {globalStylesStatus}
          </div>
        )}
      </div>

      {/* Element Styles Section */}
      <div style={{ marginBottom: "24px" }}>
        <h4 className="section-header">
          Element Styles
        </h4>

        {/* Current Page Info */}
        <div
          className="status-display"
          style={{
            background: isPageReady 
              ? "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)"
              : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            border: isPageReady ? "1px solid #60a5fa" : "1px solid #e2e8f0",
            color: isPageReady ? "#1e40af" : "#64748b",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
            Active Page
          </div>
          {isPageReady ? (
            <div style={{ fontSize: "12px" }}>
              {currentPageUrl}
            </div>
          ) : (
            <div>
              Open one of the generated screenshot pages to enable element styling.
            </div>
          )}
        </div>

        {/* Selected Element Info */}
        {isPageReady && (
          <div style={{ marginBottom: "16px" }}>
            <div className="section-header" style={{ fontSize: "12px", marginBottom: "8px" }}>
              Selected Element
            </div>
            
            {selectedElementInfo ? (
              <div
                className="status-display"
                style={{
                  background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                  border: "1px solid #60a5fa",
                  color: "#1e40af",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                  {selectedElementInfo.type}
                  {selectedElementInfo.text ? ` (${selectedElementInfo.text.substring(0, 30)}${selectedElementInfo.text.length > 30 ? '...' : ''})` : ''}
                </div>
                <div style={{ fontSize: "10px", opacity: 0.8 }}>
                  ID: {selectedElementInfo.id.substring(0, 8)}...
                </div>
              </div>
            ) : (
              <div className="status-display" style={{ 
                textAlign: "center",
                background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                border: "1px solid #fbbf24",
                color: "#92400e",
              }}>
                Select a badge or highlight frame to enable element styling
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => selectedElementId && onRenderElementStyles(selectedElementId)}
          disabled={!canRenderElementStyles || isRenderingElementStyles}
          className={`button-primary ${!canRenderElementStyles || isRenderingElementStyles ? 'button-flow-disabled' : ''}`}
          style={{
            background: canRenderElementStyles && !isRenderingElementStyles 
              ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              : undefined,
          }}
        >
          {isRenderingElementStyles ? "Rendering..." : "Render Element Styles"}
        </button>

        {elementStylesStatus && (
          <div className="status-display" style={{ textAlign: "center" }}>
            {elementStylesStatus}
          </div>
        )}
      </div>
    </div>
  );
};