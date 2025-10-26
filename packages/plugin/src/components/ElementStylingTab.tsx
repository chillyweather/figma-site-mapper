import React from "react";

interface ElementStylingTabProps {
  handleShowStyling: () => void;
}

export const ElementStylingTab: React.FC<ElementStylingTabProps> = ({
  handleShowStyling,
}) => {
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
        }}
      >
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
          Highlight Current Page
        </button>
      </div>
    </div>
  );
};
