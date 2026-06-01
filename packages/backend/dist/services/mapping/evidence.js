import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { elements, pages } from "../../schema.js";
import { parseJson } from "../../utils/parseJson.js";
function isBbox(value) {
    if (!value || typeof value !== "object")
        return false;
    const b = value;
    return (typeof b.x === "number" &&
        typeof b.y === "number" &&
        typeof b.width === "number" &&
        typeof b.height === "number" &&
        b.width > 0 &&
        b.height > 0);
}
export function filterDomCandidates(elementRows) {
    return elementRows
        .filter((row) => {
        if (row.isVisible === false)
            return false;
        const bbox = parseJson(row.bbox, null);
        if (!isBbox(bbox))
            return false;
        const tagName = (row.tagName ?? "").toLowerCase();
        const role = (row.role ?? "").toLowerCase();
        const type = (row.type ?? "").toLowerCase();
        const isInteractive = tagName === "button" ||
            tagName === "a" ||
            tagName === "input" ||
            tagName === "select" ||
            tagName === "textarea" ||
            role === "button" ||
            role === "link" ||
            role === "tab" ||
            role === "checkbox" ||
            role === "radio" ||
            Boolean(row.href);
        const isSemanticComponent = type === "button" ||
            type === "link" ||
            type === "input" ||
            type === "select" ||
            type === "textarea" ||
            type === "image" ||
            type === "heading" ||
            type === "navigation" ||
            type === "header" ||
            type === "footer";
        const isSizedBlock = bbox.width >= 24 &&
            bbox.height >= 16 &&
            bbox.width <= 1600 &&
            bbox.height <= 1200 &&
            Boolean(row.componentFingerprint || row.ariaLabel || row.text);
        return isInteractive || isSemanticComponent || isSizedBlock;
    })
        .map((row) => {
        const bbox = parseJson(row.bbox, { x: 0, y: 0, width: 0, height: 0 });
        return {
            id: String(row.id),
            pageId: String(row.pageId),
            type: row.type ?? "unknown",
            selector: row.selector ?? undefined,
            tagName: row.tagName ?? undefined,
            elementId: row.elementId ?? undefined,
            classes: parseJson(row.classes, []),
            bbox,
            text: row.text ?? undefined,
            href: row.href ?? undefined,
            ariaLabel: row.ariaLabel ?? undefined,
            role: row.role ?? undefined,
            cropPath: row.cropPath ?? undefined,
            componentFingerprint: row.componentFingerprint ?? undefined,
        };
    });
}
export function buildPageEvidence(pageRow, candidates) {
    return {
        id: String(pageRow.id),
        url: pageRow.url,
        title: pageRow.title,
        screenshotPaths: parseJson(pageRow.screenshotPaths, []),
        viewportWidth: pageRow.viewportWidth ?? null,
        candidateCount: candidates.length,
    };
}
export async function loadProjectEvidence(projectId) {
    const projectNumId = parseInt(projectId, 10);
    const pageRows = db
        .select()
        .from(pages)
        .where(eq(pages.projectId, projectNumId))
        .all()
        .sort((a, b) => a.id - b.id);
    const elementRows = db
        .select()
        .from(elements)
        .where(eq(elements.projectId, projectNumId))
        .all();
    const allCandidates = filterDomCandidates(elementRows);
    const candidatesByPage = new Map();
    for (const c of allCandidates) {
        const arr = candidatesByPage.get(c.pageId) ?? [];
        arr.push(c);
        candidatesByPage.set(c.pageId, arr);
    }
    const evidencePages = pageRows.map((row) => buildPageEvidence(row, candidatesByPage.get(String(row.id)) ?? []));
    return { pages: evidencePages, candidates: allCandidates };
}
