import { categorizeElement } from "./elementCategory.js";
import {
  buildClusterSignature,
  bucketDimension,
  isLikelyRenderableElement,
} from "./signatureBuilders.js";
import { getNormalizedStyle } from "./normalizeStyles.js";
import type {
  InventoryCategory,
  InventoryCluster,
  ParsedInventoryElement,
} from "./types.js";

type ClusterAccumulator = {
  category: InventoryCategory;
  signature: Record<string, string>;
  members: ParsedInventoryElement[];
  pageIds: Set<string>;
};

type VariantAxis = InventoryCluster["variantAxes"][number];

const PHASE_ONE_CATEGORIES = new Set<InventoryCategory>([
  "button",
  "link",
  "input",
  "heading",
]);

function formatCategoryLabel(category: InventoryCategory): string {
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

function computeConfidence(instanceCount: number, pageCount: number): number {
  const raw =
    0.45 + Math.min(instanceCount, 20) * 0.015 + Math.min(pageCount, 10) * 0.025;
  return Math.min(0.98, Number(raw.toFixed(2)));
}

function classifyKind(cluster: ClusterAccumulator): string {
  const background = cluster.signature.backgroundColor;
  const border = cluster.signature.borderColor;
  const transparentBackground =
    !background || background === "transparent" || background === "none";

  if (!transparentBackground) return "filled";
  if (border && border !== "transparent" && border !== "none") return "outline";
  return "text";
}

function classifySize(cluster: ClusterAccumulator): string {
  const heightValue = Number.parseInt(cluster.signature.height || "", 10);
  const fontSizeValue = Number.parseInt(cluster.signature.fontSize || "", 10);
  const score = Math.max(heightValue || 0, (fontSizeValue || 0) * 2);

  if (score <= 28) return "sm";
  if (score <= 44) return "md";
  if (score <= 60) return "lg";
  return "xl";
}

function classifyHeadingLevel(cluster: ClusterAccumulator): string {
  const fontSizeValue = Number.parseInt(cluster.signature.fontSize || "", 10);
  if (!fontSizeValue || Number.isNaN(fontSizeValue)) return "unknown";
  if (fontSizeValue >= 40) return "display";
  if (fontSizeValue >= 32) return "h1";
  if (fontSizeValue >= 24) return "h2";
  if (fontSizeValue >= 20) return "h3";
  return "h4+";
}

function pickCanonicalMember(members: ParsedInventoryElement[]): ParsedInventoryElement | undefined {
  if (members.length === 0) return undefined;

  const scored = members.slice().sort((a, b) => {
    const aCrop = a.cropPath ? 1 : 0;
    const bCrop = b.cropPath ? 1 : 0;
    if (bCrop !== aCrop) return bCrop - aCrop;

    const aText = a.text?.trim().length || 0;
    const bText = b.text?.trim().length || 0;
    const aTextScore = aText > 0 && aText <= 48 ? 1 : 0;
    const bTextScore = bText > 0 && bText <= 48 ? 1 : 0;
    if (bTextScore !== aTextScore) return bTextScore - aTextScore;

    const aArea = (a.bbox?.width || 0) * (a.bbox?.height || 0);
    const bArea = (b.bbox?.width || 0) * (b.bbox?.height || 0);
    return bArea - aArea;
  });

  return scored[0];
}

function buildFamilyKey(cluster: ClusterAccumulator): string {
  return [
    cluster.category,
    cluster.signature.parentTag || "none",
    cluster.signature.region || "content",
    cluster.signature.fontFamily || "default-font",
    cluster.signature.fontWeight || "default-weight",
    cluster.signature.borderRadius || "default-radius",
    cluster.signature.textTransform || "default-transform",
  ].join("|");
}

function inferVariantAxes(
  category: InventoryCategory,
  cluster: ClusterAccumulator,
  familyClusters: ClusterAccumulator[]
): VariantAxis[] {
  const axes: VariantAxis[] = [];

  if (category === "button" || category === "link" || category === "input") {
    const kinds = Array.from(new Set(familyClusters.map(classifyKind))).sort();
    if (kinds.length > 1) {
      axes.push({
        name: "kind",
        values: kinds,
        currentValue: classifyKind(cluster),
      });
    }

    const sizes = Array.from(new Set(familyClusters.map(classifySize))).sort();
    if (sizes.length > 1) {
      axes.push({
        name: "size",
        values: sizes,
        currentValue: classifySize(cluster),
      });
    }
  }

  if (category === "heading") {
    const levels = Array.from(new Set(familyClusters.map(classifyHeadingLevel))).filter(
      (value) => value !== "unknown"
    );
    if (levels.length > 1) {
      axes.push({
        name: "level",
        values: levels,
        currentValue: classifyHeadingLevel(cluster),
      });
    }
  }

  return axes;
}

function buildVariantHints(variantAxes: VariantAxis[]): string[] {
  return variantAxes.map((axis) => axis.name);
}

export function analyzeComponentClusters(
  elements: ParsedInventoryElement[]
): InventoryCluster[] {
  const accumulators = new Map<string, ClusterAccumulator>();

  for (const element of elements) {
    const category = categorizeElement(element);
    if (!PHASE_ONE_CATEGORIES.has(category)) continue;
    if (!isLikelyRenderableElement(element)) continue;

    const { key, summary } = buildClusterSignature(category, element);
    if (!key) continue;

    const clusterKey = `${category}|${key}`;
    if (!accumulators.has(clusterKey)) {
      accumulators.set(clusterKey, {
        category,
        signature: summary,
        members: [],
        pageIds: new Set<string>(),
      });
    }

    const acc = accumulators.get(clusterKey)!;
    acc.members.push(element);
    acc.pageIds.add(element.pageId);
  }

  const rawClusters = Array.from(accumulators.values()).filter(
    (cluster) => cluster.members.length >= 2
  );

  const familyMap = new Map<string, ClusterAccumulator[]>();
  for (const cluster of rawClusters) {
    const familyKey = buildFamilyKey(cluster);
    if (!familyMap.has(familyKey)) {
      familyMap.set(familyKey, []);
    }
    familyMap.get(familyKey)!.push(cluster);
  }

  const counters = new Map<InventoryCategory, number>();

  return rawClusters
    .sort((a, b) => {
      if (b.members.length !== a.members.length) {
        return b.members.length - a.members.length;
      }
      return a.category.localeCompare(b.category);
    })
    .map((cluster) => {
      const nextIndex = (counters.get(cluster.category) || 0) + 1;
      counters.set(cluster.category, nextIndex);

      const pageIds = Array.from(cluster.pageIds).sort();
      const instanceCount = cluster.members.length;
      const pageCount = pageIds.length;
      const familyId = buildFamilyKey(cluster)
        .toLowerCase()
        .replace(/[^a-z0-9|]+/g, "-")
        .replace(/\|/g, "_");
      const familyClusters = familyMap.get(buildFamilyKey(cluster)) || [cluster];
      const variantAxes = inferVariantAxes(cluster.category, cluster, familyClusters);
      const canonicalMember = pickCanonicalMember(cluster.members);
      const exampleMembers = cluster.members.slice(0, 5);
      const exampleCropPaths = exampleMembers
        .map((member) => member.cropPath)
        .filter((value): value is string => Boolean(value));

      return {
        clusterId: `${cluster.category}-${String(nextIndex).padStart(2, "0")}`,
        familyId,
        category: cluster.category,
        label: `${formatCategoryLabel(cluster.category)} / Candidate ${String(nextIndex).padStart(2, "0")}`,
        confidence: computeConfidence(instanceCount, pageCount),
        instanceCount,
        pageCount,
        signature: cluster.signature,
        variantHints: buildVariantHints(variantAxes),
        variantAxes,
        canonicalElementId: canonicalMember?.id,
        canonicalCropPath: canonicalMember?.cropPath,
        exampleElementIds: exampleMembers.map((member) => member.id),
        exampleCropPaths,
        memberElementIds: cluster.members.map((member) => member.id),
        pageIds,
      } satisfies InventoryCluster;
    });
}
