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
import { POLLING_CONFIG } from "../constants";
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

  // Initialize progress
  sendProgressUpdate({
    status: "building",
    message: "Creating flow page...",
    progress: 0,
    currentStep: 0,
    totalSteps: 5,
    steps: [
      { name: "Create flow page", status: "in-progress" },
      { name: "Clone source elements", status: "pending" },
      { name: "Crawl target page", status: "pending" },
      { name: "Render target page", status: "pending" },
      { name: "Create arrows", status: "pending" },
    ],
  });

  try {
    await createFlowPage(selectedLink);
  } catch (error) {
    console.error("Failed to create flow:", error);
    sendProgressUpdate({
      status: "error",
      message: "Error creating flow visualization",
      progress: 0,
      currentStep: 0,
      totalSteps: 5,
      steps: [
        { name: "Create flow page", status: "error" },
        { name: "Clone source elements", status: "pending" },
        { name: "Crawl target page", status: "pending" },
        { name: "Render target page", status: "pending" },
        { name: "Create arrows", status: "pending" },
      ],
    });
    figma.notify("Error: Could not create flow visualization.", {
      error: true,
    });
  }
}

/**
 * Send progress update to UI
 */
function sendProgressUpdate(progress: any): void {
  figma.ui.postMessage({
    type: "flow-progress-update",
    flowProgress: progress,
  });
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

  // Update progress: Flow page created
  sendProgressUpdate({
    status: "building",
    message: "Cloning source elements...",
    progress: 20,
    currentStep: 1,
    totalSteps: 5,
    steps: [
      { name: "Create flow page", status: "complete" },
      { name: "Clone source elements", status: "in-progress" },
      { name: "Crawl target page", status: "pending" },
      { name: "Render target page", status: "pending" },
      { name: "Create arrows", status: "pending" },
    ],
  });

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

    // Update progress: Source elements cloned
    sendProgressUpdate({
      status: "building",
      message: "Crawling target page...",
      progress: 40,
      currentStep: 2,
      totalSteps: 5,
      steps: [
        { name: "Create flow page", status: "complete" },
        { name: "Clone source elements", status: "complete" },
        { name: "Crawl target page", status: "in-progress" },
        { name: "Render target page", status: "pending" },
        { name: "Create arrows", status: "pending" },
      ],
    });

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

    // Calculate target X position (where the target screenshot will be placed)
    const targetX = screenshotClone.x + screenshotClone.width + 140;

    // Create arrow connector (from clicked_link to target screenshot)
    const arrow = createFlowArrow(screenshotClone, highlightClone, targetX);
    flowPage.appendChild(arrow);

    // Fetch and render target page
    const targetY = baseY;

    await fetchAndRenderTargetPage(
      selectedLink.url,
      flowPage,
      targetX,
      targetY
    );

    // Move arrow to the top so it appears above all other elements
    const arrowIndex = flowPage.children.indexOf(arrow);
    if (arrowIndex !== -1) {
      flowPage.insertChild(flowPage.children.length, arrow);
    }

    // Verify the arrow has correct caps (no cap at start, arrow cap at end)
    const network = arrow.vectorNetwork;
    if (
      network &&
      Array.isArray(network.vertices) &&
      network.vertices.length >= 2
    ) {
      const startVertex = network.vertices[0];
      const endVertex = network.vertices[1];

      if (
        startVertex.strokeCap !== "NONE" ||
        endVertex.strokeCap !== "ARROW_EQUILATERAL"
      ) {
        arrow.vectorNetwork = {
          regions: network.regions || [],
          segments: network.segments || [],
          vertices: [
            {
              x: startVertex.x,
              y: startVertex.y,
              strokeCap: "NONE",
            },
            {
              x: endVertex.x,
              y: endVertex.y,
              strokeCap: "ARROW_EQUILATERAL",
            },
          ],
        };
      }
    }
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

  // Track arrows for repositioning after clicked_links are placed
  const arrowsToReposition: Array<{
    arrow: VectorNode;
    originalY: number;
    frameIndex: number;
  }> = [];

  const frameClones: FrameNode[] = [];

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
    frameClones.push(frameClone);

    // Remove the Page Overlay from the cloned frame
    const pageOverlay = frameClone.findOne(
      (node) => node.type === "FRAME" && node.name === "Page Overlay"
    ) as FrameNode | null;

    if (pageOverlay) {
      pageOverlay.remove();
      console.log(`Removed Page Overlay from ${frameClone.name}`);
    }

    currentX += frameClone.width + 20;

    // Clone the arrow if it exists and store for later repositioning
    if (arrows[i]) {
      const originalArrow = arrows[i];
      const arrowClone = originalArrow.clone();
      arrowClone.x = currentX;
      // Store original Y and frame info for repositioning after clicked_links
      arrowsToReposition.push({
        arrow: arrowClone,
        originalY: originalArrow.y,
        frameIndex: i,
      });
      flowPage.appendChild(arrowClone);

      currentX += 120;
    }
  }

  // Clone ALL clicked_links and reposition based on frame movements
  const clonedClickedLinks: RectangleNode[] = [];
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
        clonedClickedLinks.push(clickedLinkClone);
        console.log(
          `Cloned ${clickedLink.name} for ${associatedFrame.name} at (${clickedLinkClone.x}, ${clickedLinkClone.y})`
        );
      }
    }
  }

  // Reposition arrows to align with their corresponding clicked_links
  for (const arrowInfo of arrowsToReposition) {
    // Find the clicked_link associated with this arrow (same frame index)
    const associatedFrame = sourceFrames[arrowInfo.frameIndex];
    if (associatedFrame) {
      // Find clicked_link on this frame
      const clickedLinkOnFrame = clickedLinks.find((cl) =>
        isClickedLinkOnFrame(cl, associatedFrame)
      );

      if (clickedLinkOnFrame) {
        // Find the cloned version
        const clonedClickedLink = clonedClickedLinks.find(
          (cl) => cl.name === clickedLinkOnFrame.name
        );

        if (clonedClickedLink) {
          const startX = clonedClickedLink.x + clonedClickedLink.width;

          // Position arrow start to touch the clicked_link's right edge and align vertically
          arrowInfo.arrow.x = startX;
          arrowInfo.arrow.y =
            clonedClickedLink.y + clonedClickedLink.height / 2;

          const targetFrameClone = frameClones[arrowInfo.frameIndex + 1];
          if (targetFrameClone) {
            const newLength = Math.max(0, targetFrameClone.x - startX);

            const originalPath = arrowInfo.arrow.vectorPaths[0];
            if (originalPath) {
              arrowInfo.arrow.vectorPaths = [
                {
                  windingRule: originalPath.windingRule,
                  data: `M 0 0 L ${newLength} 0`,
                },
              ];
            }

            const originalNetwork = arrowInfo.arrow.vectorNetwork;
            if (
              originalNetwork &&
              Array.isArray(originalNetwork.vertices) &&
              originalNetwork.vertices.length >= 2
            ) {
              const startVertex = originalNetwork.vertices[0];
              const endVertex = originalNetwork.vertices[1];
              const segments = Array.isArray(originalNetwork.segments)
                ? originalNetwork.segments.map((segment) => ({
                    start: segment.start,
                    end: segment.end,
                    tangentStart: {
                      x: segment.tangentStart.x,
                      y: segment.tangentStart.y,
                    },
                    tangentEnd: {
                      x: segment.tangentEnd.x,
                      y: segment.tangentEnd.y,
                    },
                  }))
                : [];
              const regions = Array.isArray(originalNetwork.regions)
                ? originalNetwork.regions.slice()
                : [];

              arrowInfo.arrow.vectorNetwork = {
                regions,
                segments,
                vertices: [
                  {
                    x: 0,
                    y: 0,
                    strokeCap: startVertex.strokeCap || "NONE",
                  },
                  {
                    x: newLength,
                    y: 0,
                    strokeCap: endVertex.strokeCap || "ARROW_EQUILATERAL",
                  },
                ],
              };
            }
          }

          console.log(
            `Repositioned arrow to (${arrowInfo.arrow.x}, ${arrowInfo.arrow.y}) based on ${clonedClickedLink.name}`
          );
        }
      }
    }
  }

  // Move all arrows to the top so they appear above all other elements
  for (const arrowInfo of arrowsToReposition) {
    const arrowIndex = flowPage.children.indexOf(arrowInfo.arrow);
    if (arrowIndex !== -1) {
      flowPage.insertChild(flowPage.children.length, arrowInfo.arrow);
    }
  }

  // Verify all Flow Arrow elements have arrow cap on the end side
  const allFlowArrows = flowPage.findAll(
    (node) => node.type === "VECTOR" && node.name === "Flow Arrow"
  ) as VectorNode[];

  for (const arrow of allFlowArrows) {
    const network = arrow.vectorNetwork;
    if (
      network &&
      Array.isArray(network.vertices) &&
      network.vertices.length >= 2
    ) {
      const startVertex = network.vertices[0];
      const endVertex = network.vertices[1];

      if (
        startVertex.strokeCap !== "NONE" ||
        endVertex.strokeCap !== "ARROW_EQUILATERAL"
      ) {
        arrow.vectorNetwork = {
          regions: network.regions || [],
          segments: network.segments || [],
          vertices: [
            {
              x: startVertex.x,
              y: startVertex.y,
              strokeCap: "NONE",
            },
            {
              x: endVertex.x,
              y: endVertex.y,
              strokeCap: "ARROW_EQUILATERAL",
            },
          ],
        };
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
 * Uses a line with TRIANGLE_FILLED stroke cap for the arrow
 */
function createFlowArrow(
  sourceFrame: FrameNode,
  highlightClone: RectangleNode | null,
  targetX: number
): VectorNode {
  // Calculate start position: middle of right side of clicked_link (or fallback to source frame)
  let startX: number;
  let startY: number;

  if (highlightClone) {
    // Start from middle of right edge of the clicked_link highlight
    startX = highlightClone.x + highlightClone.width;
    startY = highlightClone.y + highlightClone.height / 2;
  } else {
    // Fallback: start from middle of right edge of source frame
    startX = sourceFrame.x + sourceFrame.width;
    startY = sourceFrame.y + sourceFrame.height / 2;
  }

  // End position: left edge of target screenshot
  const endX = targetX;
  const endY = startY; // Keep horizontal line

  // Create a line from start to end
  const arrow = figma.createVector();
  arrow.name = "Flow Arrow";

  // Create a horizontal line path
  const lineLength = endX - startX;
  arrow.vectorPaths = [
    {
      windingRule: "NONZERO",
      data: `M 0 0 L ${lineLength} 0`,
    },
  ];

  // Position the line
  arrow.x = startX;
  arrow.y = startY;

  // Style with pink color to match clicked_link highlights (#FF00E1)
  const pinkColor = {
    r: 1,
    g: 0,
    b: 0.88235294117647056, // #FF00E1
  };

  arrow.strokes = [{ type: "SOLID", color: pinkColor }];
  arrow.strokeWeight = 6;

  // Set arrow cap only at the end (target screenshot side)
  arrow.strokeCap = "NONE"; // No cap at the start
  arrow.strokeJoin = "MITER";

  // Use vectorNetwork to control arrow direction - arrow only at the end
  arrow.vectorNetwork = {
    regions: [],
    segments: [
      {
        start: 0,
        end: 1,
        tangentStart: { x: 0, y: 0 },
        tangentEnd: { x: 0, y: 0 },
      },
    ],
    vertices: [
      { x: 0, y: 0, strokeCap: "NONE" },
      { x: lineLength, y: 0, strokeCap: "ARROW_EQUILATERAL" },
    ],
  };

  arrow.fills = []; // No fill for the line itself

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

    // Update progress during polling
    const pollProgress =
      40 + Math.min(40, (attempts / POLLING_CONFIG.MAX_ATTEMPTS) * 40);
    sendProgressUpdate({
      status: "building",
      message: `Crawling target page... (${attempts}/${POLLING_CONFIG.MAX_ATTEMPTS})`,
      progress: Math.round(pollProgress),
      currentStep: 2,
      totalSteps: 5,
      steps: [
        { name: "Create flow page", status: "complete" },
        { name: "Clone source elements", status: "complete" },
        { name: "Crawl target page", status: "in-progress" },
        { name: "Render target page", status: "pending" },
        { name: "Create arrows", status: "pending" },
      ],
    });

    if (attempts > POLLING_CONFIG.MAX_ATTEMPTS) {
      clearInterval(pollInterval);
      sendProgressUpdate({
        status: "error",
        message: "Target page crawl timed out",
        progress: 0,
        currentStep: 2,
        totalSteps: 5,
        steps: [
          { name: "Create flow page", status: "complete" },
          { name: "Clone source elements", status: "complete" },
          { name: "Crawl target page", status: "error" },
          { name: "Render target page", status: "pending" },
          { name: "Create arrows", status: "pending" },
        ],
      });
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

        // Update progress: Rendering target page
        sendProgressUpdate({
          status: "building",
          message: "Rendering target page...",
          progress: 80,
          currentStep: 3,
          totalSteps: 5,
          steps: [
            { name: "Create flow page", status: "complete" },
            { name: "Clone source elements", status: "complete" },
            { name: "Crawl target page", status: "complete" },
            { name: "Render target page", status: "in-progress" },
            { name: "Create arrows", status: "pending" },
          ],
        });

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

        // Update progress: Creating arrows
        sendProgressUpdate({
          status: "building",
          message: "Creating arrows...",
          progress: 90,
          currentStep: 4,
          totalSteps: 5,
          steps: [
            { name: "Create flow page", status: "complete" },
            { name: "Clone source elements", status: "complete" },
            { name: "Crawl target page", status: "complete" },
            { name: "Render target page", status: "complete" },
            { name: "Create arrows", status: "in-progress" },
          ],
        });

        // Small delay to show arrow creation step
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Flow complete
        sendProgressUpdate({
          status: "complete",
          message: "Flow visualization complete!",
          progress: 100,
          currentStep: 5,
          totalSteps: 5,
          steps: [
            { name: "Create flow page", status: "complete" },
            { name: "Clone source elements", status: "complete" },
            { name: "Crawl target page", status: "complete" },
            { name: "Render target page", status: "complete" },
            { name: "Create arrows", status: "complete" },
          ],
        });

        // Reset to idle after 3 seconds
        setTimeout(() => {
          sendProgressUpdate({
            status: "idle",
            message: "",
            progress: 0,
            currentStep: 0,
            totalSteps: 5,
            steps: [
              { name: "Create flow page", status: "pending" },
              { name: "Clone source elements", status: "pending" },
              { name: "Crawl target page", status: "pending" },
              { name: "Render target page", status: "pending" },
              { name: "Create arrows", status: "pending" },
            ],
          });
        }, 3000);

        figma.notify("Flow visualization complete!");
      }
    } catch (error) {
      console.error("Error polling for target page status:", error);
    }
  }, POLLING_CONFIG.INTERVAL_MS);
}
