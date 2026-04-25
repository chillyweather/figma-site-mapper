import { generateRecommendations } from "../services/discovery/recommendations.js";
function makeCandidate(url, path, pageType, patternKey, source, reasons, host = "example.com") {
    return {
        discoveryRunId: 1,
        projectId: 1,
        url,
        normalizedUrl: url,
        host,
        path,
        source,
        sourceUrl: null,
        pageType: pageType,
        patternKey,
        score: 0,
        reasons,
        isRecommended: false,
        isApproved: false,
        isExcluded: false,
        createdAt: new Date(),
    };
}
const fixtures = [
    makeCandidate("https://example.com/", "/", "homepage", "homepage:/", "start-url", ["start-url"]),
    makeCandidate("https://example.com/pricing", "/pricing", "pricing", "pricing:/pricing", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/products/ticketing", "/products/ticketing", "product-detail", "product-detail:/products/*", "seed-url", ["seed-url"]),
    makeCandidate("https://example.com/products/rmm", "/products/rmm", "product-detail", "product-detail:/products/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/products/backup", "/products/backup", "product-detail", "product-detail:/products/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/products/automation", "/products/automation", "product-detail", "product-detail:/products/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/features/ai", "/features/ai", "feature-detail", "feature-detail:/features/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/features/reporting", "/features/reporting", "feature-detail", "feature-detail:/features/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/features/monitoring", "/features/monitoring", "feature-detail", "feature-detail:/features/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/features/alerts", "/features/alerts", "feature-detail", "feature-detail:/features/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/integrations/slack", "/integrations/slack", "integration", "integration:/integrations/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/integrations/zapier", "/integrations/zapier", "integration", "integration:/integrations/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/customers/acme", "/customers/acme", "customer-story", "customer-story:/customers/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/customers/wayne", "/customers/wayne", "customer-story", "customer-story:/customers/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/blog/post-1", "/blog/post-1", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/blog/post-2", "/blog/post-2", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/blog/post-3", "/blog/post-3", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/blog/post-4", "/blog/post-4", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/blog/post-5", "/blog/post-5", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
    makeCandidate("https://example.com/privacy", "/privacy", "legal", "legal:/privacy", "footer", ["footer"]),
    makeCandidate("https://example.com/terms", "/terms", "legal", "legal:/terms", "footer", ["footer"]),
    makeCandidate("https://example.com/login", "/login", "utility", "utility:/login", "footer", ["footer"]),
    makeCandidate("https://example.com/signup", "/signup", "utility", "utility:/signup", "footer", ["footer"]),
    makeCandidate("https://support.example.com/docs/start", "/docs/start", "support-doc", "support-doc:/docs/*", "sitemap", ["sitemap"], "support.example.com"),
    makeCandidate("https://support.example.com/docs/advanced", "/docs/advanced", "support-doc", "support-doc:/docs/*", "sitemap", ["sitemap"], "support.example.com"),
];
const result = generateRecommendations({
    candidates: fixtures,
    pageBudget: 10,
    startHost: "example.com",
    includeBlog: true,
    includeSupport: false,
});
console.log("Types:", result.summary.byPageType);
console.log("Recommended URLs:");
result.recommended.forEach((r, i) => console.log(`  ${i + 1}. ${r.pageType} ${r.url} (score: ${r.score})`));
