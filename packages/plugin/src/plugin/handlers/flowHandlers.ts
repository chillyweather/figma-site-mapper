/**
 * FLOW VISUALIZATION HANDLERS
 *
 * Handles creating user flow visualizations by:
 * 1. Creating flow pages
 * 2. Cloning source screenshots
 * 3. Fetching and rendering target pages
 * 4. Creating arrow connectors
 */

import { FlowLink } from "../types";
import { startCrawl, getJobStatus, fetchManifest } from "../services/apiClient";
import { POLLING_CONFIG, FLOW_ARROW_PATH } from "../constants";
import { renderTargetPage } from "../services/targetPageRenderer";

/**
 * Handle show-flow request from UI
 */
export async function handleShowFlow(selectedLinks: FlowLink[]): Promise<void> {
  if (selectedLinks.length === 0) {
    figma.notify("No links selected");
    return;
  }

  if (selectedLinks.length > 1) {
    figma.notify(
      "Multiple flow visualization not yet implemented. Please select one link."
    );
    return;
  }

  const selectedLink = selectedLinks[0];
  console.log("📊 Creating flow for:", selectedLink);

  try {
    await createFlowPage(selectedLink);
  } catch (error) {
    console.error("Failed to create flow:", error);
    figma.notify("Error: Could not create flow visualization.", {
      error: true,
    });
  }
}

/**
 * Create a flow page with source and target visualization
 */
async function createFlowPage(selectedLink: FlowLink): Promise<void> {
  const currentPage = figma.currentPage;
  const flowPageName = generateFlowPageName(
    currentPage.name,
    selectedLink.text
  );

  // Find or create flow page
  let flowPage = figma.root.children.find((p) => p.name === flowPageName) as
    | PageNode
    | undefined;

  if (!flowPage) {
    flowPage = figma.createPage();
    flowPage.name = flowPageName;

    const currentPageIndex = figma.root.children.indexOf(currentPage);
    figma.root.insertChild(currentPageIndex + 1, flowPage);
    console.log(`Created flow page: ${flowPageName}`);
  } else {
    console.log(`Flow page already exists: ${flowPageName}`);
  }

  await createFlowVisualization(flowPage, selectedLink, currentPage);
  figma.notify(`Flow visualization started for link ${selectedLink.text}`);
}

/**
 * Generate flow page name with hierarchy
 */
function generateFlowPageName(
  currentPageName: string,
  linkText: string
): string {
  const pageMatch = currentPageName.match(/^(\s*)([\d-]+)_(.*)/);

  if (!pageMatch) {
    return `Flow_${linkText}`;
  }

  const currentIndent = pageMatch[1];
  const currentHierarchy = pageMatch[2];
  const newHierarchy = `${currentHierarchy}-${linkText}`;
  const currentLevel = currentHierarchy.split("-").length;
  const newLevel = currentLevel + 1;
  const newIndent = "  ".repeat(Math.max(0, newLevel - 1));

  return `${newIndent}${newHierarchy}_Loading...`;
}

/**
 * Create complete flow visualization
 */
