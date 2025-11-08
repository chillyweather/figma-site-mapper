import { TreeNode, InteractiveElement, ExtractedElement } from "../../types";
import {
  fetchProjectPages,
  fetchProjectElements,
  fetchPagesByIds,
} from "../services/apiClient";

export interface PageRecord {
  _id: string;
  url: string;
  title: string;
  screenshotPaths: string[];
  interactiveElements?: Array<{
    type: "link" | "button";
    x: number;
    y: number;
    width: number;
    height: number;
    href?: string;
    text?: string;
  }>;
  globalStyles?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ElementRecord {
  _id: string;
  pageId: string;
  projectId: string;
  type: string;
  selector?: string;
  tagName?: string;
  elementId?: string;
  classes?: string[];
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  href?: string;
  text?: string;
  styles?: Record<string, unknown>;
  styleTokens?: string[];
  ariaLabel?: string;
  role?: string;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  src?: string;
  alt?: string;
}

function canonicalizeUrl(url: string): string {
  try {
    const normalized = new URL(url);
    return normalized.toString();
  } catch (error) {
    console.warn("Failed to canonicalize URL", url, error);
    return url;
  }
}

function getParentUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const segments = urlObj.pathname.split("/").filter(Boolean);

    if (segments.length === 0) {
      return null;
    }

    segments.pop();
    urlObj.pathname = `/${segments.join("/")}`;

    if (urlObj.pathname === "") {
      urlObj.pathname = "/";
    }

    urlObj.hash = "";
    urlObj.search = "";

    return urlObj.toString();
  } catch (error) {
    console.warn("Failed to derive parent URL", url, error);
    return null;
  }
}

function buildInteractiveElements(
  rawElements: ElementRecord[]
): InteractiveElement[] {
  const interactive: InteractiveElement[] = [];

  for (const element of rawElements) {
    const bbox = element.bbox;
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
      continue;
    }

    const tagName = (element.tagName || "").toLowerCase();
    const type = (element.type || "").toLowerCase();
    let interactiveType: "link" | "button" | null = null;

    if (tagName === "a" || type === "link") {
      interactiveType = "link";
    } else if (
      tagName === "button" ||
      type === "button" ||
      (tagName === "input" &&
        ["submit", "button", "reset"].includes(type || ""))
    ) {
      interactiveType = "button";
    }

    if (!interactiveType) {
      continue;
    }

    interactive.push({
      type: interactiveType,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      href: element.href,
      text: element.text,
    });
  }

  return interactive;
}

function normalizePersistedInteractive(
  interactive?: PageRecord["interactiveElements"]
): InteractiveElement[] {
  if (!Array.isArray(interactive)) {
    return [];
  }

  return interactive
    .filter((item): item is InteractiveElement => {
      if (!item) {
        return false;
      }

      const { type, x, y, width, height } = item;
      if (type !== "link" && type !== "button") {
        return false;
      }

      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        typeof width !== "number" ||
        typeof height !== "number"
      ) {
        return false;
      }

      if (width <= 0 || height <= 0) {
        return false;
      }

      return true;
    })
    .map((item) => ({
      type: item.type,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      href: item.href,
      text: item.text,
    }));
}

function transformElement(record: ElementRecord): ExtractedElement | null {
  const bbox = record.bbox;
  if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
    return null;
  }

  return {
    selector: record.selector || "",
    tagName: record.tagName || "",
    type: record.type || record.tagName || "element",
    elementType: undefined,
    classes: Array.isArray(record.classes) ? record.classes : [],
    id: record.elementId,
    boundingBox: {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    },
    styles: (record.styles as Record<string, string>) || undefined,
    text: record.text,
    href: record.href,
    ariaLabel: record.ariaLabel,
    role: record.role,
    value: record.value,
    placeholder: record.placeholder,
    checked: record.checked !== undefined ? record.checked : undefined,
    src: record.src,
    alt: record.alt,
    styleTokens: Array.isArray(record.styleTokens)
      ? record.styleTokens
      : undefined,
  };
}

