export function classifyPage(path) {
    // Normalize path for matching: remove trailing slashes, keep root as "/"
    const clean = path.replace(/\/+$/, "") || "/";
    // Exact matches
    if (clean === "/") {
        return { pageType: "homepage", patternKey: "homepage:/" };
    }
    if (clean === "/pricing" || clean === "/plans") {
        return { pageType: "pricing", patternKey: `pricing:${clean}` };
    }
    if (clean === "/blog" || clean === "/resources") {
        return { pageType: "blog-listing", patternKey: `blog-listing:${clean}` };
    }
    if (clean === "/login" ||
        clean === "/signup" ||
        clean === "/contact" ||
        clean === "/demo" ||
        clean === "/webinars") {
        return { pageType: "utility", patternKey: `utility:${clean}` };
    }
    // Legal — exact or known prefixes
    const legalExact = ["/privacy", "/terms", "/cookies", "/security"];
    if (legalExact.includes(clean)) {
        return { pageType: "legal", patternKey: `legal:${clean}` };
    }
    if (clean.startsWith("/privacy")) {
        return { pageType: "legal", patternKey: "legal:/privacy*" };
    }
    if (clean.startsWith("/terms")) {
        return { pageType: "legal", patternKey: "legal:/terms*" };
    }
    if (clean.startsWith("/cookies")) {
        return { pageType: "legal", patternKey: "legal:/cookies*" };
    }
    if (clean.startsWith("/security")) {
        return { pageType: "legal", patternKey: "legal:/security*" };
    }
    // Prefix-based classifications
    const segments = clean.split("/").filter(Boolean);
    if (segments[0] === "customers" ||
        segments[0] === "case-studies" ||
        segments[0] === "customer-stories") {
        const prefix = segments[0];
        const stars = segments.slice(1).map(() => "*").join("/");
        const pattern = stars ? `/${prefix}/${stars}` : `/${prefix}`;
        return { pageType: "customer-story", patternKey: `customer-story:${pattern}` };
    }
    if (segments[0] === "products") {
        const stars = segments.slice(1).map(() => "*").join("/");
        const pattern = stars ? `/products/${stars}` : "/products";
        return { pageType: "product-detail", patternKey: `product-detail:${pattern}` };
    }
    if (segments[0] === "features") {
        const stars = segments.slice(1).map(() => "*").join("/");
        const pattern = stars ? `/features/${stars}` : "/features";
        return { pageType: "feature-detail", patternKey: `feature-detail:${pattern}` };
    }
    if (segments[0] === "integrations") {
        const stars = segments.slice(1).map(() => "*").join("/");
        const pattern = stars ? `/integrations/${stars}` : "/integrations";
        return { pageType: "integration", patternKey: `integration:${pattern}` };
    }
    if (segments[0] === "blog") {
        const stars = segments.slice(1).map(() => "*").join("/");
        const pattern = stars ? `/blog/${stars}` : "/blog";
        return { pageType: "blog-article", patternKey: `blog-article:${pattern}` };
    }
    if (segments[0] === "hc" ||
        segments[0] === "docs" ||
        segments[0] === "support" ||
        segments[0] === "help") {
        const prefix = segments[0];
        const stars = segments.slice(1).map(() => "*").join("/");
        const pattern = stars ? `/${prefix}/${stars}` : `/${prefix}`;
        return { pageType: "support-doc", patternKey: `support-doc:${pattern}` };
    }
    return { pageType: "unknown", patternKey: `unknown:${clean}` };
}
