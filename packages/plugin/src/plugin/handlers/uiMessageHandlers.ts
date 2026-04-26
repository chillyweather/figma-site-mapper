/**
 * UI MESSAGE HANDLERS
 *
 * These handlers process messages from the UI (React app)
 * and coordinate with backend services and Figma API
 */

import { renderSitemap } from "../../figmaRendering/renderSitemap";
import { DEFAULT_SETTINGS } from "../../constants";
import { STYLE_PRESETS } from "../../utils/stylePresets";

import {
  startCrawl,
  getJobStatus,
  openAuthSession,
  startDiscovery,
  getDiscoveryRun,
  approveDiscoveryRun,
  startApprovedCrawl,
} from "../services/apiClient";
import { handleShowFlow } from "./flowHandlers";
import {
  handleShowStylingElements,
  handleGetCurrentPageUrl,
  handleRenderGlobalStylesRequest,
  handleRenderElementStylesRequest,
  handleSelectElementStyle,
} from "./stylingHandlers";
import { handleGetElementSelection } from "../events/pageEventHandlers";
import {
  buildManifestFromProject,
  buildManifestFromPageIds,
} from "../utils/buildManifestFromProject";
import type { ManifestData } from "../types";
import {
  handleRenderMarkupRequest,
  handleClearMarkupRequest,
} from "./markupHandler";
import {
  handleLoadInventoryOverviewRequest,
  handlePrepareInventoryRequest,
  handleRenderInventoryBoardsRequest,
} from "./inventoryHandlers";
import { dispatchInventoryMessage } from "./inventoryMessageDispatcher";
import { isInventoryUiMessage } from "../../messages/inventoryMessages";

/** Persist cookies for a domain */
async function storeDomainCookies(
  domain: string,
  cookies: Array<{ name: string; value: string; domain: string }>
): Promise<void> {
  try {
    const key = `cookies_${domain}`;
    console.log(`💾 [storeDomainCookies] Saving ${cookies.length} cookies to ${key}`);
    await figma.clientStorage.setAsync(key, cookies);
    const verify = await figma.clientStorage.getAsync(key);
    console.log(
      `🔍 [storeDomainCookies] Read-back count for ${key}: ${Array.isArray(verify) ? verify.length : 0}`
    );
  } catch (error) {
    console.error(`Failed to store cookies for ${domain}`, error);
  }
}

/** Load settings and send to UI */
async function handleLoadSettings(): Promise<void> {
  try {
    const stored = await figma.clientStorage.getAsync("settings");
    const settings = stored
      ? Object.assign({}, DEFAULT_SETTINGS, stored)
      : DEFAULT_SETTINGS;
    figma.ui.postMessage({ type: "settings-loaded", settings });
  } catch (error) {
    console.error("Failed to load settings", error);
    figma.ui.postMessage({ type: "settings-error" });
  }
}

/** Load active project and send to UI */
async function handleLoadProject(): Promise<void> {
  try {
    console.log("🔍 [LOAD PROJECT] Loading project from clientStorage...");
    const projectId = await figma.clientStorage.getAsync("activeProjectId");
    console.log("🔍 [LOAD PROJECT] Retrieved projectId:", projectId);
    console.log("🔍 [LOAD PROJECT] projectId type:", typeof projectId);
    console.log("🔍 [LOAD PROJECT] Sending to UI:", {
      type: "project-loaded",
      projectId,
    });
    figma.ui.postMessage({ type: "project-loaded", projectId });
  } catch (error) {
    console.error("❌ [LOAD PROJECT] Failed to load project", error);
    figma.ui.postMessage({ type: "project-error" });
  }
}

/** Save active project */
async function handleSaveProject(msg: {
  projectId: string | null;
}): Promise<void> {
  try {
    console.log("💾 [SAVE PROJECT] Saving project to clientStorage...");
    console.log("💾 [SAVE PROJECT] projectId:", msg.projectId);
    console.log("💾 [SAVE PROJECT] projectId type:", typeof msg.projectId);
    activeProjectIdRef = msg.projectId || null;
    await figma.clientStorage.setAsync("activeProjectId", msg.projectId);
    console.log("✅ [SAVE PROJECT] Successfully saved to clientStorage");

    // Verify it was saved
    const verified = await figma.clientStorage.getAsync("activeProjectId");
    console.log("🔍 [SAVE PROJECT] Verification read:", verified);
  } catch (error) {
    console.error("❌ [SAVE PROJECT] Failed to save project", error);
  }
}

let hasRenderedSitemap = false;
let activeProjectIdRef: string | null = null;

