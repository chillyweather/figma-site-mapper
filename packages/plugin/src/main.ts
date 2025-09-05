import { renderSitemap } from "./figmaRendering/renderSitemap";

const BACKEND_URL = 'http://localhost:3006';
let screenshotWidth = 1440; // Default screenshot width

figma.showUI(__html__, { width: 320, height: 480, themeColors: true });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "start-crawl") {
    const { url, maxRequestsPerCrawl, screenshotWidth: width, deviceScaleFactor } = msg;
    
    // Store the screenshot width for later use
    screenshotWidth = width || 1440;

    try {
      const response = await fetch(`${BACKEND_URL}/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, publicUrl: BACKEND_URL, maxRequestsPerCrawl, deviceScaleFactor: deviceScaleFactor || 1 }),
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

  if (msg.type === "get-status") {
    const { jobId } = msg;

    try {

      const response = await fetch(`${BACKEND_URL}/status/${jobId}`);
      const result = await response.json();

      if (result.status === "completed" && result.result?.manifestUrl) {
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
      }

      figma.ui.postMessage({
        type: "status-update",
        jobId,
        status: result.status,
        progress: result.progress,
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
