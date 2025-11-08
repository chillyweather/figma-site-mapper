/**
 * UI MESSAGE HANDLERS
 *
 * These handlers process messages from the UI (React app)
 * and coordinate with backend services and Figma API
 */

import { renderSitemap } from "../../figmaRendering/renderSitemap";
import { DEFAULT_SETTINGS } from "../../constants";
import { buildTokensTable } from "../../figmaRendering/buildTokensTable";
import {
  startCrawl,
  getJobStatus,
  openAuthSession,
} from "../services/apiClient";
import { handleShowFlow } from "./flowHandlers";
import {
  handleShowStylingElements,
  handleGetCurrentPageUrl,
} from "./stylingHandlers";
import {
  buildManifestFromProject,
  buildManifestFromPageIds,
} from "../utils/buildManifestFromProject";
import type { ManifestData } from "../types";

/** Persist cookies for a domain */
async function storeDomainCookies(
  domain: string,
  cookies: Array<{ name: string; value: string; domain: string }>
): Promise<void> {
  try {
    const key = `cookies_${domain}`;
    await figma.clientStorage.setAsync(key, cookies);
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
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
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
    const visitedPageIds = Array.isArray(jobResult.visitedPageIds)
      ? jobResult.visitedPageIds.filter(
          (value: unknown): value is string =>
            typeof value === "string" && value.length > 0
        )
      : [];
    const hasSubsetPages = visitedPageIds.length > 0;

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
          manifestData = await buildManifestFromProject(projectId, startUrl, {
            detectInteractiveElements: detectInteractiveFromJob,
          });
          subsetUsed = false;
          console.log("Successfully built manifest from project data");
        }

        if (subsetUsed && !manifestData.tree) {
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

        await figma.clientStorage.setAsync("lastProjectId", projectId);
        await figma.clientStorage.setAsync("lastStartUrl", startUrl);
        await figma.clientStorage.setAsync("lastJobId", jobId);
        await figma.clientStorage.setAsync(
          "lastDetectInteractiveElements",
          detectInteractiveFromJob
        );
        if (subsetUsed) {
          await figma.clientStorage.setAsync("lastJobSubset", {
            jobId,
            projectId,
            startUrl,
            pageIds: visitedPageIds,
            detectInteractiveElements: detectInteractiveFromJob,
            storedAt: Date.now(),
            manifestData,
          });
        } else {
          await figma.clientStorage.setAsync("lastJobSubset", null);
        }
        console.log("💾 Stored crawl metadata in clientStorage");

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
          detectInteractiveFromJob,
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
          highlightElementFilters
        );

        figma.ui.postMessage({
          type: "status-update",
          jobId,
          status: "completed",
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
  width: number;
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
}): Promise<void> {
  const resolvedProjectId = await getActiveProjectId();

  if (!resolvedProjectId) {
    figma.notify("Select or create a project before starting a crawl.", {
      error: true,
    });
    return;
  }

  // Reset render guard so the next completed crawl can draw a new sitemap
  hasRenderedSitemap = false;

  try {
    const {
      url,
      maxRequestsPerCrawl,
      width,
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
      extractStyles,
      styleExtractionPreset,
      extractInteractiveElements,
      extractStructuralElements,
      extractTextElements,
      extractFormElements,
      extractMediaElements,
      extractColors,
      extractTypography,
      extractSpacing,
      extractLayout,
      extractBorders,
      includeSelectors,
      includeComputedStyles,
      fullRefresh,
    } = config;

    // If auth method is manual, load cookies from storage
    let authData = auth;

    if (auth && auth.method === "manual") {
      const domain = extractDomain(url);
      if (domain) {
        const cookies = await loadDomainCookies(domain);
        if (cookies && cookies.length > 0) {
          console.log(
            `🍪 Using ${cookies.length} stored cookies for manual auth`
          );
          authData = {
            method: "cookies",
            cookies,
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
      }
    }

    // Build style extraction settings if enabled
    const styleExtraction = extractStyles
      ? {
          enabled: true,
          preset: styleExtractionPreset,
          extractInteractiveElements,
          extractStructuralElements,
          extractTextElements,
          extractFormElements,
          extractMediaElements,
          extractColors,
          extractTypography,
          extractSpacing,
          extractLayout,
          extractBorders,
          includeSelectors,
          includeComputedStyles,
        }
      : undefined;

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
export async function handleGetStatus(msg: any): Promise<void> {
  const { jobId } = msg;

  try {
    const result = await getJobStatus(lastJobId);
    const projectId = (result.result && result.result.projectId) || null;
    const startUrl = (result.result && result.result.startUrl) || null;
    const detectInteractiveElements =
      result.result && result.result.detectInteractiveElements !== false;

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
        let manifestData = null as null | ManifestData;
        let subsetUsed = false;

        if (hasSubsetPages) {
          try {
            manifestData = await buildManifestFromPageIds(
              projectId,
              startUrl,
              visitedPageIds,
              {
                detectInteractiveElements: detectInteractiveFromJob,
              }
            );
            subsetUsed = true;
          } catch (subsetError) {
            console.warn(
              "Failed to build manifest from page ids, falling back to full project",
              subsetError
            );
            subsetUsed = false;
            manifestData = null;
          }
        }

        if (!manifestData) {
          manifestData = await buildManifestFromProject(
            projectId,
            startUrl,
            {
              detectInteractiveElements: detectInteractiveFromJob,
            }
          );
          subsetUsed = false;
        }

        if (subsetUsed && !manifestData.tree) {
          console.warn(
            "Subset manifest contained no tree data, using full project manifest instead"
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

        await figma.clientStorage.setAsync("lastProjectId", projectId);
        await figma.clientStorage.setAsync("lastStartUrl", startUrl);
        await figma.clientStorage.setAsync("lastJobId", jobId);
        await figma.clientStorage.setAsync(
          "lastDetectInteractiveElements",
          detectInteractiveFromJob
        );

        if (subsetUsed) {
          await figma.clientStorage.setAsync("lastJobSubset", {
            jobId,
            projectId,
            startUrl,
            pageIds: visitedPageIds,
            detectInteractiveElements: detectInteractiveFromJob,
            storedAt: Date.now(),
            manifestData,
          });
        } else {
          await figma.clientStorage.setAsync("lastJobSubset", null);
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
        } catch (error) {
          console.log("Could not load settings for highlightAllElements");
        }

        await renderSitemap(
          manifestData,
          screenshotWidth,
          detectInteractiveFromJob,
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
          highlightElementFilters
        );

        figma.ui.postMessage({
          type: "status-update",
          jobId,
          status: "completed",
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
    figma.notify("Error: Could not get job status.", { error: true });
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
  const { url } = msg;

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
    if (domain && result.cookies && result.cookies.length > 0) {
      await storeDomainCookies(domain, result.cookies);
      console.log(
        `🍪 Stored ${result.cookies.length} cookies for domain ${domain}`
      );

      figma.ui.postMessage({
        type: "auth-session-status",
        status: "success",
        cookieCount: result.cookies.length,
      });

      figma.notify(
        `Authentication successful! Captured ${result.cookies.length} cookies.`
      );
    } else {
      figma.ui.postMessage({
        type: "auth-session-status",
        status: "failed",
        error: "No cookies captured",
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

/**
 * Handle building tokens table
 */
async function handleBuildTokensTable(msg: {
  cssVariables: any;
  pageUrl: string;
}): Promise<void> {
  try {
    await buildTokensTable(msg.cssVariables, msg.pageUrl);
  } catch (error) {
    console.error("Failed to build tokens table:", error);
    figma.notify("Error: Could not build tokens table.", {
      error: true,
    });
  }
}

/**
 * Handle building tokens tables for all pages
 */
async function handleBuildAllTokensTables(msg: {
  pages: Array<{ cssVariables: any; pageUrl: string }>;
}): Promise<void> {
  try {
    console.log(`🔨 Building tables for ${msg.pages.length} pages`);
    let successCount = 0;
    let errorCount = 0;

    for (const page of msg.pages) {
      try {
        await buildTokensTable(page.cssVariables, page.pageUrl);
        successCount++;
      } catch (error) {
        console.error(`Failed to build table for ${page.pageUrl}:`, error);
        errorCount++;
      }
    }

    figma.notify(
      `✅ Built ${successCount} token table(s)${errorCount > 0 ? ` (${errorCount} failed)` : ""}`,
      { timeout: 3000 }
    );
  } catch (error) {
    console.error("Failed to build tokens tables:", error);
    figma.notify("Error: Could not build tokens tables.", {
      error: true,
    });
  }
}

/**
 * Main message router for UI messages
 */
export async function handleUIMessage(msg: any): Promise<void> {
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

    case "get-current-page-url":
      await handleGetCurrentPageUrl();
      break;

    case "show-styling-elements":
      await handleShowStylingElements();
      break;

    case "open-auth-session":
      await handleOpenAuthSession(msg);
      break;

    case "get-last-manifest":
      await handleGetLastManifest();
      break;

    case "build-tokens-table":
      await handleBuildTokensTable(msg);
      break;

    case "build-all-tokens-tables":
      await handleBuildAllTokensTables(msg);
      break;

    case "set-active-project":
      await handleSetActiveProject(msg.projectId || null);
      break;

    case "close":
      handleClose();
      break;

    default:
      console.log("Unknown message type:", msg.type);
  }
}
