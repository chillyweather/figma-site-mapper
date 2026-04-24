import path from "path";
import { writeJson } from "./paths.js";
import { WORKSPACE_SCHEMA_VERSION, type WorkspaceData } from "./types.js";

export async function writeWorkspaceMeta(
  workspacePath: string,
  data: WorkspaceData,
  generatedAt: string,
  extra?: { inventoryBuildId?: string; crawlRunId?: string }
): Promise<void> {
  await writeJson(path.join(workspacePath, ".workspace-meta.json"), {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    lastBuiltAt: generatedAt,
    projectId: data.project.id,
    inventoryBuildId: extra?.inventoryBuildId ?? null,
    crawlRunId: extra?.crawlRunId ?? null,
    sourceDbRowVersions: {
      pageIds: data.pages.map((page) => page.id),
      elementCount: data.elements.length,
      latestPageUpdatedAt:
        data.pages
          .map((page) => page.lastCrawledAt?.toISOString() ?? null)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
    },
  });
}

export async function readWorkspaceMeta(
  workspacePath: string
): Promise<Record<string, unknown> | null> {
  const fs = await import("fs");
  const filePath = path.join(workspacePath, ".workspace-meta.json");
  const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

