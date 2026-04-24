import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { elements, pages } from "../../schema.js";
import { analyzeComponentClusters } from "./componentClustering.js";
import { analyzeInconsistencies } from "./inconsistencyAnalysis.js";
import { analyzeRegionsAndTemplates } from "./regionDetection.js";
import { analyzeTokenCandidates, buildTokenFrequencyTable, } from "./tokenFrequencyTable.js";
function isValidId(id) {
    const parsed = parseInt(id, 10);
    return !Number.isNaN(parsed) && parsed > 0 && String(parsed) === id;
}
function parseJson(value, fallback) {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
async function loadProjectData(projectId) {
    if (!isValidId(projectId)) {
        throw new Error("Invalid projectId supplied to inventory analysis");
    }
    const projectNumId = parseInt(projectId, 10);
    const pageRows = db
        .select()
        .from(pages)
        .where(eq(pages.projectId, projectNumId))
        .all();
    const elementRows = db
        .select()
        .from(elements)
        .where(eq(elements.projectId, projectNumId))
        .all();
    return {
        pages: pageRows.map((row) => {
            const globalStyles = parseJson(row.globalStyles, {});
            return {
                id: String(row.id),
                projectId: String(row.projectId),
                url: row.url,
                title: row.title,
                cssVariables: globalStyles.cssVariables || {},
                tokens: Array.isArray(globalStyles.tokens) ? globalStyles.tokens : [],
                annotatedScreenshotPath: row.annotatedScreenshotPath ?? undefined,
            };
        }),
        elements: elementRows.map((row) => ({
            id: String(row.id),
            pageId: String(row.pageId),
            projectId: String(row.projectId),
            type: row.type,
            selector: row.selector ?? undefined,
            tagName: row.tagName ?? undefined,
            elementId: row.elementId ?? undefined,
            classes: parseJson(row.classes, []),
            bbox: parseJson(row.bbox, undefined),
            href: row.href ?? undefined,
            text: row.text ?? undefined,
            styles: parseJson(row.styles, {}),
            styleTokens: parseJson(row.styleTokens, []),
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
        })),
    };
}
async function analyzeProject(projectId) {
    const data = await loadProjectData(projectId);
    const tokens = analyzeTokenCandidates(data.pages, data.elements);
    const clusters = analyzeComponentClusters(data.elements);
    const inconsistencies = analyzeInconsistencies(tokens, clusters);
    const { regions, templates } = analyzeRegionsAndTemplates(data.pages, data.elements);
    return {
        ...data,
        tokens,
        clusters,
        inconsistencies,
        regions,
        templates,
    };
}
export async function getInventoryOverview(projectId) {
    const { pages: projectPages, elements: projectElements, tokens, clusters, inconsistencies, regions, templates, } = await analyzeProject(projectId);
    return {
        projectId,
        summary: {
            pageCount: projectPages.length,
            elementCount: projectElements.length,
            clusterCount: clusters.length,
            tokenCandidateCount: tokens.length,
            inconsistencyCount: inconsistencies.length,
        },
        topClusters: clusters.slice(0, 10),
        topTokenCandidates: tokens.slice(0, 12),
        topInconsistencies: inconsistencies.slice(0, 10),
        topRegions: regions.slice(0, 8),
        templates: templates.slice(0, 8),
    };
}
export async function getInventoryTokens(projectId) {
    const data = await loadProjectData(projectId);
    return { projectId, tokens: buildTokenFrequencyTable(data.pages, data.elements) };
}
export async function getInventoryClusters(projectId) {
    const { clusters } = await analyzeProject(projectId);
    return { projectId, clusters };
}
export async function getInventoryInconsistencies(projectId) {
    const { inconsistencies } = await analyzeProject(projectId);
    return { projectId, inconsistencies };
}
export async function getInventoryRegions(projectId) {
    const { regions, templates } = await analyzeProject(projectId);
    return { projectId, regions, templates };
}
