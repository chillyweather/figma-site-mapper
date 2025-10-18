import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { manifestDataAtom } from "../store/atoms";

export const StylingTab: React.FC = () => {
  const [manifestData, setManifestData] = useAtom(manifestDataAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch manifest data when tab mounts if not already in state
  useEffect(() => {
    if (!manifestData && !isLoading) {
      loadManifestData();
    }
  }, []);

  const loadManifestData = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      // Request last manifest URL from plugin code
      parent.postMessage({ pluginMessage: { type: "get-last-manifest" } }, "*");

      // Set up listener for response
      const handleMessage = async (event: MessageEvent) => {
        const msg = event.data.pluginMessage;
        if (msg?.type === "last-manifest-url") {
          window.removeEventListener("message", handleMessage);

          if (msg.manifestUrl) {
            try {
              // Fetch manifest from server
              const response = await fetch(msg.manifestUrl);
              if (!response.ok) {
                throw new Error(`Failed to fetch manifest: ${response.status}`);
              }
              const data = await response.json();
              setManifestData(data);
              setIsLoading(false);
            } catch (error) {
              console.error("Failed to fetch manifest:", error);
              setLoadError(
                error instanceof Error
                  ? error.message
                  : "Failed to load manifest data"
              );
              setIsLoading(false);
            }
          } else {
            setLoadError("No previous crawl found");
            setIsLoading(false);
          }
        }
      };

      window.addEventListener("message", handleMessage);

      // Timeout after 10 seconds
      setTimeout(() => {
        window.removeEventListener("message", handleMessage);
        if (isLoading) {
          setLoadError("Timeout loading manifest data");
          setIsLoading(false);
        }
      }, 10000);
    } catch (error) {
      console.error("Error loading manifest:", error);
      setLoadError("Error loading manifest data");
      setIsLoading(false);
    }
  };

  const handleBuildTokensTable = () => {
    console.log("🔨 handleBuildTokensTable called");
    console.log("📦 manifestData:", manifestData);

    if (!manifestData || !manifestData.tree) {
      console.warn("❌ No manifest data available");
      return;
    }

    const currentPage = manifestData.tree;
    console.log("📄 currentPage:", currentPage);
    console.log("📄 currentPage.styleData:", currentPage.styleData);
    console.log(
      "📄 currentPage.styleData.cssVariables:",
      currentPage.styleData?.cssVariables
    );

    if (currentPage.styleData && currentPage.styleData.cssVariables) {
      const cssVars = currentPage.styleData.cssVariables;
      console.log("✅ Found CSS variables");
      console.log(
        "🎨 cssVariables structure:",
        JSON.stringify(cssVars, null, 2)
      );
      console.log("🎨 Sending to plugin:", {
        type: "build-tokens-table",
        cssVariables: cssVars,
        pageUrl: currentPage.url,
      });

      // Send message to plugin code to build the table
      parent.postMessage(
        {
          pluginMessage: {
            type: "build-tokens-table",
            cssVariables: cssVars,
            pageUrl: currentPage.url,
          },
        },
        "*"
      );
    } else {
      console.log("❌ No CSS variables found in crawl data");
      // Show notification - send to plugin to display
      parent.postMessage(
        {
          pluginMessage: {
            type: "notify",
            message: "No CSS variables found for this page",
          },
        },
        "*"
      );
    }
  };

  return (
    <div
      style={{
        padding: "0 16px 16px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {isLoading && (
        <div
          style={{
            padding: "12px",
            background: "#e3f2fd",
            border: "1px solid #2196f3",
            borderRadius: "4px",
            fontSize: "13px",
          }}
        >
          🔄 Loading manifest data...
        </div>
      )}

      {loadError && (
        <div
          style={{
            padding: "12px",
            background: "#ffebee",
            border: "1px solid #f44336",
            borderRadius: "4px",
            fontSize: "13px",
          }}
        >
          ❌ {loadError}
        </div>
      )}

      {!manifestData && !isLoading && !loadError && (
        <div
          style={{
            padding: "12px",
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "4px",
            fontSize: "13px",
          }}
        >
          ⚠️ No crawl data available. Please run a crawl with style extraction
          enabled first.
        </div>
      )}

      {!isLoading && !manifestData && loadError && (
        <button
          onClick={loadManifestData}
          style={{
            padding: "10px 16px",
            background: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Retry
        </button>
      )}

      <button
        onClick={handleBuildTokensTable}
        disabled={!manifestData || isLoading}
        style={{
          padding: "10px 16px",
          background: manifestData && !isLoading ? "#0d99ff" : "#ccc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: manifestData && !isLoading ? "pointer" : "not-allowed",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Build tokens table
      </button>
    </div>
  );
};
