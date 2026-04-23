import type {
  InventoryCluster,
  InventoryInconsistency,
  InventoryTokenCandidate,
} from "./types.js";

function sharedSignatureFields(a: Record<string, string>, b: Record<string, string>): number {
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  if (keys.length === 0) return 0;

  let matches = 0;
  for (const key of keys) {
    const left = a[key];
    const right = b[key];
    if (left && right && left === right) {
      matches += 1;
    }
  }

  return matches / keys.length;
}

export function analyzeInconsistencies(
  tokens: InventoryTokenCandidate[],
  clusters: InventoryCluster[]
): InventoryInconsistency[] {
  const inconsistencies: InventoryInconsistency[] = [];

  const largeClusters = clusters.filter((cluster) => cluster.instanceCount >= 2);
  for (let i = 0; i < largeClusters.length; i++) {
    for (let j = i + 1; j < largeClusters.length; j++) {
      const left = largeClusters[i]!;
      const right = largeClusters[j]!;
      if (left.category !== right.category) continue;

      const similarity = sharedSignatureFields(left.signature, right.signature);
      if (similarity < 0.65) continue;

      const impactScore = Number(
        (similarity * (left.instanceCount + right.instanceCount) * 0.5).toFixed(2)
      );

      inconsistencies.push({
        inconsistencyId: `dup-${left.clusterId}-${right.clusterId}`,
        type: "near-duplicate-clusters",
        category: left.category,
        summary: `${left.label} and ${right.label} look similar enough to review for merge`,
        impactScore,
        exampleElementIds: [
          ...left.exampleElementIds.slice(0, 2),
          ...right.exampleElementIds.slice(0, 2),
        ],
        clusterIds: [left.clusterId, right.clusterId],
        pageIds: Array.from(new Set([...left.pageIds, ...right.pageIds])).slice(0, 10),
      });
    }
  }

  for (const cluster of largeClusters) {
    if (cluster.instanceCount >= 6 && cluster.pageCount === 1) {
      inconsistencies.push({
        inconsistencyId: `outlier-${cluster.clusterId}`,
        type: "cluster-outlier",
        category: cluster.category,
        summary: `${cluster.label} appears repeatedly but only on one page, which may indicate a local variant or one-off pattern`,
        impactScore: Number((cluster.instanceCount * 0.75).toFixed(2)),
        exampleElementIds: cluster.exampleElementIds,
        clusterIds: [cluster.clusterId],
        pageIds: cluster.pageIds,
      });
    }
  }

  for (const token of tokens) {
    if (!token.tokenBacked && token.usageCount >= 6 && token.pageCount >= 2) {
      inconsistencies.push({
        inconsistencyId: `token-${token.candidateId}`,
        type: "untokenized-frequent-value",
        category: "token",
        summary: `${token.value} is used frequently for ${token.property} but is not backed by a token`,
        impactScore: Number((token.usageCount * 0.6 + token.pageCount).toFixed(2)),
        exampleElementIds: [],
        clusterIds: [],
        pageIds: [],
      });
    }
  }

  return inconsistencies.sort((a, b) => {
    if (b.impactScore !== a.impactScore) {
      return b.impactScore - a.impactScore;
    }
    return a.inconsistencyId.localeCompare(b.inconsistencyId);
  });
}
