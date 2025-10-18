import { BACKEND_URL } from "../constants";
import { CrawlParams } from "../types";

/**
 * Start a crawl job on the backend
 */
export async function startCrawl(
  params: CrawlParams
): Promise<{ jobId: string }> {
  const response = await fetch(`${BACKEND_URL}/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: params.url,
      maxRequestsPerCrawl: params.maxRequestsPerCrawl,
      screenshotWidth: params.screenshotWidth,
      maxDepth: params.maxDepth,
      sampleSize: params.sampleSize,
      showBrowser: params.showBrowser,
      auth: params.auth,
      publicUrl: BACKEND_URL,
      deviceScaleFactor: params.deviceScaleFactor || 1,
      delay: params.delay || 0,
      requestDelay: params.requestDelay || 1000,
      defaultLanguageOnly: params.defaultLanguageOnly !== false,
      detectInteractiveElements: params.detectInteractiveElements !== false,
      styleExtraction: params.styleExtraction,
    }),
  });

  return response.json();
}

/**
 * Get job status from backend
 */
export async function getJobStatus(jobId: string): Promise<any> {
  const response = await fetch(`${BACKEND_URL}/status/${jobId}`);
  return response.json();
}

/**
 * Fetch manifest data
 */
export async function fetchManifest(manifestUrl: string): Promise<any> {
  const response = await fetch(manifestUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch manifest: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Open authentication session for manual login/CAPTCHA
 */
export async function openAuthSession(url: string): Promise<{
  cookies: Array<{ name: string; value: string; domain: string }>;
}> {
  const response = await fetch(`${BACKEND_URL}/auth-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to open auth session: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
