const TRACKING_PARAM_NAMES = new Set([
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
]);
function isTrackingParam(key) {
    const normalized = key.toLowerCase();
    return normalized.startsWith("utm_") || TRACKING_PARAM_NAMES.has(normalized);
}
export function normalizeUrl(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("mailto:") ||
        lower.startsWith("tel:") ||
        lower.startsWith("javascript:")) {
        return null;
    }
    let url;
    try {
        url = new URL(trimmed);
    }
    catch {
        return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
    }
    const hostname = url.hostname.toLowerCase();
    const host = url.port ? `${hostname}:${url.port}` : hostname;
    // Remove hash
    url.hash = "";
    const params = url.searchParams;
    for (const key of Array.from(params.keys())) {
        if (isTrackingParam(key)) {
            params.delete(key);
        }
    }
    // Sort remaining params alphabetically for stability
    const remaining = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const search = remaining.length > 0
        ? "?" +
            remaining
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join("&")
        : "";
    // Path normalization
    let pathname = url.pathname;
    // Collapse multiple slashes
    pathname = pathname.replace(/\/{2,}/g, "/");
    // Remove trailing slash unless it's the root
    if (pathname.length > 1 && pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
    }
    const normalizedUrlStr = `${url.protocol}//${host}${pathname}${search}`;
    return {
        url: normalizedUrlStr,
        host,
        path: pathname,
    };
}
