import { TreeNode, InteractiveElement, ExtractedElement } from "../../types";
import { fetchProjectPages, fetchProjectElements } from "../services/apiClient";

interface PageRecord {
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

interface ElementRecord {
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
    checked: record.checked ?? undefined,
    src: record.src,
    alt: record.alt,
    styleTokens: Array.isArray(record.styleTokens)
      ? record.styleTokens
      : undefined,
  };
}

function sortPages(pages: PageRecord[]): PageRecord[] {
  return pages.slice().sort((a, b) => {
    const aTs = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTs = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (!Number.isNaN(aTs) && !Number.isNaN(bTs) && aTs !== bTs) {
      return aTs - bTs;
    }
    return a.title.localeCompare(b.title);
  });
}

function buildTreeFromPages(
  pages: PageRecord[],
  elementsByPageId: Map<string, ExtractedElement[]>,
  interactiveByPageId: Map<string, InteractiveElement[]>,
  startUrl: string
): TreeNode | null {
  if (pages.length === 0) {
    return null;
  }

  const canonicalStartUrl = canonicalizeUrl(startUrl);
  const sortedPages = sortPages(pages);
  const nodeMap = new Map<string, TreeNode & { children: TreeNode[] }>();

  for (const page of sortedPages) {
    const canonicalUrl = canonicalizeUrl(page.url);
    const screenshotPaths = Array.isArray(page.screenshotPaths)
      ? page.screenshotPaths
      : [];

    const elements = elementsByPageId.get(page._id) ?? [];
    const persistedInteractive = normalizePersistedInteractive(
      page.interactiveElements
    );
    const interactive =
      persistedInteractive.length > 0
        ? persistedInteractive
        : (interactiveByPageId.get(page._id) ?? []);

    const cssVariables = (page.globalStyles as any)?.cssVariables;
    const tokens = (page.globalStyles as any)?.tokens;

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

  return root;
}

export async function buildManifestFromProject(
  projectId: string,
  startUrl: string,
  options: { detectInteractiveElements: boolean }
): Promise<{ tree: TreeNode | null; projectId: string; startUrl: string }> {
  const pages = await fetchProjectPages(projectId);
  const elements = await fetchProjectElements(projectId);

  const elementsByPageId = new Map<string, ExtractedElement[]>();
  const interactiveByPageId = new Map<string, InteractiveElement[]>();

  for (const element of elements as ElementRecord[]) {
    if (!element.pageId) {
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
    pages as PageRecord[],
    elementsByPageId,
    interactiveByPageId,
    startUrl
  );

  return {
    tree,
    projectId,
    startUrl,
  };
}
