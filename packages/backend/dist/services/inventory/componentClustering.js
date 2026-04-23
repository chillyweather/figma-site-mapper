import { categorizeElement } from "./elementCategory.js";
import { buildClusterSignature, isLikelyRenderableElement } from "./signatureBuilders.js";
const PHASE_ONE_CATEGORIES = new Set([
    "button",
    "link",
    "input",
    "heading",
]);
function formatCategoryLabel(category) {
    switch (category) {
        case "button":
            return "Button";
        case "link":
            return "Link";
        case "input":
            return "Input";
        case "select":
            return "Select";
        case "textarea":
            return "Textarea";
        case "heading":
            return "Heading";
        case "image":
            return "Image";
        case "text-block":
            return "Text Block";
        default:
            return "Other";
    }
}
function computeConfidence(instanceCount, pageCount) {
    const raw = 0.45 + Math.min(instanceCount, 20) * 0.015 + Math.min(pageCount, 10) * 0.025;
    return Math.min(0.98, Number(raw.toFixed(2)));
}
function getVariantHints(category, signature) {
    const hints = new Set();
    if (category === "button" || category === "link") {
        if (signature.backgroundColor || signature.borderColor)
            hints.add("kind");
        if (signature.width !== "unknown" || signature.height !== "unknown")
            hints.add("size");
    }
    if (category === "input") {
        if (signature.width !== "unknown" || signature.height !== "unknown")
            hints.add("size");
    }
    if (category === "heading" && signature.fontSize) {
        hints.add("level");
    }
    return Array.from(hints);
}
export function analyzeComponentClusters(elements) {
    const accumulators = new Map();
    for (const element of elements) {
        const category = categorizeElement(element);
        if (!PHASE_ONE_CATEGORIES.has(category))
            continue;
        if (!isLikelyRenderableElement(element))
            continue;
        const { key, summary } = buildClusterSignature(category, element);
        if (!key)
            continue;
        const clusterKey = `${category}|${key}`;
        if (!accumulators.has(clusterKey)) {
            accumulators.set(clusterKey, {
                category,
                signature: summary,
                memberElementIds: [],
                pageIds: new Set(),
            });
        }
        const acc = accumulators.get(clusterKey);
        acc.memberElementIds.push(element.id);
        acc.pageIds.add(element.pageId);
    }
    const counters = new Map();
    return Array.from(accumulators.values())
        .filter((cluster) => cluster.memberElementIds.length >= 2)
        .sort((a, b) => {
        if (b.memberElementIds.length !== a.memberElementIds.length) {
            return b.memberElementIds.length - a.memberElementIds.length;
        }
        return a.category.localeCompare(b.category);
    })
        .map((cluster) => {
        const nextIndex = (counters.get(cluster.category) || 0) + 1;
        counters.set(cluster.category, nextIndex);
        const pageIds = Array.from(cluster.pageIds).sort();
        const instanceCount = cluster.memberElementIds.length;
        const pageCount = pageIds.length;
        return {
            clusterId: `${cluster.category}-${String(nextIndex).padStart(2, "0")}`,
            category: cluster.category,
            label: `${formatCategoryLabel(cluster.category)} / Candidate ${String(nextIndex).padStart(2, "0")}`,
            confidence: computeConfidence(instanceCount, pageCount),
            instanceCount,
            pageCount,
            signature: cluster.signature,
            variantHints: getVariantHints(cluster.category, cluster.signature),
            exampleElementIds: cluster.memberElementIds.slice(0, 5),
            memberElementIds: cluster.memberElementIds,
            pageIds,
        };
    });
}
