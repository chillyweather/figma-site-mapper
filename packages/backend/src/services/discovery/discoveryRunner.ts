import { db } from "../../db.js";
import { discoveryRuns, discoveryCandidates, pages } from "../../schema.js";
import { eq } from "drizzle-orm";
import { normalizeUrl } from "./urlNormalize.js";
import { classifyPage } from "./pageClassifier.js";
import { generateRecommendations } from "./recommendations.js";
import type { PageType } from "./types.js";

export interface DiscoveryInput {
  projectId: string;
  startUrl: string;
  seedUrls?: string[];
  maxCandidates?: number;
  pageBudget?: number;
  maxDepth?: number;
  includeSubdomains?: boolean;
  includeBlog?: boolean;
  includeSupport?: boolean;
  requestDelay?: number;
}

export interface DiscoveryCandidate {
  id?: number;
  discoveryRunId: number;
  projectId: number;
  url: string;
  normalizedUrl: string;
  host: string;
  path: string;
  source: string;
  sourceUrl?: string | null;
  pageType: PageType;
  patternKey: string;
  score: number;
  reasons: string[];
  isRecommended: boolean;
  isApproved: boolean;
  isExcluded: boolean;
  createdAt: Date;
}

export interface DiscoveryResult {
  discoveryRunId: string;
  projectId: string;
  status: string;
  candidates: DiscoveryCandidate[];
  recommended: DiscoveryCandidate[];
  summary: {
    totalCandidates: number;
    recommendedCount: number;
    byPageType: Record<string, number>;
    byHost: Record<string, number>;
    excludedCount: number;
  };
}

function isValidId(id: unknown): id is string {
  if (!id || typeof id !== "string") return false;
  const n = parseInt(id, 10);
  return !isNaN(n) && n > 0 && String(n) === id;
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const hrefs = new Set<string>();
  const regex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      const rawHref = match[1];
      if (!rawHref) continue;
      const resolved = new URL(rawHref, baseUrl).href;
      hrefs.add(resolved);
    } catch {
      // ignore malformed URLs
    }
  }
  return Array.from(hrefs);
}

function extractSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const raw = match[1];
    if (raw) urls.push(raw.trim());
  }
  return urls;
}