async function createFlowVisualization(
  flowPage: PageNode,
  selectedLink: FlowLink,
  sourcePage: PageNode
): Promise<void> {
  console.log("Creating flow visualization for:", selectedLink);

  const previousPage = figma.currentPage;
  figma.currentPage = sourcePage;

  try {
    let currentX = 100;
    const baseY = 100;

    // Check if source page is a flow page (has existing breadcrumb trail)
    const isSourceFlowPage = isFlowPage(sourcePage.name);

    // Calculate the flow step number (how many clicks in the chain)
    let flowStepNumber = 1;

    if (isSourceFlowPage) {
      // Clone all existing screenshots from the flow trail
      console.log("Source is a flow page, cloning breadcrumb trail");
      currentX = await cloneFlowBreadcrumb(
        sourcePage,
        flowPage,
        currentX,
        baseY
      );

      // Count existing clicked_links to determine the next step number
      const existingClickedLinks = flowPage.findAll(
        (node) =>
          node.type === "RECTANGLE" && node.name.startsWith("clicked_link_")
      );
      flowStepNumber = existingClickedLinks.length + 1;
    }

    // Find and clone source screenshot with highlight
    const { screenshotClone, highlightClone } = await cloneSourceElements(
      selectedLink,
      sourcePage,
      flowPage,
      currentX,
      baseY,
      flowStepNumber
    );

    if (highlightClone) {
      // Magenta/pink dashed border (#ff00e1)
      highlightClone.strokeWeight = 8;
      highlightClone.opacity = 1;
      highlightClone.strokes = [
        {
          type: "SOLID",
          visible: true,
          opacity: 1,
          blendMode: "NORMAL",
          color: {
            r: 1,
            g: 0,
            b: 0.88235294117647056, // #ff00e1
          },
          boundVariables: {},
        },
      ];

      // Add pink fill with 30% opacity
      highlightClone.fills = [
        {
          type: "SOLID",
          visible: true,
          opacity: 0.3,
          blendMode: "NORMAL",
          color: {
            r: 1,
            g: 0,
            b: 0.88235294117647056, // #ff00e1
          },
          boundVariables: {},
        },
      ];

      highlightClone.dashPattern = [12, 8]; // Dashed pattern
      highlightClone.cornerRadius = 4; // Rounded corners

      // Add pink drop shadow
      highlightClone.effects = [
        {
          type: "DROP_SHADOW",
          visible: true,
          color: {
            r: 1,
            g: 0,
            b: 0.88235294117647056, // #ff00e1
            a: 0.5, // 50% opacity
          },
          blendMode: "NORMAL",
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 6,
          showShadowBehindNode: false,
        },
      ];

      highlightClone.x -= 4;
      highlightClone.y -= 4;
      highlightClone.resize(
        highlightClone.width + 8,
        highlightClone.height + 8
      );
      highlightClone.strokeAlign = "INSIDE";
    }

    if (!screenshotClone) {
      throw new Error("Could not clone source screenshot");
    }

    // Create arrow connector
    const arrow = createFlowArrow(screenshotClone);
    flowPage.appendChild(arrow);

    // Fetch and render target page
    const targetX = arrow.x + 120;
    const targetY = baseY;

    await fetchAndRenderTargetPage(
      selectedLink.url,
      flowPage,
      targetX,
      targetY
    );
  } finally {
    figma.currentPage = previousPage;
  }
}

/**
 * Check if page is a flow page (hierarchical naming pattern)
 */
function isFlowPage(pageName: string): boolean {
  const hierarchyMatch = pageName.match(/^\s*([\d-]+)_/);
  return hierarchyMatch ? hierarchyMatch[1].includes("-") : false;
}

/**
 * Clone existing breadcrumb trail from a flow page
 */
async function cloneFlowBreadcrumb(
  sourcePage: PageNode,
  flowPage: PageNode,
  startX: number,
  baseY: number
): Promise<number> {
  let currentX = startX;

  // Find all Source_ frames, arrows, and clicked_link highlights
  const sourceFrames = sourcePage.findAll(
    (node) => node.type === "FRAME" && node.name.startsWith("Source_")
  ) as FrameNode[];

  const arrows = sourcePage.findAll(
    (node) => node.type === "VECTOR" && node.name === "Flow Arrow"
  ) as VectorNode[];

  const clickedLinks = sourcePage.findAll(
    (node) => node.type === "RECTANGLE" && node.name.startsWith("clicked_link_")
  ) as RectangleNode[];

  console.log(
    `Found ${sourceFrames.length} source frames, ${arrows.length} arrows, and ${clickedLinks.length} clicked links to clone`
  );

  // Track frame position mappings for repositioning clicked_links
  const framePositions = new Map<
    string,
    { originalX: number; originalY: number; newX: number; newY: number }
  >();

  // Clone each source frame and arrow
  for (let i = 0; i < sourceFrames.length; i++) {
    const sourceFrame = sourceFrames[i];

    // Store position mapping
    framePositions.set(sourceFrame.name, {
      originalX: sourceFrame.x,
      originalY: sourceFrame.y,
      newX: currentX,
      newY: baseY,
    });

    // Clone the frame
    const frameClone = sourceFrame.clone();
    frameClone.x = currentX;
    frameClone.y = baseY;
    flowPage.appendChild(frameClone);

    // Remove the Page Overlay from the cloned frame
    const pageOverlay = frameClone.findOne(
      (node) => node.type === "FRAME" && node.name === "Page Overlay"
    ) as FrameNode | null;

    if (pageOverlay) {
      pageOverlay.remove();
      console.log(`Removed Page Overlay from ${frameClone.name}`);
    }

    currentX += frameClone.width + 20;

    // Clone the arrow if it exists
    if (arrows[i]) {
      const arrowClone = arrows[i].clone();
      arrowClone.x = currentX;
      arrowClone.y = baseY - 15;
      flowPage.appendChild(arrowClone);

      currentX += 120;
    }
  }

  // Clone ALL clicked_links and reposition based on frame movements
  for (const clickedLink of clickedLinks) {
    const associatedFrame = findAssociatedFrame(clickedLink, sourceFrames);
    if (associatedFrame) {
      const positions = framePositions.get(associatedFrame.name);
      if (positions) {
        const clickedLinkClone = clickedLink.clone();
        const offsetX = clickedLink.x - positions.originalX;
        const offsetY = clickedLink.y - positions.originalY;
        clickedLinkClone.x = positions.newX + offsetX;
        clickedLinkClone.y = positions.newY + offsetY;
        flowPage.appendChild(clickedLinkClone);
        console.log(
          `Cloned ${clickedLink.name} for ${associatedFrame.name} at (${clickedLinkClone.x}, ${clickedLinkClone.y})`
        );
      }
    }
  }

  return currentX;
}

