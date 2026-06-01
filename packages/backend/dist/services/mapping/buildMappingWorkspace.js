import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { projects } from "../../schema.js";
import { ensureDir, writeJson } from "../workspace/paths.js";
import { mappingWorkspacePath, mappingManifestPath, mappingMetaPath, mappingPageDir, mappingReadmePath, mappingDecisionsDir, } from "./paths.js";
import { loadProjectEvidence } from "./evidence.js";
export { filterDomCandidates } from "./evidence.js";
export function isValidProjectId(id) {
    const n = parseInt(id, 10);
    return !isNaN(n) && n > 0 && String(n) === id;
}
function buildReadme(manifest, pageEvidences) {
    const pageList = pageEvidences
        .map((p, i) => `  ${i + 1}. Page ${p.id} — ${p.url} (${p.candidateCount} candidates)`)
        .join("\n");
    return `# Mapping Evidence — Project ${manifest.projectId}

Generated: ${manifest.generatedAt}
Schema version: ${manifest.schemaVersion}

## Summary

- Pages: ${manifest.pageCount}
- DOM candidates: ${manifest.candidateCount}

## Pages

${pageList}

## Files

\`\`\`
mapping/
  manifest.json          — project-level summary
  README.md              — this file
  pages/
    <pageId>/
      page.json          — page metadata (url, title, screenshotPaths, viewportWidth)
      candidates.json    — DOM element candidates with bbox (CSS-pixel coordinates)
  decisions/
    latest.json          — symlink to most recent components-<timestamp>.json
    components-<timestamp>.json  — agent-written component decisions
\`\`\`

## How to use

1. Read \`manifest.json\` for project-level counts.
2. For each page in \`pages/\`, read \`page.json\` and \`candidates.json\`.
3. Candidates are DOM elements with confirmed bboxes in CSS-pixel coordinates.
4. Screenshot paths in \`page.json\` are absolute local paths to the captured images.
5. After analysis, write \`decisions/components-<timestamp>.json\` and update \`decisions/latest.json\`.

## Decision schema

\`\`\`json
{
  "schemaVersion": 1,
  "generatedAt": "ISO-8601 timestamp",
  "projectId": "${manifest.projectId}",
  "components": [
    {
      "type": "Buttons",
      "instances": [
        {
          "pageId": "5",
          "elementId": "42",
          "bbox": { "x": 100, "y": 200, "width": 120, "height": 40 },
          "source": "dom",
          "confidence": "high",
          "label": "Primary CTA"
        }
      ]
    }
  ]
}
\`\`\`

- \`type\` must be a name from the Tidy Mapper component taxonomy (e.g. "Buttons", "Cards", "Navigation") or "Other".
- \`source\` is "dom" for candidates from this evidence file, "vision" for agent-identified visual patterns.
- \`bbox\` is CSS-pixel coordinates relative to the page viewport (same coordinate space as candidates.json).
- Low-confidence candidates that don't fit a named type should use \`"type": "Other"\`.
`;
}
export async function buildMappingWorkspace(projectId) {
    if (!isValidProjectId(projectId)) {
        throw new Error(`Invalid projectId: ${projectId}`);
    }
    const projectNumId = parseInt(projectId, 10);
    const projectRow = db.select().from(projects).where(eq(projects.id, projectNumId)).get();
    if (!projectRow) {
        const err = new Error(`Project ${projectId} not found`);
        err.name = "ProjectNotFound";
        throw err;
    }
    const { pages: pageEvidences, candidates } = await loadProjectEvidence(projectId);
    const workspaceRoot = mappingWorkspacePath(projectId);
    const generatedAt = new Date().toISOString();
    const manifest = {
        schemaVersion: 1,
        projectId,
        generatedAt,
        pageCount: pageEvidences.length,
        candidateCount: candidates.length,
    };
    const meta = {
        schemaVersion: 1,
        generatedAt,
        projectId,
    };
    const candidatesByPage = new Map();
    for (const c of candidates) {
        const arr = candidatesByPage.get(c.pageId) ?? [];
        arr.push(c);
        candidatesByPage.set(c.pageId, arr);
    }
    // Materialise workspace (preserve existing decisions/)
    await ensureDir(workspaceRoot);
    await ensureDir(path.join(workspaceRoot, "pages"));
    await ensureDir(mappingDecisionsDir(projectId));
    await writeJson(mappingManifestPath(projectId), manifest);
    await writeJson(mappingMetaPath(projectId), meta);
    await fs.promises.writeFile(mappingReadmePath(projectId), buildReadme(manifest, pageEvidences), "utf8");
    for (const page of pageEvidences) {
        const pageDir = mappingPageDir(projectId, page.id);
        await ensureDir(pageDir);
        await writeJson(path.join(pageDir, "page.json"), {
            id: page.id,
            url: page.url,
            title: page.title,
            screenshotPaths: page.screenshotPaths,
            viewportWidth: page.viewportWidth,
        });
        const pageCandidates = candidatesByPage.get(page.id) ?? [];
        await writeJson(path.join(pageDir, "candidates.json"), pageCandidates);
    }
    return {
        projectId,
        mappingWorkspaceRoot: workspaceRoot,
        pageCount: pageEvidences.length,
        candidateCount: candidates.length,
        generatedAt,
    };
}
export async function getMappingWorkspaceMeta(projectId) {
    const metaPath = mappingMetaPath(projectId);
    try {
        const raw = await fs.promises.readFile(metaPath, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function getMappingManifest(projectId) {
    try {
        const raw = await fs.promises.readFile(mappingManifestPath(projectId), "utf8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
