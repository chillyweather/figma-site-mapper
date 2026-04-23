import { categorizeElement } from "./elementCategory.js";
function inferTemplateLabel(url) {
    try {
        const pathname = new URL(url).pathname.toLowerCase();
        if (pathname === "/" || pathname === "")
            return "Home";
        if (/(login|sign-in|signin|sign-up|signup|register)/.test(pathname))
            return "Auth";
        if (/(checkout|cart|basket)/.test(pathname))
            return "Checkout";
        if (/(account|profile|settings|dashboard)/.test(pathname))
            return "Account";
        if (/(product|item)\//.test(pathname))
            return "Detail";
        if (/(products|catalog|search|category|categories|blog|docs|articles)/.test(pathname)) {
            return "Listing";
        }
        const segments = pathname.split("/").filter(Boolean);
        if (segments.length >= 2)
            return "Content Detail";
        return "Content";
    }
    catch {
        return "Content";
    }
}
export function analyzeRegionsAndTemplates(pages, elements) {
    const pageCount = pages.length || 1;
    const regionMap = new Map();
    for (const element of elements) {
        const regionLabel = element.regionLabel || "content";
        if (!regionMap.has(regionLabel)) {
            regionMap.set(regionLabel, {
                pageIds: new Set(),
                elementCount: 0,
                categories: new Map(),
            });
        }
        const acc = regionMap.get(regionLabel);
        const category = categorizeElement(element);
        acc.pageIds.add(element.pageId);
        acc.elementCount += 1;
        acc.categories.set(category, (acc.categories.get(category) || 0) + 1);
    }
    const regions = Array.from(regionMap.entries())
        .map(([regionLabel, acc]) => ({
        regionLabel,
        pageCount: acc.pageIds.size,
        elementCount: acc.elementCount,
        prevalence: Number((acc.pageIds.size / pageCount).toFixed(2)),
        topCategories: Array.from(acc.categories.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([category]) => category),
    }))
        .filter((region) => region.pageCount >= 2)
        .sort((a, b) => {
        if (b.prevalence !== a.prevalence)
            return b.prevalence - a.prevalence;
        if (b.elementCount !== a.elementCount)
            return b.elementCount - a.elementCount;
        return a.regionLabel.localeCompare(b.regionLabel);
    });
    const templateMap = new Map();
    for (const page of pages) {
        const label = inferTemplateLabel(page.url);
        if (!templateMap.has(label)) {
            templateMap.set(label, { pageIds: [], sampleUrls: [] });
        }
        const acc = templateMap.get(label);
        acc.pageIds.push(page.id);
        if (acc.sampleUrls.length < 3) {
            acc.sampleUrls.push(page.url);
        }
    }
    const templates = Array.from(templateMap.entries())
        .map(([label, acc]) => ({
        templateId: label.toLowerCase().replace(/\s+/g, "-"),
        label,
        pageCount: acc.pageIds.length,
        pageIds: acc.pageIds,
        sampleUrls: acc.sampleUrls,
    }))
        .sort((a, b) => {
        if (b.pageCount !== a.pageCount)
            return b.pageCount - a.pageCount;
        return a.label.localeCompare(b.label);
    });
    return { regions, templates };
}
