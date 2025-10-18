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
    if (!manifestData || !manifestData.tree) {
      console.warn("No manifest data available");
      return;
    }

    const currentPage = manifestData.tree;
    console.log("Current page URL:", currentPage.url);
    console.log("Current page title:", currentPage.title || "No title");

    if (currentPage.styleData && currentPage.styleData.cssVariables) {
      const cssVars = currentPage.styleData.cssVariables;

      // Count variables by category
      const counts = {
        colors: {
          primitives: Object.keys(cssVars.colors?.primitives || {}).length,
          aliases: Object.keys(cssVars.colors?.aliases || {}).length,
        },
        spacing: {
          primitives: Object.keys(cssVars.spacing?.primitives || {}).length,
          aliases: Object.keys(cssVars.spacing?.aliases || {}).length,
        },
        typography: {
          primitives: Object.keys(cssVars.typography?.primitives || {}).length,
          aliases: Object.keys(cssVars.typography?.aliases || {}).length,
        },
        sizing: {
          primitives: Object.keys(cssVars.sizing?.primitives || {}).length,
          aliases: Object.keys(cssVars.sizing?.aliases || {}).length,
        },
        borders: {
          primitives: Object.keys(cssVars.borders?.primitives || {}).length,
          aliases: Object.keys(cssVars.borders?.aliases || {}).length,
        },
        shadows: {
          primitives: Object.keys(cssVars.shadows?.primitives || {}).length,
          aliases: Object.keys(cssVars.shadows?.aliases || {}).length,
        },
        other: {
          primitives: Object.keys(cssVars.other?.primitives || {}).length,
          aliases: Object.keys(cssVars.other?.aliases || {}).length,
        },
      };

      console.log("CSS Variable counts by category:");
      console.log("Colors:", counts.colors);
      console.log("Spacing:", counts.spacing);
      console.log("Typography:", counts.typography);
      console.log("Sizing:", counts.sizing);
      console.log("Borders:", counts.borders);
      console.log("Shadows:", counts.shadows);
      console.log("Other:", counts.other);

      const totalPrimitives = Object.values(counts).reduce(
        (sum, cat) => sum + cat.primitives,
        0
      );
      const totalAliases = Object.values(counts).reduce(
        (sum, cat) => sum + cat.aliases,
        0
      );
      console.log(
        `Total: ${totalPrimitives} primitives, ${totalAliases} aliases`
      );
    } else {
      console.log("No CSS variables found in crawl data");
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
