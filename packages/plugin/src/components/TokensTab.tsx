import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { manifestDataAtom } from "../store/atoms";

interface PageNode {
  url: string;
  title?: string;
  styleData?: {
    cssVariables?: any;
  };
  children?: PageNode[];
}

export const TokensTab: React.FC = () => {
  const [manifestData, setManifestData] = useAtom(manifestDataAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPageUrl, setSelectedPageUrl] = useState<string>("");
  const [allPages, setAllPages] = useState<PageNode[]>([]);

  // Fetch manifest data when tab mounts if not already in state
  useEffect(() => {
    if (!manifestData && !isLoading) {
      loadManifestData();
    }
  }, []);

  // Extract all pages from tree when manifestData changes
  useEffect(() => {
    if (manifestData?.tree) {
      const pages = flattenPageTree(manifestData.tree);
      setAllPages(pages);
      if (pages.length > 0 && !selectedPageUrl) {
        setSelectedPageUrl(pages[0].url);
      }
    }
  }, [manifestData]);

  // Recursively flatten the page tree
  const flattenPageTree = (node: PageNode): PageNode[] => {
    const pages: PageNode[] = [node];
    if (node.children) {
      node.children.forEach((child) => {
        pages.push(...flattenPageTree(child));
      });
    }
    return pages;
  };

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

    // Find the selected page
    const selectedPage = allPages.find((page) => page.url === selectedPageUrl);
    if (!selectedPage) {
      console.warn("❌ No page selected");
      return;
    }

    console.log("📄 selectedPage:", selectedPage);
    console.log("📄 selectedPage.styleData:", selectedPage.styleData);
    console.log(
      "📄 selectedPage.styleData.cssVariables:",
      selectedPage.styleData?.cssVariables
    );

    if (selectedPage.styleData && selectedPage.styleData.cssVariables) {
      const cssVars = selectedPage.styleData.cssVariables;
      console.log("✅ Found CSS variables");
      console.log(
        "🎨 cssVariables structure:",
        JSON.stringify(cssVars, null, 2)
      );
      console.log("🎨 Sending to plugin:", {
        type: "build-tokens-table",
        cssVariables: cssVars,
        pageUrl: selectedPage.url,
      });

      // Send message to plugin code to build the table
      parent.postMessage(
        {
          pluginMessage: {
            type: "build-tokens-table",
            cssVariables: cssVars,
            pageUrl: selectedPage.url,
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

  const handleBuildAllTokensTables = () => {
    console.log("🔨 handleBuildAllTokensTables called");

    if (!manifestData || !manifestData.tree) {
      console.warn("❌ No manifest data available");
      return;
    }

    // Filter pages that have CSS variables
    const pagesWithTokens = allPages.filter(
      (page) => page.styleData?.cssVariables
    );

    if (pagesWithTokens.length === 0) {
      parent.postMessage(
        {
          pluginMessage: {
            type: "notify",
            message: "No pages with CSS variables found",
          },
        },
        "*"
      );
      return;
    }

    console.log(`📊 Building tables for ${pagesWithTokens.length} pages`);

    // Send message to plugin to build tables for all pages
    parent.postMessage(
      {
        pluginMessage: {
          type: "build-all-tokens-tables",
          pages: pagesWithTokens.map((page) => ({
            cssVariables: page.styleData!.cssVariables,
            pageUrl: page.url,
          })),
        },
      },
      "*"
    );
  };

  const handleBuildCombinedTokensTable = () => {
    console.log("🔨 handleBuildCombinedTokensTable called");

    if (!manifestData || !manifestData.tree) {
      console.warn("❌ No manifest data available");
      return;
    }

    // Filter pages that have CSS variables
    const pagesWithTokens = allPages.filter(
      (page) => page.styleData?.cssVariables
    );

    if (pagesWithTokens.length === 0) {
      parent.postMessage(
        {
          pluginMessage: {
            type: "notify",
            message: "No pages with CSS variables found",
          },
        },
        "*"
      );
      return;
    }

    // Merge all CSS variables from all pages
    const mergedVariables = {
      colors: { primitives: {}, aliases: {} },
      spacing: { primitives: {}, aliases: {} },
      typography: { primitives: {}, aliases: {} },
      sizing: { primitives: {}, aliases: {} },
      borders: { primitives: {}, aliases: {} },
      shadows: { primitives: {}, aliases: {} },
      other: { primitives: {}, aliases: {} },
    };

    pagesWithTokens.forEach((page) => {
      const cssVars = page.styleData!.cssVariables;

      // Merge each category
      Object.keys(mergedVariables).forEach((category) => {
        if (cssVars[category]) {
          // Merge primitives
          if (cssVars[category].primitives) {
            Object.assign(
              mergedVariables[category as keyof typeof mergedVariables]
                .primitives,
              cssVars[category].primitives
            );
          }
          // Merge aliases
          if (cssVars[category].aliases) {
            Object.assign(
              mergedVariables[category as keyof typeof mergedVariables].aliases,
              cssVars[category].aliases
            );
          }
        }
      });
    });

    console.log("✅ Merged CSS variables from all pages");
    console.log("🎨 Combined variables:", mergedVariables);

    // Send message to plugin to build the combined table
    parent.postMessage(
      {
        pluginMessage: {
          type: "build-tokens-table",
          cssVariables: mergedVariables,
          pageUrl: "App Tokens (Combined)",
        },
      },
      "*"
    );
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

      {manifestData && allPages.length > 0 && (
        <div
          style={{
            padding: "12px",
            background: "#f8f9fa",
            border: "1px solid #dee2e6",
            borderRadius: "4px",
            fontSize: "13px",
          }}
        >
          <div style={{ marginBottom: "8px", fontWeight: "500" }}>
            Select Page:
          </div>
          <select
            value={selectedPageUrl}
            onChange={(e) => setSelectedPageUrl(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              fontSize: "13px",
              borderRadius: "4px",
              border: "1px solid #ced4da",
              background: "white",
            }}
          >
            {allPages.map((page) => (
              <option key={page.url} value={page.url}>
                {page.title || page.url}
                {!page.styleData?.cssVariables && " (no tokens)"}
              </option>
            ))}
          </select>
          <div style={{ marginTop: "4px", fontSize: "11px", color: "#6c757d" }}>
            {allPages.length} page(s) found •{" "}
            {allPages.filter((p) => p.styleData?.cssVariables).length} with
            tokens
          </div>
        </div>
      )}

      <button
        onClick={handleBuildTokensTable}
        disabled={!manifestData || isLoading || !selectedPageUrl}
        style={{
          padding: "10px 16px",
          background:
            manifestData && !isLoading && selectedPageUrl ? "#0d99ff" : "#ccc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor:
            manifestData && !isLoading && selectedPageUrl
              ? "pointer"
              : "not-allowed",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Build tokens table for selected page
      </button>

      <button
        onClick={handleBuildAllTokensTables}
        disabled={
          !manifestData ||
          isLoading ||
          allPages.filter((p) => p.styleData?.cssVariables).length === 0
        }
        style={{
          padding: "10px 16px",
          background:
            manifestData &&
            !isLoading &&
            allPages.filter((p) => p.styleData?.cssVariables).length > 0
              ? "#28a745"
              : "#ccc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor:
            manifestData &&
            !isLoading &&
            allPages.filter((p) => p.styleData?.cssVariables).length > 0
              ? "pointer"
              : "not-allowed",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Build tables for all pages (
        {allPages.filter((p) => p.styleData?.cssVariables).length})
      </button>

      <button
        onClick={handleBuildCombinedTokensTable}
        disabled={
          !manifestData ||
          isLoading ||
          allPages.filter((p) => p.styleData?.cssVariables).length === 0
        }
        style={{
          padding: "10px 16px",
          background:
            manifestData &&
            !isLoading &&
            allPages.filter((p) => p.styleData?.cssVariables).length > 0
              ? "#ff9800"
              : "#ccc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor:
            manifestData &&
            !isLoading &&
            allPages.filter((p) => p.styleData?.cssVariables).length > 0
              ? "pointer"
              : "not-allowed",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Build combined App tokens table
      </button>
    </div>
  );
};