/**
 * Find which Source frame a clicked_link belongs to based on position
 * A clicked_link belongs to a frame if it's positioned over it
 */
function findAssociatedFrame(
  clickedLink: RectangleNode,
  sourceFrames: FrameNode[]
): FrameNode | null {
  for (const frame of sourceFrames) {
    // Check if clicked_link is within the frame bounds
    const isWithinX =
      clickedLink.x >= frame.x && clickedLink.x <= frame.x + frame.width;
    const isWithinY =
      clickedLink.y >= frame.y && clickedLink.y <= frame.y + frame.height;

    if (isWithinX && isWithinY) {
      return frame;
    }
  }
  return null;
}

/**
 * Check if a clicked_link element is positioned on a specific frame
 */
function isClickedLinkOnFrame(
  clickedLink: RectangleNode,
  frame: FrameNode
): boolean {
  const isWithinX =
    clickedLink.x >= frame.x && clickedLink.x <= frame.x + frame.width;
  const isWithinY =
    clickedLink.y >= frame.y && clickedLink.y <= frame.y + frame.height;
  return isWithinX && isWithinY;
}

/**
 * Clone source screenshot and highlight from source page
 */
async function cloneSourceElements(
  selectedLink: FlowLink,
  sourcePage: PageNode,
  flowPage: PageNode,
  x: number = 100,
  y: number = 100,
  flowStepNumber: number = 1
): Promise<{
  screenshotClone: FrameNode | null;
  highlightClone: RectangleNode | null;
}> {
  const badgeElement = await figma.getNodeByIdAsync(selectedLink.id);

  if (!badgeElement || badgeElement.type !== "TEXT") {
    throw new Error(`Could not find badge element with ID: ${selectedLink.id}`);
  }

  // Find screenshot frame
  // On regular pages, it's named "Screenshots"
  // On flow pages, it's named "Target_..."
  let screenshotFrames = sourcePage.findAll(
    (node: SceneNode) =>
      node.type === "FRAME" && node.name.includes("Screenshots")
  ) as FrameNode[];

  // If not found, try looking for Target_ frames (flow pages)
  if (screenshotFrames.length === 0) {
    screenshotFrames = sourcePage.findAll(
      (node: SceneNode) =>
        node.type === "FRAME" && node.name.startsWith("Target_")
    ) as FrameNode[];
  }

  if (screenshotFrames.length === 0) {
    throw new Error("Could not find Screenshots or Target frame");
  }

  const screenshotFrame = screenshotFrames[0];

  // Clone screenshot
  figma.currentPage = flowPage;
  const screenshotClone = screenshotFrame.clone();
  screenshotClone.name = `Source_${selectedLink.text}`;
  screenshotClone.x = x;
  screenshotClone.y = y;
  flowPage.appendChild(screenshotClone);

  // Remove Page Overlay from the cloned screenshot (only needed on target page)
  // This ensures breadcrumb screenshots show only the base image + clicked_link highlight
  const clonedOverlay = screenshotClone.findOne(
    (node) => node.type === "FRAME" && node.name === "Page Overlay"
  ) as FrameNode | null;

  if (clonedOverlay) {
    clonedOverlay.remove();
    console.log(`Removed Page Overlay from cloned ${screenshotClone.name}`);
  }

  // Copy all existing clicked_links from source page to the new Source frame
  const existingClickedLinks = sourcePage.findAll(
    (node) => node.type === "RECTANGLE" && node.name.startsWith("clicked_link_")
  ) as RectangleNode[];

  console.log(
    `Found ${existingClickedLinks.length} existing clicked_links to copy`
  );

  for (const clickedLink of existingClickedLinks) {
    // Check if this clicked_link is associated with the screenshot we're cloning
    if (isClickedLinkOnFrame(clickedLink, screenshotFrame)) {
      const clickedLinkClone = clickedLink.clone();
      const offsetX = clickedLink.x - screenshotFrame.x;
      const offsetY = clickedLink.y - screenshotFrame.y;
      clickedLinkClone.x = x + offsetX;
      clickedLinkClone.y = y + offsetY;
      flowPage.appendChild(clickedLinkClone);
      console.log(`Copied existing ${clickedLink.name} to new Source frame`);
    }
  }

  // Find and clone highlight (from original page's overlay, before we removed the clone's overlay)
  let highlightClone: RectangleNode | null = null;
  const overlayFrames = sourcePage.findAll(
    (node: SceneNode) => node.type === "FRAME" && node.name === "Page Overlay"
  ) as FrameNode[];

  if (overlayFrames.length > 0) {
    const linkNumber = badgeElement.characters;
    const highlightNamePattern = `link_${linkNumber}_highlight:`;

    const highlights = overlayFrames[0].findAll(
      (node: SceneNode) =>
        node.type === "RECTANGLE" && node.name.startsWith(highlightNamePattern)
    ) as RectangleNode[];

    if (highlights.length > 0) {
      const originalHighlight = highlights[0];
      highlightClone = originalHighlight.clone();

      // Rename from link_X_highlight: to clicked_link_STEP:
      // Use flowStepNumber for sequential numbering (clicked_link_1, clicked_link_2, etc.)
      const linkNumber = badgeElement.characters;
      const originalText = originalHighlight.name
        .replace(`link_${linkNumber}_highlight:`, "")
        .trim();
      highlightClone.name = `clicked_link_${flowStepNumber}: ${originalText}`;

      highlightClone.x = screenshotClone.x + originalHighlight.x;
      highlightClone.y = screenshotClone.y + originalHighlight.y;
      flowPage.appendChild(highlightClone);

      console.log(
        `Created clicked_link_${flowStepNumber} (from link_${linkNumber}): ${originalText}`
      );
    }
  }

  return { screenshotClone, highlightClone };
}

