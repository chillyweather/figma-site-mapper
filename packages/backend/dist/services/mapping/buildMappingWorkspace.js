import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { elements, pages, projects } from "../../schema.js";
import { parseJson } from "../../utils/parseJson.js";
import { ensureDir, writeJson } from "../workspace/paths.js";
import { mappingWorkspacePath, mappingManifestPath, mappingMetaPath, mappingPageDir, mappingReadmePath, mappingDecisionsDir, } from "./paths.js";
export function isValidProjectId(id) {
    const n = parseInt(id, 10);
    return !isNaN(n) && n > 0 && String(n) === id;
}
function isBbox(value) {
    if (!value || typeof value !== "object")
        return false;
    const b = value;
    return (typeof b.x === "number" &&
        typeof b.y === "number" &&
        typeof b.width === "number" &&
        typeof b.height === "number" &&
        b.width > 0 &&
        b.height > 0);
}
export function filterDomCandidates(elementRows) {
    return elementRows
        .filter((row) => {
        if (row.isVisible === false)
            return false;
        const bbox = parseJson(row.bbox, null);
        if (!isBbox(bbox))
            return false;
        const tagName = (row.tagName ?? "").toLowerCase();
        const role = (row.role ?? "").toLowerCase();
        const type = (row.type ?? "").toLowerCase();
        const isInteractive = tagName === "button" ||
            tagName === "a" ||
            tagName === "input" ||
            tagName === "select" ||
            tagName === "textarea" ||
            role === "button" ||
            role === "link" ||
            role === "tab" ||
            role === "checkbox" ||
            role === "radio" ||
            Boolean(row.href);
        const isSemanticComponent = type === "button" ||
            type === "link" ||
            type === "input" ||
            type === "select" ||
            type === "textarea" ||
            type === "image" ||
            type === "heading" ||
            type === "navigation" ||
            type === "header" ||
            type === "footer";
        const isSizedBlock = bbox.width >= 24 &&
            bbox.height >= 16 &&
            bbox.width <= 1600 &&
            bbox.height <= 1200 &&
            Boolean(row.componentFingerprint || row.ariaLabel || row.text);
        return isInteractive || isSemanticComponent || isSizedBlock;
    })
        .map((row) => {
        const bbox = parseJson(row.bbox, { x: 0, y: 0, width: 0, height: 0 });
        return {
            id: String(row.id),
            pageId: String(row.pageId),
            type: row.type ?? "unknown",
            selector: row.selector ?? undefined,
            tagName: row.tagName ?? undefined,
            elementId: row.elementId ?? undefined,
            classes: parseJson(row.classes, []),
            bbox,
            text: row.text ?? undefined,
            href: row.href ?? undefined,
            ariaLabel: row.ariaLabel ?? undefined,
            role: row.role ?? undefined,
            cropPath: row.cropPath ?? undefined,
            componentFingerprint: row.componentFingerprint ?? undefined,
        };
    });
}
function buildReadme(manifest, pages) {
    const pageList = pages
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
    const pageRows = db
        .select()
        .from(pages)
        .where(eq(pages.projectId, projectNumId))
        .all()
        .sort((a, b) => a.id - b.id);
    const elementRows = db
        .select()
        .from(elements)
        .where(eq(elements.projectId, projectNumId))
        .all();
    const workspaceRoot = mappingWorkspacePath(projectId);
    const generatedAt = new Date().toISOString();
    const candidates = filterDomCandidates(elementRows);
    const candidatesByPage = new Map();
    for (const c of candidates) {
        const arr = candidatesByPage.get(c.pageId) ?? [];
        arr.push(c);
        candidatesByPage.set(c.pageId, arr);
    }
    const pageEvidences = pageRows.map((row) => ({
        id: String(row.id),
        url: row.url,
        title: row.title,
        screenshotPaths: parseJson(row.screenshotPaths, []),
        viewportWidth: row.viewportWidth ?? null,
        candidateCount: (candidatesByPage.get(String(row.id)) ?? []).length,
    }));
    const manifest = {
        schemaVersion: 1,
        projectId,
        generatedAt,
        pageCount: pageRows.length,
        candidateCount: candidates.length,
    };
    const meta = {
        schemaVersion: 1,
        generatedAt,
        projectId,
    };
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
        pageCount: pageRows.length,
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
