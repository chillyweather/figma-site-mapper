import { BACKEND_URL } from "../constants";
import { CrawlParams } from "../types";
import type { InventoryDecisions, InventoryOverview, DiscoveryResult, MappingContextSummary, MappingSuggestions, MappingInputs, FlowRecord, FlowStepRecord } from "../../types";
import type { InventoryRenderData } from "@sitemapper/shared";
import { createHttpClient } from "./httpClient";

const client = createHttpClient(BACKEND_URL);

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

interface GetPageOptions {
  url?: string;
  pageId?: string;
}

interface RecrawlParams {
  url: string;
  projectId: string;
  deviceScaleFactor?: number;
  delay?: number;
  requestDelay?: number;
  auth?: CrawlParams["auth"];
  cookieBannerHandling?: CrawlParams["cookieBannerHandling"];
  styleExtraction?: CrawlParams["styleExtraction"];
}

export async function startCrawl(params: CrawlParams): Promise<{ jobId: string }> {
  const data = await client.post("/crawl", {
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
    cookieBannerHandling: params.cookieBannerHandling ?? "auto",
    styleExtraction: params.styleExtraction,
    captureOnlyVisibleElements: params.captureOnlyVisibleElements !== false,
    projectId: params.projectId,
  }) as any;
  if (!data || typeof data.jobId !== "string") {
    throw new Error("Backend did not return a crawl job ID");
  }
  return { jobId: data.jobId };
}

export async function recrawlPage(params: RecrawlParams): Promise<{ jobId: string }> {
  return client.post("/recrawl-page", {
    url: params.url,
    publicUrl: BACKEND_URL,
    projectId: params.projectId,
    deviceScaleFactor: params.deviceScaleFactor || 1,
    delay: params.delay || 0,
    requestDelay: params.requestDelay || 1000,
    auth: params.auth,
    cookieBannerHandling: params.cookieBannerHandling ?? "auto",
    styleExtraction: params.styleExtraction,
  }) as Promise<{ jobId: string }>;
}

export async function getJobStatus(jobId: string): Promise<any> {
  return client.get(`/status/${jobId}`);
}

export async function fetchProjectPages(projectId: string): Promise<PageResponseItem[]> {
  const data = await client.get(`/page?projectId=${encodeURIComponent(projectId)}`) as any;
  return Array.isArray(data.pages) ? data.pages : [];
}

export async function fetchProjectElements(
  projectId: string,
  options: { pageId?: string; url?: string } = {}
): Promise<ElementResponseItem[]> {
  const queryParts = [`projectId=${encodeURIComponent(projectId)}`];
  if (options.pageId) queryParts.push(`pageId=${encodeURIComponent(options.pageId)}`);
  if (options.url) queryParts.push(`url=${encodeURIComponent(options.url)}`);
  const data = await client.get(`/elements?${queryParts.join("&")}`) as any;
  return Array.isArray(data.elements) ? data.elements : [];
}

export async function getPage(
  projectId: string,
  options: GetPageOptions = {}
): Promise<PageResponseItem | null> {
  const queryParts = [`projectId=${encodeURIComponent(projectId)}`];
  if (options.url) queryParts.push(`url=${encodeURIComponent(options.url)}`);
  if (options.pageId) queryParts.push(`pageId=${encodeURIComponent(options.pageId)}`);
  const data = await client.getOrNull(`/page?${queryParts.join("&")}`) as any;
  if (!data) return null;
  if (data.page) return data.page as PageResponseItem;
  const pages = Array.isArray(data.pages) ? data.pages : [];
  return pages.length > 0 ? pages[0] as PageResponseItem : null;
}

interface PagesByIdsResponse {
  pages: PageResponseItem[];
  elements: ElementResponseItem[];
}

interface JobPagesResponse extends PagesByIdsResponse {
  jobId: string;
  projectId: string;
}

interface InventoryTokensResponse {
  projectId: string;
  tokens: Record<string, unknown>;
}

