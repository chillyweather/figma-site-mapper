import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { elements, pages } from "../../schema.js";
import { buildTokenFrequencyTable } from "./tokenFrequencyTable.js";
import type {
  InventoryTokenFrequencyTable,
  ParsedInventoryElement,
  ParsedInventoryPage,
} from "./types.js";

function isValidId(id: string): boolean {
  const parsed = parseInt(id, 10);
  return !Number.isNaN(parsed) && parsed > 0 && String(parsed) === id;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function loadProjectData(projectId: string): Promise<{
  pages: ParsedInventoryPage[];
  elements: ParsedInventoryElement[];
}> {
  if (!isValidId(projectId)) {
    throw new Error("Invalid projectId supplied to inventory analysis");
  }

  const projectNumId = parseInt(projectId, 10);
  const pageRows = db
    .select()
    .from(pages)
    .where(eq(pages.projectId, projectNumId))
    .all();
  const elementRows = db
    .select()
    .from(elements)
    .where(eq(elements.projectId, projectNumId))
    .all();

  return {
    pages: pageRows.map((row) => {
      const globalStyles = parseJson<{ cssVariables?: Record<string, string>; tokens?: string[] }>(
        row.globalStyles,
        {}
      );

      return {
        id: String(row.id),
        projectId: String(row.projectId),
        url: row.url,
        title: row.title,
        cssVariables: globalStyles.cssVariables || {},
        tokens: Array.isArray(globalStyles.tokens) ? globalStyles.tokens : [],
        annotatedScreenshotPath: row.annotatedScreenshotPath ?? undefined,
      } satisfies ParsedInventoryPage;
    }),
    elements: elementRows.map((row) => ({
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
      childCount: row.childCount ?? undefined,
      cropPath: row.cropPath ?? undefined,
      cropContextPath: row.cropContextPath ?? undefined,
      cropError: row.cropError ?? undefined,
      isGlobalChrome: row.isGlobalChrome ?? undefined,
      value: row.value ?? undefined,
      placeholder: row.placeholder ?? undefined,
      checked: row.checked ?? undefined,
      src: row.src ?? undefined,
      alt: row.alt ?? undefined,
    } satisfies ParsedInventoryElement)),
  };
}

export async function getInventoryTokens(
  projectId: string
): Promise<{ projectId: string; tokens: InventoryTokenFrequencyTable }> {
  const data = await loadProjectData(projectId);
  return { projectId, tokens: buildTokenFrequencyTable(data.pages, data.elements) };
}
