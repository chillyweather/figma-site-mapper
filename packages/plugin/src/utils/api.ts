import { BACKEND_URL } from "../constants";
import { CrawlStartMessage } from "../types/messages";

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
    }),
  });

  return response.json();
}

export async function getJobStatus(jobId: string) {
  const response = await fetch(`${BACKEND_URL}/status/${jobId}`);
  return response.json();
}