function sameHost(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function isSubdomain(host: string, parentHost: string): boolean {
  const h = host.toLowerCase();
  const p = parentHost.toLowerCase();
  return h.endsWith(`.${p}`);
}

export async function runDiscovery(input: DiscoveryInput): Promise<DiscoveryResult> {
  if (!isValidId(input.projectId)) {
    throw new Error("Invalid projectId");
  }
  const projectIdNum = parseInt(input.projectId, 10);
  const maxCandidates = input.maxCandidates ?? 300;
  const pageBudget = input.pageBudget && input.pageBudget > 0 ? input.pageBudget : 10;
  const includeSubdomains = input.includeSubdomains ?? false;

  const startNormalized = normalizeUrl(input.startUrl);
  if (!startNormalized) {
    throw new Error("Invalid startUrl");
  }
  const startHost = startNormalized.host;

  // Create discovery run
  const now = new Date();
  const [runRow] = db
    .insert(discoveryRuns)
    .values({
      projectId: projectIdNum,
      startUrl: input.startUrl,
      status: "running",
      settingsJson: JSON.stringify({
        maxCandidates,
        pageBudget,
        maxDepth: input.maxDepth ?? 2,
        includeSubdomains,
        includeBlog: input.includeBlog ?? true,
        includeSupport: input.includeSupport ?? false,
        seedUrls: input.seedUrls ?? [],
      }),
      startedAt: now,
    })
    .returning()
    .all();
  if (!runRow) {
    throw new Error("Failed to create discovery run");
  }
  const runId = runRow.id;

  // Collect raw URLs with provenance
  const rawSources: Array<{ url: string; source: string; sourceUrl?: string }> = [];

  // 1. Start URL
  rawSources.push({ url: input.startUrl, source: "start-url" });

  // 2. Seed URLs
  for (const seed of input.seedUrls ?? []) {
    rawSources.push({ url: seed, source: "seed-url" });
  }

  // 3. Existing project pages from DB
  const existingPages = db
    .select()
    .from(pages)
    .where(eq(pages.projectId, projectIdNum))
    .all();
  for (const page of existingPages) {
    rawSources.push({ url: page.url, source: "existing-page" });
  }

  // 4. Sitemap.xml
  const sitemapUrl = new URL("/sitemap.xml", input.startUrl).href;
  const sitemapXml = await fetchText(sitemapUrl);
  if (sitemapXml) {
    for (const url of extractSitemapUrls(sitemapXml)) {
      rawSources.push({ url, source: "sitemap", sourceUrl: sitemapUrl });
    }
  }

  // 5. Homepage links
  const homepageHtml = await fetchText(input.startUrl);
  if (homepageHtml) {
    for (const url of extractLinks(homepageHtml, input.startUrl)) {
      rawSources.push({ url, source: "homepage-link", sourceUrl: input.startUrl });
    }
  }

  // Normalize and dedupe
  const seen = new Set<string>();
  const candidates: DiscoveryCandidate[] = [];

  for (const raw of rawSources) {
    const norm = normalizeUrl(raw.url);
    if (!norm) continue;

    // Scope boundary
    const inScope =
      sameHost(norm.host, startHost) ||
      (includeSubdomains && isSubdomain(norm.host, startHost));
    if (!inScope) continue;

    if (seen.has(norm.url)) continue;
    seen.add(norm.url);

    if (candidates.length >= maxCandidates) break;

    const classification = classifyPage(norm.path);

    const candidate: DiscoveryCandidate = {
      discoveryRunId: runId,
      projectId: projectIdNum,
      url: raw.url,
      normalizedUrl: norm.url,
      host: norm.host,
      path: norm.path,
      source: raw.source,
      sourceUrl: raw.sourceUrl ?? null,
      pageType: classification.pageType,
      patternKey: classification.patternKey,
      score: 0,
      reasons: [raw.source],
      isRecommended: false,
      isApproved: false,
      isExcluded: false,
      createdAt: now,
    };

    candidates.push(candidate);
  }

  // Persist candidates with deduplication via unique index
  for (const c of candidates) {
    try {
      const [inserted] = db.insert(discoveryCandidates)
        .values({
          discoveryRunId: c.discoveryRunId,
          projectId: c.projectId,
          url: c.url,
          normalizedUrl: c.normalizedUrl,
          host: c.host,
          path: c.path,
          source: c.source,
          sourceUrl: c.sourceUrl,
          pageType: c.pageType,
          patternKey: c.patternKey,
          score: c.score,
          reasonsJson: JSON.stringify(c.reasons),
          isRecommended: c.isRecommended,
          isApproved: c.isApproved,
          isExcluded: c.isExcluded,
          createdAt: c.createdAt,
        })
        .returning({ id: discoveryCandidates.id })
        .all();
      if (inserted) {
        c.id = inserted.id;
      }
    } catch (err) {
      // Unique constraint violation is expected for duplicates; ignore
      if (err && typeof err === "object" && (err as any).message?.includes("UNIQUE")) {
        continue;
      }
      throw err;
    }
  }

  // Generate recommendations
  const recResult = generateRecommendations({
    candidates,
    pageBudget,
    startHost,
    includeBlog: input.includeBlog ?? true,
    includeSupport: input.includeSupport ?? false,
  });

  // Update DB with recommendation status
  for (const c of recResult.recommended) {
    db.update(discoveryCandidates)
      .set({
        isRecommended: true,
        score: c.score,
      })
      .where(
        eq(discoveryCandidates.id, c.id ?? 0)
      )
      .run();
  }

  // Update run counts
  db.update(discoveryRuns)
    .set({
      status: "completed",
      candidateCount: candidates.length,
      recommendedCount: recResult.recommended.length,
      approvedCount: 0,
      completedAt: new Date(),
    })
    .where(eq(discoveryRuns.id, runId))
    .run();

  return {
    discoveryRunId: String(runId),
    projectId: String(projectIdNum),
    status: "completed",
    candidates,
    recommended: recResult.recommended,
    summary: {
      totalCandidates: candidates.length,
      recommendedCount: recResult.recommended.length,
      byPageType: recResult.summary.byPageType,
      byHost: recResult.summary.byHost,
      excludedCount: recResult.excluded.length,
    },
  };
}
