import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import {
  isLoadingAtom,
  statusAtom,
  jobIdAtom,
  authStatusAtom,
  crawlProgressAtom,
  manifestDataAtom,
  activeProjectIdAtom,
  isRenderingSnapshotAtom,
} from "../store/atoms";
import { useSettings } from "./useSettings";
import {
  parseMaxRequests,
  parseScreenshotWidth,
  parseDeviceScaleFactor,
  parseDelay,
  parseRequestDelay,
  parseMaxDepth,
  parseSampleSize,
  parseAuthData,
} from "../utils/validation";

export function useCrawl() {
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom);
  const [status, setStatus] = useAtom(statusAtom);
  const [jobId, setJobId] = useAtom(jobIdAtom);
  const [authStatus, setAuthStatus] = useAtom(authStatusAtom);
  const [crawlProgress, setCrawlProgress] = useAtom(crawlProgressAtom);
  const [isRenderingSnapshot, setIsRenderingSnapshot] = useAtom(
    isRenderingSnapshotAtom
  );
  const setManifestData = useSetAtom(manifestDataAtom);
  const activeProjectId = useAtomValue(activeProjectIdAtom);
  const intervalRef = useRef<number | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!settings.url.trim()) return;

      if (!activeProjectId) {
        setStatus("Select or create a project before starting a crawl.");
        return;
      }

      console.log("Starting crawl with URL:", settings.url.trim());

      try {
        const authData = parseAuthData(
          settings.authMethod,
          settings.loginUrl,
          settings.username,
          settings.password,
          settings.cookies
        );

        setIsLoading(true);
        setStatus("Starting crawl...");

        // Send message to plugin to start crawl (plugin will handle API call)
        parent.postMessage(
          {
            pluginMessage: {
              type: "start-crawl",
              url: settings.url.trim(),
              maxRequestsPerCrawl: parseMaxRequests(settings.maxRequests),
              screenshotWidth: parseScreenshotWidth(settings.screenshotWidth),
              deviceScaleFactor: parseDeviceScaleFactor(
                settings.deviceScaleFactor
              ),
              delay: parseDelay(settings.delay),
              requestDelay: parseRequestDelay(settings.requestDelay),
              maxDepth: parseMaxDepth(settings.maxDepth),
              defaultLanguageOnly: settings.defaultLanguageOnly,
              fullRefresh: settings.fullRefresh,
              sampleSize: parseSampleSize(settings.sampleSize),
              showBrowser: settings.showBrowser,
              detectInteractiveElements: settings.detectInteractiveElements,
              highlightAllElements: settings.highlightAllElements,
              highlightElementFilters: settings.highlightElementFilters,
              captureOnlyVisibleElements: settings.captureOnlyVisibleElements,
              auth: authData,
              extractStyles: settings.extractStyles,
              styleExtractionPreset: settings.styleExtractionPreset,
              // Map frontend field names to backend field names
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
              includeSelectors: settings.detectPatterns, // using detectPatterns as includeSelectors
              includeComputedStyles: true, // always include computed styles when enabled
              projectId: activeProjectId,
            },
          },
          "*"
        );
      } catch (error: any) {
        setStatus(`Error: ${error.message}`);
        setIsLoading(false);
      }
    },
    [settings, setIsLoading, setStatus, activeProjectId]
  );

  const handleRenderSnapshot = useCallback(async () => {
    if (!activeProjectId) {
      setStatus("Select or create a project before rendering a snapshot.");
      return;
    }

    try {
      const screenshotWidth = parseScreenshotWidth(settings.screenshotWidth);

      setIsRenderingSnapshot(true);
      setStatus("Rendering project snapshot...");
      setCrawlProgress({
        status: "rendering",
        message: "Rendering project snapshot...",
        progress: 5,
      });

      parent.postMessage(
        {
          pluginMessage: {
            type: "render-project-snapshot",
            projectId: activeProjectId,
            startUrl: settings.url.trim(),
            screenshotWidth,
            detectInteractiveElements: settings.detectInteractiveElements,
          },
        },
        "*"
      );
    } catch (error: any) {
      setIsRenderingSnapshot(false);
      setStatus(`Snapshot error: ${error.message || "Invalid configuration"}`);
    }
  }, [
    activeProjectId,
    setStatus,
    settings.screenshotWidth,
    settings.url,
    settings.detectInteractiveElements,
    setIsRenderingSnapshot,
    setCrawlProgress,
  ]);

  // Listen for crawl started message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === "crawl-started") {
        setStatus(`Crawl started! Job ID: ${msg.jobId}`);
        setJobId(msg.jobId);
        setIsLoading(false);
        setCrawlProgress({
          status: "crawling",
          message: "Crawl started...",
          progress: 0,
        });
      }

      if (msg.type === "status-update") {
        let statusText = `Job ${msg.jobId}: ${msg.status}`;

        if (msg.detailedProgress) {
          const { stage, currentPage, totalPages, currentUrl, progress } =
            msg.detailedProgress;
          statusText = `Job ${msg.jobId}: ${msg.status} - ${stage}`;

          if (currentUrl) {
            statusText += ` - ${currentUrl}`;
          }

          if (currentPage && totalPages) {
            statusText += ` (${currentPage}/${totalPages})`;
          }

          if (typeof progress === "number") {
            statusText += ` ${progress}%`;
          }

          // Update crawl progress
          const isComplete = msg.status === "completed";
          const isRendering = msg.status === "rendering";

          setCrawlProgress({
            status: isComplete
              ? "complete"
              : isRendering
                ? "rendering"
                : "crawling",
            message: stage || msg.status,
            progress: progress || 0,
            currentPage,
            totalPages,
            currentUrl,
            stage,
          });
        } else if (msg.progress && typeof msg.progress === "number") {
          statusText += ` (${msg.progress}%)`;
          setCrawlProgress({
            status: msg.status === "completed" ? "complete" : "crawling",
            message: msg.status,
            progress: msg.progress,
          });
        }

        setStatus(statusText);

        if (msg.status === "completed") {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setStatus(`Sitemap created successfully!`);
          setJobId(null);

          // Reset progress to idle after 3 seconds
          setTimeout(() => {
            setCrawlProgress({
              status: "idle",
              message: "",
              progress: 0,
            });
          }, 3000);
        }
      }

      if (msg.type === "auth-session-status") {
        if (msg.status === "opening") {
          setAuthStatus("authenticating");
          setStatus("Opening authentication browser...");
        } else if (msg.status === "success") {
          setAuthStatus("success");
          setStatus(
            `Authentication successful! Captured ${msg.cookieCount} cookies.`
          );
          // Reset auth status after 5 seconds
          setTimeout(() => setAuthStatus(null), 5000);
        } else if (msg.status === "failed") {
          setAuthStatus("failed");
          setStatus(`Authentication failed: ${msg.error || "Unknown error"}`);
          // Reset auth status after 5 seconds
          setTimeout(() => setAuthStatus(null), 5000);
        }
      }

      if (msg.type === "manifest-data") {
        console.log("Received manifest data:", msg.manifestData);
        setManifestData(msg.manifestData);
      }

      if (msg.type === "snapshot-render-started") {
        setIsRenderingSnapshot(true);
        setStatus("Rendering project snapshot...");
        setCrawlProgress({
          status: "rendering",
          message: "Rendering project snapshot...",
          progress: 5,
        });
      }

      if (msg.type === "snapshot-status") {
        const detailed = msg.detailedProgress;
        const message = detailed?.stage
          ? `Snapshot: ${detailed.stage}`
          : `Snapshot status: ${msg.status || "rendering"}`;
        const progress = detailed?.progress ?? msg.progress ?? 0;

        setStatus(message);
        setCrawlProgress((prev) => ({
          status: "rendering",
          message,
          progress: typeof progress === "number" ? progress : prev.progress,
          currentPage: detailed?.currentPage,
          totalPages: detailed?.totalPages,
          currentUrl: detailed?.currentUrl,
          stage: detailed?.stage,
        }));
      }

      if (msg.type === "snapshot-completed") {
        setIsRenderingSnapshot(false);
        const message = msg.message || "Project snapshot rendered.";
        setStatus(message);
        setCrawlProgress({
          status: "complete",
          message,
          progress: 100,
        });

        setTimeout(() => {
          setCrawlProgress({
            status: "idle",
            message: "",
            progress: 0,
          });
        }, 3000);
      }

      if (msg.type === "snapshot-error") {
        setIsRenderingSnapshot(false);
        const errorMessage = msg.error
          ? `Snapshot error: ${msg.error}`
          : "Snapshot rendering failed.";
        setStatus(errorMessage);
        setCrawlProgress({
          status: "error",
          message: errorMessage,
          progress: 100,
        });

        setTimeout(() => {
          setCrawlProgress({
            status: "idle",
            message: "",
            progress: 0,
          });
        }, 4000);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    setStatus,
    setJobId,
    setIsLoading,
    setCrawlProgress,
    setManifestData,
    setIsRenderingSnapshot,
    setAuthStatus,
  ]);

  // Start polling when jobId is set
  useEffect(() => {
    if (jobId && !intervalRef.current) {
      intervalRef.current = window.setInterval(() => {
        parent.postMessage(
          { pluginMessage: { type: "get-status", jobId } },
          "*"
        );
      }, 3000);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId]);

  return {
    isLoading,
    isRenderingSnapshot,
    status,
    jobId,
    authStatus,
    handleSubmit,
    handleRenderSnapshot,
    crawlProgress,
  };
}
