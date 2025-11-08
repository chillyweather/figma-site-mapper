import { BACKEND_URL } from "../constants";
import { CrawlParams } from "../types";

interface PageResponseItem {
  _id: string;
  url: string;
  title: string;
  screenshotPaths: string[];
  interactiveElements?: Array<{
    type: "link" | "button";
    x: number;
    y: number;
    width: number;
    height: number;
    href?: string;
    text?: string;
  }>;
  globalStyles?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ElementResponseItem {
  _id: string;
  pageId: string;
  projectId: string;
  type: string;
  selector?: string;
  tagName?: string;
  elementId?: string;
  classes?: string[];
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  href?: string;
  text?: string;
  styles?: Record<string, unknown>;
  styleTokens?: string[];
  ariaLabel?: string;
  role?: string;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  src?: string;
  alt?: string;
}

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
      fullRefresh: params.fullRefresh === true,
      detectInteractiveElements: params.detectInteractiveElements !== false,
      styleExtraction: params.styleExtraction,
      captureOnlyVisibleElements: params.captureOnlyVisibleElements !== false,
      projectId: params.projectId,
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
 * Fetch all pages for a project from the backend
 */
export async function fetchProjectPages(
  projectId: string
): Promise<PageResponseItem[]> {
  const response = await fetch(
    `${BACKEND_URL}/page?projectId=${encodeURIComponent(projectId)}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch pages: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return Array.isArray(data.pages) ? data.pages : [];
}

/**
 * Fetch all persisted elements for a project. Optionally filter by page id or URL.
 */
export async function fetchProjectElements(
  projectId: string,
  options: { pageId?: string; url?: string } = {}
): Promise<ElementResponseItem[]> {
  const queryParts = [`projectId=${encodeURIComponent(projectId)}`];
  if (options.pageId) {
    queryParts.push(`pageId=${encodeURIComponent(options.pageId)}`);
  }
  if (options.url) {
    queryParts.push(`url=${encodeURIComponent(options.url)}`);
  }

  const response = await fetch(
    `${BACKEND_URL}/elements?${queryParts.join("&")}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch elements: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return Array.isArray(data.elements) ? data.elements : [];
}

interface PagesByIdsResponse {
  pages: PageResponseItem[];
  elements: ElementResponseItem[];
}

interface JobPagesResponse extends PagesByIdsResponse {
  jobId: string;
  projectId: string;
}

/**
 * Fetch a subset of pages by their identifiers.
 */
export async function fetchPagesByIds(
  projectId: string,
  pageIds: string[]
): Promise<PagesByIdsResponse> {
  const normalizedIds = (Array.isArray(pageIds) ? pageIds : [])
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  if (normalizedIds.length === 0) {
    return { pages: [], elements: [] };
  }

  // Build query string manually (URLSearchParams not available in Figma sandbox)
  const queryParts = [`projectId=${encodeURIComponent(projectId)}`];
  for (const id of normalizedIds) {
    queryParts.push(`ids=${encodeURIComponent(id)}`);
  }

  const response = await fetch(
    `${BACKEND_URL}/pages/by-ids?${queryParts.join("&")}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch pages by ids: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const pages = Array.isArray((data as any).pages)
    ? ((data as any).pages as PageResponseItem[])
    : [];
  const elements = Array.isArray((data as any).elements)
    ? ((data as any).elements as ElementResponseItem[])
    : [];

  return { pages, elements };
}

/**
 * Fetch the manifest subset for a completed job.
 */
export async function fetchJobPages(jobId: string): Promise<JobPagesResponse> {
  const response = await fetch(
    `${BACKEND_URL}/jobs/${encodeURIComponent(jobId)}/pages`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch job pages: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const pages = Array.isArray((data as any).pages)
    ? ((data as any).pages as PageResponseItem[])
    : [];
  const elements = Array.isArray((data as any).elements)
    ? ((data as any).elements as ElementResponseItem[])
    : [];

  return {
    jobId: (data as any).jobId ?? jobId,
    projectId: (data as any).projectId ?? "",
    pages,
    elements,
  };
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
