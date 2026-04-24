import { db } from "../db.js";
import { pages, elements } from "../schema.js";
import { eq, and, inArray } from "drizzle-orm";
function isValidId(id) {
    if (!id || typeof id !== "string")
        return false;
    const n = parseInt(id, 10);
    return !isNaN(n) && n > 0 && String(n) === id;
}
function serializePage(row) {
    return {
        _id: String(row.id),
        id: row.id,
        projectId: String(row.projectId),
        url: row.url,
        title: row.title,
        screenshotPaths: JSON.parse(row.screenshotPaths),
        annotatedScreenshotPath: row.annotatedScreenshotPath ?? null,
        interactiveElements: JSON.parse(row.interactiveElements),
        globalStyles: row.globalStyles ? JSON.parse(row.globalStyles) : null,
        lastCrawledAt: row.lastCrawledAt?.toISOString() ?? null,
        lastCrawlJobId: row.lastCrawlJobId ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
function serializeElement(row) {
    return {
        _id: String(row.id),
        id: row.id,
        pageId: String(row.pageId),
        projectId: String(row.projectId),
        type: row.type,
        selector: row.selector ?? undefined,
        tagName: row.tagName ?? undefined,
        elementId: row.elementId ?? undefined,
        classes: JSON.parse(row.classes),
        bbox: row.bbox ? JSON.parse(row.bbox) : undefined,
        href: row.href ?? undefined,
        text: row.text ?? undefined,
        styles: JSON.parse(row.styles),
        styleTokens: JSON.parse(row.styleTokens),
        ariaLabel: row.ariaLabel ?? undefined,
        role: row.role ?? undefined,
        parentTag: row.parentTag ?? undefined,
        parentSelector: row.parentSelector ?? undefined,
        ancestryPath: row.ancestryPath ?? undefined,
        nearestInteractiveSelector: row.nearestInteractiveSelector ?? undefined,
        isVisible: row.isVisible ?? undefined,
        regionLabel: row.regionLabel ?? undefined,
        styleSignature: row.styleSignature ?? undefined,
        componentFingerprint: row.componentFingerprint ?? undefined,
        parentFingerprint: row.parentFingerprint ?? undefined,
        childCount: row.childCount ?? undefined,
        cropPath: row.cropPath ?? undefined,
        cropContextPath: row.cropContextPath ?? undefined,
        cropError: row.cropError ?? undefined,
        isGlobalChrome: row.isGlobalChrome ?? undefined,
        value: row.value ?? undefined,
        placeholder: row.placeholder ?? undefined,
        checked: row.checked ?? undefined,
        src: row.src ?? undefined,
        alt: row.alt ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
export async function buildManifestForPageIds(projectId, pageIds) {
    if (!isValidId(projectId)) {
        throw new Error("Invalid projectId supplied to buildManifestForPageIds");
    }
    const validIds = pageIds.filter(isValidId).map((id) => parseInt(id, 10));
    const uniqueIds = [...new Set(validIds)];
    if (uniqueIds.length === 0) {
        return { pages: [], elements: [] };
    }
    const projectNumId = parseInt(projectId, 10);
    const pageRows = db
        .select()
        .from(pages)
        .where(and(eq(pages.projectId, projectNumId), inArray(pages.id, uniqueIds)))
        .all();
    if (pageRows.length === 0) {
        return { pages: [], elements: [] };
    }
    // Preserve the order of the requested IDs
    const pageIdOrder = new Map(uniqueIds.map((id, i) => [id, i]));
    const sortedPages = pageRows
        .slice()
        .sort((a, b) => (pageIdOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (pageIdOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    const foundPageIds = sortedPages.map((p) => p.id);
    const elementRows = db
        .select()
        .from(elements)
        .where(and(eq(elements.projectId, projectNumId), inArray(elements.pageId, foundPageIds)))
        .all();
    return {
        pages: sortedPages.map(serializePage),
        elements: elementRows.map(serializeElement),
    };
}
export { serializePage, serializeElement };
