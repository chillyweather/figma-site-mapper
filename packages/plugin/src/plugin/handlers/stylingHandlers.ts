/**
 * STYLING ELEMENT HANDLERS
 *
 * Handles creating a styling page for the current page:
 * 1. Gets URL from current page plugin data
 * 2. Creates new page with 🎨 prefix
 * 3. Crawls single page with element highlighting
 * 4. Renders below current page
 */

import { startCrawl, getJobStatus } from "../services/apiClient";
import { POLLING_CONFIG } from "../constants";
import { renderTargetPage } from "../services/targetPageRenderer";
import { loadDomainCookies } from "./uiMessageHandlers";
import { buildManifestFromProject } from "../utils/buildManifestFromProject";
import type { TreeNode } from "../../types";

async function getActiveProjectId(): Promise<string | null> {
  try {
    const stored = await figma.clientStorage.getAsync("activeProjectId");
    return stored || null;
  } catch (error) {
    console.error("Failed to load active project id", error);
    return null;
  }
}

/**
 * Extract domain from URL string
 */
function extractDomain(url: string): string | null {
  try {
    let domain = url.replace(/^https?:\/\//, "");
    domain = domain.split("/")[0];
    domain = domain.split("?")[0];
    domain = domain.split(":")[0];
    return domain;
  } catch (error) {
    console.error("Failed to extract domain from URL:", error);
    return null;
  }
}

/**
 * Load settings from client storage
 */
async function loadSettings(): Promise<any> {
  try {
    const settings = await figma.clientStorage.getAsync("pluginSettings");
    return settings || {};
  } catch (error) {
    console.error("Failed to load settings:", error);
    return {};
  }
}

/**
 * Handle get-current-page-url request from UI
 */
export async function handleGetCurrentPageUrl(): Promise<void> {
  const currentPage = figma.currentPage;
  const url = currentPage.getPluginData("URL");

  console.log("Current page URL:", url || "not set");

  figma.ui.postMessage({
    type: "current-page-url",
    url: url || null,
  });
}

/**
 * Handle show-styling-elements request from UI
 * This creates a new styling page below the current page
 */
export async function handleShowStylingElements(): Promise<void> {
  console.log("🎨 Starting styling page creation");

  try {
    const currentPage = figma.currentPage;
    const pageUrl = currentPage.getPluginData("URL");

    if (!pageUrl) {
      figma.notify("No URL found for current page", { error: true });
      return;
    }

    console.log("Creating styling page for URL:", pageUrl);

    // Load settings
    const settings = await loadSettings();
    const showBrowser = settings.showBrowser || false;

    // Try to load cached cookies for this domain
    let domainCookies = null;
    try {
      const domain = extractDomain(pageUrl);
      if (domain) {
        domainCookies = await loadDomainCookies(domain);
      }
    } catch (error) {
      console.log("Could not load domain cookies:", error);
    }

    // Build auth object if we have cookies
    let auth = null;
    if (domainCookies && domainCookies.length > 0) {
      auth = {
        method: "cookies" as const,
        cookies: domainCookies,
      };
      console.log(
        `🍪 Using ${domainCookies.length} cached cookies for authentication`
      );
    }

    // Start crawl with limit 1 and highlight elements enabled
    figma.notify("Crawling page for styling...");

    const projectId = await getActiveProjectId();
    if (!projectId) {
      figma.notify(
        "Select a project in the plugin UI before creating styling pages.",
        { error: true }
      );
      return;
    }

    const result = await startCrawl({
      url: pageUrl,
      maxRequestsPerCrawl: 1,
      screenshotWidth: 1440,
      deviceScaleFactor: 1,
      delay: 0,
      requestDelay: 1000,
      maxDepth: 0,
      defaultLanguageOnly: false,
      sampleSize: 1,
      showBrowser: showBrowser,
      detectInteractiveElements: true,
      captureOnlyVisibleElements: true,
      fullRefresh: false,
      auth: auth,
      projectId,
    });

    const jobId = result.jobId;
    console.log(`Started crawl job ${jobId} for styling page`);

    // Poll for completion
    await pollForStylingPageCompletion(jobId, currentPage, pageUrl);
  } catch (error) {
    console.error("Failed to create styling page:", error);
    figma.notify("Error creating styling page", { error: true });
  }
}

/**
 * Poll for job completion and render styling page
 */
async function pollForStylingPageCompletion(
  jobId: string,
  sourcePage: PageNode,
  pageUrl: string
): Promise<void> {
  let attempts = 0;
  const maxAttempts = POLLING_CONFIG.MAX_ATTEMPTS;

  while (attempts < maxAttempts) {
    await new Promise((resolve) =>
      setTimeout(resolve, POLLING_CONFIG.INTERVAL_MS)
    );
    attempts++;

    try {
      const status = await getJobStatus(jobId);
      console.log(`Polling attempt ${attempts}: ${status.status}`);

      if (
        status.status === "completed" &&
        status.result &&
        status.result.projectId &&
        status.result &&
        status.result.startUrl
      ) {
        console.log("Crawl completed, creating styling page");

        const detectInteractiveElements =
          status.result && status.result.detectInteractiveElements !== false;

        const manifestData = await buildManifestFromProject(
          status.result.projectId,
          status.result.startUrl,
          {
            detectInteractiveElements,
          }
        );

        const targetPageNode = findPageByUrl(manifestData.tree, pageUrl);

        if (!targetPageNode) {
          figma.notify("Could not locate crawled page in project data", {
            error: true,
          });
          return;
        }

        const manifestForPage = {
          tree: targetPageNode,
          projectId: manifestData.projectId,
          startUrl: manifestData.startUrl,
        };

        // Create new page with 🎨 prefix
        const stylingPage = figma.createPage();
        stylingPage.name = `🎨 ${sourcePage.name}`;

        // Find index of source page and insert styling page right after it
        const allPages = figma.root.children;
        const sourceIndex = allPages.indexOf(sourcePage);
        if (sourceIndex !== -1) {
          // Move styling page to position after source page
          const targetIndex = sourceIndex + 1;
          // Use appendChild then reorder
          if (targetIndex < allPages.length) {
            figma.root.insertChild(targetIndex, stylingPage);
          }
        }

        // Switch to the new styling page
        figma.currentPage = stylingPage;

        // Render the page with ALL element types highlighted
        await renderTargetPage(
          stylingPage,
          manifestForPage,
          0, // x position
          0, // y position
          true, // highlightAllElements = true
          {
            // Highlight ALL element types
            headings: true,
            buttons: true,
            inputs: true,
            textareas: true,
            selects: true,
            images: true,
            links: true,
            paragraphs: true,
            divs: true,
            other: true,
          }
        );

        figma.notify("✨ Styling page created successfully!");
        return;
      } else if (status.status === "failed") {
        figma.notify("Crawl failed", { error: true });
        return;
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }

  figma.notify("Timeout waiting for crawl to complete", { error: true });
}

function canonicalizeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch (error) {
    console.warn("Unable to canonicalize URL", url, error);
    return url;
  }
}

function findPageByUrl(
  root: TreeNode | null,
  targetUrl: string
): TreeNode | null {
  if (!root) {
    return null;
  }

  const canonicalTarget = canonicalizeUrl(targetUrl);
  const stack: TreeNode[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (canonicalizeUrl(node.url) === canonicalTarget) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      stack.push(...node.children);
    }
  }

  return null;
}