async function getActiveProjectId(): Promise<string | null> {
  if (activeProjectIdRef !== null) {
    return activeProjectIdRef;
  }
  try {
    const stored = await figma.clientStorage.getAsync("activeProjectId");
    activeProjectIdRef = stored || null;
    return activeProjectIdRef;
  } catch (error) {
    console.error("Failed to load active project id", error);
    return null;
  }
}

function extractDomain(url: string): string | null {
  console.log("[extractDomain] START - input:", url, "type:", typeof url);
  try {
    if (!url || typeof url !== "string") {
      console.warn("[extractDomain] Invalid url provided", url);
      return null;
    }
    console.log("[extractDomain] URL type check:", typeof URL);
    if (typeof URL === "undefined") {
      console.warn("[extractDomain] Global URL constructor missing", url);
      // Fallback: parse manually
      const match = url.match(/^https?:\/\/([^\/]+)/);
      if (match && match[1]) {
        console.log("[extractDomain] Manual parse success:", match[1]);
        return match[1];
      }
      return null;
    }
    const trimmedUrl = url.trim();
    console.log("[extractDomain] About to call new URL with:", trimmedUrl);
    const urlObj = new URL(trimmedUrl);
    console.log("[extractDomain] URL parsed, hostname:", urlObj.hostname);
    const hostname = urlObj.hostname;
    if (!hostname) {
      console.warn("[extractDomain] Parsed URL without hostname", trimmedUrl);
      return null;
    }
    console.log("[extractDomain] SUCCESS - returning:", hostname);
    return hostname;
  } catch (error) {
    console.error(
      `[extractDomain] EXCEPTION for url=${url}:`,
      error,
      "message:",
      error instanceof Error ? error.message : String(error),
      "stack:",
      error instanceof Error ? error.stack : "N/A"
    );
    // Fallback: parse manually
    const match = url.match(/^https?:\/\/([^\/]+)/);
    if (match && match[1]) {
      console.log("[extractDomain] Fallback parse success:", match[1]);
      return match[1];
    }
    return null;
  }
}

export async function loadDomainCookies(
  domain: string
): Promise<Array<{ name: string; value: string; domain: string }> | null> {
  try {
    const key = `cookies_${domain}`;
    const stored = await figma.clientStorage.getAsync(key);
    return stored || null;
  } catch (error) {
    console.error(`Failed to load cookies for ${domain}`, error);
    return null;
  }
}

async function loadStoredCookieAuthForUrl(url: string): Promise<{
  method: "cookies";
  cookies: Array<{ name: string; value: string; domain: string }>;
} | null> {
  const domain = extractDomain(url);
  const storedCookies = domain ? await loadDomainCookies(domain) : null;
  if (!storedCookies || storedCookies.length === 0) {
    return null;
  }
  return {
    method: "cookies",
    cookies: storedCookies,
  };
}

type LastJobSubsetMetadata = {
  jobId: string;
  projectId: string;
  startUrl: string;
  pageIds: string[];
  detectInteractiveElements: boolean;
  storedAt: number;
};

async function persistLastJobSubset(
  payload: LastJobSubsetMetadata | null
): Promise<boolean> {
  try {
    await figma.clientStorage.setAsync("lastJobSubset", payload);
    return true;
  } catch (error) {
    console.warn("Unable to persist last job subset metadata", error);
    const message = error instanceof Error ? error.message : String(error);
    if (payload && message.includes("quota")) {
      try {
        await figma.clientStorage.setAsync("lastJobSubset", null);
        await figma.clientStorage.setAsync("lastJobSubset", payload);
        return true;
      } catch (retryError) {
        console.warn("Retry to persist subset metadata failed", retryError);
      }
    }
    return false;
  }
}

function countManifestPages(node: any): number {
  if (!node) {
    return 0;
  }

  let count = 1;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countManifestPages(child);
    }
  }
  return count;
}