function sortPages(pages: PageRecord[], startUrl?: string): PageRecord[] {
  const canonicalStart = startUrl ? canonicalizeUrl(startUrl) : null;

  return pages.slice().sort((a, b) => {
    const aUrl = canonicalizeUrl(a.url);
    const bUrl = canonicalizeUrl(b.url);

    if (canonicalStart) {
      const aIsStart = aUrl === canonicalStart;
      const bIsStart = bUrl === canonicalStart;
      if (aIsStart && !bIsStart) {
        return -1;
      }
      if (bIsStart && !aIsStart) {
        return 1;
      }
    }

    const aDepth = new URL(aUrl).pathname.split('/').filter(Boolean).length;
    const bDepth = new URL(bUrl).pathname.split('/').filter(Boolean).length;
    
    if (aDepth !== bDepth) {
      return aDepth - bDepth;
    }

    return aUrl.localeCompare(bUrl);
  });
}

function sortTreeChildrenByUrl(node: TreeNode | null): void {
  if (!node || !Array.isArray(node.children) || node.children.length === 0) {
    return;
  }

  node.children.sort((a, b) => a.url.localeCompare(b.url));
  for (const child of node.children) {
    sortTreeChildrenByUrl(child);
  }
}

function buildTreeFromPages(
  pages: PageRecord[],
  elementsByPageId: Map<string, ExtractedElement[]>,
  interactiveByPageId: Map<string, InteractiveElement[]>,
  startUrl: string,
  preserveOrder: boolean
): TreeNode | null {
  if (pages.length === 0) {
    return null;
  }

  const canonicalStartUrl = canonicalizeUrl(startUrl);
  const sortedPages = preserveOrder
    ? pages.slice()
    : sortPages(pages, canonicalStartUrl);
  const nodeMap = new Map<string, TreeNode & { children: TreeNode[] }>();

  for (const page of sortedPages) {
    const canonicalUrl = canonicalizeUrl(page.url);
    const screenshotPaths = Array.isArray(page.screenshotPaths)
      ? page.screenshotPaths
      : [];

    const elements = elementsByPageId.get(page._id) || [];
    const persistedInteractive = normalizePersistedInteractive(
      page.interactiveElements
    );
    const interactive =
      persistedInteractive.length > 0
        ? persistedInteractive
        : interactiveByPageId.get(page._id) || [];

    const cssVariables =
      page.globalStyles && (page.globalStyles as any).cssVariables
        ? (page.globalStyles as any).cssVariables
        : undefined;
    const tokens =
      page.globalStyles && (page.globalStyles as any).tokens
        ? (page.globalStyles as any).tokens
        : undefined;

    const node: TreeNode & { children: TreeNode[] } = {
      url: canonicalUrl,
      title: page.title || canonicalUrl,
      screenshot: screenshotPaths,
      thumbnail: screenshotPaths[0] || "",
      children: [],
      interactiveElements: interactive,
      styleData: {
        elements,
        cssVariables,
        tokens,
      },
    };

    nodeMap.set(canonicalUrl, node);
  }

  let root: (TreeNode & { children: TreeNode[] }) | undefined;

  for (const node of nodeMap.values()) {
    if (!root && node.url === canonicalStartUrl) {
      root = node;
    }
  }

  if (!root) {
    // fallback to earliest page
    root = nodeMap.get(canonicalizeUrl(sortedPages[0]!.url));
  }

  if (!root) {
    return null;
  }

  for (const node of nodeMap.values()) {
    if (node === root) {
      continue;
    }

    const parentUrl = getParentUrl(node.url);
    if (!parentUrl) {
      root.children.push(node);
      continue;
    }

    const parentNode = nodeMap.get(parentUrl);
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      root.children.push(node);
    }
  }

  if (!preserveOrder) {
    sortTreeChildrenByUrl(root);
  }

  return root;
}

interface AssembleOptions {
  detectInteractiveElements: boolean;
  preservePageOrder?: boolean;
}

