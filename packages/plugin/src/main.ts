import { renderSitemap } from "./figmaRendering/renderSitemap";

const BACKEND_URL = 'http://localhost:3006';
let screenshotWidth = 1440; // Default screenshot width
let hasRenderedSitemap = false; // Prevent duplicate rendering

figma.showUI(__html__, { width: 320, height: 1000, themeColors: true });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "start-crawl") {
    const { url, maxRequestsPerCrawl, screenshotWidth: width, deviceScaleFactor, delay, requestDelay, maxDepth, defaultLanguageOnly, sampleSize, showBrowser, auth } = msg;

    console.log('📡 Main.ts received crawl request for URL:', url);

    // Store the screenshot width for later use
    screenshotWidth = width || 1440;
    hasRenderedSitemap = false; // Reset flag for new crawl

    try {
      const response = await fetch(`${BACKEND_URL}/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, publicUrl: BACKEND_URL, maxRequestsPerCrawl, deviceScaleFactor: deviceScaleFactor || 1, delay: delay || 0, requestDelay: requestDelay || 1000, maxDepth, defaultLanguageOnly: defaultLanguageOnly !== false, sampleSize, showBrowser, auth }),
      });

      const result = await response.json();

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

  if (msg.type === "save-settings") {
    try {
      await figma.clientStorage.setAsync("settings", msg.settings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  if (msg.type === "load-settings") {
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

  if (msg.type === "get-status") {
    const { jobId } = msg;

    try {

      const response = await fetch(`${BACKEND_URL}/status/${jobId}`);
      const result = await response.json();

      if (result.status === "completed" && result.result?.manifestUrl && !hasRenderedSitemap) {
        hasRenderedSitemap = true; // Prevent duplicate rendering
        console.log("🎉 Job completed, rendering sitemap (first time)");

        console.log(
          "Job complete! Fetching manifest from:",
          result.result.manifestUrl
        );

        const manifestResponse = await fetch(result.result.manifestUrl);

        if (!manifestResponse.ok) {
          console.error("Failed to fetch manifest:", manifestResponse.status, manifestResponse.statusText);
          figma.notify("Error: Could not fetch manifest from backend.", { error: true });
          return;
        }

        const manifestData = await manifestResponse.json();

        console.log("Successfully fetched manifest: ", manifestData);

        figma.notify("Crawl complete and manifest fetched!");
        await renderSitemap(manifestData, screenshotWidth);
      } else if (result.status === "completed" && hasRenderedSitemap) {
        console.log("⚠️  Skipping duplicate sitemap rendering");
      }

      figma.ui.postMessage({
        type: "status-update",
        jobId,
        status: result.status,
        progress: result.progress,
        detailedProgress: result.detailedProgress,
        manifestUrl: result.result?.manifestUrl,
      });
    } catch (error) {
      console.error("Failed to get job status: ", error);
      figma.notify("Error: Could not get job status.", { error: true });
    }
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};
