import "../logger.js";
import fs from "fs";
import path from "path";
import { InventoryClusterDecisionFileSchema } from "@sitemapper/shared";
import { defaultWorkspacePath } from "../services/workspace/paths.js";

async function readJson<T>(filePath: string): Promise<T | null> {
  const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const projectId = process.argv[2];
  const customPath = process.argv[3];

  if (!projectId) {
    process.stderr.write("Usage: pnpm --filter backend run validate:fingerprints <projectId> [workspacePath]\n");
    process.exit(1);
  }

  const workspacePath = customPath ?? defaultWorkspacePath(projectId);
  const errors: string[] = [];
  const warnings: string[] = [];

  process.stdout.write(`Validating fingerprints: ${workspacePath}\n\n`);

  // Load clusters
  const clustersPath = path.join(workspacePath, "decisions", "clusters.json");
  const clustersRaw = await readJson<unknown>(clustersPath);
  if (!clustersRaw) {
    errors.push("clusters.json missing or invalid");
    report(errors, warnings);
    return;
  }

  const clustersResult = InventoryClusterDecisionFileSchema.safeParse(clustersRaw);
  if (!clustersResult.success) {
    errors.push(`clusters.json invalid: ${clustersResult.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`);
    report(errors, warnings);
    return;
  }

  const clusters = clustersResult.data.clusters;

  // Check duplicate cluster IDs
  const clusterIds = new Map<string, number>();
  for (const cluster of clusters) {
    clusterIds.set(cluster.id, (clusterIds.get(cluster.id) ?? 0) + 1);
  }
  for (const [id, count] of clusterIds.entries()) {
    if (count > 1) errors.push(`Duplicate cluster ID: ${id} (${count} occurrences)`);
  }

  // Load catalog groups
  const catalogDir = path.join(workspacePath, "catalog");
  const folders = ["buttons", "links", "inputs", "headings", "images", "text-blocks", "other"];
  const groupsByFingerprint = new Map<string, { folder: string; exemplarElementId: string }>();

  for (const folder of folders) {
    const groups = await readJson<Array<Record<string, unknown>>>(path.join(catalogDir, folder, "groups.json"));
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      const fingerprint = typeof group.fingerprint === "string" ? group.fingerprint : null;
      const exemplarElementId = typeof group.exemplarElementId === "string" ? group.exemplarElementId : null;
      if (!fingerprint) continue;
      groupsByFingerprint.set(fingerprint, { folder, exemplarElementId: exemplarElementId ?? "" });
    }
  }

  // Validate each cluster's fingerprints
  for (const cluster of clusters) {
    for (const fingerprint of cluster.memberFingerprints) {
      const group = groupsByFingerprint.get(fingerprint);
      if (!group) {
        errors.push(`Cluster ${cluster.id}: fingerprint not found in catalog — ${fingerprint.slice(0, 40)}...`);
        continue;
      }
      if (!group.exemplarElementId) {
        warnings.push(`Cluster ${cluster.id}: fingerprint has no exemplar element — ${fingerprint.slice(0, 40)}...`);
      }
    }
  }

  report(errors, warnings);
}

function report(errors: string[], warnings: string[]): void {
  for (const error of errors) {
    process.stderr.write(`  ❌ ${error}\n`);
  }
  for (const warning of warnings) {
    process.stdout.write(`  ⚠️  ${warning}\n`);
  }

  if (errors.length === 0) {
    process.stdout.write(`  ✅ Fingerprints valid (${warnings.length} warning(s)).\n`);
    process.exit(0);
  } else {
    process.stdout.write(`\n  ${errors.length} error(s) found.\n`);
    process.exit(1);
  }
}

main();
