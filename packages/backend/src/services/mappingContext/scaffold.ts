import path from "path";
import { getMappingInputs, type MappingInputsPayload } from "../mappingInputs.js";
import { ensureDir, writeJson } from "../workspace/paths.js";
import type { MappingContextProfile, RepoIndex, StorybookIndex } from "./types.js";
import { analyzeRepoMappingInput } from "./repoAdapter.js";
import { analyzeStorybookMappingInput } from "./storybookAdapter.js";
import { buildSuggestions } from "./suggestions.js";

function hasEvidence(inputs: MappingInputsPayload): boolean {
  return Boolean(
    inputs.repoPath ||
    inputs.branchName ||
    inputs.storybookUrl ||
    inputs.storybookPath ||
    inputs.uiLibrary ||
    inputs.tokenSources.length > 0 ||
    inputs.notes
  );
}

function toProfile(
  projectId: string,
  inputs: MappingInputsPayload,
  repo: MappingContextProfile["repo"]
): MappingContextProfile {
  return {
    projectId,
    mode: hasEvidence(inputs) ? "crawl-plus-evidence" : "crawl-only",
    sourcePriority: ["repo", "storybook", "ui-library", "tokens", "crawl"],
    repo,
    storybook: {
      enabled: Boolean(inputs.storybookUrl || inputs.storybookPath),
      url: inputs.storybookUrl || null,
      path: inputs.storybookPath || null,
      status: inputs.storybookUrl || inputs.storybookPath ? "pending" : "not-configured",
    },
    uiLibrary: {
      enabled: Boolean(inputs.uiLibrary),
      name: inputs.uiLibrary || null,
      status: inputs.uiLibrary ? "pending" : "not-configured",
    },
    tokenSources: inputs.tokenSources,
    notes: inputs.notes,
  };
}

function buildEvidence(repoIndex: RepoIndex, storybookIndex: StorybookIndex, storybookComponents: Array<Record<string, unknown>>) {
  return {
    components: storybookComponents,
    tokens: [],
    templates: [],
    inconsistencies: [],
    sources: {
      repo: {
        status: repoIndex.status,
        repoPath: repoIndex.repoPath,
        requestedBranch: repoIndex.requestedBranch,
        requestedBranchRef: repoIndex.requestedBranchRef,
        resolvedBranch: repoIndex.resolvedBranch,
        resolvedHeadRef: repoIndex.resolvedHeadRef,
        commitSha: repoIndex.commitSha,
        packageManager: repoIndex.packageManager,
        packageRoots: repoIndex.packageRoots,
        appRoots: repoIndex.appRoots,
        componentRoots: repoIndex.componentRoots,
        routeRoots: repoIndex.routeRoots,
        tokenSources: repoIndex.tokenSources,
        storybookDetected: repoIndex.storybookDetected,
        storybookRoots: repoIndex.storybookRoots,
        uiLibraryCandidates: repoIndex.uiLibraryCandidates,
        componentFileSamples: repoIndex.componentFileSamples,
        notes: repoIndex.notes,
      },
      storybook: {
        status: storybookIndex.status,
        url: storybookIndex.url,
        path: storybookIndex.path,
        detectedRoots: storybookIndex.detectedRoots,
        sourceMode: storybookIndex.sourceMode,
        storyCount: storybookIndex.storyCount,
        componentCount: storybookIndex.componentCount,
        notes: storybookIndex.notes,
      },
    },
  };
}

