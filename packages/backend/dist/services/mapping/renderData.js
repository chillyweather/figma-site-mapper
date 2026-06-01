import fs from "fs";
import path from "path";
import { mappingWorkspacePath, mappingLatestDecisionPath, mappingMetaPath, } from "./paths.js";
import { loadAndValidateDecisionFile, extractDecisionFileMetadata } from "./validator.js";
import { loadProjectEvidence } from "./evidence.js";
export function buildRenderInstance(instance, pageEvidence) {
    return {
        instanceId: instance.instanceId ?? instance.elementId ?? `${instance.pageId}:vision`,
        elementId: instance.elementId,
        pageId: instance.pageId,
        pageUrl: instance.sourceUrl ?? pageEvidence?.url ?? "",
        bbox: instance.bbox,
        source: instance.source,
        confidence: instance.confidence,
        rawLabel: instance.rawLabel,
        label: instance.label,
        notes: instance.notes,
        screenshotPaths: pageEvidence?.screenshotPaths ?? [],
        viewportWidth: pageEvidence?.viewportWidth ?? null,
    };
}
export function buildRenderComponents(decisions, pageMap) {
    return decisions.map((comp) => {
        const instances = comp.instances.map((inst) => buildRenderInstance(inst, pageMap.get(inst.pageId)));
        return {
            type: comp.type,
            instanceCount: instances.length,
            instances,
        };
    });
}
async function readFileSafe(filePath) {
    try {
        return await fs.promises.readFile(filePath, "utf8");
    }
    catch {
        return null;
    }
}
export async function getMappingOverview(projectId) {
    const metaPath = mappingMetaPath(projectId);
    const metaContent = await readFileSafe(metaPath);
    const hasMappingWorkspace = metaContent !== null;
    let lastPreparedAt = null;
    let pageCount = 0;
    let candidateCount = 0;
    if (metaContent) {
        try {
            const meta = JSON.parse(metaContent);
            lastPreparedAt = meta.generatedAt ?? null;
        }
        catch { /* ignore */ }
    }
    // Read manifest for counts
    const manifestPath = path.join(mappingWorkspacePath(projectId), "manifest.json");
    const manifestContent = await readFileSafe(manifestPath);
    if (manifestContent) {
        try {
            const manifest = JSON.parse(manifestContent);
            pageCount = manifest.pageCount ?? 0;
            candidateCount = manifest.candidateCount ?? 0;
        }
        catch { /* ignore */ }
    }
    let hasDecisions = false;
    let lastDecisionsAt = null;
    let componentTypeCount = 0;
    let instanceCount = 0;
    const latestPath = mappingLatestDecisionPath(projectId);
    const latestContent = await readFileSafe(latestPath);
    if (latestContent) {
        const meta = extractDecisionFileMetadata(tryParse(latestContent));
        lastDecisionsAt = meta.generatedAt;
        const { valid } = loadAndValidateDecisionFile(latestContent);
        if (valid.length > 0) {
            hasDecisions = true;
            componentTypeCount = valid.length;
            instanceCount = valid.reduce((sum, c) => sum + c.instances.length, 0);
        }
    }
    return {
        projectId,
        mappingWorkspaceRoot: mappingWorkspacePath(projectId),
        hasMappingWorkspace,
        hasDecisions,
        lastPreparedAt,
        lastDecisionsAt,
        pageCount,
        candidateCount,
        componentTypeCount,
        instanceCount,
    };
}
function tryParse(content) {
    try {
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export async function getMappingRenderData(projectId) {
    const overview = await getMappingOverview(projectId);
    if (!overview.hasMappingWorkspace) {
        return {
            projectId,
            hasMappingWorkspace: false,
            hasDecisions: false,
            lastPreparedAt: null,
            lastDecisionsAt: null,
            components: [],
            warnings: [],
        };
    }
    const latestPath = mappingLatestDecisionPath(projectId);
    const latestContent = await readFileSafe(latestPath);
    if (!latestContent) {
        return {
            projectId,
            hasMappingWorkspace: true,
            hasDecisions: false,
            lastPreparedAt: overview.lastPreparedAt,
            lastDecisionsAt: null,
            components: [],
            warnings: [],
        };
    }
    const { valid, warnings } = loadAndValidateDecisionFile(latestContent);
    const meta = extractDecisionFileMetadata(tryParse(latestContent));
    const { pages: pageEvidences } = await loadProjectEvidence(projectId);
    const pageMap = new Map(pageEvidences.map((p) => [p.id, p]));
    const components = buildRenderComponents(valid, pageMap);
    return {
        projectId,
        hasMappingWorkspace: true,
        hasDecisions: valid.length > 0,
        lastPreparedAt: overview.lastPreparedAt,
        lastDecisionsAt: meta.generatedAt,
        components,
        warnings,
    };
}
export async function getMappingDecisions(projectId) {
    const overview = await getMappingOverview(projectId);
    const latestPath = mappingLatestDecisionPath(projectId);
    const latestContent = await readFileSafe(latestPath);
    if (!latestContent) {
        return {
            projectId,
            hasMappingWorkspace: overview.hasMappingWorkspace,
            hasDecisions: false,
            lastDecisionsAt: null,
            components: [],
            warnings: [],
        };
    }
    const { valid, warnings } = loadAndValidateDecisionFile(latestContent);
    const meta = extractDecisionFileMetadata(tryParse(latestContent));
    return {
        projectId,
        hasMappingWorkspace: overview.hasMappingWorkspace,
        hasDecisions: valid.length > 0,
        lastDecisionsAt: meta.generatedAt,
        components: valid,
        warnings,
    };
}
