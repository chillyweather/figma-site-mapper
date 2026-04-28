import path from "path";
import { readJsonFile } from "./utils.js";
const GENERIC_NAMES = new Set([
    "app",
    "apps",
    "assets",
    "blocks",
    "components",
    "content",
    "core",
    "dist",
    "docs",
    "examples",
    "lib",
    "modules",
    "node_modules",
    "pages",
    "partials",
    "parts",
    "patterns",
    "routes",
    "scss",
    "src",
    "stories",
    "styles",
    "tailwind",
    "template",
    "templates",
    "theme",
    "themes",
    "ui",
    "views",
    "web",
]);
function isMeaningfulName(name) {
    const normalized = name.trim().toLowerCase();
    if (!normalized)
        return false;
    if (normalized.length < 3)
        return false;
    if (GENERIC_NAMES.has(normalized))
        return false;
    if (normalized === "index")
        return false;
    return true;
}
function candidateNameFromPath(sourcePath) {
    const stem = path.basename(sourcePath, path.extname(sourcePath));
    return stem.replace(/^\_+/, "").replace(/\.config$/i, "").trim();
}
function isUsefulTemplateRoot(root) {
    if (root.includes("/themes/"))
        return false;
    const name = path.basename(root);
    return isMeaningfulName(name);
}
function deriveComponentCandidates(storybookIndex, repoIndex) {
    const seen = new Set();
    const results = [];
    // Rule 1: Storybook component names first (high confidence)
    if (storybookIndex) {
        for (const story of storybookIndex.stories) {
            const name = story.componentName ?? story.title.split("/").pop() ?? story.title;
            if (name && isMeaningfulName(name) && !seen.has(name)) {
                seen.add(name);
                results.push({ name, source: "storybook", confidence: "high" });
            }
        }
    }
    // Rule 2: Repo component roots and file samples (medium confidence)
    if (repoIndex) {
        for (const root of repoIndex.componentRoots) {
            const name = path.basename(root);
            if (name && isMeaningfulName(name) && !seen.has(name)) {
                seen.add(name);
                results.push({ name, source: "repo", confidence: "medium" });
            }
        }
        for (const file of repoIndex.componentFileSamples) {
            const name = candidateNameFromPath(file);
            if (name && isMeaningfulName(name) && !seen.has(name)) {
                seen.add(name);
                results.push({ name, source: "repo", confidence: "medium" });
            }
        }
    }
    return results;
}
function deriveTokenCandidates(repoIndex) {
    if (!repoIndex?.tokenSources?.length)
        return [];
    const seen = new Set();
    const results = [];
    for (const source of repoIndex.tokenSources) {
        const name = candidateNameFromPath(source);
        if (name && isMeaningfulName(name) && !seen.has(name)) {
            seen.add(name);
            results.push({ name, source: "repo", confidence: "medium" });
        }
    }
    return results;
}
function deriveTemplateCandidates(storybookIndex, repoIndex) {
    const seen = new Set();
    const results = [];
    // From Storybook: repeated section titles
    if (storybookIndex) {
        const sectionCounts = new Map();
        for (const story of storybookIndex.stories) {
            const section = story.title.split("/")[0] ?? "";
            if (isMeaningfulName(section)) {
                sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
            }
        }
        for (const [section, count] of sectionCounts) {
            if (count >= 2 && !seen.has(section)) {
                seen.add(section);
                results.push({
                    name: section,
                    source: "storybook",
                    confidence: count >= 4 ? "high" : "medium",
                });
            }
        }
    }
    // From repo: app roots
    if (repoIndex) {
        for (const root of repoIndex.appRoots) {
            if (!isUsefulTemplateRoot(root))
                continue;
            const name = path.basename(root);
            if (name && !seen.has(name)) {
                seen.add(name);
                results.push({ name, source: "repo", confidence: "low" });
            }
        }
    }
    return results;
}
export function buildSuggestions(repoIndex, storybookIndex, libraryHints, projectId, generatedAt) {
    const repoStatus = repoIndex?.status ?? "not-configured";
    const storybookStatus = storybookIndex?.status ?? "not-configured";
    const uiLibraryHints = libraryHints?.hints ?? [];
    const topComponentCandidates = deriveComponentCandidates(storybookIndex, repoIndex);
    const topTokenCandidates = deriveTokenCandidates(repoIndex);
    const topTemplateCandidates = deriveTemplateCandidates(storybookIndex, repoIndex);
    const warnings = [];
    if (repoStatus === "not-configured") {
        warnings.push("No repository configured. Repo-derived suggestions will be empty.");
    }
    if (storybookStatus === "not-configured" &&
        repoIndex &&
        !repoIndex.storybookDetected) {
        warnings.push("No Storybook configured or detected. Storybook-derived suggestions will be empty.");
    }
    if (topComponentCandidates.length === 0 && topTokenCandidates.length === 0) {
        warnings.push("No component or token candidates could be derived from the available evidence.");
    }
    return {
        generatedAt,
        projectId,
        repoStatus,
        storybookStatus,
        uiLibraryHints,
        topComponentCandidates,
        topTokenCandidates,
        topTemplateCandidates,
        warnings,
    };
}
export async function deriveSuggestionsFromDisk(mappingContextPath, projectId, generatedAt) {
    const repoIndex = await readJsonFile(path.join(mappingContextPath, "repo-index.json"), null);
    const storybookIndex = await readJsonFile(path.join(mappingContextPath, "storybook-index.json"), null);
    const libraryHints = await readJsonFile(path.join(mappingContextPath, "library-hints.json"), null);
    return buildSuggestions(repoIndex, storybookIndex, libraryHints, projectId, generatedAt);
}
export async function readSuggestionsFile(mappingContextPath) {
    return readJsonFile(path.join(mappingContextPath, "suggestions.json"), null);
}