function logContent(
  projectId: string,
  inputs: MappingInputsPayload,
  generatedAt: string,
  repoLogLines: string[],
  storybookLogLines: string[]
): string {
  const lines = [
    "# Mapping Context Log",
    "",
    `- Project ID: ${projectId}`,
    `- Generated at: ${generatedAt}`,
    `- Mode: ${hasEvidence(inputs) ? "crawl-plus-evidence" : "crawl-only"}`,
    "",
    "## Inputs",
    "",
    `- Repo path: ${inputs.repoPath || "(not set)"}`,
    `- Branch name: ${inputs.branchName || "(not set)"}`,
    `- Storybook URL: ${inputs.storybookUrl || "(not set)"}`,
    `- Storybook path: ${inputs.storybookPath || "(not set)"}`,
    `- UI library: ${inputs.uiLibrary || "(not set)"}`,
    `- Token sources: ${inputs.tokenSources.length > 0 ? inputs.tokenSources.join(", ") : "(not set)"}`,
    "",
    "## Status",
    "",
    "- Repo adapter analysis has run and repo-derived metadata is written into `repo-index.json` and `evidence.json`.",
    "- `profile.json` reflects the saved project inputs plus resolved repo status.",
    "- Storybook adapter analysis has run when configured or repo-detected and writes `storybook-index.json` plus Storybook-derived component candidates.",
    "- UI library hints are still lightweight summaries, not full adapters.",
    "- `evidence.json` currently contains source summaries and unlinked Storybook component candidates; it does not contain curated mapping decisions yet.",
    "",
    "## Repo Adapter",
    "",
    ...repoLogLines,
    "",
    "## Storybook Adapter",
    "",
    ...storybookLogLines,
    "",
  ];

  if (inputs.notes) {
    lines.push("## Notes", "", inputs.notes, "");
  }

  return lines.join("\n");
}

export async function writeMappingContextScaffold(
  workspacePath: string,
  projectId: string,
  generatedAt: string
): Promise<void> {
  const mappingContextPath = path.join(workspacePath, "mapping-context");
  await ensureDir(mappingContextPath);

  const inputs = getMappingInputs(projectId);
  const repoResult = await analyzeRepoMappingInput(
    inputs.repoPath,
    inputs.branchName,
    generatedAt,
    inputs.tokenSources
  );
  const storybookResult = await analyzeStorybookMappingInput(
    generatedAt,
    inputs.storybookPath,
    inputs.storybookUrl,
    repoResult.repo.path ?? "",
    repoResult.repoIndex
  );
  const profile = toProfile(projectId, inputs, {
    enabled: Boolean(inputs.repoPath),
    path: repoResult.repo.path,
    requestedBranch: repoResult.repo.requestedBranch,
    resolvedBranch: repoResult.repo.resolvedBranch,
    commitSha: repoResult.repo.commitSha,
    status: repoResult.repo.status,
  });

  const suggestions = buildSuggestions(
    repoResult.repoIndex,
    storybookResult.storybookIndex,
    {
      status: profile.uiLibrary.status === "pending"
        ? "pending"
        : repoResult.repoIndex.uiLibraryCandidates.length > 0
          ? "detected-from-repo"
          : "not-configured",
      hints: repoResult.repoIndex.uiLibraryCandidates,
    },
    projectId,
    generatedAt
  );

  await Promise.all([
    writeJson(path.join(mappingContextPath, "profile.json"), profile),
    writeJson(
      path.join(mappingContextPath, "evidence.json"),
      buildEvidence(repoResult.repoIndex, storybookResult.storybookIndex, storybookResult.evidenceComponents)
    ),
    writeJson(path.join(mappingContextPath, "repo-index.json"), repoResult.repoIndex),
    writeJson(path.join(mappingContextPath, "storybook-index.json"), storybookResult.storybookIndex),
    writeJson(path.join(mappingContextPath, "library-hints.json"), {
      generatedAt,
      status: profile.uiLibrary.status === "pending"
        ? "pending"
        : repoResult.repoIndex.uiLibraryCandidates.length > 0
          ? "detected-from-repo"
          : "not-configured",
      configuredName: profile.uiLibrary.name,
      hints: repoResult.repoIndex.uiLibraryCandidates,
    }),
    writeJson(path.join(mappingContextPath, "suggestions.json"), suggestions),
  ]);

  await import("fs").then((fs) =>
    fs.promises.writeFile(
      path.join(mappingContextPath, "log.md"),
      logContent(projectId, inputs, generatedAt, repoResult.logLines, storybookResult.logLines),
      "utf8"
    )
  );
}
