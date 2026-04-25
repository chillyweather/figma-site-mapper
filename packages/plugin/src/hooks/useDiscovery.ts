import { useAtomValue, useSetAtom } from "jotai";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  jobIdAtom,
  isLoadingAtom,
  statusAtom,
  crawlProgressAtom,
  activeProjectIdAtom,
} from "../store/atoms";
import { useSettings } from "./useSettings";
import {
  parseScreenshotWidth,
  parseDeviceScaleFactor,
} from "../utils/validation";
import type {
  CrawlMode,
  DiscoveryPhase,
  DiscoveryResult,
  DiscoveryCandidate,
  PluginSettings,
} from "../types";

export type { CrawlMode };

function buildStyleExtractionSettings(settings: PluginSettings): Record<string, unknown> | undefined {
  if (!settings.extractStyles) {
    return undefined;
  }

  return {
    enabled: true,
    preset: settings.styleExtractionPreset,
    extractInteractiveElements: settings.extractInteractive,
    extractStructuralElements: settings.extractStructural,
    extractTextElements: settings.extractContentBlocks,
    extractFormElements: settings.extractFormElements,
    extractMediaElements: settings.extractCustomComponents,
    extractColors: settings.extractColors,
    extractTypography: settings.extractTypography,
    extractSpacing: settings.extractSpacing,
    extractLayout: settings.extractLayout,
    extractBorders: settings.extractBorders,
    includeSelectors: true,
    includeComputedStyles: true,
    captureOnlyVisibleElements: settings.captureOnlyVisibleElements,
  };
}

