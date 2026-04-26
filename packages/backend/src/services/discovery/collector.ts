import { normalizeUrl } from "./urlNormalize.js";

export type DiscoveryMode = "fast" | "full";

export interface DiscoverySource {
  url: string;
  source: string;
  sourceUrl?: string | null;
  depth?: number;
}

export interface DiscoveryCollectionInput {
  startUrl: string;
  seedUrls?: string[];
  existingUrls?: string[];
  includeSubdomains?: boolean;
  maxCandidates?: number;
  maxDepth?: number;
  requestDelay?: number;
}

const TECHNICAL_PATH_PATTERNS = [
  /\/api\//i,
  /\/assets\//i,
  /\/static\//i,
  /\/cdn-cgi\//i,
  /\/images?\//i,
  /\/js\//i,
  /\/css\//i,
  /\/fonts?\//i,
  /\/wp-json\//i,
];

const ASSET_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".rar",
  ".7z",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
  ".ico",
  ".css",
  ".js",
  ".json",
  ".xml",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSubdomain(host: string, parentHost: string): boolean {
  const normalizedHost = host.toLowerCase();
  const normalizedParent = parentHost.toLowerCase();
  return normalizedHost.endsWith(`.${normalizedParent}`);
}

function isInScope(host: string, startHost: string, includeSubdomains: boolean): boolean {
  return host.toLowerCase() === startHost.toLowerCase() || (
    includeSubdomains && isSubdomain(host, startHost)
  );
}

function isTechnicalPath(path: string, rawUrl: string): boolean {
  const lower = `${path} ${rawUrl}`.toLowerCase();
  if (TECHNICAL_PATH_PATTERNS.some((pattern) => pattern.test(lower))) {
    return true;
  }
  return ASSET_EXTENSIONS.some((ext) => lower.includes(ext));
}

function isLikelyHtmlContent(contentType: string | null, text: string): boolean {
  const lowerType = (contentType || "").toLowerCase();
  const lowerText = text.toLowerCase();
  if (!lowerType) {
    return lowerText.includes("<html") || lowerText.includes("<!doctype html");
  }
  return lowerType.includes("text/html") || lowerType.includes("application/xhtml+xml");
}

function isLikelyXmlContent(contentType: string | null, text: string): boolean {
  const lowerType = (contentType || "").toLowerCase();
  const lowerText = text.toLowerCase();
  if (!lowerType) {
    return lowerText.includes("<urlset") || lowerText.includes("<sitemapindex");
  }
  return lowerType.includes("xml") || lowerText.includes("<urlset") || lowerText.includes("<sitemapindex");
}

function extractLinks(html: string, baseUrl: string): string[] {
  const hrefs = new Set<string>();
  const regex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const rawHref = match[1];
    if (!rawHref) continue;
    try {
      hrefs.add(new URL(rawHref, baseUrl).href);
    } catch {
      // ignore malformed URLs
    }
  }
  return Array.from(hrefs);
}

function extractSitemapUrls(text: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1];
    if (raw) urls.push(raw.trim());
  }
  return urls;
}

function extractRobotsSitemaps(text: string): string[] {
  const urls: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*sitemap:\s*(.+)\s*$/i);
    if (match?.[1]) {
      urls.push(match[1].trim());
    }
  }
  return urls;
}

async function fetchText(url: string, timeoutMs = 15000): Promise<{
  text: string | null;
  contentType: string | null;
  finalUrl: string | null;
  ok: boolean;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!response.ok) {
      return {
        text: null,
        contentType: response.headers.get("content-type"),
        finalUrl: response.url || null,
        ok: false,
      };
    }
    return {
      text: await response.text(),
      contentType: response.headers.get("content-type"),
      finalUrl: response.url || null,
      ok: true,
    };
  } catch {
    return {
      text: null,
      contentType: null,
      finalUrl: null,
      ok: false,
    };
  }
}

function chooseSource(existing: DiscoverySource | undefined, next: DiscoverySource): DiscoverySource {
  if (!existing) return next;

  const priority: Record<string, number> = {
    "seed-url": 100,
    "start-url": 90,
    "existing-page": 80,
    "robots-sitemap": 75,
    sitemap: 70,
    "homepage-link": 60,
    "deep-link": 50,
  };
  const existingPriority = priority[existing.source] ?? 0;
  const nextPriority = priority[next.source] ?? 0;
  const source = nextPriority > existingPriority ? next.source : existing.source;
  const sourceUrl = nextPriority > existingPriority ? next.sourceUrl ?? existing.sourceUrl : existing.sourceUrl ?? next.sourceUrl;
  const depth = existing.depth === undefined
    ? next.depth
    : next.depth === undefined
      ? existing.depth
      : Math.min(existing.depth, next.depth);
  return {
    ...existing,
    ...next,
    source,
    sourceUrl,
    depth,
  };
}

