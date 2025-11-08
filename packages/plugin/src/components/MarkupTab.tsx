import React from "react";
import { MarkupTabProps } from "../types";

function formatFilterLabel(filter: string): string {
  switch (filter) {
    case "buttons":
      return "Buttons";
    case "links":
      return "Links";
    case "inputs":
      return "Inputs";
    case "textareas":
      return "Textareas";
    case "selects":
      return "Selects";
    case "images":
      return "Images";
    case "headings":
      return "Headings";
    case "paragraphs":
      return "Paragraphs";
    case "divs":
      return "Containers";
    case "other":
      return "Other";
    default:
      return filter;
  }
}

export const MarkupTab: React.FC<MarkupTabProps> = ({
  filters,
  supportedFilters,
  onFilterChange,
  onRender,
  onClear,
  isRendering,
  status,
  activePage,
  selectedFilterCount,
}) => {
  const isPageReady = Boolean(activePage && activePage.pageId);

  return (
    <div style={{ padding: "0 16px 16px 16px" }}>
      <div
        style={{
          padding: "12px",
          backgroundColor: "#f8f9fa",
          borderRadius: "6px",
          marginBottom: "16px",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
          Active Page
        </div>
        {isPageReady ? (
          <div style={{ fontSize: "11px", color: "#343a40" }}>
            {activePage?.pageName || activePage?.pageUrl || "Screenshot"}
          </div>
        ) : (
          <div style={{ fontSize: "11px", color: "#6c757d" }}>
            Open one of the generated screenshot pages to enable markup.
          </div>
        )}
      </div>

      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
          Element Types
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "8px 12px",
          }}
        >
          {supportedFilters.map((filterKey) => (
            <label
              key={filterKey}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(filters[filterKey])}
                onChange={(event) =>
                  onFilterChange(filterKey, event.target.checked)
                }
              />
              {formatFilterLabel(filterKey)}
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={onRender}
        disabled={!isPageReady || isRendering || selectedFilterCount === 0}
        style={{
          width: "100%",
          padding: "10px 16px",
          backgroundColor:
            !isPageReady || selectedFilterCount === 0
              ? "#adb5bd"
              : "#0066cc",
          border: "none",
          color: "white",
          fontSize: "12px",
          fontWeight: 600,
          borderRadius: "4px",
          cursor:
            !isPageReady || selectedFilterCount === 0 || isRendering
              ? "not-allowed"
              : "pointer",
          marginBottom: "8px",
        }}
      >
        {isRendering ? "Working…" : "Render Highlights"}
      </button>

      <button
        onClick={onClear}
        disabled={!isPageReady || isRendering}
        style={{
          width: "100%",
          padding: "9px 16px",
          backgroundColor: "white",
          border: "1px solid #ced4da",
          color: !isPageReady || isRendering ? "#868e96" : "#343a40",
          fontSize: "12px",
          fontWeight: 500,
          borderRadius: "4px",
          cursor: !isPageReady || isRendering ? "not-allowed" : "pointer",
          marginBottom: "12px",
        }}
      >
        Clear Highlights
      </button>

      {status && (
        <div
          style={{
            fontSize: "11px",
            color: "#495057",
            backgroundColor: "#f1f3f5",
            borderRadius: "4px",
            padding: "8px",
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
};
