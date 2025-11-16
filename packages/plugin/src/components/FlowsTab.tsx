import React from "react";
import { FlowLink, FlowProgress as FlowProgressType } from "../types/index";
import { FlowProgress } from "./FlowProgress";

interface FlowsTabProps {
  badgeLinks: FlowLink[];
  checkedLinks: Set<string>;
  handleLinkCheck: (id: string, checked: boolean) => void;
  handleShowFlow: () => void;
  flowProgress: FlowProgressType;
}

export const FlowsTab: React.FC<FlowsTabProps> = ({
  badgeLinks,
  checkedLinks,
  handleLinkCheck,
  handleShowFlow,
  flowProgress,
}) => {
  return (
    <div
      id="flows-tab"
      className="flows-container"
    >
      <div
        id="flows-content"
        className="flows-content"
      >
        {/* Flow Progress Component */}
        <FlowProgress progress={flowProgress} />

        {badgeLinks.length === 0 ? (
          <div
            id="flows-empty-state"
            className="flows-empty"
          >
            <p>No interactive elements found on this page.</p>
            <p className="flows-empty-hint">
              Links and buttons are created when crawling websites.
            </p>
          </div>
        ) : (
          <div id="flows-link-list">
            <h4
              id="flows-list-header"
              className="flows-list-header"
            >
              Found {badgeLinks.length} element
              {badgeLinks.length !== 1 ? "s" : ""}
            </h4>
            {badgeLinks.map((link: FlowLink, index: number) => (
              <div
                key={link.id}
                className={`flows-link-item ${checkedLinks.has(link.id) ? 'flows-link-item-selected' : ''}`}
                onClick={() => handleLinkCheck(link.id, !checkedLinks.has(link.id))}
              >
                <div className="flows-link-badge">
                  {index + 1}
                </div>
                <div className="flows-link-content">
                  <div className="flows-link-url">
                    {link.url}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        id="flows-footer"
        className="flows-footer"
      >
        <button
          id="show-flow-button"
          onClick={handleShowFlow}
          disabled={checkedLinks.size === 0}
          className={`button-flow ${checkedLinks.size === 0 ? 'button-flow-disabled' : 'button-flow-enabled'}`}
        >
          Show Flow ({checkedLinks.size} selected)
        </button>
      </div>
    </div>
  );
};