export async function collectFullDiscoverySources(
  input: DiscoveryCollectionInput
): Promise<DiscoverySource[]> {
  const startNormalized = normalizeUrl(input.startUrl);
  if (!startNormalized) {
    return [];
  }

  const startHost = startNormalized.host;
  const maxCandidates = input.maxCandidates ?? 300;
  const depthLimit = input.maxDepth && input.maxDepth > 0 ? input.maxDepth : Number.POSITIVE_INFINITY;
  const requestDelay = input.requestDelay && input.requestDelay > 0 ? input.requestDelay : 0;

  const candidateByUrl = new Map<string, DiscoverySource>();
  const queuedPages = new Set<string>();
  const queuedSitemaps = new Set<string>();
  const pageQueue: Array<{ url: string; source: string; sourceUrl?: string | null; depth: number }> = [];
  const sitemapQueue: Array<{ url: string; sourceUrl?: string | null }> = [];

  const registerCandidate = (rawUrl: string, source: string, sourceUrl?: string | null, depth = 0): boolean => {
    const norm = normalizeUrl(rawUrl);
    if (!norm) return false;
    if (!isInScope(norm.host, startHost, input.includeSubdomains ?? false)) return false;
    if (isTechnicalPath(norm.path, rawUrl)) return false;

    const next: DiscoverySource = {
      url: norm.url,
      source,
      sourceUrl: sourceUrl ?? null,
      depth,
    };
    const existing = candidateByUrl.get(norm.url);
    candidateByUrl.set(norm.url, chooseSource(existing, next));

    if (depth <= depthLimit && !queuedPages.has(norm.url)) {
      queuedPages.add(norm.url);
      pageQueue.push({ url: norm.url, source, sourceUrl: sourceUrl ?? null, depth });
    }

    return !existing;
  };

  const enqueueSitemap = (rawUrl: string, sourceUrl?: string | null): void => {
    const norm = normalizeUrl(rawUrl);
    if (!norm) return;
    if (queuedSitemaps.has(norm.url)) return;
    if (!isInScope(norm.host, startHost, input.includeSubdomains ?? false)) return;
    queuedSitemaps.add(norm.url);
    sitemapQueue.push({ url: norm.url, sourceUrl: sourceUrl ?? null });
  };

  registerCandidate(input.startUrl, "start-url", null, 0);
  for (const seed of input.seedUrls ?? []) {
    registerCandidate(seed, "seed-url", null, 0);
  }
  for (const existing of input.existingUrls ?? []) {
    registerCandidate(existing, "existing-page", null, 0);
  }

  const commonSitemaps = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/wp-sitemap.xml",
  ];
  for (const path of commonSitemaps) {
    enqueueSitemap(new URL(path, input.startUrl).href, input.startUrl);
  }

  const robots = await fetchText(new URL("/robots.txt", input.startUrl).href);
  if (robots.ok && robots.text) {
    for (const sitemapUrl of extractRobotsSitemaps(robots.text)) {
      enqueueSitemap(sitemapUrl, robots.finalUrl ?? input.startUrl);
    }
  }

  while (sitemapQueue.length > 0 && candidateByUrl.size < maxCandidates) {
    const next = sitemapQueue.shift();
    if (!next) break;

    if (requestDelay > 0) {
      await sleep(requestDelay);
    }

    const fetched = await fetchText(next.url);
    if (!fetched.ok || !fetched.text || !isLikelyXmlContent(fetched.contentType, fetched.text)) {
      continue;
    }

    const finalUrl = fetched.finalUrl ?? next.url;
    const text = fetched.text;
    const isIndex = /<sitemapindex[\s>]/i.test(text);

    if (isIndex) {
      for (const sitemapUrl of extractSitemapUrls(text)) {
        enqueueSitemap(sitemapUrl, finalUrl);
      }
      continue;
    }

    for (const url of extractSitemapUrls(text)) {
      if (candidateByUrl.size >= maxCandidates) break;
      const added = registerCandidate(url, "sitemap", finalUrl, 0);
      if (added && depthLimit > 0) {
        const norm = normalizeUrl(url);
        if (norm && !queuedPages.has(norm.url)) {
          queuedPages.add(norm.url);
          pageQueue.push({ url: norm.url, source: "sitemap", sourceUrl: finalUrl, depth: 0 });
        }
      }
    }
  }

  while (pageQueue.length > 0 && candidateByUrl.size < maxCandidates) {
    const current = pageQueue.shift();
    if (!current) break;

    if (requestDelay > 0) {
      await sleep(requestDelay);
    }

    const fetched = await fetchText(current.url);
    if (!fetched.ok || !fetched.text || !isLikelyHtmlContent(fetched.contentType, fetched.text)) {
      continue;
    }

    const baseUrl = fetched.finalUrl ?? current.url;
    const linkSource = current.source === "start-url" ? "homepage-link" : "deep-link";
    const nextDepth = current.depth + 1;
    if (nextDepth > depthLimit) {
      continue;
    }

    for (const link of extractLinks(fetched.text, baseUrl)) {
      if (candidateByUrl.size >= maxCandidates) break;
      const added = registerCandidate(link, linkSource, baseUrl, nextDepth);
      if (!added) {
        const norm = normalizeUrl(link);
        if (norm && nextDepth <= depthLimit && !queuedPages.has(norm.url)) {
          queuedPages.add(norm.url);
          pageQueue.push({ url: norm.url, source: linkSource, sourceUrl: baseUrl, depth: nextDepth });
        }
        continue;
      }
    }
  }

  return Array.from(candidateByUrl.values());
}
