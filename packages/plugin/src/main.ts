figma.showUI(__html__, { width: 320, height: 240, themeColors: true });

// --- NEW: Type Definitions ---
interface TreeNode {
  url: string;
  title: string;
  screenshot: string;
  thumbnail: string;
  children: TreeNode[];
}

interface QueueItem {
  node: TreeNode;
  x: number;
  y: number;
  parentCenter: { x: number; y: number } | null;
}

// --- Helper function with types ---
function flattenTree(node: TreeNode): TreeNode[] {
  if (!node) return [];
  const list = [node];
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      list.push(...flattenTree(child));
    }
  }
  return list;
}

// --- Helper function with types ---
async function createScreenshotPages(pages: TreeNode[]): Promise<Map<string, string>> {
  const pageIdMap = new Map<string, string>();
  const rootPage = figma.root.children[0];

  for (const page of pages) {
    const newPage = figma.createPage();
    newPage.name = page.title || page.url;
    pageIdMap.set(page.url, newPage.id);
  }

  figma.currentPage = rootPage;
  return pageIdMap;
}

async function renderSitemap(manifestData: { tree: TreeNode }) {
  const pages = flattenTree(manifestData.tree);
  const pageIdMap = await createScreenshotPages(pages);

  const NODE_WIDTH = 320;
  const NODE_HEIGHT = 240;
  const HORIZONTAL_SPACING = 200;
  const VERTICAL_SPACING = 150;

  const sitemapFrame = figma.createFrame();
  sitemapFrame.name = 'Sitemap';
  sitemapFrame.fills = [];
  sitemapFrame.resize(2000, 2000);

  // Apply the QueueItem type
  const queue: QueueItem[] = [{ node: manifestData.tree, x: 0, y: 0, parentCenter: null }];
  const visited = new Set<string>();

  // Explicitly type the render arrays
  const nodesToRender: { node: TreeNode; x: number; y: number }[] = [];
  const linesToRender: { from: { x: number, y: number }; to: { x: number, y: number } }[] = [];

  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  // Phase 1: Calculate positions
  while (queue.length > 0) {
    const { node, x, y, parentCenter } = queue.shift()!;
    if (visited.has(node.url)) continue;
    visited.add(node.url);

    const nodeCenter = { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT / 2 };
    nodesToRender.push({ node, x, y });

    if (parentCenter) {
      linesToRender.push({ from: parentCenter, to: { x: nodeCenter.x, y } });
    }

    if (node.children && node.children.length > 0) {
      const childY = y + NODE_HEIGHT + VERTICAL_SPACING;
      const totalChildrenWidth = (node.children.length * NODE_WIDTH) + ((node.children.length - 1) * HORIZONTAL_SPACING);
      let childX = x - (totalChildrenWidth / 2) + (NODE_WIDTH / 2);

      for (const child of node.children) {
        queue.push({ node: child, x: childX, y: childY, parentCenter: { x: nodeCenter.x, y: y + NODE_HEIGHT } });
        childX += NODE_WIDTH + HORIZONTAL_SPACING;
      }
    }
  }

  // Phase 2: Create all Figma nodes
  for (const line of linesToRender) {
    const vector = figma.createVector();
    vector.vectorNetwork = {
      vertices: [
        { x: line.from.x, y: line.from.y, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0, handleMirroring: 'NONE' },
        { x: line.to.x, y: line.to.y, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0, handleMirroring: 'NONE' },
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    };
    vector.strokes = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
    sitemapFrame.appendChild(vector);
  }

  for (const item of nodesToRender) {
    const { node, x, y } = item;
    const nodeFrame = figma.createFrame();
    // ... (rest of the node creation logic is the same)
  }

  figma.currentPage.appendChild(sitemapFrame);
  figma.viewport.scrollAndZoomIntoView([sitemapFrame]);
  figma.notify('Sitemap rendered successfully!');
}


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

      if (result.status === "completed" && result.result?.manifestUrl) {
        console.log("Job complete! Fetching manifest from:", result.result.manifestUrl);

        const manifestResponse = await fetch(result.result.manifestUrl);
        const manifestData = await manifestResponse.json();

        console.log("Successfully fetched manifest: ", manifestData);

        figma.notify("Crawl complete and manifest fetched!");
      }

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