export async function fetchPagesByIds(
  projectId: string,
  pageIds: string[]
): Promise<PagesByIdsResponse> {
  const normalizedIds = (Array.isArray(pageIds) ? pageIds : [])
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  if (normalizedIds.length === 0) return { pages: [], elements: [] };

  // Build query string manually (URLSearchParams not available in Figma sandbox)
  const queryParts = [`projectId=${encodeURIComponent(projectId)}`];
  for (const id of normalizedIds) queryParts.push(`ids=${encodeURIComponent(id)}`);

  const data = await client.get(`/pages/by-ids?${queryParts.join("&")}`) as any;
  return {
    pages: Array.isArray(data.pages) ? data.pages as PageResponseItem[] : [],
    elements: Array.isArray(data.elements) ? data.elements as ElementResponseItem[] : [],
  };
}

export async function fetchJobPages(jobId: string): Promise<JobPagesResponse> {
  const data = await client.get(`/jobs/${encodeURIComponent(jobId)}/pages`) as any;
  return {
    jobId: data.jobId ?? jobId,
    projectId: data.projectId ?? "",
    pages: Array.isArray(data.pages) ? data.pages as PageResponseItem[] : [],
    elements: Array.isArray(data.elements) ? data.elements as ElementResponseItem[] : [],
  };
}

export async function openAuthSession(url: string): Promise<{
  cookies: Array<{ name: string; value: string; domain: string }>;
}> {
  return client.post("/auth-session", { url }) as Promise<{
    cookies: Array<{ name: string; value: string; domain: string }>;
  }>;
}

export async function fetchInventoryOverview(projectId: string): Promise<InventoryOverview> {
  return client.get(
    `/inventory/overview?projectId=${encodeURIComponent(projectId)}`
  ) as Promise<InventoryOverview>;
}

export async function fetchInventoryTokens(projectId: string): Promise<InventoryTokensResponse> {
  return client.get(
    `/inventory/tokens?projectId=${encodeURIComponent(projectId)}`
  ) as Promise<InventoryTokensResponse>;
}

export async function fetchInventoryDecisions(projectId: string): Promise<InventoryDecisions> {
  return client.get(
    `/inventory/decisions/${encodeURIComponent(projectId)}`
  ) as Promise<InventoryDecisions>;
}

export async function fetchMappingInputs(projectId: string): Promise<MappingInputs> {
  return client.get(
    `/mapping-inputs/${encodeURIComponent(projectId)}`
  ) as Promise<MappingInputs>;
}

export async function fetchMappingContextSummary(projectId: string): Promise<MappingContextSummary> {
  return client.get(
    `/mapping-context/${encodeURIComponent(projectId)}`
  ) as Promise<MappingContextSummary>;
}

export async function fetchSuggestions(projectId: string): Promise<MappingSuggestions> {
  return client.get(
    `/mapping-suggestions/${encodeURIComponent(projectId)}`
  ) as Promise<MappingSuggestions>;
}

export async function saveProjectMappingInputs(
  projectId: string,
  mappingInputs: Omit<MappingInputs, "projectId">
): Promise<MappingInputs> {
  return client.post(
    `/mapping-inputs/${encodeURIComponent(projectId)}`,
    mappingInputs
  ) as Promise<MappingInputs>;
}

export async function fetchInventoryRenderData(projectId: string): Promise<InventoryRenderData> {
  return client.get(
    `/inventory/render-data/${encodeURIComponent(projectId)}`
  ) as Promise<InventoryRenderData>;
}

export async function startDiscovery(params: {
  projectId: string;
  startUrl: string;
  seedUrls?: string[];
  discoveryMode?: "fast" | "full";
  maxCandidates?: number;
  pageBudget?: number;
  maxDepth?: number;
  requestDelay?: number;
  includeSubdomains?: boolean;
  includeBlog?: boolean;
  includeSupport?: boolean;
}): Promise<{ discoveryRunId: string; status: string }> {
  return client.post("/discovery/start", params) as Promise<{
    discoveryRunId: string;
    status: string;
  }>;
}

export async function getDiscoveryRun(runId: string): Promise<DiscoveryResult> {
  const data = await client.get(`/discovery/${encodeURIComponent(runId)}`) as any;
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  return {
    discoveryRunId: String(data.discoveryRunId ?? runId),
    projectId: String(data.projectId ?? ""),
    status: String(data.status ?? ""),
    candidates,
    recommended: candidates.filter((c: any) => c.isRecommended),
    summary: data.summary ?? { totalCandidates: 0, recommendedCount: 0, byPageType: {}, byHost: {}, warnings: [] },
  };
}

