import React, { useState, useRef, useEffect } from "react";
import { FlowLink, FlowProgress as FlowProgressType } from "../types/index";
import { FlowProgress } from "./FlowProgress";

interface FlowsTabProps {
  badgeLinks: FlowLink[];
  checkedLinks: Set<string>;
  handleLinkCheck: (id: string, checked: boolean) => void;
  handleShowFlow: () => void;
  flowProgress: FlowProgressType;
  focusedBadgeNumber?: number | null;
}

export const FlowsTab: React.FC<FlowsTabProps> = ({
  badgeLinks,
  checkedLinks,
  handleLinkCheck,
  handleShowFlow,
  flowProgress,
  focusedBadgeNumber,
}) => {
  const [query, setQuery] = useState("");
  const focusedRef = useRef<HTMLDivElement | null>(null);

  const filtered = query.trim()
    ? badgeLinks.filter((link, index) => {
        const num = link.badgeNumber ?? index + 1;
        const q = query.trim().toLowerCase();
        return (
          String(num).includes(q) ||
          link.url.toLowerCase().includes(q) ||
          (link.text || "").toLowerCase().includes(q)
        );
      })
    : badgeLinks;

  const hasUnbuildableSelection = Array.from(checkedLinks).some((id) => {
    const link = badgeLinks.find((l) => l.id === id);
    return link ? !link.url : false;
  });

  // Scroll focused badge into view when canvas selection changes
  useEffect(() => {
    if (focusedBadgeNumber != null && focusedRef.current) {
      focusedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [focusedBadgeNumber]);

  return (
    <div id="flows-tab" className="flows-container">
      <div id="flows-content" className="flows-content">
        <FlowProgress progress={flowProgress} />

        {badgeLinks.length === 0 ? (
          <div id="flows-empty-state" className="flows-empty">
            <p>No interactive elements found on this page.</p>
            <p className="flows-empty-hint">
              Links and buttons are created when crawling websites.
            </p>
          </div>
        ) : (
          <div id="flows-link-list">
            <div className="flows-search-row">
              <input
                id="flows-search"
                className="flows-search-input"
                type="text"
                placeholder="Filter by # or URL…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="flows-count">
                {filtered.length}/{badgeLinks.length}
              </span>
            </div>
            {filtered.length === 0 ? (
              <p className="flows-no-match">No elements match "{query}"</p>
            ) : (
              filtered.map((link: FlowLink, index: number) => {
                const badgeNum = link.badgeNumber ?? index + 1;
                const isFocused = focusedBadgeNumber != null && badgeNum === focusedBadgeNumber;
                const isButton = link.elementType === "button";
                return (
                  <div
                    key={link.id}
                    ref={isFocused ? focusedRef : null}
                    className={`flows-link-item ${checkedLinks.has(link.id) ? "flows-link-item-selected" : ""} ${isFocused ? "flows-link-item-focused" : ""}`}
                    onClick={() => handleLinkCheck(link.id, !checkedLinks.has(link.id))}
                  >
                    <div className={`flows-link-badge ${isButton ? "flows-link-badge-button" : ""}`}>
                      {badgeNum}
                    </div>
                    <div className="flows-link-content">
                      <div className="flows-link-url">
                        {isButton
                          ? link.url
                            ? `${link.text || "button"} → ${link.url}`
                            : link.text || "(button)"
                          : link.url}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div id="flows-footer" className="flows-footer">
        <button
          id="show-flow-button"
          onClick={handleShowFlow}
          disabled={checkedLinks.size === 0 || hasUnbuildableSelection}
          title={hasUnbuildableSelection ? "Buttons have no navigation target — select a link to build a flow." : undefined}
          className={`button-flow ${checkedLinks.size === 0 || hasUnbuildableSelection ? "button-flow-disabled" : "button-flow-enabled"}`}
        >
          Show Flow ({checkedLinks.size} selected)
        </button>
      </div>
    </div>
  );
};
