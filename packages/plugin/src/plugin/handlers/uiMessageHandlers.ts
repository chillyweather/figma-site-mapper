/**
 * UI MESSAGE HANDLERS
 *
 * These handlers process messages from the UI (React app)
 * and coordinate with backend services and Figma API
 */

import { renderSitemap } from "../../figmaRendering/renderSitemap";
import { buildTokensTable } from "../../figmaRendering/buildTokensTable";
import {
  startCrawl,
  getJobStatus,
  fetchManifest,
  openAuthSession,
} from "../services/apiClient";
import { handleShowFlow } from "./flowHandlers";
import { handleShowStylingElements } from "./stylingHandlers";
import { DEFAULT_SETTINGS } from "../../constants";

let screenshotWidth = 1440;
let hasRenderedSitemap = false;

/**
 * Extract domain from URL string without using URL constructor
 * (URL constructor is not available in Figma plugin sandbox)
 */
function extractDomain(url: string): string | null {
  try {
    // Remove protocol
    let domain = url.replace(/^https?:\/\//, "");
    // Remove path and query string
    domain = domain.split("/")[0];
    domain = domain.split("?")[0];
    // Remove port if present
    domain = domain.split(":")[0];
    return domain;
  } catch (error) {
    console.error("Failed to extract domain from URL:", error);
    return null;
  }
}

/**
 * Store cookies for a specific domain
 */
async function storeDomainCookies(
  domain: string,
  cookies: Array<{ name: string; value: string; domain: string }>
): Promise<void> {
  try {
    const domainCookies =
      (await figma.clientStorage.getAsync("domainCookies")) || {};
    domainCookies[domain] = {
      cookies,
      timestamp: Date.now(),
    };
    await figma.clientStorage.setAsync("domainCookies", domainCookies);
  } catch (error) {
    console.error("Failed to store domain cookies:", error);
  }
}

/**
 * Load cookies for a specific domain
 */
export async function loadDomainCookies(
  domain: string
): Promise<Array<{ name: string; value: string }> | null> {
  try {
    const domainCookies =
      (await figma.clientStorage.getAsync("domainCookies")) || {};
    const cookieData = domainCookies[domain];

    if (!cookieData) {
      return null;
    }

    // Check if cookies are less than 24 hours old
    const age = Date.now() - cookieData.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (age > maxAge) {
      console.log(
        `🍪 Cookies for ${domain} are stale (${Math.round(age / 1000 / 60)} minutes old), ignoring`
      );
      return null;
    }

    console.log(
      `🍪 Found ${cookieData.cookies.length} cached cookies for ${domain}`
    );
    return cookieData.cookies;
  } catch (error) {
    console.error("Failed to load domain cookies:", error);
    return null;
  }
}

/**
 * Handle start-crawl message from UI
 */
export async function handleStartCrawl(msg: any): Promise<void> {
  const {
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
    captureOnlyVisibleElements,
    auth,
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
  } = msg;

  console.log("📡 Received crawl request for URL:", url);

  screenshotWidth = width || 1440;
  hasRenderedSitemap = false;

  try {
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
      captureOnlyVisibleElements,
      auth: authData,
      styleExtraction,
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
 * Handle load-settings message from UI
 */
export async function handleLoadSettings(): Promise<void> {
  try {
    const storedSettings = await figma.clientStorage.getAsync("settings");
    // Merge stored settings with defaults to ensure new fields have default values
    const settings = storedSettings
      ? Object.assign({}, DEFAULT_SETTINGS, storedSettings)
      : DEFAULT_SETTINGS;
    figma.ui.postMessage({
      type: "settings-loaded",
      settings: settings,
    });
  } catch (error) {
    console.error("Failed to load settings:", error);
    figma.ui.postMessage({
      type: "settings-loaded",
      settings: DEFAULT_SETTINGS,
    });
  }
}

/**
 * Handle get-status message from UI
 */
export async function handleGetStatus(msg: any): Promise<void> {
  const { jobId } = msg;

  try {
    const result = await getJobStatus(jobId);

    // Check if job is completed and needs rendering
    if (
      result.status === "completed" &&
      result.result?.manifestUrl &&
      !hasRenderedSitemap
    ) {
      hasRenderedSitemap = true;
      console.log("🎉 Job completed, rendering sitemap");

      // Update progress: Fetching manifest
      figma.ui.postMessage({
        type: "status-update",
        jobId,
        status: "rendering",
        detailedProgress: {
          stage: "Fetching manifest...",
          progress: 5,
        },
      });

      const manifestData = await fetchManifest(result.result.manifestUrl);
      console.log("Successfully fetched manifest");

      // Store manifest URL in clientStorage for persistence
      await figma.clientStorage.setAsync(
        "lastManifestUrl",
        result.result.manifestUrl
      );
      await figma.clientStorage.setAsync("lastJobId", jobId);
      console.log("💾 Stored manifest URL in clientStorage");

      // Send manifest data to UI for storage
      figma.ui.postMessage({
        type: "manifest-data",
        manifestData,
      });

      // Store cookies for this domain if available
      if (manifestData.cookies && manifestData.cookies.length > 0) {
        try {
          const domain = extractDomain(manifestData.startUrl);
          if (domain) {
            await storeDomainCookies(domain, manifestData.cookies);
            console.log(
              `🍪 Stored ${manifestData.cookies.length} cookies for domain ${domain}`
            );
          }
        } catch (error) {
          console.error("Failed to store domain cookies:", error);
        }
      }

      const detectInteractiveElements =
        result.result?.detectInteractiveElements !== false;

      // Render sitemap with progress updates
      await renderSitemap(
        manifestData,
        screenshotWidth,
        detectInteractiveElements,
        (stage: string, progress: number) => {
          // Send progress update to UI
          figma.ui.postMessage({
            type: "status-update",
            jobId,
            status: "rendering",
            detailedProgress: {
              stage,
              progress,
            },
          });
        }
      );

      // Final completion - now set status to completed
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

      // Don't send the backend status update since we've handled rendering
      return;
    } else if (result.status === "completed" && hasRenderedSitemap) {
      console.log("⚠️ Skipping duplicate sitemap rendering");
      // Don't send duplicate updates
      return;
    }

    // Send status update to UI (only if not handled above)
    figma.ui.postMessage({
      type: "status-update",
      jobId,
      status: result.status,
      progress: result.progress,
      detailedProgress: result.detailedProgress,
      manifestUrl: result.result?.manifestUrl,
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
    const lastManifestUrl =
      await figma.clientStorage.getAsync("lastManifestUrl");
    const lastJobId = await figma.clientStorage.getAsync("lastJobId");

    figma.ui.postMessage({
      type: "last-manifest-url",
      manifestUrl: lastManifestUrl || null,
      jobId: lastJobId || null,
    });
  } catch (error) {
    console.error("Failed to get last manifest URL:", error);
    figma.ui.postMessage({
      type: "last-manifest-url",
      manifestUrl: null,
      jobId: null,
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
      await handleGetStatus(msg);
      break;

    case "show-flow":
      await handleShowFlow(msg.selectedLinks);
      break;

    case "show-styling-elements":
      await handleShowStylingElements(msg.filters);
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

    case "close":
      handleClose();
      break;

    default:
      console.log("Unknown message type:", msg.type);
  }
}