export async function handleGetStatus(
  jobId: string,
  screenshotWidth: number,
  detectInteractiveElements: boolean
): Promise<void> {
  try {
    const result = await getJobStatus(jobId);
    const jobResult =
      (result && typeof result === "object"
        ? (result as { result?: any }).result
        : undefined) || {};
    const projectId = jobResult.projectId as string | undefined;
    const startUrl = jobResult.startUrl as string | undefined;
    const detectInteractiveFromJob =
      jobResult.detectInteractiveElements !== undefined
        ? !!jobResult.detectInteractiveElements
        : detectInteractiveElements;
    const renderInteractiveHighlights =
      jobResult.renderInteractiveHighlights !== undefined
        ? !!jobResult.renderInteractiveHighlights
        : detectInteractiveFromJob;
    const fullRefreshFromJob = jobResult.fullRefresh === true;
    const visitedPageIds = Array.isArray(jobResult.visitedPageIds)
      ? jobResult.visitedPageIds.filter(
          (value: unknown): value is string =>
            typeof value === "string" && value.length > 0
        )
      : [];
    const hasSubsetPages = visitedPageIds.length > 0;
    const isApprovedCrawl = Array.isArray(jobResult.approvedUrls)
      || (jobResult.discoveryRunId !== null && jobResult.discoveryRunId !== undefined);

    if (result.status === "completed" && projectId && startUrl) {
      if (hasRenderedSitemap) {
        console.log("⚠️ Skipping duplicate sitemap rendering");
        return;
      }

      hasRenderedSitemap = true;
      console.log("🎉 Job completed, rendering sitemap");

      figma.ui.postMessage({
        type: "status-update",
        jobId,
        status: "rendering",
        detailedProgress: {
          stage: hasSubsetPages
            ? "Fetching job subset..."
            : "Fetching crawl data...",
          progress: 5,
        },
      });

      try {
        let manifestData: ManifestData | null = null;
        let subsetUsed = false;

        if (hasSubsetPages) {
          try {
            console.log(
              `🔍 Attempting to build manifest from ${visitedPageIds.length} page IDs:`,
              visitedPageIds
            );
            manifestData = await buildManifestFromPageIds(
              projectId,
              startUrl,
              visitedPageIds,
              {
                detectInteractiveElements: detectInteractiveFromJob,
              }
            );
            subsetUsed = true;
            console.log(
              `✅ Successfully built manifest from page subset (${visitedPageIds.length} pages)`
            );
            // Count actual pages in tree
            let treePageCount = 0;
            if (manifestData.tree) {
              const countPages = (node: any): number => {
                let count = 1;
                if (node.children) {
                  for (const child of node.children) {
                    count += countPages(child);
                  }
                }
                return count;
              };
              treePageCount = countPages(manifestData.tree);
            }
            console.log(`📊 Manifest tree contains ${treePageCount} pages`);
          } catch (subsetError) {
            subsetUsed = false;
            manifestData = null;
            console.error(
              "❌ Failed to build manifest from job subset, falling back to full project"
            );
            console.error("Error details:", subsetError);
            if (subsetError instanceof Error) {
              console.error("Error stack:", subsetError.stack);
            }
          }
        }

        if (!manifestData) {
          if (isApprovedCrawl) {
            // For discovery-driven approved crawls, never fall back to the full project —
            // doing so would render every existing page on the canvas instead of just the
            // approved subset. Surface a clear error instead.
            figma.ui.postMessage({
              type: "status-update",
              jobId,
              status: "error",
              detailedProgress: {
                stage:
                  "Approved capture finished but produced no pages. Check that the approved URLs are reachable.",
                progress: 100,
              },
            });
            figma.notify(
              "Approved capture finished but produced no pages. Check the worker logs for skipped URLs.",
              { error: true }
            );
            hasRenderedSitemap = false;
            return;
          }
          manifestData = await buildManifestFromProject(projectId, startUrl, {
            detectInteractiveElements: detectInteractiveFromJob,
          });
          subsetUsed = false;
          console.log("Successfully built manifest from project data");
        }

        if (subsetUsed && !manifestData.tree && !isApprovedCrawl) {
          console.warn(
            "Subset manifest contained no pages, rebuilding from full project"
          );
          manifestData = await buildManifestFromProject(projectId, startUrl, {
            detectInteractiveElements: detectInteractiveFromJob,
          });
          subsetUsed = false;
        }

        if (!manifestData.tree) {
          figma.ui.postMessage({
            type: "status-update",
            jobId,
            status: "error",
            detailedProgress: {
              stage: "No pages available in crawl",
              progress: 100,
            },
          });
          figma.notify("Error: No crawled pages found for this project.", {
            error: true,
          });
          hasRenderedSitemap = false;
          return;
        }
        const renderedPageCount = countManifestPages(manifestData.tree);

        await figma.clientStorage.setAsync("lastProjectId", projectId);
        await figma.clientStorage.setAsync("lastStartUrl", startUrl);
        await figma.clientStorage.setAsync("lastJobId", jobId);
        await figma.clientStorage.setAsync(
          "lastDetectInteractiveElements",
          detectInteractiveFromJob
        );
        const subsetMetadataStored = await persistLastJobSubset(
          subsetUsed
            ? {
                jobId,
                projectId,
                startUrl,
                pageIds: visitedPageIds,
                detectInteractiveElements: detectInteractiveFromJob,
                storedAt: Date.now(),
              }
            : null
        );
        if (subsetMetadataStored) {
          console.log(
            subsetUsed
              ? "💾 Stored job subset metadata in clientStorage"
              : "💾 Cleared job subset metadata in clientStorage"
          );
        }

        figma.ui.postMessage({
          type: "manifest-data",
          manifestData,
        });

        let highlightAllElements = false;
        let highlightElementFilters = null;
        try {
          const storedSettings = await figma.clientStorage.getAsync("settings");
          const merged = storedSettings
            ? Object.assign({}, DEFAULT_SETTINGS, storedSettings)
            : DEFAULT_SETTINGS;
          highlightAllElements = !!merged.highlightAllElements;
          highlightElementFilters = merged.highlightElementFilters || null;
          console.log(
            `� Highlight all elements setting: ${highlightAllElements}`
          );
          console.log(`� Element filters:`, highlightElementFilters);
        } catch (e) {
          console.log("Could not load settings for highlightAllElements");
        }

        await renderSitemap(
          manifestData,
          screenshotWidth,
          renderInteractiveHighlights,
          highlightAllElements,
          (stage: string, progress: number) => {
            figma.ui.postMessage({
              type: "status-update",
              jobId,
              status: "rendering",
              detailedProgress: {
                stage,
                progress,
              },
            });
          },
          highlightElementFilters,
          fullRefreshFromJob
        );

        figma.ui.postMessage({
          type: "status-update",
          jobId,
          status: "completed",
          capturedCount: renderedPageCount,
          detailedProgress: {
            stage: "Complete!",
            progress: 100,
          },
        });

        figma.notify("Sitemap created successfully!");
        return;
      } catch (error) {
        hasRenderedSitemap = false;
        console.error("Failed to assemble manifest data:", error);
        figma.notify("Error: Could not fetch crawl results from backend.", {
          error: true,
        });
        figma.ui.postMessage({
          type: "status-update",
          jobId,
          status: "error",
          detailedProgress: {
            stage: "Failed to build sitemap",
            progress: 100,
          },
        });
        return;
      }
    }

    figma.ui.postMessage({
      type: "status-update",
      jobId,
      status: result.status,
      progress: result.progress,
      detailedProgress: result.detailedProgress,
    });
  } catch (error) {
    console.error("Failed to get job status:", error);
    figma.ui.postMessage({
      type: "status-update",
      jobId,
      status: "error",
      detailedProgress: {
        stage: "Failed to get job status",
        progress: 100,
      },
    });
  }
}