/**
 * Create arrow connector between source and target
 */
function createFlowArrow(sourceFrame: FrameNode): VectorNode {
  const arrow = figma.createVector();
  arrow.name = "Flow Arrow";
  arrow.x = sourceFrame.x + sourceFrame.width + 20;
  arrow.y = sourceFrame.y - 15;

  arrow.vectorPaths = [
    {
      windingRule: "NONZERO",
      data: FLOW_ARROW_PATH,
    },
  ];

  arrow.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
  arrow.strokes = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
  arrow.strokeWeight = 4;

  return arrow;
}

/**
 * Fetch and render target page
 */
async function fetchAndRenderTargetPage(
  url: string,
  flowPage: PageNode,
  x: number,
  y: number
): Promise<void> {
  figma.notify(`Crawling target page: ${url}...`);

  try {
    const result = await startCrawl({
      url,
      maxRequestsPerCrawl: 1,
      screenshotWidth: 1440,
      deviceScaleFactor: 1,
      delay: 0,
      requestDelay: 1000,
      maxDepth: 0,
      defaultLanguageOnly: false,
      sampleSize: 1,
      showBrowser: false,
      detectInteractiveElements: true,
      auth: null,
    });

    const jobId = result.jobId;
    console.log(`Started crawl job ${jobId} for target page`);

    // Poll for completion
    await pollForCompletion(jobId, flowPage, x, y);
  } catch (error) {
    console.error("Failed to crawl target page:", error);
    figma.notify("Error: Could not crawl target page.", { error: true });
  }
}

/**
 * Poll for job completion and render when ready
 */
async function pollForCompletion(
  jobId: string,
  flowPage: PageNode,
  x: number,
  y: number
): Promise<void> {
  let attempts = 0;

  const pollInterval = setInterval(async () => {
    attempts++;

    if (attempts > POLLING_CONFIG.MAX_ATTEMPTS) {
      clearInterval(pollInterval);
      figma.notify("Target page crawl timed out", { error: true });
      return;
    }

    try {
      const statusResult = await getJobStatus(jobId);

      if (
        statusResult.status === "completed" &&
        statusResult.result?.manifestUrl
      ) {
        clearInterval(pollInterval);

        const manifestData = await fetchManifest(
          statusResult.result.manifestUrl
        );
        console.log("Target page crawl completed, rendering...");

        // Update flow page name with target title
        if (manifestData.tree?.title) {
          const cleanTitle = manifestData.tree.title.replace(/^\d+_/, "");
          flowPage.name = flowPage.name.replace(
            "_Loading...",
            `_${cleanTitle}`
          );
        }

        await renderTargetPage(flowPage, manifestData, x, y);
        figma.notify("Flow visualization complete!");
      }
    } catch (error) {
      console.error("Error polling for target page status:", error);
    }
  }, POLLING_CONFIG.INTERVAL_MS);
}
