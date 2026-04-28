import fs from "fs";
import path from "path";
import { defaultWorkspacePath } from "../workspace/paths.js";
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
function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
function buildConciseHandoffWarnings(repo, warnings) {
    if (repo.status === "branch-mismatch") {
        return [
            `Repo evidence comes from checked-out branch ${repo.resolvedBranch ?? "(unknown)"} instead of requested branch ${repo.requestedBranch ?? "(not set)"}.`,
        ];
    }
    if (repo.status === "missing-branch") {
        return [
            `Requested branch ${repo.requestedBranch ?? "(not set)"} could not be resolved in the local repo.`,
        ];
    }
    if (repo.status === "missing-path") {
        return ["Configured repo path could not be read."];
    }
    if (repo.status === "not-git") {
        return ["Configured repo path is not a git worktree."];
    }
    return warnings.slice(0, 2);
}
function buildAgentHandoffText(projectId, workspacePath, generatedAt, mode, repo, storybook, uiLibrary, tokenSources, warnings) {
    const lines = [
        `/ds-inventory ${projectId}`,
        "",
        "Mapping context:",
        `- Workspace: ${workspacePath}`,
        `- Mapping context built: ${generatedAt ?? "(unknown)"}`,
        `- Workflow mode: ${mode ?? "crawl-only"}`,
    ];
    if (repo.enabled || repo.path) {
        lines.push(`- Repo path: ${repo.path ?? "(not set)"}`, `- Requested branch: ${repo.requestedBranch ?? "(not set)"}`, `- Current checked-out branch: ${repo.resolvedBranch ?? "(unknown)"}`, `- Commit SHA: ${repo.commitSha ?? "(unknown)"}`, `- Repo status: ${repo.status}`);
    }
    if (storybook.enabled || storybook.detectedRoots.length > 0) {
        lines.push(`- Storybook status: ${storybook.status}`, `- Storybook URL: ${storybook.url ?? "(not set)"}`, `- Storybook path: ${storybook.path ?? "(not set)"}`, `- Storybook roots: ${storybook.detectedRoots.length > 0 ? storybook.detectedRoots.join(", ") : "(none detected)"}`, `- Storybook stories indexed: ${storybook.storyCount}`, `- Storybook components inferred: ${storybook.componentCount}`);
    }
    if (uiLibrary.enabled || uiLibrary.hints.length > 0) {
        lines.push(`- Configured UI library: ${uiLibrary.configuredName ?? "(not set)"}`, `- UI library hints: ${uiLibrary.hints.length > 0 ? uiLibrary.hints.join(", ") : "(none)"}`, `- UI library status: ${uiLibrary.status}`);
    }
    if (tokenSources.length > 0) {
        lines.push(`- Token sources: ${tokenSources.join(", ")}`);
    }
    const conciseWarnings = buildConciseHandoffWarnings(repo, warnings);
    if (conciseWarnings.length > 0) {
        lines.push("", "Warnings:");
        for (const warning of conciseWarnings) {
            lines.push(`- ${warning}`);
        }
    }
    return lines.join("\n");
}
export async function getMappingContextSummary(projectId) {
    const workspacePath = defaultWorkspacePath(projectId);
    const mappingContextPath = path.join(workspacePath, "mapping-context");
    const profilePath = path.join(mappingContextPath, "profile.json");
    const repoIndexPath = path.join(mappingContextPath, "repo-index.json");
    const storybookIndexPath = path.join(mappingContextPath, "storybook-index.json");
    const libraryHintsPath = path.join(mappingContextPath, "library-hints.json");
    const hasMappingContext = await fs.promises
        .access(profilePath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
    const profile = await readJsonFile(profilePath, {});
    const repoIndex = await readJsonFile(repoIndexPath, {});
    const storybookIndex = await readJsonFile(storybookIndexPath, {});
    const libraryHints = await readJsonFile(libraryHintsPath, {});
    const repo = {
        enabled: Boolean(profile.repo?.enabled),
        path: profile.repo?.path ?? null,
        requestedBranch: profile.repo?.requestedBranch ?? null,
        requestedBranchRef: repoIndex.requestedBranchRef ?? null,
        resolvedBranch: profile.repo?.resolvedBranch ?? null,
        resolvedHeadRef: repoIndex.resolvedHeadRef ?? null,
        commitSha: profile.repo?.commitSha ?? null,
        status: profile.repo?.status ?? (profile.repo?.enabled ? "pending" : "not-configured"),
    };
    const storybook = {
        enabled: Boolean(profile.storybook?.enabled),
        url: profile.storybook?.url ?? null,
        path: profile.storybook?.path ?? null,
        status: storybookIndex.status ?? profile.storybook?.status ?? "not-configured",
        detectedRoots: unique([
            ...(Array.isArray(storybookIndex.detectedRoots) ? storybookIndex.detectedRoots : []),
            ...(Array.isArray(repoIndex.storybookRoots) ? repoIndex.storybookRoots : []),
        ]),
        storyCount: typeof storybookIndex.storyCount === "number" ? storybookIndex.storyCount : 0,
        componentCount: typeof storybookIndex.componentCount === "number" ? storybookIndex.componentCount : 0,
    };
    const uiLibrary = {
        enabled: Boolean(profile.uiLibrary?.enabled),
        configuredName: profile.uiLibrary?.name ?? null,
        hints: unique([
            ...(Array.isArray(libraryHints.hints) ? libraryHints.hints : []),
            ...(Array.isArray(repoIndex.uiLibraryCandidates) ? repoIndex.uiLibraryCandidates : []),
        ]),
        status: profile.uiLibrary?.status ?? "not-configured",
    };
    const tokenSources = Array.isArray(profile.tokenSources) ? profile.tokenSources : [];
    const warnings = unique(Array.isArray(repoIndex.notes) ? repoIndex.notes : []);
    const generatedAt = repoIndex.generatedAt ?? null;
    const mode = typeof profile.mode === "string" ? profile.mode : null;
    return {
        projectId,
        workspaceRoot: workspacePath,
        hasMappingContext,
        generatedAt,
        mode,
        repo,
        storybook,
        uiLibrary,
        tokenSources,
        warnings,
        agentHandoffText: buildAgentHandoffText(projectId, workspacePath, generatedAt, mode, repo, storybook, uiLibrary, tokenSources, warnings),
    };
}