export async function handleStartCrawl(config: {
  url: string;
  maxRequestsPerCrawl: number;
  width?: number;
  screenshotWidth?: number;
  maxDepth: number;
  sampleSize: number;
  showBrowser: boolean;
  auth: any;
  deviceScaleFactor: number;
  delay: number;
  requestDelay: number;
  defaultLanguageOnly: boolean;
  detectInteractiveElements: boolean;
  captureOnlyVisibleElements: boolean;
  extractStyles: boolean;
  styleExtractionPreset: "smart" | "minimal" | "complete" | "custom";
  extractInteractiveElements: boolean;
  extractStructuralElements: boolean;
  extractTextElements: boolean;
  extractFormElements: boolean;
  extractMediaElements: boolean;
  extractColors: boolean;
  extractTypography: boolean;
  extractSpacing: boolean;
  extractLayout: boolean;
  extractBorders: boolean;
  includeSelectors: boolean;
  includeComputedStyles: boolean;
  fullRefresh: boolean;
  cookieBannerHandling?: "auto" | "hide" | "off";
  projectId?: string | null;
}): Promise<void> {
  const resolvedProjectId = config.projectId || await getActiveProjectId();

  if (!resolvedProjectId) {
    figma.notify("Select or create a project before starting a crawl.", {
      error: true,
    });
    return;
  }

  // Keep sandbox ref in sync with what the UI considers active.
  activeProjectIdRef = resolvedProjectId;

  // Reset render guard so the next completed crawl can draw a new sitemap
  hasRenderedSitemap = false;

  try {
    const {
      url,
      maxRequestsPerCrawl,
      width: configuredWidth,
      screenshotWidth,
      maxDepth,
      sampleSize,
      showBrowser,
      auth,
      deviceScaleFactor,
      delay,
      requestDelay,
      defaultLanguageOnly,
      detectInteractiveElements,
      captureOnlyVisibleElements,
      fullRefresh,
      cookieBannerHandling,
    } = config;

    const width = configuredWidth ?? screenshotWidth ?? parseInt(DEFAULT_SETTINGS.screenshotWidth, 10);

    // Resolve stored cookies for this domain (used for manual auth or auto-injection)
    const domain = extractDomain(url);
    const storedCookies = domain ? await loadDomainCookies(domain) : null;

    // If auth method is manual, load cookies from storage
    let authData = auth;

    if (auth && auth.method === "manual") {
      if (storedCookies && storedCookies.length > 0) {
        console.log(
          `🍪 Using ${storedCookies.length} stored cookies for manual auth`
        );
        authData = {
          method: "cookies",
          cookies: storedCookies,
        };
      } else {
        console.log(
          "⚠️ Manual auth selected but no cookies found. Run authentication session first."
        );
        figma.notify(
          "No authentication cookies found. Please complete the authentication session first.",
          { error: true }
        );
        return;
      }
    } else if (
      storedCookies &&
      storedCookies.length > 0 &&
      (!auth ||
        (auth.method === "cookies" && (!auth.cookies || auth.cookies.length === 0)))
    ) {
      console.log(
        `🍪 Injecting ${storedCookies.length} stored cookies for ${domain} automatically`
      );
      authData = {
        method: "cookies",
        cookies: storedCookies,
      };
    }

    const smartStyleExtraction = STYLE_PRESETS.smart;
    const styleExtraction = {
      enabled: true,
      preset: "smart",
      extractInteractiveElements: smartStyleExtraction.extractInteractive,
      extractStructuralElements: smartStyleExtraction.extractStructural,
      extractTextElements: smartStyleExtraction.extractContentBlocks,
      extractFormElements: smartStyleExtraction.extractFormElements,
      extractMediaElements: smartStyleExtraction.extractCustomComponents,
      extractColors: smartStyleExtraction.extractColors,
      extractTypography: smartStyleExtraction.extractTypography,
      extractSpacing: smartStyleExtraction.extractSpacing,
      extractLayout: smartStyleExtraction.extractLayout,
      extractBorders: smartStyleExtraction.extractBorders,
      includeSelectors: true,
      includeComputedStyles: true,
    };

    const result = await startCrawl({
      url,
      maxRequestsPerCrawl,
      screenshotWidth: width,
      deviceScaleFactor,
      delay,
      requestDelay,
      maxDepth,
      defaultLanguageOnly,
      sampleSize,
      showBrowser,
      detectInteractiveElements,
      cookieBannerHandling,
      fullRefresh,
      captureOnlyVisibleElements,
      auth: authData,
      styleExtraction,
      projectId: resolvedProjectId,
    });

    figma.ui.postMessage({
      type: "crawl-started",
      jobId: result.jobId,
    });
  } catch (error) {
    console.error("Failed to start crawl:", error);
    figma.notify("Error: Could not connect to the backend server.", {
      error: true,
    });
  }
}