function assembleManifestData(
  projectId: string,
  startUrl: string,
  pages: PageRecord[],
  elements: ElementRecord[],
  options: AssembleOptions
): { tree: TreeNode | null; projectId: string; startUrl: string } {
  const elementsByPageId = new Map<string, ExtractedElement[]>();
  const interactiveByPageId = new Map<string, InteractiveElement[]>();

  for (const element of elements) {
    if (!element || !element.pageId) {
      continue;
    }

    const transformed = transformElement(element);
    if (transformed) {
      if (!elementsByPageId.has(element.pageId)) {
        elementsByPageId.set(element.pageId, []);
      }
      elementsByPageId.get(element.pageId)!.push(transformed);
    }

    if (options.detectInteractiveElements) {
      if (!interactiveByPageId.has(element.pageId)) {
        interactiveByPageId.set(element.pageId, []);
      }
      const interactiveElements = interactiveByPageId.get(element.pageId)!;
      const interactiveForElement = buildInteractiveElements([element]);
      if (interactiveForElement.length > 0) {
        interactiveElements.push(...interactiveForElement);
      }
    }
  }

  const tree = buildTreeFromPages(
    pages,
    elementsByPageId,
    interactiveByPageId,
    startUrl,
    options.preservePageOrder === true
  );

  return {
    tree,
    projectId,
    startUrl,
  };
}

export async function buildManifestFromProject(
  projectId: string,
  startUrl: string,
  options: { detectInteractiveElements: boolean; preservePageOrder?: boolean }
): Promise<{ tree: TreeNode | null; projectId: string; startUrl: string }> {
  const pages = (await fetchProjectPages(projectId)) as PageRecord[];
  const elements = (await fetchProjectElements(projectId)) as ElementRecord[];

  return assembleManifestData(projectId, startUrl, pages, elements, {
    detectInteractiveElements: options.detectInteractiveElements,
    preservePageOrder: options.preservePageOrder,
  });
}

export async function buildManifestFromPageIds(
  projectId: string,
  startUrl: string,
  pageIds: string[],
  options: { detectInteractiveElements: boolean }
): Promise<{ tree: TreeNode | null; projectId: string; startUrl: string }> {
  console.log(`🔨 buildManifestFromPageIds called with ${pageIds.length} IDs`);
  console.log(`🌐 Fetching pages from backend...`);

  const normalizedIds = (Array.isArray(pageIds) ? pageIds : [])
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  if (normalizedIds.length === 0) {
    return { tree: null, projectId, startUrl };
  }

  const response = await fetchPagesByIds(projectId, normalizedIds);

  console.log(`📦 Received ${response.pages?.length || 0} pages from API`);
  console.log(
    `📝 Page URLs received:`,
    response.pages?.map((p: PageRecord) => p.url) || []
  );

  const pages = (response.pages || []) as PageRecord[];
  const elements = (response.elements || []) as ElementRecord[];

  const result = assembleManifestData(projectId, startUrl, pages, elements, {
    detectInteractiveElements: options.detectInteractiveElements,
    preservePageOrder: true,
  });

  // Count pages in tree
  let pageCount = 0;
  if (result.tree) {
    const countPages = (node: TreeNode): number => {
      let count = 1; // This node
      if (node.children) {
        for (const child of node.children) {
          count += countPages(child);
        }
      }
      return count;
    };
    pageCount = countPages(result.tree);
  }
  console.log(`🌲 Assembled tree contains ${pageCount} pages`);

  return result;
}

export function buildManifestFromData(
  projectId: string,
  startUrl: string,
  data: { pages: PageRecord[]; elements: ElementRecord[] },
  options: { detectInteractiveElements: boolean; preservePageOrder?: boolean }
): { tree: TreeNode | null; projectId: string; startUrl: string } {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  const elements = Array.isArray(data.elements) ? data.elements : [];

  return assembleManifestData(projectId, startUrl, pages, elements, options);
}
