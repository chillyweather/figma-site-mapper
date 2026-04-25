import "../logger.js";
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
function assertTrue(condition, label) {
    if (!condition) {
        process.stderr.write(`  ❌ ${label}\n`);
        return false;
    }
    process.stdout.write(`  ✅ ${label}\n`);
    return true;
}
function assertEqual(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        process.stderr.write(`  ❌ ${label}\n     expected: ${e}\n     actual:   ${a}\n`);
        return false;
    }
    process.stdout.write(`  ✅ ${label}\n`);
    return true;
}
function main() {
    process.stdout.write("\nStage C: Recommendation Engine Validation\n\n");
    const fixtures = [
        // Homepage
        makeCandidate("https://example.com/", "/", "homepage", "homepage:/", "start-url", ["start-url"]),
        // Pricing
        makeCandidate("https://example.com/pricing", "/pricing", "pricing", "pricing:/pricing", "homepage-link", ["homepage-link"]),
        // Product pages (seed + discovered)
        makeCandidate("https://example.com/products/ticketing", "/products/ticketing", "product-detail", "product-detail:/products/*", "seed-url", ["seed-url"]),
        makeCandidate("https://example.com/products/rmm", "/products/rmm", "product-detail", "product-detail:/products/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/products/backup", "/products/backup", "product-detail", "product-detail:/products/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/products/automation", "/products/automation", "product-detail", "product-detail:/products/*", "homepage-link", ["homepage-link"]),
        // Feature pages
        makeCandidate("https://example.com/features/ai", "/features/ai", "feature-detail", "feature-detail:/features/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/features/reporting", "/features/reporting", "feature-detail", "feature-detail:/features/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/features/monitoring", "/features/monitoring", "feature-detail", "feature-detail:/features/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/features/alerts", "/features/alerts", "feature-detail", "feature-detail:/features/*", "homepage-link", ["homepage-link"]),
        // Integration
        makeCandidate("https://example.com/integrations/slack", "/integrations/slack", "integration", "integration:/integrations/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/integrations/zapier", "/integrations/zapier", "integration", "integration:/integrations/*", "homepage-link", ["homepage-link"]),
        // Customer stories
        makeCandidate("https://example.com/customers/acme", "/customers/acme", "customer-story", "customer-story:/customers/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/customers/wayne", "/customers/wayne", "customer-story", "customer-story:/customers/*", "homepage-link", ["homepage-link"]),
        // Blog articles (many)
        makeCandidate("https://example.com/blog/post-1", "/blog/post-1", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/blog/post-2", "/blog/post-2", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/blog/post-3", "/blog/post-3", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/blog/post-4", "/blog/post-4", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
        makeCandidate("https://example.com/blog/post-5", "/blog/post-5", "blog-article", "blog-article:/blog/*", "homepage-link", ["homepage-link"]),
        // Legal
        makeCandidate("https://example.com/privacy", "/privacy", "legal", "legal:/privacy", "footer", ["footer"]),
        makeCandidate("https://example.com/terms", "/terms", "legal", "legal:/terms", "footer", ["footer"]),
        // Utility
        makeCandidate("https://example.com/login", "/login", "utility", "utility:/login", "footer", ["footer"]),
        makeCandidate("https://example.com/signup", "/signup", "utility", "utility:/signup", "footer", ["footer"]),
        // Support on different subdomain
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
    let passed = 0;
    let failed = 0;
    function check(ok) {
        if (ok)
            passed++;
        else
            failed++;
    }
    // Budget respected
    check(assertEqual(result.recommended.length, 10, "recommended count equals page budget"));
    // Mixed page types
    const types = result.recommended.map((r) => r.pageType);
    check(assertTrue(types.includes("homepage"), "homepage is recommended"));
    check(assertTrue(types.includes("product-detail"), "product-detail is recommended"));
    check(assertTrue(types.includes("feature-detail"), "feature-detail is recommended"));
    check(assertTrue(types.includes("integration"), "integration is recommended"));
    // Seed URL always included
    const seedUrls = result.recommended.filter((r) => r.reasons.includes("seed-url"));
    check(assertTrue(seedUrls.length > 0, "seed URLs are included in recommendations"));
    // Blog capped at 1
    const blogCount = types.filter((t) => t === "blog-article").length;
    check(assertTrue(blogCount <= 1, "blog articles capped at 1"));
    // Legal excluded
    const legalCount = types.filter((t) => t === "legal").length;
    check(assertEqual(legalCount, 0, "legal pages excluded"));
    // Utility excluded
    const utilityCount = types.filter((t) => t === "utility").length;
    check(assertEqual(utilityCount, 0, "utility pages excluded"));
    // Support subdomain excluded when includeSupport=false
    const supportCount = result.recommended.filter((r) => r.host === "support.example.com").length;
    check(assertEqual(supportCount, 0, "support subdomain excluded by default"));
    // Product and feature detail have multiple representatives (2-4 range)
    const productCount = types.filter((t) => t === "product-detail").length;
    const featureCount = types.filter((t) => t === "feature-detail").length;
    check(assertTrue(productCount >= 2, "product-detail has at least 2 representatives"));
    check(assertTrue(featureCount >= 2, "feature-detail has at least 2 representatives"));
    // Summary correct
    check(assertTrue(result.summary.totalCandidates > 0, "summary totalCandidates > 0"));
    check(assertEqual(result.summary.recommendedCount, 10, "summary recommendedCount matches"));
    process.stdout.write(`\nResults: ${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
}
main();
