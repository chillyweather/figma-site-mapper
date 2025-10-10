/**
 * UI MESSAGE HANDLERS
 * 
 * These handlers process messages from the UI (React app)
 * and coordinate with backend services and Figma API
 */

import { renderSitemap } from '../../figmaRendering/renderSitemap';
import { startCrawl, getJobStatus, fetchManifest } from '../services/apiClient';
import { handleShowFlow } from './flowHandlers';

let screenshotWidth = 1440;
let hasRenderedSitemap = false;

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
    auth 
  } = msg;

  console.log('📡 Received crawl request for URL:', url);

  screenshotWidth = width || 1440;
  hasRenderedSitemap = false;

  try {
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
      auth
    });

    figma.ui.postMessage({
      type: "crawl-started",
      jobId: result.jobId,
    });
  } catch (error) {
    console.error("Failed to start crawl:", error);
    figma.notify("Error: Could not connect to the backend server.", { error: true });
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
    const settings = await figma.clientStorage.getAsync("settings");
    figma.ui.postMessage({
      type: "settings-loaded",
      settings: settings || null,
    });
  } catch (error) {
    console.error("Failed to load settings:", error);
    figma.ui.postMessage({
      type: "settings-loaded",
      settings: null,
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
    if (result.status === "completed" && result.result?.manifestUrl && !hasRenderedSitemap) {
      hasRenderedSitemap = true;
      console.log("🎉 Job completed, rendering sitemap");

      const manifestData = await fetchManifest(result.result.manifestUrl);
      console.log("Successfully fetched manifest");

      figma.notify("Crawl complete and manifest fetched!");
      
      const detectInteractiveElements = result.result?.detectInteractiveElements !== false;
      await renderSitemap(manifestData, screenshotWidth, detectInteractiveElements);
    } else if (result.status === "completed" && hasRenderedSitemap) {
      console.log("⚠️ Skipping duplicate sitemap rendering");
    }

    // Send status update to UI
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
    
    case "close":
      handleClose();
      break;
    
    default:
      console.warn('Unknown message type:', msg.type);
  }
}
