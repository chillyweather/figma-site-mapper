import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { elements, pages } from "../../schema.js";
import { analyzeComponentClusters } from "./componentClustering.js";
import { analyzeInconsistencies } from "./inconsistencyAnalysis.js";
import { analyzeTokenCandidates } from "./tokenMining.js";
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
    return {
        ...data,
        tokens,
        clusters,
        inconsistencies,
    };
}
export async function getInventoryOverview(projectId) {
    const { pages: projectPages, elements: projectElements, tokens, clusters, inconsistencies } = await analyzeProject(projectId);
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
    };
}
export async function getInventoryTokens(projectId) {
    const { tokens } = await analyzeProject(projectId);
    return { projectId, tokens };
}
export async function getInventoryClusters(projectId) {
    const { clusters } = await analyzeProject(projectId);
    return { projectId, clusters };
}
export async function getInventoryInconsistencies(projectId) {
    const { inconsistencies } = await analyzeProject(projectId);
    return { projectId, inconsistencies };
}
