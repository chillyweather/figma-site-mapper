import fs from "fs";
import path from "path";
import type { RepoIndex, StorybookIndex, StorybookIndexStory } from "./types.js";

interface StorybookAdapterResult {
  storybookIndex: StorybookIndex;
  evidenceComponents: Array<Record<string, unknown>>;
  logLines: string[];
}

const STORY_FILE_PATTERN = /\.(stories|story)\.(t|j)sx?$|\.stories\.mdx$/i;
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "out",
]);

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function relativeToRoot(rootPath: string, targetPath: string): string {
  const relative = path.relative(rootPath, targetPath).split(path.sep).join("/");
  return relative.length > 0 ? relative : ".";
}

function isDir(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
}

function isFile(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function walkFiles(rootPath: string, maxDepth: number): string[] {
  const results: string[] = [];

  function visit(currentPath: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const nextPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        visit(nextPath, depth + 1);
        continue;
      }
      if (entry.isFile()) {
        results.push(nextPath);
      }
    }
  }

  visit(rootPath, 0);
  return results;
}

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseTitle(content: string): string | null {
  const metaTitle = content.match(/title\s*:\s*['"`]([^'"`]+)['"`]/);
  if (metaTitle?.[1]) return metaTitle[1].trim();
  const mdxTitle = content.match(/<Meta[^>]*title=["'`]([^"'`]+)["'`]/i);
  if (mdxTitle?.[1]) return mdxTitle[1].trim();
  return null;
}

function parseComponentName(content: string, title: string | null): string | null {
  const componentMatch = content.match(/component\s*:\s*([A-Za-z0-9_$.]+)/);
  if (componentMatch?.[1]) {
    const value = componentMatch[1].split(".").pop()?.trim();
    if (value) return value;
  }
  if (!title) return null;
  const lastSegment = title.split("/").map((part) => part.trim()).filter(Boolean).pop();
  return lastSegment || null;
}

function parseVariantNames(content: string): string[] {
  const variants: string[] = [];
  const exportConstPattern = /export\s+const\s+([A-Za-z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = exportConstPattern.exec(content)) !== null) {
    const variantName = match[1];
    if (variantName) variants.push(variantName);
  }
  return uniqueSorted(variants);
}

function parseArgNames(content: string): string[] {
  const names = new Set<string>();
  const blockPattern = /(argTypes|args)\s*:\s*{([\s\S]{0,1200}?)}\s*[,\n]/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockPattern.exec(content)) !== null) {
    const block = blockMatch[2];
    if (!block) continue;
    const keyPattern = /([A-Za-z0-9_]+)\s*:/g;
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = keyPattern.exec(block)) !== null) {
      const argName = keyMatch[1];
      if (argName) names.add(argName);
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function parseStoryFile(rootPath: string, filePath: string): StorybookIndexStory | null {
  const content = readText(filePath);
  if (!content) return null;
  const title = parseTitle(content);
  const componentName = parseComponentName(content, title);
  const variantNames = parseVariantNames(content);
  const argNames = parseArgNames(content);

  if (!title && !componentName && variantNames.length === 0) {
    return null;
  }

  return {
    title: title ?? relativeToRoot(rootPath, filePath),
    componentName,
    variantNames,
    argNames,
    storyFilePath: relativeToRoot(rootPath, filePath),
    sourceFilePath: null,
    sourceType: filePath.endsWith(".mdx") ? "mdx" : "csf",
  };
}

function parseStaticStorybookIndex(
  rootPath: string,
  jsonPath: string
): StorybookIndexStory[] {
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as Record<string, unknown>;
    const entries = typeof raw.entries === "object" && raw.entries
      ? raw.entries as Record<string, Record<string, unknown>>
      : typeof raw.stories === "object" && raw.stories
        ? raw.stories as Record<string, Record<string, unknown>>
        : {};

    const byTitle = new Map<string, StorybookIndexStory>();
    for (const entry of Object.values(entries)) {
      const title = typeof entry.title === "string" ? entry.title.trim() : "";
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const importPath = typeof entry.importPath === "string" ? entry.importPath : null;
      if (!title) continue;

      const existing = byTitle.get(title);
      const nextVariantNames = uniqueSorted([...(existing?.variantNames ?? []), ...(name ? [name] : [])]);
      byTitle.set(title, {
        title,
        componentName: title.split("/").filter(Boolean).pop() ?? null,
        variantNames: nextVariantNames,
        argNames: existing?.argNames ?? [],
        storyFilePath: importPath,
        sourceFilePath: importPath,
        sourceType: "index-json",
      });
    }
    return Array.from(byTitle.values()).sort((a, b) => a.title.localeCompare(b.title));
  } catch {
    return [];
  }
}

function collectStoriesFromDirectory(rootPath: string, scanRoot: string, maxDepth = 6): StorybookIndexStory[] {
  const files = walkFiles(scanRoot, maxDepth).filter((filePath) => STORY_FILE_PATTERN.test(filePath));
  const stories = files
    .map((filePath) => parseStoryFile(rootPath, filePath))
    .filter((story): story is StorybookIndexStory => Boolean(story));
  return stories.sort((a, b) => a.title.localeCompare(b.title));
}

function dedupeStories(stories: StorybookIndexStory[]): StorybookIndexStory[] {
  const byKey = new Map<string, StorybookIndexStory>();
  for (const story of stories) {
    const key = `${story.title}::${story.storyFilePath ?? ""}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, story);
      continue;
    }
    byKey.set(key, {
      ...story,
      variantNames: uniqueSorted([...existing.variantNames, ...story.variantNames]),
      argNames: uniqueSorted([...existing.argNames, ...story.argNames]),
      sourceFilePath: existing.sourceFilePath ?? story.sourceFilePath,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => a.title.localeCompare(b.title));
}

function toEvidenceComponents(stories: StorybookIndexStory[], sourceLabel: string): Array<Record<string, unknown>> {
  return stories.map((story) => ({
    sourceType: "storybook",
    sourceRef: story.storyFilePath ?? story.title,
    sourceLabel,
    confidence: story.sourceType === "index-json" ? 0.85 : 0.8,
    componentName: story.componentName,
    storyTitle: story.title,
    variantNames: story.variantNames,
    argNames: story.argNames,
    matchedFingerprints: [],
    matchedElementIds: [],
    matchedPageIds: [],
    notes: [
      `Storybook source type: ${story.sourceType}`,
      story.sourceFilePath ? `Source path: ${story.sourceFilePath}` : null,
    ].filter(Boolean),
  }));
}

async function fetchStorybookIndexFromUrl(url: string): Promise<StorybookIndexStory[]> {
  const normalized = url.replace(/\/+$/, "");
  const candidates = [`${normalized}/index.json`, `${normalized}/stories.json`];

  for (const candidate of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(candidate, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const json = await response.json() as Record<string, unknown>;
      const tempPath = "/virtual";
      const entries = typeof json.entries === "object" && json.entries
        ? json.entries as Record<string, Record<string, unknown>>
        : typeof json.stories === "object" && json.stories
          ? json.stories as Record<string, Record<string, unknown>>
          : {};
      const stories: StorybookIndexStory[] = [];
      const byTitle = new Map<string, StorybookIndexStory>();
      for (const entry of Object.values(entries)) {
        const title = typeof entry.title === "string" ? entry.title.trim() : "";
        const name = typeof entry.name === "string" ? entry.name.trim() : "";
        const importPath = typeof entry.importPath === "string" ? entry.importPath : null;
        if (!title) continue;
        const existing = byTitle.get(title);
        byTitle.set(title, {
          title,
          componentName: title.split("/").filter(Boolean).pop() ?? null,
          variantNames: uniqueSorted([...(existing?.variantNames ?? []), ...(name ? [name] : [])]),
          argNames: existing?.argNames ?? [],
          storyFilePath: importPath,
          sourceFilePath: importPath ? relativeToRoot(tempPath, importPath) : null,
          sourceType: "index-json",
        });
      }
      stories.push(...byTitle.values());
      return stories.sort((a, b) => a.title.localeCompare(b.title));
    } catch {
      // Try the next candidate URL.
    }
  }

  return [];
}

export async function analyzeStorybookMappingInput(
  generatedAt: string,
  configuredStorybookPath: string,
  configuredStorybookUrl: string,
  repoPath: string,
  repoIndex: RepoIndex
): Promise<StorybookAdapterResult> {
  const storybookPath = configuredStorybookPath.trim();
  const storybookUrl = configuredStorybookUrl.trim();
  const notes: string[] = [];
  let stories: StorybookIndexStory[] = [];
  let status = "not-configured";
  let sourceMode: StorybookIndex["sourceMode"] = "none";
  let detectedRoots = uniqueSorted(repoIndex.storybookRoots);

  if (storybookPath) {
    sourceMode = "configured-path";
    if (!isDir(storybookPath)) {
      status = "missing-path";
      notes.push("Configured Storybook path does not exist or is not a directory.");
    } else {
      const indexJsonPath = path.join(storybookPath, "index.json");
      const storiesJsonPath = path.join(storybookPath, "stories.json");
      if (isFile(indexJsonPath)) {
        stories = parseStaticStorybookIndex(storybookPath, indexJsonPath);
      } else if (isFile(storiesJsonPath)) {
        stories = parseStaticStorybookIndex(storybookPath, storiesJsonPath);
      } else {
        stories = collectStoriesFromDirectory(storybookPath, storybookPath);
      }
      status = stories.length > 0 ? "indexed-from-path" : "empty";
      if (stories.length === 0) {
        notes.push("Configured Storybook path was readable, but no stories were indexed.");
      }
      if (detectedRoots.length === 0 && isDir(path.join(storybookPath, ".storybook"))) {
        detectedRoots = [".storybook"];
      }
    }
  } else if (storybookUrl) {
    sourceMode = "configured-url";
    stories = await fetchStorybookIndexFromUrl(storybookUrl);
    status = stories.length > 0 ? "indexed-from-url" : "error";
    if (stories.length === 0) {
      notes.push("Configured Storybook URL did not return a readable index.json or stories.json.");
    }
  } else if (repoPath && repoIndex.storybookDetected && repoIndex.storybookRoots.length > 0) {
    sourceMode = "repo-detected";
    const repoStories: StorybookIndexStory[] = [];
    for (const root of repoIndex.storybookRoots) {
      const rootPath = path.join(repoPath, root);
      const basePath = root.endsWith("/.storybook") || root === ".storybook"
        ? path.dirname(rootPath)
        : rootPath;
      if (!isDir(basePath)) continue;
      repoStories.push(...collectStoriesFromDirectory(repoPath, basePath));
    }
    stories = dedupeStories(repoStories);
    status = stories.length > 0 ? "indexed-from-repo" : "detected-from-repo";
    if (stories.length === 0) {
      notes.push("Repo Storybook roots were detected, but no parseable story files were found.");
    }
  }

  const normalizedStories = dedupeStories(stories);
  const componentCount = new Set(
    normalizedStories.map((story) => story.componentName).filter(Boolean)
  ).size;
  const sourceLabel =
    sourceMode === "configured-path"
      ? "storybook-path"
      : sourceMode === "configured-url"
        ? "storybook-url"
        : "storybook-repo";

  const storybookIndex: StorybookIndex = {
    generatedAt,
    status,
    url: storybookUrl || null,
    path: storybookPath || null,
    detectedRoots,
    sourceMode,
    storyCount: normalizedStories.length,
    componentCount,
    stories: normalizedStories,
    notes,
  };

  const logLines = [
    `- Storybook adapter status: ${status}`,
    `- Storybook source mode: ${sourceMode}`,
    `- Storybook detected roots: ${detectedRoots.length > 0 ? detectedRoots.join(", ") : "(none)"}`,
    `- Storybook stories indexed: ${normalizedStories.length}`,
    `- Storybook components inferred: ${componentCount}`,
  ];
  for (const note of notes) {
    logLines.push(`- Note: ${note}`);
  }

  return {
    storybookIndex,
    evidenceComponents: toEvidenceComponents(normalizedStories, sourceLabel),
    logLines,
  };
}
