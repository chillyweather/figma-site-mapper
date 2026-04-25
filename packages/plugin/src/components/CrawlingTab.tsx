import React from "react";
import { IconCheck, IconKey, IconX } from "@tabler/icons-react";
import { CrawlingTabProps } from "../types/index";
import { FocusedInput } from "./common/FocusedInput";
import { CrawlProgress } from "./CrawlProgress";
import { useDiscovery } from "../hooks/useDiscovery";
import type { DiscoveryCandidate } from "../types";

// ── Page type badge ───────────────────────────────────────────────

const PAGE_TYPE_COLOR: Record<string, string> = {
  homepage: "#7c3aed",
  pricing: "#059669",
  "product-detail": "#0369a1",
  "feature-detail": "#0369a1",
  integration: "#b45309",
  "customer-story": "#be185d",
  "blog-listing": "#374151",
  "blog-article": "#374151",
  "support-doc": "#64748b",
  legal: "#94a3b8",
  utility: "#94a3b8",
};

function PageTypeBadge({ type }: { type: string }) {
  const bg = PAGE_TYPE_COLOR[type] ?? "#6b7280";
  return (
    <span
      style={{
        fontSize: "9px",
        padding: "1px 5px",
        borderRadius: "999px",
        background: bg,
        color: "#fff",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {type}
    </span>
  );
}

// ── Mode selector ─────────────────────────────────────────────────

type CrawlMode = "recommended" | "exact" | "legacy";

function ModeSelector({
  mode,
  onChange,
  disabled,
}: {
  mode: CrawlMode;
  onChange: (m: CrawlMode) => void;
  disabled: boolean;
}) {
  const modes: { value: CrawlMode; label: string }[] = [
    { value: "recommended", label: "Recommended" },
    { value: "exact", label: "Exact URLs" },
    { value: "legacy", label: "Legacy" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        marginBottom: "16px",
        background: "#f3f4f6",
        borderRadius: "6px",
        padding: "3px",
      }}
    >
      {modes.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => !disabled && onChange(value)}
          disabled={disabled}
          style={{
            flex: 1,
            fontSize: "11px",
            padding: "5px 4px",
            borderRadius: "4px",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            background: mode === value ? "#ffffff" : "transparent",
            fontWeight: mode === value ? 600 : 400,
            color: mode === value ? "#111827" : "#6b7280",
            boxShadow: mode === value ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Discovery summary ─────────────────────────────────────────────

function DiscoverySummary({
  summary,
  recommendedCount,
  selectedCount,
}: {
  summary: { totalCandidates: number; byPageType: Record<string, number>; byHost: Record<string, number> };
  recommendedCount: number;
  selectedCount: number;
}) {
  return (
    <div
      style={{
        background: "#f0f9ff",
        border: "1px solid #bae6fd",
        borderRadius: "6px",
        padding: "10px 12px",
        marginBottom: "12px",
        fontSize: "11px",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "6px", color: "#0369a1" }}>
        {summary.totalCandidates} candidates · {recommendedCount} recommended · {selectedCount} selected
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {Object.entries(summary.byPageType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <span
              key={type}
              style={{
                fontSize: "9px",
                padding: "1px 5px",
                borderRadius: "999px",
                background: "#e0f2fe",
                color: "#0369a1",
              }}
            >
              {type}: {count}
            </span>
          ))}
      </div>
      {Object.keys(summary.byHost).length > 1 && (
        <div style={{ marginTop: "6px", color: "#64748b" }}>
          Hosts: {Object.keys(summary.byHost).join(", ")}
        </div>
      )}
    </div>
  );
}

// ── Candidate row ─────────────────────────────────────────────────

function CandidateRow({
  candidate,
  checked,
  onChange,
  startHost,
}: {
  candidate: DiscoveryCandidate;
  checked: boolean;
  onChange: (id: string, checked: boolean) => void;
  startHost: string;
}) {
  const isOtherHost = candidate.host !== startHost;

  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "6px",
        padding: "6px 0",
        borderBottom: "1px solid #f3f4f6",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(candidate.id, e.target.checked)}
        style={{ marginTop: "2px", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
          <PageTypeBadge type={candidate.pageType} />
          {isOtherHost && (
            <span
              style={{
                fontSize: "9px",
                padding: "1px 4px",
                borderRadius: "3px",
                background: "#fef3c7",
                color: "#92400e",
              }}
            >
              {candidate.host}
            </span>
          )}
          <span
            style={{
              fontSize: "10px",
              color: "#6b7280",
              flexShrink: 0,
            }}
          >
            {candidate.score}pts
          </span>
          <span
            style={{
              fontSize: "9px",
              color: "#9ca3af",
              flexShrink: 0,
            }}
          >
            [{candidate.source}]
          </span>
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#111827",
            wordBreak: "break-all",
            lineHeight: 1.4,
            marginTop: "2px",
          }}
        >
          {candidate.url}
        </div>
        {candidate.reasons && candidate.reasons.length > 0 && (
          <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>
            {candidate.reasons.join(", ")}
          </div>
        )}
      </div>
    </label>
  );
}

// ── Main CrawlingTab component ────────────────────────────────────

export const CrawlingTab: React.FC<CrawlingTabProps> = ({
  url,
  handleUrlChange,
  isLoading,
  jobId,
  handleSubmit,
  handleRenderSnapshot,
  status,
  crawlProgress,
  projectSelected,
  isRenderingSnapshot,
  authStatus,
  authMethod,
  onAuthorize,
}) => {
  const discovery = useDiscovery();
  const { crawlMode, setCrawlMode, discoveryPhase } = discovery;

  // Disable mode changes while a crawl or discovery is running
  const isBusy =
    isLoading ||
    isRenderingSnapshot ||
    !!jobId ||
    discoveryPhase === "discovering" ||
    discoveryPhase === "capturing";

  const disableActions = isBusy || !projectSelected;

  // ── Legacy crawl mode ────────────────────────────────────────

  const trimmedUrl = url.trim();
  const showAuthorize = authMethod === "manual";
  const authorizeDisabled = disableActions || !trimmedUrl;

  const authorizeLabel = (() => {
    if (authStatus === "authenticating") return "Browser Open – Complete auth...";
    if (authStatus === "success") return "Reauthorize";
    if (authStatus === "failed") return "Retry Authorization";
    return "Authorize";
  })();

  const renderAuthStatus = () => {
    if (authStatus === "authenticating") {
      return (
        <div className="auth-status auth-status-authenticating">
          <IconKey size={12} />
          Authentication browser is open — complete login/CAPTCHA, then close the window.
        </div>
      );
    }
    if (authStatus === "success") {
      return (
        <div className="auth-status auth-status-success">
          <IconCheck size={12} /> Authentication successful — cookies saved for this domain.
        </div>
      );
    }
    if (authStatus === "failed") {
      return (
        <div className="auth-status auth-status-failed">
          <IconX size={12} /> Authentication failed — try again or update your credentials.
        </div>
      );
    }
    return null;
  };

  const manualReminder =
    authMethod === "manual" && authStatus !== "success" ? (
      <div className="form-hint-small">
        Manual auth is selected. Run <strong>Authorize</strong> before starting a crawl so the
        backend can reuse your session cookies.
      </div>
    ) : null;

  // ── Start URL shared field ────────────────────────────────────

  const renderUrlField = (disabled: boolean) => (
    <div className="form-group">
      <label htmlFor="url-input" className="form-label">
        Website URL
      </label>
      <FocusedInput
        id="url-input"
        key="url-input"
        type="url"
        value={url}
        onChange={handleUrlChange}
        placeholder="https://example.com"
        required
        disabled={disabled}
        className="form-input"
      />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────

  return (
    <div id="crawling-tab" className="container">
      {!projectSelected && (
        <div className="status-display status-warning">
          Select or create a project to enable crawling.
        </div>
      )}

      <ModeSelector mode={crawlMode} onChange={setCrawlMode} disabled={isBusy} />

      {/* ── RECOMMENDED PAGES MODE ── */}
      {crawlMode === "recommended" && (
        <RecommendedMode
          url={url}
          renderUrlField={renderUrlField}
          discovery={discovery}
          crawlProgress={crawlProgress}
          isLoading={isLoading}
          jobId={jobId}
          status={status}
          disableActions={disableActions}
        />
      )}

      {/* ── EXACT URL LIST MODE ── */}
      {crawlMode === "exact" && (
        <ExactUrlMode
          discovery={discovery}
          crawlProgress={crawlProgress}
          isLoading={isLoading}
          jobId={jobId}
          status={status}
          disableActions={disableActions}
        />
      )}

      {/* ── LEGACY CRAWL MODE ── */}
      {crawlMode === "legacy" && (
        <div id="crawl-form" style={{ marginBottom: "20px" }}>
          {renderUrlField(disableActions)}

          {showAuthorize && (
            <div className="form-group">
              <button
                id="authorize-button"
                type="button"
                onClick={onAuthorize}
                disabled={authorizeDisabled}
                className={`button-secondary ${authorizeDisabled ? "button-flow-disabled" : ""}`}
              >
                {authorizeLabel}
              </button>
              <div className="form-hint">
                Opens a browser for login or CAPTCHA. Close that browser when finished so cookies
                can be captured.
              </div>
              {renderAuthStatus()}
              {manualReminder}
            </div>
          )}

          <button
            id="start-crawl-button"
            onClick={handleSubmit}
            disabled={disableActions || !trimmedUrl}
            className={`button-primary ${(!trimmedUrl || disableActions) ? "button-flow-disabled" : ""}`}
          >
            {isLoading
              ? "Starting..."
              : jobId
                ? "Crawl in Progress"
                : isRenderingSnapshot
                  ? "Rendering Snapshot..."
                  : !projectSelected
                    ? "Select a Project"
                    : "Start Crawl"}
          </button>

          <button
            id="render-snapshot-button"
            onClick={handleRenderSnapshot}
            disabled={disableActions}
            className={`button-secondary ${disableActions ? "button-flow-disabled" : ""}`}
          >
            {isRenderingSnapshot ? "Rendering Screenshot Pages..." : "Render Screenshot Pages"}
          </button>

          <CrawlProgress progress={crawlProgress} />

          {status && (
            <div id="crawl-status-display" className="status-display" style={{ marginTop: "8px" }}>
              {status}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Recommended mode sub-component ───────────────────────────────

function RecommendedMode({
  url,
  renderUrlField,
  discovery,
  crawlProgress,
  isLoading,
  jobId,
  status,
  disableActions,
}: {
  url: string;
  renderUrlField: (disabled: boolean) => React.ReactNode;
  discovery: ReturnType<typeof useDiscovery>;
  crawlProgress: any;
  isLoading: boolean;
  jobId: string | null;
  status: string;
  disableActions: boolean;
}) {
  const {
    seedUrls, setSeedUrls,
    pageBudget, setPageBudget,
    includeSubdomains, setIncludeSubdomains,
    includeBlog, setIncludeBlog,
    includeSupport, setIncludeSupport,
    discoveryPhase, discoveryResult, selectedCandidateIds,
    toggleCandidate, selectAllRecommended, clearSelection,
    manualUrls, setManualUrls,
    discoveryError, capturedCount,
    handleDiscover, handleStartCapture, resetDiscovery,
  } = discovery;

  const startHost = (() => {
    try { return new URL(url.trim()).hostname; } catch { return ""; }
  })();

  // Phase: idle – show discovery form
  if (discoveryPhase === "idle" || discoveryPhase === "error") {
    return (
      <div>
        {renderUrlField(disableActions)}

        <div className="form-group">
          <label className="form-label">Must-include URLs</label>
          <textarea
            value={seedUrls}
            onChange={(e) => setSeedUrls(e.target.value)}
            disabled={disableActions}
            placeholder={"https://example.com/products/\nhttps://example.com/pricing/"}
            rows={3}
            className="form-input"
            style={{ resize: "vertical", fontFamily: "monospace", fontSize: "11px" }}
          />
          <div className="form-hint">
            One URL per line. Always included; discovery may recommend more.
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Page budget</label>
          <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
            {[10, 25, 50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPageBudget(n)}
                disabled={disableActions}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  borderRadius: "4px",
                  border: "1px solid",
                  borderColor: pageBudget === n ? "#0369a1" : "#d1d5db",
                  background: pageBudget === n ? "#e0f2fe" : "#ffffff",
                  color: pageBudget === n ? "#0369a1" : "#374151",
                  cursor: disableActions ? "not-allowed" : "pointer",
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="form-hint">Recommended page target for this project.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Options</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {(
              [
                { key: "subdomains", label: "Include subdomains", value: includeSubdomains, set: setIncludeSubdomains },
                { key: "blog", label: "Include blog/articles (sample only)", value: includeBlog, set: setIncludeBlog },
                { key: "support", label: "Include support/docs", value: includeSupport, set: setIncludeSupport },
              ] as Array<{ key: string; label: string; value: boolean; set: (v: boolean) => void }>
            ).map(({ key, label, value, set }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: disableActions ? "not-allowed" : "pointer" }}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => set(e.target.checked)}
                  disabled={disableActions}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {discoveryPhase === "error" && discoveryError && (
          <div className="status-display status-error" style={{ marginBottom: "12px" }}>
            {discoveryError}
          </div>
        )}

        <button
          onClick={handleDiscover}
          disabled={disableActions || !url.trim()}
          className={`button-primary ${disableActions || !url.trim() ? "button-flow-disabled" : ""}`}
        >
          Discover Pages
        </button>
      </div>
    );
  }

  // Phase: discovering – loading
  if (discoveryPhase === "discovering") {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#0369a1", marginBottom: "8px" }}>
          Discovering pages...
        </div>
        <div style={{ fontSize: "11px", color: "#6b7280" }}>
          Crawling sitemap, navigation, and links. This may take 30–90 seconds.
        </div>
      </div>
    );
  }

  // Phase: reviewing – show candidate list
  if (discoveryPhase === "reviewing" && discoveryResult) {
    const candidates = discoveryResult.candidates;
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const manualUrlCount = manualUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean).length;
    const captureCount = selectedCandidateIds.size + manualUrlCount;

    return (
      <div>
        <DiscoverySummary
          summary={discoveryResult.summary}
          recommendedCount={discoveryResult.recommended.length}
          selectedCount={selectedCandidateIds.size}
        />

        <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
          <button
            type="button"
            onClick={selectAllRecommended}
            className="button-secondary"
            style={{ fontSize: "11px", padding: "4px 8px" }}
          >
            Select Recommended
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="button-secondary"
            style={{ fontSize: "11px", padding: "4px 8px" }}
          >
            Clear All
          </button>
        </div>

        <div
          style={{
            maxHeight: "280px",
            overflowY: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            padding: "0 8px",
            marginBottom: "12px",
          }}
        >
          {sorted.map((candidate) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              checked={selectedCandidateIds.has(candidate.id)}
              onChange={toggleCandidate}
              startHost={startHost}
            />
          ))}
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontSize: "11px" }}>
            Additional URLs (optional)
          </label>
          <textarea
            value={manualUrls}
            onChange={(e) => setManualUrls(e.target.value)}
            placeholder={"https://example.com/pricing/"}
            rows={2}
            className="form-input"
            style={{ resize: "vertical", fontFamily: "monospace", fontSize: "11px" }}
          />
          <div className="form-hint">Extra URLs not in the candidate list above.</div>
        </div>

        <button
          onClick={handleStartCapture}
          disabled={captureCount === 0}
          className={`button-primary ${captureCount === 0 ? "button-flow-disabled" : ""}`}
        >
          Start Capture Crawl ({captureCount} pages)
        </button>

        <button
          type="button"
          onClick={resetDiscovery}
          className="button-secondary"
          style={{ marginTop: "6px" }}
        >
          Reset Discovery
        </button>
      </div>
    );
  }

  // Phase: capturing – show progress
  if (discoveryPhase === "capturing") {
    return (
      <div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "12px" }}>
          Capture crawl in progress...
        </div>
        <CrawlProgress progress={crawlProgress} />
        {status && (
          <div className="status-display" style={{ marginTop: "8px", fontSize: "11px" }}>
            {status}
          </div>
        )}
      </div>
    );
  }

  // Phase: complete
  if (discoveryPhase === "complete") {
    return (
      <div>
        <div
          className="status-display status-success"
          style={{ marginBottom: "16px" }}
        >
          <div style={{ fontWeight: 600, marginBottom: "6px" }}>
            Capture complete
            {capturedCount !== null ? ` — ${capturedCount} pages captured` : ""}
          </div>
          <div style={{ fontSize: "11px" }}>
            Pages are ready in Figma. Go to the <strong>Inventory</strong> tab and click
            {" "}<strong>Rebuild Inventory Workspace</strong> to update the design-system analysis.
          </div>
        </div>
        <button
          type="button"
          onClick={resetDiscovery}
          className="button-secondary"
        >
          Start New Discovery
        </button>
      </div>
    );
  }

  return null;
}

// ── Exact URL mode sub-component ──────────────────────────────────

function ExactUrlMode({
  discovery,
  crawlProgress,
  isLoading,
  jobId,
  status,
  disableActions,
}: {
  discovery: ReturnType<typeof useDiscovery>;
  crawlProgress: any;
  isLoading: boolean;
  jobId: string | null;
  status: string;
  disableActions: boolean;
}) {
  const {
    exactUrls, setExactUrls,
    discoveryPhase, discoveryError, capturedCount,
    handleStartExactCapture, resetDiscovery,
  } = discovery;

  const urlCount = exactUrls
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u.length > 0).length;

  if (discoveryPhase === "capturing") {
    return (
      <div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "12px" }}>
          Capture crawl in progress...
        </div>
        <CrawlProgress progress={crawlProgress} />
        {status && (
          <div className="status-display" style={{ marginTop: "8px", fontSize: "11px" }}>
            {status}
          </div>
        )}
      </div>
    );
  }

  if (discoveryPhase === "complete") {
    return (
      <div>
        <div className="status-display status-success" style={{ marginBottom: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "6px" }}>
            Capture complete{capturedCount !== null ? ` — ${capturedCount} pages` : ""}
          </div>
          <div style={{ fontSize: "11px" }}>
            Go to the <strong>Inventory</strong> tab and click{" "}
            <strong>Rebuild Inventory Workspace</strong> to update the design-system analysis.
          </div>
        </div>
        <button type="button" onClick={resetDiscovery} className="button-secondary">
          Start Another Capture
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="form-group">
        <label className="form-label">URLs to capture</label>
        <textarea
          value={exactUrls}
          onChange={(e) => setExactUrls(e.target.value)}
          disabled={disableActions}
          placeholder={"https://example.com/\nhttps://example.com/products/\nhttps://example.com/pricing/"}
          rows={6}
          className="form-input"
          style={{ resize: "vertical", fontFamily: "monospace", fontSize: "11px" }}
        />
        <div className="form-hint">One URL per line. Only these pages will be captured.</div>
      </div>

      {(discoveryPhase === "error") && discoveryError && (
        <div className="status-display status-error" style={{ marginBottom: "12px" }}>
          {discoveryError}
        </div>
      )}

      <button
        onClick={handleStartExactCapture}
        disabled={disableActions || urlCount === 0}
        className={`button-primary ${disableActions || urlCount === 0 ? "button-flow-disabled" : ""}`}
      >
        {urlCount > 0 ? `Capture ${urlCount} Page${urlCount !== 1 ? "s" : ""}` : "Enter URLs above"}
      </button>
    </div>
  );
}
