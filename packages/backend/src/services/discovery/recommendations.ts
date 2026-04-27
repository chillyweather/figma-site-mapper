import type { DiscoveryCandidate } from "./discoveryRunner.js";
import type { PageType } from "./types.js";

export interface RecommendationInput {
  candidates: DiscoveryCandidate[];
  pageBudget: number;
  startHost: string;
  includeBlog?: boolean;
  includeSupport?: boolean;
}

export interface RecommendationResult {
  recommended: DiscoveryCandidate[];
  excluded: DiscoveryCandidate[];
  summary: {
    totalCandidates: number;
    recommendedCount: number;
    byPageType: Record<string, number>;
    byHost: Record<string, number>;
    excludedCount: number;
  };
}

const VALUABLE_TYPES: Set<PageType> = new Set([
  "homepage",
  "pricing",
  "product-detail",
  "feature-detail",
  "integration",
]);

const TYPE_CAPS: Record<PageType, number> = {
  homepage: 1,
  pricing: 1,
  "product-detail": 4,
  "feature-detail": 4,
  integration: 3,
  "customer-story": 3,
  "blog-listing": 1,
  "blog-article": 1,
  "support-doc": 0,
  legal: 0,
  utility: 0,
  unknown: 5,
};

const LANGUAGE_CODES = new Set([
  "en", "de", "fr", "es", "it", "pt", "nl", "ja", "zh", "ko", "ru", "ar", "hi",
]);

function hasLanguagePrefix(path: string): boolean {
  const first = path.split("/").filter(Boolean)[0];
  if (!first) return false;
  return LANGUAGE_CODES.has(first.toLowerCase());
}

function stripLanguagePrefix(path: string): string {
  const segments = path.split("/").filter(Boolean);
  const first = segments[0];
  if (first && LANGUAGE_CODES.has(first.toLowerCase())) {
    return "/" + segments.slice(1).join("/");
  }
  return path;
}

function isLanguageDuplicate(
  candidate: DiscoveryCandidate,
  selected: DiscoveryCandidate[]
): boolean {
  if (!hasLanguagePrefix(candidate.path)) return false;
  const stripped = stripLanguagePrefix(candidate.path);
  return selected.some((s) => {
    if (s.pageType !== candidate.pageType) return false;
    const sStripped = stripLanguagePrefix(s.path);
    return sStripped === stripped;
  });
}

function computeBaseScore(candidate: DiscoveryCandidate): number {
  let score = 0;

  // Source signals
  if (candidate.reasons.includes("seed-url")) score += 40;
  if (candidate.reasons.includes("main-nav")) score += 30;
  if (candidate.reasons.includes("footer")) score += 20;

  // Page type value
  if (VALUABLE_TYPES.has(candidate.pageType)) score += 20;

  // Penalties
  if (candidate.pageType === "legal" || candidate.pageType === "utility") score -= 40;
  if (candidate.pageType === "support-doc") score -= 30;

  return score;
}

export function generateRecommendations(
  input: RecommendationInput
): RecommendationResult {
  const { candidates, pageBudget, startHost, includeBlog = true, includeSupport = false } = input;

  const mutable = candidates.map((c) => ({
    ...c,
    baseScore: computeBaseScore(c),
    computedScore: 0,
  }));

  const recommended: typeof mutable = [];
  const selectedPatternKeys = new Set<string>();
  const selectedTypes = new Map<PageType, number>();
  let blogSelected = false;

  while (recommended.length < pageBudget && mutable.length > 0) {
    // Re-score remaining based on dynamic signals (always from base)
    for (const c of mutable) {
      let adj = c.baseScore;

      // Pattern novelty
      if (selectedPatternKeys.has(c.patternKey)) {
        adj -= 10; // mild redundancy penalty
      } else {
        adj += 10;
      }

      // Language duplicate (heavy penalty)
      if (isLanguageDuplicate(c, recommended)) {
        adj -= 50;
      }

      // Blog cap
      if (c.pageType === "blog-article" && blogSelected) {
        adj -= 20;
      }

      // Support subdomain penalty
      if (
        c.pageType === "support-doc" &&
        c.host.toLowerCase() !== startHost.toLowerCase()
      ) {
        adj -= 30;
      }

      c.computedScore = adj;
    }

    // Sort by computed score descending
    mutable.sort((a, b) => b.computedScore - a.computedScore);

    const pick = mutable[0];
    if (!pick) break;

    // Check hard caps
    const cap =
      pick.pageType === "blog-article" && !includeBlog
        ? 0
        : pick.pageType === "support-doc" && !includeSupport
        ? 0
        : (TYPE_CAPS[pick.pageType] ?? 1);

    const currentCount = selectedTypes.get(pick.pageType) ?? 0;
    if (currentCount >= cap) {
      // Remove from pool and continue; it can't be recommended
      mutable.shift();
      continue;
    }

    // Select it
    recommended.push(pick);
    mutable.shift();
    selectedPatternKeys.add(pick.patternKey);
    selectedTypes.set(pick.pageType, currentCount + 1);
    if (pick.pageType === "blog-article") blogSelected = true;
  }

  const excluded = mutable;

  const byPageType: Record<string, number> = {};
  const byHost: Record<string, number> = {};
  for (const c of recommended) {
    byPageType[c.pageType] = (byPageType[c.pageType] ?? 0) + 1;
    byHost[c.host] = (byHost[c.host] ?? 0) + 1;
  }

  return {
    recommended: recommended.map((r) => ({
      ...r,
      isRecommended: true,
      score: r.computedScore,
    })),
    excluded: excluded.map((e) => ({
      ...e,
      isRecommended: false,
      score: e.computedScore,
    })),
    summary: {
      totalCandidates: candidates.length,
      recommendedCount: recommended.length,
      byPageType,
      byHost,
      excludedCount: excluded.length,
    },
  };
}
