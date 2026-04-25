import fs from "fs";
import path from "path";
import { defaultWorkspacePath } from "../workspace/paths.js";
import { readDecisionFiles } from "../workspace/decisions.js";
import { readWorkspaceMeta } from "../workspace/meta.js";
import { getLatestCompletedCrawlRun } from "../workspace/index.js";
async function readJsonFile(filePath, fallback) {
    const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
    if (!content)
        return fallback;
    try {
        return JSON.parse(content);
    }
    catch {
        return fallback;
    }
}
function workspaceAssetUrl(baseUrl, projectId, relativePath) {
    if (!relativePath || relativePath.includes("undefined"))
        return null;
    return `${baseUrl}/workspace/${encodeURIComponent(projectId)}/${relativePath
        .split(path.sep)
        .map((part) => encodeURIComponent(part))
        .join("/")}`;
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function asArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => Boolean(item) && typeof item === "object")
        : [];
}
function textValue(value, fallback = "") {
    return typeof value === "string" && value.trim() ? value : fallback;
}
function arrayText(value, limit = 6) {
    if (!Array.isArray(value))
        return "";
    return value
        .map((item) => String(item))
        .filter(Boolean)
        .slice(0, limit)
        .join(", ");
}
function normalizeRelativeWorkspacePath(...parts) {
    return path.posix.normalize(parts.filter(Boolean).join("/")).replace(/^(\.\.\/)+/, "");
}
export async function buildInventoryRenderModel(projectId, baseUrl) {
    const workspacePath = defaultWorkspacePath(projectId);
    const decisions = await readDecisionFiles(workspacePath);
    const meta = await readWorkspaceMeta(workspacePath);
    const latestCrawlRun = getLatestCompletedCrawlRun(projectId);
    const workspaceCrawlRunId = meta && typeof meta.crawlRunId === "string" ? meta.crawlRunId : null;
    const latestCrawlRunId = latestCrawlRun ? String(latestCrawlRun.id) : null;
    const isWorkspaceStale = Boolean(meta) && latestCrawlRunId !== null && workspaceCrawlRunId !== latestCrawlRunId;
    // Load catalog groups and elements for enrichment
    const groupsByFingerprint = new Map();
    const elementsById = new Map();
    const catalogPath = path.join(workspacePath, "catalog");
    const entries = await fs.promises.readdir(catalogPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const categoryFolder = entry.name;
        const groups = await readJsonFile(path.join(catalogPath, categoryFolder, "groups.json"), []);
        for (const group of groups) {
            const fingerprint = typeof group.fingerprint === "string" ? group.fingerprint : null;
            if (!fingerprint)
                continue;
            groupsByFingerprint.set(fingerprint, { ...group, categoryFolder });
        }
    }
    const pagesPath = path.join(workspacePath, "pages");
    const pageEntries = await fs.promises.readdir(pagesPath, { withFileTypes: true }).catch(() => []);
    for (const entry of pageEntries) {
        if (!entry.isDirectory())
            continue;
        const pageElements = await readJsonFile(path.join(pagesPath, entry.name, "elements.json"), []);
        for (const element of pageElements) {
            const id = typeof element.id === "string" ? element.id : null;
            if (id)
                elementsById.set(id, { ...element, pageId: entry.name });
        }
    }
    // Build cluster examples
    const clustersRecord = asRecord(decisions.clusters);
    const clusters = asArray(clustersRecord.clusters);
    const clusterExamples = new Map();
    for (const cluster of clusters) {
        const clusterId = textValue(cluster.id);
        if (!clusterId)
            continue;
        const examples = [];
        const fingerprints = Array.isArray(cluster.memberFingerprints)
            ? cluster.memberFingerprints.filter((value) => typeof value === "string")
            : [];
        for (const fingerprint of fingerprints) {
            const group = groupsByFingerprint.get(fingerprint);
            if (!group)
                continue;
            const categoryFolder = typeof group.categoryFolder === "string" ? group.categoryFolder : "";
            const cropPath = typeof group.cropPath === "string" ? group.cropPath : undefined;
            const cropContextPath = typeof group.cropContextPath === "string" ? group.cropContextPath : undefined;
            const exemplarElementId = typeof group.exemplarElementId === "string"
                ? group.exemplarElementId
                : Array.isArray(group.elementIds) && typeof group.elementIds[0] === "string"
                    ? group.elementIds[0]
                    : null;
            const exemplarElement = exemplarElementId ? elementsById.get(exemplarElementId) : null;
            const cropUrl = cropPath
                ? workspaceAssetUrl(baseUrl, projectId, `catalog/${categoryFolder}/${cropPath}`)
                : null;
            const cropContextUrl = cropContextPath
                ? workspaceAssetUrl(baseUrl, projectId, `catalog/${categoryFolder}/${cropContextPath}`)
                : null;
            examples.push({
                fingerprint,
                shortFingerprint: fingerprint.slice(0, 18),
                instanceCount: typeof group.instanceCount === "number" ? group.instanceCount : 0,
                pageCount: typeof group.pageCount === "number" ? group.pageCount : 0,
                textSamples: Array.isArray(group.textSamples) ? group.textSamples.slice(0, 3) : [],
                elementId: exemplarElementId,
                pageId: exemplarElement && typeof exemplarElement.pageId === "string"
                    ? exemplarElement.pageId
                    : null,
                bbox: Array.isArray(exemplarElement?.bbox) ? exemplarElement.bbox : null,
                cropUrl,
                cropContextUrl,
            });
            if (examples.length >= 3)
                break;
        }
        if (examples.length === 0 && Array.isArray(cluster.representativeElementIds)) {
            for (const elementId of cluster.representativeElementIds) {
                if (typeof elementId !== "string")
                    continue;
                const element = elementsById.get(elementId);
                if (!element)
                    continue;
                const pageId = typeof element.pageId === "string" ? element.pageId : null;
                const fingerprint = typeof element.fingerprint === "string"
                    ? element.fingerprint
                    : typeof element.componentFingerprint === "string"
                        ? element.componentFingerprint
                        : `element:${elementId}`;
                const rawCrop = typeof element.crop === "string" ? element.crop : undefined;
                const rawCropContext = typeof element.cropContext === "string" ? element.cropContext : undefined;
                const cropUrl = pageId && rawCrop
                    ? workspaceAssetUrl(baseUrl, projectId, normalizeRelativeWorkspacePath("pages", pageId, rawCrop))
                    : null;
                const cropContextUrl = pageId && rawCropContext
                    ? workspaceAssetUrl(baseUrl, projectId, normalizeRelativeWorkspacePath("pages", pageId, rawCropContext))
                    : null;
                examples.push({
                    fingerprint,
                    shortFingerprint: fingerprint.slice(0, 18),
                    instanceCount: 1,
                    pageCount: pageId ? 1 : 0,
                    textSamples: typeof element.text === "string" && element.text.trim()
                        ? [element.text.trim().slice(0, 120)]
                        : [],
                    elementId,
                    pageId,
                    bbox: Array.isArray(element.bbox) ? element.bbox : null,
                    cropUrl,
                    cropContextUrl,
                });
                if (examples.length >= 3)
                    break;
            }
        }
        clusterExamples.set(clusterId, examples);
    }
    // Build boards
    const boards = [];
    // Components board
    const componentCards = [];
    for (const cluster of clusters) {
        const clusterId = textValue(cluster.id);
        const examples = clusterId ? clusterExamples.get(clusterId) ?? [] : [];
        const assets = [];
        for (const example of examples) {
            if (example.cropContextUrl) {
                assets.push({ kind: "image", url: example.cropContextUrl, label: example.shortFingerprint });
            }
            else if (example.cropUrl) {
                assets.push({ kind: "image", url: example.cropUrl, label: example.shortFingerprint });
            }
        }
        const links = [];
        const firstWithSample = examples.find((e) => e.pageId && e.elementId && e.bbox);
        if (firstWithSample) {
            links.push({
                label: "View sample",
                target: {
                    kind: "sample",
                    pageId: firstWithSample.pageId,
                    elementId: firstWithSample.elementId,
                    bbox: firstWithSample.bbox,
                },
            });
        }
        componentCards.push({
            id: clusterId || "unknown",
            title: textValue(cluster.name, clusterId || "Unnamed cluster"),
            subtitle: clusterId || undefined,
            badges: [textValue(cluster.category, "-"), textValue(cluster.confidence, "-")].filter(Boolean),
            body: [
                `Members: ${Array.isArray(cluster.memberFingerprints) ? cluster.memberFingerprints.length : 0}`,
                examples.length > 0
                    ? `Examples: ${examples.map((e) => `${e.instanceCount}x`).join(" / ")}`
                    : "",
                textValue(cluster.notes),
            ].filter(Boolean),
            assets,
            links,
        });
    }
    if (componentCards.length > 0) {
        boards.push({
            id: "components",
            title: "Components",
            sections: [
                {
                    id: "component-clusters",
                    title: `${componentCards.length} agent-defined clusters`,
                    kind: "components",
                    cards: componentCards,
                },
            ],
        });
    }
    // Tokens board
    const tokenRecord = asRecord(decisions.tokens);
    const tokenCards = [];
    for (const token of asArray(tokenRecord.colors)) {
        const value = textValue(token.value);
        const assets = [];
        if (value) {
            assets.push({ kind: "color", color: value, label: value });
        }
        tokenCards.push({
            id: textValue(token.name, value) || "unknown",
            title: textValue(token.name, value) || "Unnamed token",
            subtitle: value || undefined,
            badges: ["color"],
            body: [textValue(token.usage)].filter(Boolean),
            assets,
            links: [],
        });
    }
    for (const key of ["typography", "spacing", "radii", "shadows"]) {
        const tokens = asArray(tokenRecord[key]);
        for (const token of tokens) {
            tokenCards.push({
                id: textValue(token.name, "unknown"),
                title: textValue(token.name, "Unnamed token"),
                subtitle: textValue(token.value) || undefined,
                badges: [key],
                body: [textValue(token.usage)].filter(Boolean),
                assets: [],
                links: [],
            });
        }
    }
    if (tokenCards.length > 0) {
        boards.push({
            id: "tokens",
            title: "Tokens",
            sections: [
                {
                    id: "tokens",
                    title: `${tokenCards.length} accepted tokens`,
                    kind: "tokens",
                    cards: tokenCards,
                },
            ],
        });
    }
    // Issues board
    const issues = asArray(asRecord(decisions.inconsistencies).issues);
    const issueCards = [];
    for (const issue of issues) {
        const severity = textValue(issue.severity, "review");
        issueCards.push({
            id: textValue(issue.id, "unknown"),
            title: textValue(issue.id, "Issue"),
            subtitle: severity,
            badges: [severity],
            body: [
                textValue(issue.description, textValue(issue.summary)),
                `Recommendation: ${textValue(issue.recommendation, "-")}`,
            ].filter(Boolean),
            assets: [],
            links: [],
        });
    }
    if (issueCards.length > 0) {
        boards.push({
            id: "issues",
            title: "Inconsistencies",
            sections: [
                {
                    id: "issues",
                    title: `${issueCards.length} review items`,
                    kind: "issues",
                    cards: issueCards,
                },
            ],
        });
    }
    // Templates board
    const templates = asArray(asRecord(decisions.templates).templates);
    const templateCards = [];
    for (const template of templates) {
        templateCards.push({
            id: textValue(template.id, "unknown"),
            title: textValue(template.name, textValue(template.id, "Template")),
            subtitle: textValue(template.id) || undefined,
            badges: [],
            body: [
                `Pages: ${arrayText(template.pageIds) || "-"}`,
                `Regions: ${arrayText(template.regions) || "-"}`,
                textValue(template.notes),
            ].filter(Boolean),
            assets: [],
            links: [],
        });
    }
    if (templateCards.length > 0) {
        boards.push({
            id: "templates",
            title: "Templates",
            sections: [
                {
                    id: "templates",
                    title: `${templateCards.length} page and section patterns`,
                    kind: "templates",
                    cards: templateCards,
                },
            ],
        });
    }
    // Notes board
    const notes = typeof decisions.notes === "string" ? decisions.notes : "";
    boards.push({
        id: "notes",
        title: "Notes",
        sections: [
            {
                id: "notes",
                title: "Agent-written summary and caveats",
                kind: "notes",
                cards: [
                    {
                        id: "notes",
                        title: "Notes",
                        badges: [],
                        body: [notes || "No notes written."],
                        assets: [],
                        links: [],
                    },
                ],
            },
        ],
    });
    return {
        projectId,
        hasWorkspace: Boolean(meta),
        build: {
            inventoryBuildId: meta && typeof meta.inventoryBuildId === "string" ? meta.inventoryBuildId : null,
            crawlRunId: workspaceCrawlRunId,
            isWorkspaceStale,
        },
        boards,
    };
}
