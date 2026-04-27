import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { elements, pages, projects } from "../../schema.js";
import { categorizeElement } from "../inventory/elementCategory.js";
import { buildTokenFrequencyTable } from "../inventory/tokenFrequencyTable.js";
import type { InventoryCategory, ParsedInventoryElement } from "../inventory/types.js";
import type {
  WorkspaceCategoryFolder,
  WorkspaceData,
  WorkspaceElement,
  WorkspacePage,
} from "./types.js";
import { parseJson } from "../../utils/parseJson.js";

export function isValidProjectId(projectId: string): boolean {
  const parsed = Number(projectId);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === projectId;
}

export function categoryFolder(category: InventoryCategory): WorkspaceCategoryFolder {
  switch (category) {
    case "button":
      return "buttons";
    case "link":
      return "links";
    case "input":
    case "select":
    case "textarea":
      return "inputs";
    case "heading":
      return "headings";
    case "image":
      return "images";
    case "text-block":
      return "text-blocks";
    default:
      return "other";
  }
}

export async function loadWorkspaceData(projectId: string): Promise<WorkspaceData> {
  if (!isValidProjectId(projectId)) {
    throw new Error(`Invalid projectId: ${projectId}`);
  }

  const projectNumId = Number(projectId);
  const projectRow = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectNumId))
    .get();

  if (!projectRow) {
    const error = new Error(`Project ${projectId} not found`);
    error.name = "ProjectNotFound";
    throw error;
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
    .all()
    .sort((a, b) => a.id - b.id);

  const workspacePages: WorkspacePage[] = pageRows.map((row) => {
    const globalStyles = parseJson<{
      cssVariables?: Record<string, string>;
      tokens?: string[];
    }>(row.globalStyles, {});

    return {
      id: String(row.id),
      projectId: String(row.projectId),
      url: row.url,
      title: row.title,
      screenshotPaths: parseJson<string[]>(row.screenshotPaths, []),
      annotatedScreenshotPath: row.annotatedScreenshotPath ?? undefined,
      cssVariables: globalStyles.cssVariables ?? {},
      tokens: Array.isArray(globalStyles.tokens) ? globalStyles.tokens : [],
      lastCrawledAt: row.lastCrawledAt ?? null,
    };
  });

  const workspaceElements: WorkspaceElement[] = elementRows.map((row) => {
    const base: ParsedInventoryElement = {
      id: String(row.id),
      pageId: String(row.pageId),
      projectId: String(row.projectId),
      type: row.type,
      selector: row.selector ?? undefined,
      tagName: row.tagName ?? undefined,
      elementId: row.elementId ?? undefined,
      classes: parseJson<string[]>(row.classes, []),
      bbox: parseJson<{ x: number; y: number; width: number; height: number } | undefined>(
        row.bbox,
        undefined
      ),
      href: row.href ?? undefined,
      text: row.text ?? undefined,
      styles: parseJson<Record<string, unknown>>(row.styles, {}),
      styleTokens: parseJson<string[]>(row.styleTokens, []),
      ariaLabel: row.ariaLabel ?? undefined,
      role: row.role ?? undefined,
      parentTag: row.parentTag ?? undefined,
      parentSelector: row.parentSelector ?? undefined,
      ancestryPath: row.ancestryPath ?? undefined,
      nearestInteractiveSelector: row.nearestInteractiveSelector ?? undefined,
      isVisible: row.isVisible ?? undefined,
      regionLabel: row.regionLabel ?? undefined,
      styleSignature: row.styleSignature ?? undefined,
      componentFingerprint: row.componentFingerprint ?? undefined,
      parentFingerprint: row.parentFingerprint ?? undefined,
      childCount: row.childCount ?? 0,
      cropPath: row.cropPath ?? undefined,
      cropContextPath: row.cropContextPath ?? undefined,
      cropError: row.cropError ?? undefined,
      isGlobalChrome: row.isGlobalChrome ?? undefined,
      value: row.value ?? undefined,
      placeholder: row.placeholder ?? undefined,
      checked: row.checked ?? undefined,
      src: row.src ?? undefined,
      alt: row.alt ?? undefined,
    };
    const category = categorizeElement(base);
    return {
      ...base,
      category,
      categoryFolder: categoryFolder(category),
    };
  });

  return {
    project: {
      id: String(projectRow.id),
      name: projectRow.name,
      createdAt: projectRow.createdAt,
      updatedAt: projectRow.updatedAt,
    },
    pages: workspacePages,
    elements: workspaceElements,
    tokenTable: buildTokenFrequencyTable(workspacePages, workspaceElements),
  };
}

