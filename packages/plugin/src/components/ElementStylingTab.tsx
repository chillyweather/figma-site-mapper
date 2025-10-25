import React, { useEffect, useState } from "react";
import { ElementFilters, CategorizedElements } from "../types/index";

interface PageNode {
  url: string;
  title?: string;
  styleData?: {
    elements?: any[];
    cssVariables?: any;
  };
  children?: PageNode[];
}

interface ManifestData {
  tree?: PageNode;
}

interface ElementStylingTabProps {
  categorizedElements: CategorizedElements | null;
  elementFilters: ElementFilters;
  onElementFilterChange: (type: keyof ElementFilters, checked: boolean) => void;
  handleShowStyling: () => void;
  manifestData: ManifestData | null;
  selectedPageUrl: string;
  onPageSelection: (url: string) => void;
}

export const ElementStylingTab: React.FC<ElementStylingTabProps> = ({
  categorizedElements,
  elementFilters,
  onElementFilterChange,
  handleShowStyling,
  manifestData,
  selectedPageUrl,
  onPageSelection,
}) => {
  const [allPages, setAllPages] = useState<PageNode[]>([]);

  // Extract all pages from manifest tree
  useEffect(() => {
    if (manifestData?.tree) {
      const pages = flattenPageTree(manifestData.tree);
      setAllPages(pages);

      // Set initial selected page if not set
      if (pages.length > 0 && !selectedPageUrl) {
        onPageSelection(pages[0].url);
      }
    }
  }, [manifestData, selectedPageUrl, onPageSelection]);

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

  // Calculate total selected elements
  const getSelectedCount = () => {
    if (!categorizedElements) return 0;
    let count = 0;
    (Object.keys(elementFilters) as Array<keyof ElementFilters>).forEach(
      (key) => {
        if (elementFilters[key]) {
          count += categorizedElements[key]?.length || 0;
        }
      }
    );
    return count;
  };

  return (
    <div
      id="styling-tab"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100% - 108px)",
      }}
    >
      <div
        id="styling-content"
        style={{ flex: 1, overflowY: "auto", padding: "16px" }}
      >
        {!manifestData?.tree ? (
          <div
            style={{
              textAlign: "center",
              color: "#666",
              padding: "32px 16px",
            }}
          >
            <p>No manifest data available.</p>
            <p style={{ fontSize: "11px", marginTop: "8px" }}>
              Crawl a website with style extraction enabled to see elements.
            </p>
          </div>
        ) : (
          <>
            {/* Page Selector */}
            {allPages.length > 1 && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "600",
                    marginBottom: "4px",
                    color: "#212529",
                  }}
                >
                  Select Page:
                </label>
                <select
                  value={selectedPageUrl}
                  onChange={(e) => onPageSelection(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: "11px",
                    border: "1px solid #e9ecef",
                    borderRadius: "4px",
                    backgroundColor: "white",
                  }}
                >
                  {allPages.map((page) => (
                    <option key={page.url} value={page.url}>
                      {page.title || page.url}
                      {page.styleData?.elements
                        ? ` (${page.styleData.elements.length} elements)`
                        : " (no elements)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <h4
              style={{
                margin: "0 0 12px 0",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Element Types
            </h4>

            {!categorizedElements ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#666",
                  padding: "16px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                }}
              >
                <p style={{ fontSize: "11px" }}>
                  No elements found on this page.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {(
                  Object.entries(elementFilters) as [
                    keyof ElementFilters,
                    boolean,
                  ][]
                ).map(([type, checked]) => {
                  const count = categorizedElements[type]?.length || 0;
                  const label = type.charAt(0).toUpperCase() + type.slice(1);

                  return (
                    <label
                      key={type}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px",
                        border: "1px solid #e9ecef",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          onElementFilterChange(type, e.target.checked)
                        }
                        style={{ marginRight: "8px" }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: "11px",
                          fontWeight: "500",
                          color: "#212529",
                        }}
                      >
                        {label}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#6c757d",
                          backgroundColor: "#e9ecef",
                          padding: "2px 8px",
                          borderRadius: "12px",
                        }}
                      >
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div
        id="styling-footer"
        style={{ padding: "16px", borderTop: "1px solid #e9ecef" }}
      >
        <button
          id="show-styling-button"
          onClick={handleShowStyling}
          disabled={!categorizedElements || getSelectedCount() === 0}
          style={{
            width: "100%",
            padding: "8px 16px",
            backgroundColor:
              !categorizedElements || getSelectedCount() === 0
                ? "#e9ecef"
                : "#6f42c1",
            color:
              !categorizedElements || getSelectedCount() === 0
                ? "#6c757d"
                : "white",
            border: "none",
            borderRadius: "4px",
            cursor:
              !categorizedElements || getSelectedCount() === 0
                ? "not-allowed"
                : "pointer",
            fontSize: "12px",
            fontWeight: "500",
          }}
        >
          Show Elements ({getSelectedCount()} selected)
        </button>
      </div>
    </div>
  );
};
