import fs from "fs";
import path from "path";
import { writeJson } from "./paths.js";

const DECISION_FILES = [
  "clusters.json",
  "tokens.json",
  "inconsistencies.json",
  "templates.json",
  "notes.md",
];

export async function ensureDecisionScaffold(workspacePath: string): Promise<void> {
  const decisionsDir = path.join(workspacePath, "decisions");
  await fs.promises.mkdir(decisionsDir, { recursive: true });

  for (const file of DECISION_FILES) {
    const filePath = path.join(decisionsDir, file);
    const exists = await fs.promises.stat(filePath).then(() => true).catch(() => false);
    if (exists) continue;

    if (file.endsWith(".md")) {
      await fs.promises.writeFile(filePath, "# Inventory Notes\n\n", "utf8");
    } else {
      await writeJson(filePath, {});
    }
  }
}

export async function readDecisionFiles(workspacePath: string): Promise<Record<string, unknown>> {
  const decisionsDir = path.join(workspacePath, "decisions");
  const result: Record<string, unknown> = {};

  for (const file of DECISION_FILES) {
    const filePath = path.join(decisionsDir, file);
    const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
    if (content === null) continue;
    const key = file.replace(/\.(json|md)$/, "");
    if (file.endsWith(".json")) {
      try {
        result[key] = JSON.parse(content) as unknown;
      } catch {
        result[key] = null;
      }
    } else {
      result[key] = content;
    }
  }

  return result;
}

export async function decisionSummary(workspacePath: string): Promise<Record<string, number | boolean>> {
  const decisions = await readDecisionFiles(workspacePath);
  const clusters = decisions.clusters as { clusters?: unknown[] } | undefined;
  const tokens = decisions.tokens as Record<string, unknown[]> | undefined;
  const inconsistencies = decisions.inconsistencies as { issues?: unknown[] } | undefined;
  const templates = decisions.templates as { templates?: unknown[] } | undefined;
  const notes = typeof decisions.notes === "string" ? decisions.notes : "";

  const clusterCount = Array.isArray(clusters?.clusters) ? clusters.clusters.length : 0;
  const tokenCount = tokens
    ? Object.values(tokens).reduce(
        (count, value) => count + (Array.isArray(value) ? value.length : 0),
        0
      )
    : 0;
  const inconsistencyCount = Array.isArray(inconsistencies?.issues)
    ? inconsistencies.issues.length
    : 0;
  const templateCount = Array.isArray(templates?.templates) ? templates.templates.length : 0;
  const hasMeaningfulNotes = notes.replace(/^# Inventory Notes\s*/i, "").trim().length > 0;

  return {
    hasDecisions:
      clusterCount + tokenCount + inconsistencyCount + templateCount > 0 || hasMeaningfulNotes,
    clusterCount,
    tokenCount,
    inconsistencyCount,
    templateCount,
  };
}