export async function approveDiscoveryRun(
  runId: string,
  params: {
    approvedCandidateIds?: string[];
    manualUrls?: string[];
    excludedCandidateIds?: string[];
  }
): Promise<{ ok: boolean; approvedUrls: string[] }> {
  return client.post(
    `/discovery/${encodeURIComponent(runId)}/approval`,
    params
  ) as Promise<{ ok: boolean; approvedUrls: string[] }>;
}

export async function startApprovedCrawl(params: {
  projectId: string;
  discoveryRunId: string;
  approvedUrls: string[];
  fullRefresh?: boolean;
  screenshotWidth?: number;
  deviceScaleFactor?: number;
  auth?: CrawlParams["auth"];
  cookieBannerHandling?: CrawlParams["cookieBannerHandling"];
  styleExtraction?: Record<string, unknown>;
}): Promise<{ jobId: string }> {
  const data = await client.post("/crawl/approved", {
    projectId: params.projectId,
    discoveryRunId: params.discoveryRunId,
    approvedUrls: params.approvedUrls,
    fullRefresh: params.fullRefresh ?? true,
    screenshotWidth: params.screenshotWidth ?? 1440,
    deviceScaleFactor: params.deviceScaleFactor ?? 1,
    auth: params.auth,
    cookieBannerHandling: params.cookieBannerHandling ?? "auto",
    styleExtraction: params.styleExtraction,
  }) as any;
  if (!data || typeof data.jobId !== "string") {
    throw new Error("Backend did not return a crawl job ID");
  }
  return { jobId: data.jobId };
}

export async function prepareInventory(
  projectId: string
): Promise<{ jobId: string; projectId: string; type: "inventory-prepare" }> {
  const data = await client.post(
    `/inventory/prepare/${encodeURIComponent(projectId)}`
  ) as any;
  if (!data || typeof data.jobId !== "string") {
    throw new Error("Backend did not return an inventory prepare job id");
  }
  return {
    jobId: data.jobId,
    projectId: String(data.projectId ?? projectId),
    type: "inventory-prepare",
  };
}

// ── Flow API ────────────────────────────────────────────────────────────────

export async function fetchFlows(projectId: string): Promise<FlowRecord[]> {
  const data = await client.get(`/flows?projectId=${encodeURIComponent(projectId)}`) as any;
  return Array.isArray(data.flows) ? data.flows : [];
}

export async function createFlow(params: {
  projectId: string;
  name: string;
  description?: string;
}): Promise<FlowRecord> {
  const data = await client.post("/flows", params) as any;
  return data.flow;
}

export async function fetchFlow(flowId: string): Promise<FlowRecord> {
  const data = await client.get(`/flows/${encodeURIComponent(flowId)}`) as any;
  return data.flow;
}

export async function updateFlow(
  flowId: string,
  params: { name?: string; description?: string }
): Promise<FlowRecord> {
  const data = await client.put(`/flows/${encodeURIComponent(flowId)}`, params) as any;
  return data.flow;
}

export async function deleteFlow(flowId: string): Promise<void> {
  await client.del(`/flows/${encodeURIComponent(flowId)}`);
}

export async function addFlowStep(
  flowId: string,
  params: {
    sourcePageId: string;
    sourceUrl: string;
    elementId?: string;
    elementSelector?: string;
    elementText?: string;
    elementBbox?: { x: number; y: number; width: number; height: number };
    targetUrl?: string;
    targetPageId?: string;
    actionKind: string;
  }
): Promise<FlowStepRecord> {
  const data = await client.post(`/flows/${encodeURIComponent(flowId)}/steps`, params) as any;
  return data.step;
}

export async function updateFlowStep(
  flowId: string,
  stepId: string,
  params: Record<string, unknown>
): Promise<FlowStepRecord> {
  const data = await client.put(
    `/flows/${encodeURIComponent(flowId)}/steps/${encodeURIComponent(stepId)}`,
    params
  ) as any;
  return data.step;
}

export async function deleteFlowStep(flowId: string, stepId: string): Promise<void> {
  await client.del(`/flows/${encodeURIComponent(flowId)}/steps/${encodeURIComponent(stepId)}`);
}