async function handleSetActiveProject(projectId: string | null): Promise<void> {
  activeProjectIdRef = projectId || null;
  try {
    await figma.clientStorage.setAsync("activeProjectId", projectId || null);
  } catch (error) {
    console.error("Failed to persist active project id", error);
  }
}

async function handleRenderProjectSnapshot(msg: {
  projectId?: string | null;
  startUrl?: string;
  screenshotWidth?: number;
  detectInteractiveElements?: boolean;
}): Promise<void> {
  const resolvedProjectId = msg.projectId
    ? msg.projectId
    : await getActiveProjectId();

  if (!resolvedProjectId) {
    figma.ui.postMessage({
      type: "snapshot-error",
      error: "Select a project before rendering a snapshot.",
    });
    figma.notify("Select a project before rendering a snapshot.", {
      error: true,
    });
    return;
  }

  let startUrl = typeof msg.startUrl === "string" ? msg.startUrl.trim() : "";

  if (!startUrl) {
    try {
      const storedStartUrl = await figma.clientStorage.getAsync("lastStartUrl");
      if (typeof storedStartUrl === "string" && storedStartUrl.length > 0) {
        startUrl = storedStartUrl;
      }
    } catch (error) {
      console.warn("Failed to load last start URL for snapshot", error);
    }
  }

  if (!startUrl) {
    figma.ui.postMessage({
      type: "snapshot-error",
      error: "No start URL available for this project.",
    });
    figma.notify("Provide a start URL before rendering a snapshot.", {
      error: true,
    });
    return;
  }

  let screenshotWidth =
    typeof msg.screenshotWidth === "number" &&
    Number.isFinite(msg.screenshotWidth) &&
    msg.screenshotWidth > 0
      ? msg.screenshotWidth
      : parseInt(DEFAULT_SETTINGS.screenshotWidth, 10);

  if (!Number.isFinite(screenshotWidth) || screenshotWidth <= 0) {
    screenshotWidth = 1440;
  }

  const detectInteractiveElements =
    msg.detectInteractiveElements !== undefined
      ? !!msg.detectInteractiveElements
      : true;

  figma.ui.postMessage({ type: "snapshot-render-started" });

  try {
    figma.ui.postMessage({
      type: "snapshot-status",
      status: "fetching",
      detailedProgress: {
        stage: "Fetching project data...",
        progress: 5,
      },
    });

    const manifestData = await buildManifestFromProject(
      resolvedProjectId,
      startUrl,
      {
        detectInteractiveElements,
        preservePageOrder: true,
      }
    );

    if (!manifestData.tree) {
      figma.ui.postMessage({
        type: "snapshot-error",
        error: "No pages available to render.",
      });
      figma.notify("No pages available to render for this project.", {
        error: true,
      });
      return;
    }

    await figma.clientStorage.setAsync("lastProjectId", resolvedProjectId);
    await figma.clientStorage.setAsync("lastStartUrl", startUrl);
    await figma.clientStorage.setAsync(
      "lastDetectInteractiveElements",
      detectInteractiveElements
    );
    await persistLastJobSubset(null);

    figma.ui.postMessage({
      type: "manifest-data",
      manifestData,
    });

    let highlightAllElements = false;
    let highlightElementFilters = null as null | Record<string, any>;

    try {
      const storedSettings = await figma.clientStorage.getAsync("settings");
      const mergedSettings = storedSettings
        ? Object.assign({}, DEFAULT_SETTINGS, storedSettings)
        : DEFAULT_SETTINGS;
      highlightAllElements = !!mergedSettings.highlightAllElements;
      highlightElementFilters = mergedSettings.highlightElementFilters || null;
    } catch (error) {
      console.warn("Unable to load highlight settings for snapshot", error);
    }

    hasRenderedSitemap = true;

    await renderSitemap(
      manifestData,
      screenshotWidth,
      detectInteractiveElements,
      highlightAllElements,
      (stage: string, progress: number) => {
        figma.ui.postMessage({
          type: "snapshot-status",
          status: "rendering",
          detailedProgress: {
            stage,
            progress,
          },
        });
      },
      highlightElementFilters
    );

    figma.ui.postMessage({
      type: "snapshot-completed",
      message: "Project snapshot rendered successfully!",
    });
    figma.notify("Project snapshot rendered successfully!");
  } catch (error) {
    hasRenderedSitemap = false;
    console.error("Failed to render project snapshot", error);
    figma.ui.postMessage({
      type: "snapshot-error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    figma.notify("Error: Failed to render project snapshot.", { error: true });
  }
}

/**
 * Handle save-settings message from UI
 */
export async function handleSaveSettings(msg: any): Promise<void> {
  try {
    await figma.clientStorage.setAsync("settings", msg.settings);
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

/**
 * Handle close message from UI
 */
export function handleClose(): void {
  figma.closePlugin();
}

/**
 * Handle open-auth-session message from UI
 */
export async function handleOpenAuthSession(msg: any): Promise<void> {
  const rawUrl = typeof msg.url === "string" ? msg.url : "";
  const url = rawUrl.trim();

  console.log("🔐 Opening authentication session for URL:", url);

  try {
    // Notify UI that auth session is starting
    figma.ui.postMessage({
      type: "auth-session-status",
      status: "opening",
    });

    const result = await openAuthSession(url);

    // Store cookies for this domain
    const domain = extractDomain(url);
    const cookieArray = Array.isArray(result.cookies) ? result.cookies : [];
    const cookieCount = cookieArray.length;
    const cookiePreview = cookieArray.map(
      (cookie) => `${cookie.name}=${cookie.value.slice(0, 4)}…`
    );
    const domainLabel = domain ? domain : "unknown";
    console.log(
      `🔍 Auth session result for ${url} (domain: ${domainLabel}) captured ${cookieCount} cookies`
    );

    if (domain && cookieCount > 0) {
      await storeDomainCookies(domain, cookieArray);
      console.log(
        `🍪 Stored ${cookieCount} cookies for domain ${domain}:`,
        cookiePreview
      );

      figma.ui.postMessage({
        type: "auth-session-status",
        status: "success",
        cookieCount,
        domain,
      });

      figma.notify(
        `Authentication successful! Captured ${cookieCount} cookies for ${domain}.`
      );
    } else {
      console.warn(
        `⚠️ Auth session completed without cookies (domain: ${domainLabel}) preview:`,
        cookiePreview
      );
      figma.ui.postMessage({
        type: "auth-session-status",
        status: "failed",
        error: "No cookies captured",
        domain: domain ? domain : null,
        cookieCount,
        cookiePreview,
        rawUrl: url,
        storeKey: domain ? `cookies_${domain}` : null,
      });

      figma.notify("Authentication completed but no cookies were captured.", {
        error: true,
      });
    }
  } catch (error) {
    console.error("Failed to open auth session:", error);
    figma.ui.postMessage({
      type: "auth-session-status",
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    figma.notify("Error: Could not open authentication session.", {
      error: true,
    });
  }
}

/**
 * Handle loading last manifest URL from storage
 */
async function handleGetLastManifest(): Promise<void> {
  try {
    const lastProjectId = await figma.clientStorage.getAsync("lastProjectId");
    const lastStartUrl = await figma.clientStorage.getAsync("lastStartUrl");
    const lastDetectInteractiveElements =
      (await figma.clientStorage.getAsync("lastDetectInteractiveElements")) !==
        null &&
      (await figma.clientStorage.getAsync("lastDetectInteractiveElements")) !==
        undefined
        ? await figma.clientStorage.getAsync("lastDetectInteractiveElements")
        : true;

    if (!lastProjectId || !lastStartUrl) {
      figma.ui.postMessage({
        type: "manifest-error",
        message: "No previous crawl found",
      });
      return;
    }

    const manifestData = await buildManifestFromProject(
      lastProjectId,
      lastStartUrl,
      {
        detectInteractiveElements: !!lastDetectInteractiveElements,
      }
    );

    figma.ui.postMessage({
      type: "manifest-data",
      manifestData,
    });
  } catch (error) {
    console.error("Failed to get last manifest URL:", error);
    figma.ui.postMessage({
      type: "manifest-error",
      message: "Failed to fetch previous crawl",
    });
  }
}



async function handleStartDiscovery(msg: {
  projectId: string;
  startUrl: string;
  seedUrls?: string[];
  pageBudget?: number;
  includeSubdomains?: boolean;
  includeBlog?: boolean;
  includeSupport?: boolean;
}): Promise<void> {
  try {
    const started = await startDiscovery({
      projectId: msg.projectId,
      startUrl: msg.startUrl,
      seedUrls: msg.seedUrls,
      pageBudget: msg.pageBudget,
      includeSubdomains: msg.includeSubdomains,
      includeBlog: msg.includeBlog,
      includeSupport: msg.includeSupport,
    });

    const fullRun = await getDiscoveryRun(started.discoveryRunId);

    figma.ui.postMessage({
      type: "discovery-result",
      result: fullRun,
    });
  } catch (error) {
    console.error("Discovery failed:", error);
    figma.ui.postMessage({
      type: "discovery-error",
      error: error instanceof Error ? error.message : "Discovery failed",
    });
  }
}

async function handleSubmitDiscoveryApproval(msg: {
  runId: string;
  projectId: string;
  approvedCandidateIds: string[];
  manualUrls: string[];
  excludedCandidateIds: string[];
  screenshotWidth: number;
  deviceScaleFactor: number;
  fullRefresh: boolean;
  cookieBannerHandling?: "auto" | "hide" | "off";
  styleExtraction?: Record<string, unknown>;
}): Promise<void> {
  hasRenderedSitemap = false;

  try {
    const approval = await approveDiscoveryRun(msg.runId, {
      approvedCandidateIds: msg.approvedCandidateIds,
      manualUrls: msg.manualUrls,
      excludedCandidateIds: msg.excludedCandidateIds,
    });

    if (!approval.approvedUrls || approval.approvedUrls.length === 0) {
      figma.notify("No URLs approved for capture.", { error: true });
      figma.ui.postMessage({
        type: "discovery-error",
        error: "No URLs were approved for capture.",
      });
      return;
    }

    const result = await startApprovedCrawl({
      projectId: msg.projectId,
      discoveryRunId: msg.runId,
      approvedUrls: approval.approvedUrls,
      fullRefresh: msg.fullRefresh,
      screenshotWidth: msg.screenshotWidth,
      deviceScaleFactor: msg.deviceScaleFactor,
      auth: (await loadStoredCookieAuthForUrl(approval.approvedUrls[0]!)) ?? undefined,
      cookieBannerHandling: msg.cookieBannerHandling ?? "auto",
      styleExtraction: msg.styleExtraction,
    });

    figma.ui.postMessage({
      type: "crawl-started",
      jobId: result.jobId,
    });
  } catch (error) {
    console.error("Failed to submit discovery approval:", error);
    figma.notify("Error: Could not start approved capture crawl.", { error: true });
    figma.ui.postMessage({
      type: "discovery-error",
      error: error instanceof Error ? error.message : "Failed to start capture crawl",
    });
  }
}

async function handleSubmitExactUrls(msg: {
  projectId: string;
  exactUrls: string[];
  screenshotWidth: number;
  deviceScaleFactor: number;
  fullRefresh: boolean;
  cookieBannerHandling?: "auto" | "hide" | "off";
  styleExtraction?: Record<string, unknown>;
}): Promise<void> {
  hasRenderedSitemap = false;

  if (!msg.exactUrls || msg.exactUrls.length === 0) {
    figma.notify("Enter at least one URL to capture.", { error: true });
    figma.ui.postMessage({
      type: "discovery-error",
      error: "Enter at least one URL to capture.",
    });
    return;
  }

  try {
    // Run a minimal discovery to register these URLs as candidates
    const started = await startDiscovery({
      projectId: msg.projectId,
      startUrl: msg.exactUrls[0],
      seedUrls: msg.exactUrls,
      maxCandidates: msg.exactUrls.length,
    });

    // Approve via manualUrls (adds them as approved candidates regardless of discovery result)
    const approval = await approveDiscoveryRun(started.discoveryRunId, {
      approvedCandidateIds: [],
      manualUrls: msg.exactUrls,
      excludedCandidateIds: [],
    });

    if (!approval.approvedUrls || approval.approvedUrls.length === 0) {
      figma.notify("No valid URLs to capture.", { error: true });
      figma.ui.postMessage({
        type: "discovery-error",
        error: "No valid URLs could be queued for capture.",
      });
      return;
    }

    const result = await startApprovedCrawl({
      projectId: msg.projectId,
      discoveryRunId: started.discoveryRunId,
      approvedUrls: approval.approvedUrls,
      fullRefresh: msg.fullRefresh,
      screenshotWidth: msg.screenshotWidth,
      deviceScaleFactor: msg.deviceScaleFactor,
      auth: (await loadStoredCookieAuthForUrl(approval.approvedUrls[0]!)) ?? undefined,
      cookieBannerHandling: msg.cookieBannerHandling ?? "auto",
      styleExtraction: msg.styleExtraction,
    });

    figma.ui.postMessage({
      type: "crawl-started",
      jobId: result.jobId,
    });
  } catch (error) {
    console.error("Failed to start exact URL crawl:", error);
    figma.notify("Error: Could not start capture crawl.", { error: true });
    figma.ui.postMessage({
      type: "discovery-error",
      error: error instanceof Error ? error.message : "Failed to start capture crawl",
    });
  }
}

/**
 * Main message router for UI messages
 */
export async function handleUIMessage(msg: any): Promise<void> {
  // Route typed inventory messages through the dedicated dispatcher
  if (isInventoryUiMessage(msg)) {
    await dispatchInventoryMessage(msg);
    return;
  }

  switch (msg.type) {
    case "start-crawl":
      await handleStartCrawl(msg);
      break;
    case "save-settings":
      await handleSaveSettings(msg);
      break;
    case "load-settings":
      await handleLoadSettings();
      break;
    case "load-project":
      await handleLoadProject();
      break;
    case "save-project":
      await handleSaveProject({ projectId: msg.projectId ?? null });
      break;
    case "get-status":
      await handleGetStatus(
        msg.jobId,
        msg.screenshotWidth,
        msg.detectInteractiveElements !== false
      );
      break;
    case "show-flow":
      await handleShowFlow(msg.selectedLinks);
      break;
    case "show-styling-elements":
      await handleShowStylingElements();
      break;
    case "get-current-page-url":
      await handleGetCurrentPageUrl();
      break;
    case "render-global-styles":
      await handleRenderGlobalStylesRequest();
      break;
    case "render-element-styles":
      await handleRenderElementStylesRequest((msg as any).elementId);
      break;
    case "select-element-style":
      await handleSelectElementStyle((msg as any).elementId);
      break;
    case "get-element-selection":
      handleGetElementSelection();
      break;
    case "open-auth-session":
      await handleOpenAuthSession(msg);
      break;
    case "set-active-project":
      await handleSetActiveProject(msg.projectId || null);
      break;

    case "render-project-snapshot":
      await handleRenderProjectSnapshot(msg);
      break;

    case "render-markup": {
      const projectId = await getActiveProjectId();
      await handleRenderMarkupRequest({
        projectId,
        pageId: msg.pageId || null,
        pageUrl: msg.pageUrl || null,
        elementFilters: msg.elementFilters,
      });
      break;
    }

    case "clear-markup": {
      await handleClearMarkupRequest({
        pageId: msg.pageId || null,
        pageUrl: msg.pageUrl || null,
      });
      break;
    }

    case "load-inventory-overview": {
      await handleLoadInventoryOverviewRequest({
        projectId: msg.projectId || null,
      });
      break;
    }

    case "prepare-inventory": {
      await handlePrepareInventoryRequest({
        projectId: msg.projectId || null,
      });
      break;
    }

    case "render-inventory-boards": {
      await handleRenderInventoryBoardsRequest({
        projectId: msg.projectId || null,
      });
      break;
    }

    case "start-discovery":
      await handleStartDiscovery(msg);
      break;

    case "submit-discovery-approval":
      await handleSubmitDiscoveryApproval(msg);
      break;

    case "submit-exact-urls":
      await handleSubmitExactUrls(msg);
      break;

    case "close":
      handleClose();
      break;

    default:
      console.log("Unknown message type:", msg.type);
  }
}
