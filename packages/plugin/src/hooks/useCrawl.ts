import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import {
  isLoadingAtom,
  statusAtom,
  jobIdAtom,
  authStatusAtom,
} from "../store/atoms";
import { useSettings } from "./useSettings";
import { startCrawl } from "../utils/api";
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
  const intervalRef = useRef<number | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!settings.url.trim()) return;

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

        const result = await startCrawl({
          url: settings.url.trim(),
          maxRequestsPerCrawl: parseMaxRequests(settings.maxRequests),
          screenshotWidth: parseScreenshotWidth(settings.screenshotWidth),
          deviceScaleFactor: parseDeviceScaleFactor(settings.deviceScaleFactor),
          delay: parseDelay(settings.delay),
          requestDelay: parseRequestDelay(settings.requestDelay),
          maxDepth: parseMaxDepth(settings.maxDepth),
          defaultLanguageOnly: settings.defaultLanguageOnly,
          sampleSize: parseSampleSize(settings.sampleSize),
          showBrowser: settings.showBrowser,
          detectInteractiveElements: settings.detectInteractiveElements,
          auth: authData,
        });

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
              sampleSize: parseSampleSize(settings.sampleSize),
              showBrowser: settings.showBrowser,
              detectInteractiveElements: settings.detectInteractiveElements,
              auth: authData,
            },
          },
          "*"
        );
      } catch (error: any) {
        setStatus(`Error: ${error.message}`);
        setIsLoading(false);
      }
    },
    [settings, setIsLoading, setStatus]
  );

  // Listen for crawl started message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === "crawl-started") {
        setStatus(`Crawl started! Job ID: ${msg.jobId}`);
        setJobId(msg.jobId);
        setIsLoading(false);
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
        } else if (msg.progress && typeof msg.progress === "number") {
          statusText += ` (${msg.progress}%)`;
        }

        setStatus(statusText);

        if (msg.status === "completed") {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setStatus(`Crawl complete! Manifest at: ${msg.manifestUrl}`);
          setJobId(null);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setStatus, setJobId, setIsLoading]);

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
    status,
    jobId,
    authStatus,
    handleSubmit,
  };
}
