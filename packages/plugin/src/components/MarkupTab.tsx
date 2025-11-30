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
    <div className="container">
      <div
        className={`status-display ${isPageReady ? "status-info" : "status-warning"}`}
      >
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>
          Active Page
        </div>
        {isPageReady ? (
          <div style={{ fontSize: "12px" }}>
            {activePage?.pageName || activePage?.pageUrl || "Screenshot"}
          </div>
        ) : (
          <div>
            Open one of the generated screenshot pages to enable markup.
          </div>
        )}
      </div>

      <div className="form-group">
        <h4 className="section-header">
          Element Types
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "12px 16px",
            background: "var(--color-bg)",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
          }}
        >
          {supportedFilters.map((filterKey) => (
            <label
              key={filterKey}
              className="checkbox-label"
              style={{ fontSize: "12px" }}
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
        <div className="form-hint">
          {selectedFilterCount} type{selectedFilterCount !== 1 ? "s" : ""} selected
        </div>
      </div>

      <button
        onClick={onRender}
        disabled={!isPageReady || isRendering || selectedFilterCount === 0}
        className={`button-primary ${(!isPageReady || selectedFilterCount === 0 || isRendering) ? 'button-flow-disabled' : ''}`}
      >
        {isRendering ? "Working…" : "Render Highlights"}
      </button>

      <button
        onClick={onClear}
        disabled={!isPageReady || isRendering}
        className={`button-secondary ${(!isPageReady || isRendering) ? 'button-flow-disabled' : ''}`}
      >
        Clear Highlights
      </button>

      {status && (
        <div className="status-display status-neutral" style={{ textAlign: "center" }}>
          {status}
        </div>
      )}
    </div>
  );
};
