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
}

interface GlobalStylesData {
  cssVariables: Record<string, string>;
  tokens: string[];
  pages: Array<{
    pageId: string;
    url: string;
    title: string;
    cssVariableCount: number;
    tokenCount: number;
  }>;
}

interface ElementData {
  _id: string;
  type: string;
  styles?: Record<string, string>;
  text?: string;
  selector: string;
}

export const StylingTab: React.FC<StylingTabProps> = ({
  onRenderGlobalStyles,
  onRenderElementStyles,
  isRenderingGlobalStyles,
  isRenderingElementStyles,
  globalStylesStatus,
  elementStylesStatus,
  selectedElementId,
}) => {
  const activeProjectId = useAtomValue(activeProjectIdAtom);
  const [currentPageUrl, setCurrentPageUrl] = useState<string | null>(null);
  const [globalStylesData, setGlobalStylesData] = useState<GlobalStylesData | null>(null);
  const [availableElements, setAvailableElements] = useState<ElementData[]>([]);
  const [isLoadingElements, setIsLoadingElements] = useState(false);

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

  // Fetch elements when current page URL changes
  useEffect(() => {
    if (hasProject && isPageReady) {
      fetchPageElements();
    }
  }, [hasProject, isPageReady]);

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

  const fetchPageElements = async () => {
    if (!activeProjectId || !currentPageUrl) return;

    setIsLoadingElements(true);
    try {
      const response = await fetch(`${BACKEND_URL}/elements?projectId=${activeProjectId}&url=${encodeURIComponent(currentPageUrl)}`);
      const data = await response.json();
      const elementsData = (data as { elements: ElementData[] }).elements || [];
      setAvailableElements(elementsData.filter(el => el.styles && Object.keys(el.styles).length > 0));
    } catch (error) {
      console.error("Failed to fetch elements:", error);
      setAvailableElements([]);
    } finally {
      setIsLoadingElements(false);
    }
  };

  const handleElementSelect = (elementId: string) => {
    if (selectedElementId === elementId) {
      // Deselect if already selected
      parent.postMessage(
        { pluginMessage: { type: "select-element-style", elementId: null } },
        "*"
      );
    } else {
      // Select new element
      parent.postMessage(
        { pluginMessage: { type: "select-element-style", elementId } },
        "*"
      );
    }
  };

  const canRenderGlobalStyles = hasProject && globalStylesData && 
    (globalStylesData.cssVariables && Object.keys(globalStylesData.cssVariables).length > 0 ||
     globalStylesData.tokens && globalStylesData.tokens.length > 0);

  const canRenderElementStyles = hasProject && selectedElementId && availableElements.length > 0;

  return (
    <div style={{ padding: "0 16px 16px 16px" }}>
      {/* Project Status */}
      {!hasProject && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "4px",
            marginBottom: "16px",
            fontSize: "11px",
          }}
        >
          Select a project to access styling features.
        </div>
      )}

      {/* Global Styles Section */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
          Global Styles
        </div>
        
        <div
          style={{
            padding: "12px",
            backgroundColor: "#f8f9fa",
            borderRadius: "6px",
            marginBottom: "12px",
          }}
        >
          {globalStylesData ? (
            <div style={{ fontSize: "11px", color: "#495057" }}>
              <div>
                CSS Variables: {Object.keys(globalStylesData.cssVariables || {}).length}
              </div>
              <div>
                Style Tokens: {globalStylesData.tokens?.length || 0}
              </div>
              <div>
                Source Pages: {globalStylesData.pages?.length || 0}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "#6c757d" }}>
              Loading styles...
            </div>
          )}
        </div>

        <button
          onClick={onRenderGlobalStyles}
          disabled={!canRenderGlobalStyles || isRenderingGlobalStyles}
          style={{
            padding: "10px 16px",
            backgroundColor: canRenderGlobalStyles && !isRenderingGlobalStyles ? "#6f42c1" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: canRenderGlobalStyles && !isRenderingGlobalStyles ? "pointer" : "not-allowed",
            fontSize: "14px",
            fontWeight: 500,
            width: "100%",
          }}
        >
          {isRenderingGlobalStyles ? "Rendering..." : "Render Global Styles"}
        </button>

        {globalStylesStatus && (
          <div style={{ fontSize: "11px", color: "#6c757d", marginTop: "8px", textAlign: "center" }}>
            {globalStylesStatus}
          </div>
        )}
      </div>

      {/* Element Styles Section */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
          Element Styles
        </div>

        {/* Current Page Info */}
        <div
          style={{
            padding: "12px",
            backgroundColor: isPageReady ? "#e7f3ff" : "#f8f9fa",
            borderRadius: "6px",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
            Active Page
          </div>
          {isPageReady ? (
            <div style={{ fontSize: "11px", color: "#343a40" }}>
              {currentPageUrl}
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "#6c757d" }}>
              Open one of the generated screenshot pages to enable element styling.
            </div>
          )}
        </div>

        {/* Elements List */}
        {isPageReady && (
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, marginBottom: "8px" }}>
              Available Elements
            </div>
            
            {isLoadingElements ? (
              <div style={{ fontSize: "11px", color: "#6c757d", textAlign: "center", padding: "8px" }}>
                Loading elements...
              </div>
            ) : availableElements.length === 0 ? (
              <div style={{ fontSize: "11px", color: "#6c757d", textAlign: "center", padding: "8px" }}>
                No styled elements found on this page.
              </div>
            ) : (
              <div style={{ maxHeight: "120px", overflowY: "auto", border: "1px solid #e9ecef", borderRadius: "4px" }}>
                {availableElements.map((element) => (
                  <label
                    key={element._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderBottom: "1px solid #f1f3f4",
                      cursor: "pointer",
                      fontSize: "11px",
                      backgroundColor: selectedElementId === element._id ? "#e3f2fd" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="selectedElement"
                      value={element._id}
                      checked={selectedElementId === element._id}
                      onChange={() => handleElementSelect(element._id)}
                      style={{ marginRight: "8px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>
                        {element.type} {element.text ? `(${element.text.substring(0, 30)}${element.text.length > 30 ? '...' : ''})` : ''}
                      </div>
                      <div style={{ color: "#6c757d", fontSize: "10px" }}>
                        {Object.keys(element.styles || {}).length} style properties
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => selectedElementId && onRenderElementStyles(selectedElementId)}
          disabled={!canRenderElementStyles || isRenderingElementStyles}
          style={{
            padding: "10px 16px",
            backgroundColor: canRenderElementStyles && !isRenderingElementStyles ? "#fd7e14" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: canRenderElementStyles && !isRenderingElementStyles ? "pointer" : "not-allowed",
            fontSize: "14px",
            fontWeight: 500,
            width: "100%",
          }}
        >
          {isRenderingElementStyles ? "Rendering..." : "Render Element Styles"}
        </button>

        {elementStylesStatus && (
          <div style={{ fontSize: "11px", color: "#6c757d", marginTop: "8px", textAlign: "center" }}>
            {elementStylesStatus}
          </div>
        )}
      </div>
    </div>
  );
};