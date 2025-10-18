import React from "react";
import { useAtomValue } from "jotai";
import { manifestDataAtom } from "../store/atoms";

interface StylingViewProps {
  onBack: () => void;
}

export const StylingView: React.FC<StylingViewProps> = ({ onBack }) => {
  const manifestData = useAtomValue(manifestDataAtom);

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
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "16px",
          gap: "8px",
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: "4px 8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            background: "white",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
          Styling
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {!manifestData && (
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

        <button
          onClick={handleBuildTokensTable}
          disabled={!manifestData}
          style={{
            padding: "10px 16px",
            background: manifestData ? "#0d99ff" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: manifestData ? "pointer" : "not-allowed",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Build tokens table
        </button>
      </div>
    </div>
  );
};
