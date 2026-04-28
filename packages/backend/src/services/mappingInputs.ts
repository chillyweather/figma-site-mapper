import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { projectMappingInputs } from "../schema.js";

export interface MappingInputsPayload {
  projectId: string;
  repoPath: string;
  branchName: string;
  storybookUrl: string;
  storybookPath: string;
  uiLibrary: string;
  tokenSources: string[];
  notes: string;
}

interface MappingInputsBody {
  repoPath?: unknown;
  branchName?: unknown;
  storybookUrl?: unknown;
  storybookPath?: unknown;
  uiLibrary?: unknown;
  tokenSources?: unknown;
  notes?: unknown;
}

function toId(projectId: string): number {
  return parseInt(projectId, 10);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTokenSources(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function normalizeMappingInputs(
  projectId: string,
  input: MappingInputsBody
): MappingInputsPayload {
  const repoPath = asTrimmedString(input.repoPath);
  const branchName = asTrimmedString(input.branchName);
  const storybookUrl = asTrimmedString(input.storybookUrl);
  const storybookPath = asTrimmedString(input.storybookPath);
  const uiLibrary = asTrimmedString(input.uiLibrary);
  const tokenSources = normalizeTokenSources(input.tokenSources);
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";

  if (repoPath && !branchName) {
    throw new Error("branchName is required when repoPath is set");
  }

  return {
    projectId,
    repoPath,
    branchName,
    storybookUrl,
    storybookPath,
    uiLibrary,
    tokenSources,
    notes,
  };
}

export function getMappingInputs(projectId: string): MappingInputsPayload {
  const row = db
    .select()
    .from(projectMappingInputs)
    .where(eq(projectMappingInputs.projectId, toId(projectId)))
    .get();

  if (!row) {
    return {
      projectId,
      repoPath: "",
      branchName: "",
      storybookUrl: "",
      storybookPath: "",
      uiLibrary: "",
      tokenSources: [],
      notes: "",
    };
  }

  let tokenSources: string[] = [];
  try {
    const parsed = JSON.parse(row.tokenSourcesJson) as unknown;
    tokenSources = normalizeTokenSources(parsed);
  } catch {
    tokenSources = [];
  }

  return {
    projectId,
    repoPath: row.repoPath ?? "",
    branchName: row.branchName ?? "",
    storybookUrl: row.storybookUrl ?? "",
    storybookPath: row.storybookPath ?? "",
    uiLibrary: row.uiLibrary ?? "",
    tokenSources,
    notes: row.notes ?? "",
  };
}

export function saveMappingInputs(
  projectId: string,
  input: MappingInputsBody
): MappingInputsPayload {
  const normalized = normalizeMappingInputs(projectId, input);
  const now = new Date();
  const values = {
    projectId: toId(projectId),
    repoPath: normalized.repoPath || null,
    branchName: normalized.branchName || null,
    storybookUrl: normalized.storybookUrl || null,
    storybookPath: normalized.storybookPath || null,
    uiLibrary: normalized.uiLibrary || null,
    tokenSourcesJson: JSON.stringify(normalized.tokenSources),
    notes: normalized.notes,
    updatedAt: now,
  };

  const existing = db
    .select({ projectId: projectMappingInputs.projectId })
    .from(projectMappingInputs)
    .where(eq(projectMappingInputs.projectId, toId(projectId)))
    .get();

  if (existing) {
    db.update(projectMappingInputs)
      .set(values)
      .where(eq(projectMappingInputs.projectId, toId(projectId)))
      .run();
  } else {
    db.insert(projectMappingInputs).values(values).run();
  }

  return normalized;
}
