figma.showUI(__html__, { width: 320, height: 240, themeColors: true });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'start-crawl') {
    const { url } = msg;

    try {
      const response = await fetch('http://localhost:3006/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();

      figma.ui.postMessage({
        type: 'crawl-started',
        jobId: result.jobId,
      });

    } catch (error) {
      console.error('Failed to start crawl:', error);
      figma.notify('Error: Could not connect to the backend server.', { error: true });
    }
  }

  if (msg.type === "get-status") {
    const { jobId } = msg;

    try {
      const response = await fetch(`http://localhost:3006/status/${jobId}`);
      const result = await response.json();

      figma.ui.postMessage({
        type: "status-update",
        status: result.status,
        progress: result.progress,
        manifestUrl: result.result?.manifestUrl,
      });
    } catch (error) {
      console.error("Failed to get job status: ", error);
      figma.notify("Error: Could not get job status.", { error: true })
    }
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
