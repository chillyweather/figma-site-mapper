import { TreeNode, QueueItem } from "../main";
import { createScreenshotPages } from "./utils/createScreenshotPages";
import { flattenTree } from "./utils/flattenTree";

export async function renderSitemap(manifestData: { tree: TreeNode }) {
  const pages = flattenTree(manifestData.tree);
  console.log("pages", pages);

  const pageIdMap = await createScreenshotPages(pages);
  //
  //   const NODE_WIDTH = 320;
  //   const NODE_HEIGHT = 240;
  //   const HORIZONTAL_SPACING = 200;
  //   const VERTICAL_SPACING = 150;
  //
  //   const sitemapFrame = figma.createFrame();
  //   sitemapFrame.name = "Sitemap";
  //   sitemapFrame.fills = [];
  //   sitemapFrame.resize(2000, 2000);
  //
  //   // Apply the QueueItem type
  //   const queue: QueueItem[] = [
  //     { node: manifestData.tree, x: 0, y: 0, parentCenter: null },
  //   ];
  //   const visited = new Set<string>();
  //
  //   // Explicitly type the render arrays
  //   const nodesToRender: { node: TreeNode; x: number; y: number }[] = [];
  //   const linesToRender: {
  //     from: { x: number; y: number };
  //     to: { x: number; y: number };
  //   }[] = [];
  //
  //   await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  //
  //   // Phase 1: Calculate positions
  //   while (queue.length > 0) {
  //     const { node, x, y, parentCenter } = queue.shift()!;
  //     if (visited.has(node.url)) continue;
  //     visited.add(node.url);
  //
  //     const nodeCenter = { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT / 2 };
  //     nodesToRender.push({ node, x, y });
  //
  //     if (parentCenter) {
  //       linesToRender.push({ from: parentCenter, to: { x: nodeCenter.x, y } });
  //     }
  //
  //     if (node.children && node.children.length > 0) {
  //       const childY = y + NODE_HEIGHT + VERTICAL_SPACING;
  //       const totalChildrenWidth =
  //         node.children.length * NODE_WIDTH +
  //         (node.children.length - 1) * HORIZONTAL_SPACING;
  //       let childX = x - totalChildrenWidth / 2 + NODE_WIDTH / 2;
  //
  //       for (const child of node.children) {
  //         queue.push({
  //           node: child,
  //           x: childX,
  //           y: childY,
  //           parentCenter: { x: nodeCenter.x, y: y + NODE_HEIGHT },
  //         });
  //         childX += NODE_WIDTH + HORIZONTAL_SPACING;
  //       }
  //     }
  //   }
  //
  //   // Phase 2: Create all Figma nodes
  //   for (const line of linesToRender) {
  //     const vector = figma.createVector();
  //     vector.vectorNetwork = {
  //       vertices: [
  //         {
  //           x: line.from.x,
  //           y: line.from.y,
  //           strokeCap: "NONE",
  //           strokeJoin: "MITER",
  //           cornerRadius: 0,
  //           handleMirroring: "NONE",
  //         },
  //         {
  //           x: line.to.x,
  //           y: line.to.y,
  //           strokeCap: "NONE",
  //           strokeJoin: "MITER",
  //           cornerRadius: 0,
  //           handleMirroring: "NONE",
  //         },
  //       ],
  //       segments: [
  //         {
  //           start: 0,
  //           end: 1,
  //           tangentStart: { x: 0, y: 0 },
  //           tangentEnd: { x: 0, y: 0 },
  //         },
  //       ],
  //     };
  //     vector.strokes = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
  //     sitemapFrame.appendChild(vector);
  //   }
  //
  //   for (const item of nodesToRender) {
  //     const { node, x, y } = item;
  //     const nodeFrame = figma.createFrame();
  //     nodeFrame.name = node.title;
  //     nodeFrame.x = x;
  //     nodeFrame.y = y;
  //     nodeFrame.fills = [];
  //     nodeFrame.layoutMode = "VERTICAL";
  //     nodeFrame.itemSpacing = 8;
  //
  //     const rect = figma.createRectangle();
  //     rect.resize(NODE_WIDTH, NODE_HEIGHT);
  //     rect.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 } }];
  //     rect.cornerRadius = 8;
  //
  //     const label = figma.createText();
  //     label.characters = node.title;
  //     label.textAlignHorizontal = "CENTER";
  //     label.resize(NODE_WIDTH, 40);
  //
  //     nodeFrame.appendChild(rect);
  //     nodeFrame.appendChild(label);
  //     sitemapFrame.appendChild(nodeFrame);
  //   }
  //
  //   figma.currentPage.appendChild(sitemapFrame);
  //   figma.viewport.scrollAndZoomIntoView([sitemapFrame]);
  //   figma.notify("Sitemap rendered successfully!");
}
