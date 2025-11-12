import React from "react";
import { useAtomValue } from "jotai";
import { manifestDataAtom } from "../store/atoms";

type CssVarGroup = {
  primitives?: Record<string, unknown>;
  aliases?: Record<string, unknown>;
};

type CssVariableSnapshot = {
  colors?: CssVarGroup;
  spacing?: CssVarGroup;
  typography?: CssVarGroup;
  sizing?: CssVarGroup;
  borders?: CssVarGroup;
  shadows?: CssVarGroup;
  other?: CssVarGroup;
};

type CategoryCount = {
  primitives: number;
  aliases: number;
};

interface StylingViewProps {
  onBack: () => void;
}

export const StylingView: React.FC<StylingViewProps> = ({ onBack }) => {
  const manifestData = useAtomValue(manifestDataAtom);



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


      </div>
    </div>
  );
};