export function useDiscovery() {
  const { settings } = useSettings();
  const activeProjectId = useAtomValue(activeProjectIdAtom);
  const setJobId = useSetAtom(jobIdAtom);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const setStatus = useSetAtom(statusAtom);
  const setCrawlProgress = useSetAtom(crawlProgressAtom);

  const [crawlMode, setCrawlMode] = useState<CrawlMode>("recommended");

  // Recommended mode inputs
  const [seedUrls, setSeedUrls] = useState("");
  const [pageBudget, setPageBudget] = useState(10);
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [includeBlog, setIncludeBlog] = useState(true);
  const [includeSupport, setIncludeSupport] = useState(false);

  // Exact URL mode input
  const [exactUrls, setExactUrls] = useState("");

  // Discovery flow state
  const [discoveryPhase, setDiscoveryPhase] = useState<DiscoveryPhase>("idle");
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [manualUrls, setManualUrls] = useState("");
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [capturedCount, setCapturedCount] = useState<number | null>(null);

  // Use refs so message handlers don't need to re-register when phase changes
  const phaseRef = useRef<DiscoveryPhase>("idle");
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const captureTargetCountRef = useRef(0);

  useEffect(() => { phaseRef.current = discoveryPhase; }, [discoveryPhase]);
  useEffect(() => { selectedIdsRef.current = selectedCandidateIds; }, [selectedCandidateIds]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === "discovery-result") {
        const result = msg.result as DiscoveryResult;
        setDiscoveryResult(result);
        const recommended = new Set(result.recommended.map((c: DiscoveryCandidate) => c.id));
        for (const candidate of result.candidates) {
          if (
            candidate.source === "seed-url" ||
            candidate.reasons?.includes("seed-url")
          ) {
            recommended.add(candidate.id);
          }
        }
        setSelectedCandidateIds(recommended);
        setDiscoveryPhase("reviewing");
        setDiscoveryError(null);
      }

      if (msg.type === "crawl-started") {
        setJobId(msg.jobId);
        setIsLoading(false);
        setStatus(`Capture crawl started. Job ID: ${msg.jobId}`);
      }

      if (msg.type === "discovery-error") {
        setDiscoveryPhase("error");
        setDiscoveryError(typeof msg.error === "string" ? msg.error : "Discovery failed");
        setIsLoading(false);
      }

      if (msg.type === "status-update") {
        const phase = phaseRef.current;
        if (phase === "capturing") {
          if (msg.status === "completed") {
            setDiscoveryPhase("complete");
            setCapturedCount(
              typeof msg.capturedCount === "number"
                ? msg.capturedCount
                : captureTargetCountRef.current || selectedIdsRef.current.size
            );
          } else if (msg.status === "failed" || msg.status === "error") {
            setDiscoveryPhase("error");
            setDiscoveryError(
              msg.detailedProgress?.stage ||
              `Capture crawl ${msg.status}`
            );
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setIsLoading, setJobId, setStatus]);

  const handleDiscover = useCallback(() => {
    if (!activeProjectId || !settings.url.trim()) return;

    const seedUrlList = seedUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    setDiscoveryPhase("discovering");
    setDiscoveryError(null);
    setDiscoveryResult(null);
    setSelectedCandidateIds(new Set());

    parent.postMessage(
      {
        pluginMessage: {
          type: "start-discovery",
          projectId: activeProjectId,
          startUrl: settings.url.trim(),
          seedUrls: seedUrlList,
          pageBudget,
          includeSubdomains,
          includeBlog,
          includeSupport,
        },
      },
      "*"
    );
  }, [activeProjectId, settings.url, seedUrls, pageBudget, includeSubdomains, includeBlog, includeSupport]);

  const toggleCandidate = useCallback((id: string, checked: boolean) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAllRecommended = useCallback(() => {
    if (!discoveryResult) return;
    setSelectedCandidateIds(new Set(discoveryResult.recommended.map((c) => c.id)));
  }, [discoveryResult]);

  const clearSelection = useCallback(() => {
    setSelectedCandidateIds(new Set());
  }, []);

  const handleStartCapture = useCallback(() => {
    if (!activeProjectId || !discoveryResult) return;

    const approvedIds = Array.from(selectedCandidateIds);
    const manualUrlList = manualUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (approvedIds.length === 0 && manualUrlList.length === 0) return;

    setDiscoveryPhase("capturing");
    captureTargetCountRef.current = approvedIds.length + manualUrlList.length;
    setIsLoading(true);
    setStatus("Starting approved capture crawl...");
    setCrawlProgress({ status: "crawling", message: "Queuing capture crawl...", progress: 0 });

    parent.postMessage(
      {
        pluginMessage: {
          type: "submit-discovery-approval",
          runId: discoveryResult.discoveryRunId,
          projectId: activeProjectId,
          approvedCandidateIds: approvedIds,
          manualUrls: manualUrlList,
          excludedCandidateIds: [],
          screenshotWidth: parseScreenshotWidth(settings.screenshotWidth),
          deviceScaleFactor: parseDeviceScaleFactor(settings.deviceScaleFactor),
          fullRefresh: settings.fullRefresh,
          styleExtraction: buildStyleExtractionSettings(settings),
        },
      },
      "*"
    );
  }, [
    activeProjectId,
    discoveryResult,
    selectedCandidateIds,
    manualUrls,
    settings,
    setIsLoading,
    setStatus,
    setCrawlProgress,
  ]);

  const handleStartExactCapture = useCallback(() => {
    if (!activeProjectId) return;

    const urls = exactUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) return;

    setDiscoveryPhase("capturing");
    captureTargetCountRef.current = urls.length;
    setIsLoading(true);
    setStatus("Starting capture crawl...");
    setCrawlProgress({ status: "crawling", message: "Queueing capture crawl...", progress: 0 });

    parent.postMessage(
      {
        pluginMessage: {
          type: "submit-exact-urls",
          projectId: activeProjectId,
          exactUrls: urls,
          screenshotWidth: parseScreenshotWidth(settings.screenshotWidth),
          deviceScaleFactor: parseDeviceScaleFactor(settings.deviceScaleFactor),
          fullRefresh: settings.fullRefresh,
          styleExtraction: buildStyleExtractionSettings(settings),
        },
      },
      "*"
    );
  }, [
    activeProjectId,
    exactUrls,
    settings,
    setIsLoading,
    setStatus,
    setCrawlProgress,
  ]);

  const resetDiscovery = useCallback(() => {
    setDiscoveryPhase("idle");
    setDiscoveryResult(null);
    setSelectedCandidateIds(new Set());
    setDiscoveryError(null);
    setCapturedCount(null);
    captureTargetCountRef.current = 0;
    setIsLoading(false);
  }, [setIsLoading]);

  return {
    crawlMode,
    setCrawlMode,

    seedUrls,
    setSeedUrls,
    pageBudget,
    setPageBudget,
    includeSubdomains,
    setIncludeSubdomains,
    includeBlog,
    setIncludeBlog,
    includeSupport,
    setIncludeSupport,

    exactUrls,
    setExactUrls,

    discoveryPhase,
    discoveryResult,
    selectedCandidateIds,
    toggleCandidate,
    selectAllRecommended,
    clearSelection,

    manualUrls,
    setManualUrls,
    discoveryError,
    capturedCount,

    handleDiscover,
    handleStartCapture,
    handleStartExactCapture,
    resetDiscovery,
  };
}
