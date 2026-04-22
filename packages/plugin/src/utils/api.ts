import { BACKEND_URL } from "../constants";
import { Project } from "../types";
import { CrawlStartMessage } from "../types/messages";

export async function fetchProjects(): Promise<{ projects: Project[] }> {
  const response = await fetch(`${BACKEND_URL}/projects`);

  if (!response.ok) {
    throw new Error(`Failed to fetch projects (${response.status})`);
  }

  return response.json();
}

export async function createProject(
  name: string
): Promise<{ project: Project }> {
  const response = await fetch(`${BACKEND_URL}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to create project");
  }

  return response.json();
}

export async function startCrawl(params: Omit<CrawlStartMessage, "type">) {
  const response = await fetch(`${BACKEND_URL}/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: params.url,
      publicUrl: BACKEND_URL,
      maxRequestsPerCrawl: params.maxRequestsPerCrawl,
      deviceScaleFactor: params.deviceScaleFactor,
      delay: params.delay,
      requestDelay: params.requestDelay,
      maxDepth: params.maxDepth,
      defaultLanguageOnly: params.defaultLanguageOnly,
      sampleSize: params.sampleSize,
      showBrowser: params.showBrowser,
      detectInteractiveElements: params.detectInteractiveElements,
      auth: params.auth,
      projectId: params.projectId,
    }),
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      if (data && typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // Keep HTTP status fallback.
    }
    throw new Error(`Failed to queue crawl: ${message}`);
  }

  return response.json();
}

export async function getJobStatus(jobId: string) {
  const response = await fetch(`${BACKEND_URL}/status/${jobId}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch job status: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}
