import React from "react";
import { MappingTabProps, BadgeLink } from "../types/index";

export const MappingTab: React.FC<MappingTabProps> = ({
  badgeLinks,
  checkedLinks,
  handleLinkCheck,
  handleShowFlow,
}) => (
  <div
    id="flows-tab"
    style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100% - 108px)",
    }}
  >
    <div
      id="flows-content"
      style={{ flex: 1, overflowY: "auto", padding: "16px" }}
    >
      {badgeLinks.length === 0 ? (
        <div
          id="flows-empty-state"
          style={{ textAlign: "center", color: "#666", padding: "32px 16px" }}
        >
          <p>No badge-with-link elements found on this page.</p>
          <p style={{ fontSize: "11px", marginTop: "8px" }}>
            Badge links are created when crawling websites with interactive
            elements.
          </p>
        </div>
      ) : (
        <div id="flows-link-list">
          <h4
            id="flows-list-header"
            style={{
              margin: "0 0 12px 0",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            Found {badgeLinks.length} link{badgeLinks.length !== 1 ? "s" : ""}
          </h4>
          {badgeLinks.map((link: BadgeLink) => (
            <div
              key={link.id}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                padding: "8px",
                backgroundColor: "#f8f9fa",
                borderRadius: "4px",
                border: "1px solid #e9ecef",
              }}
            >
              <input
                type="checkbox"
                checked={checkedLinks.has(link.id)}
                onChange={(e) => handleLinkCheck(link.id, e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "500",
                    color: "#212529",
                    marginBottom: "2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {link.text}
                </div>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "10px",
                    color: "#0066cc",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "block",
                  }}
                  onClick={(e) => {
                    if (
                      link.url.startsWith("#") ||
                      link.url.includes("example.com")
                    ) {
                      e.preventDefault();
                      console.log("Placeholder URL clicked:", link.url);
                    }
                  }}
                >
                  {link.url}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <div
      id="flows-footer"
      style={{ padding: "16px", borderTop: "1px solid #e9ecef" }}
    >
      <button
        id="show-flow-button"
        onClick={handleShowFlow}
        disabled={checkedLinks.size === 0}
        style={{
          width: "100%",
          padding: "8px 16px",
          backgroundColor: checkedLinks.size === 0 ? "#e9ecef" : "#0066cc",
          color: checkedLinks.size === 0 ? "#6c757d" : "white",
          border: "none",
          borderRadius: "4px",
          cursor: checkedLinks.size === 0 ? "not-allowed" : "pointer",
          fontSize: "12px",
          fontWeight: "500",
        }}
      >
        Show Flow ({checkedLinks.size} selected)
      </button>
    </div>
  </div>
);
