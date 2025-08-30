import { renderSitemap } from "./figmaRendering/renderSitemap";
import { TreeNode } from "./types";

const BACKEND_URL = 'https://efba33f8e90c.ngrok-free.app';


figma.showUI(__html__, { width: 320, height: 240, themeColors: true });


// export interface QueueItem {
//   node: TreeNode;
//   x: number;
//   y: number;
//   parentCenter: { x: number; y: number } | null;
// }

figma.ui.onmessage = async (msg) => {
  if (msg.type === "start-crawl") {
    const { url } = msg;

    try {
      const response = await fetch(`${BACKEND_URL}/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, publicUrl: BACKEND_URL }),
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
        const manifestData = await manifestResponse.json();

        console.log("Successfully fetched manifest: ", manifestData);

        figma.notify("Crawl complete and manifest fetched!");
        await renderSitemap(manifestData);
      }

      figma.ui.postMessage({
        type: "status-update",
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
