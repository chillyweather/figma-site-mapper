import { PlaywrightCrawler, Configuration } from "crawlee";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { db } from "./db.js";
import { pages, elements } from "./schema.js";
import { eq, and, notInArray } from "drizzle-orm";
import { categorizeElement } from "./services/inventory/elementCategory.js";
import { normalizeStyleValue } from "./services/inventory/normalizeStyles.js";
import { bucketDimension } from "./services/inventory/signatureBuilders.js";

interface InteractiveElement {
  type: "link" | "button";
  x: number;
  y: number;
  width: number;
  height: number;
  href?: string;
  text?: string;
}

interface ExtractedElement {
  selector: string;
  tagName: string;
  type: string;
  classes: string[];
  id?: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  styles?: Record<string, string>;
  styleTokens?: string[];
  text?: string;
  href?: string;
  ariaLabel?: string;
  role?: string;
  parentTag?: string;
  parentSelector?: string;
  ancestryPath?: string;
  nearestInteractiveSelector?: string;
  isVisible?: boolean;
  regionLabel?: string;
  styleSignature?: string;
  componentFingerprint?: string;
  cropPath?: string;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  src?: string;
  alt?: string;
}

// CSS properties that we want to capture on every element.
const ELEMENT_STYLE_PROPERTIES = [
  "color",
  "background-color",
  "font-size",
  "font-family",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-decoration",
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "box-shadow",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "opacity",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
];

interface StyleData {
  elements: ExtractedElement[];
  cssVariables: Record<string, string>;
  tokens: string[];
}

interface PageData {
  url: string;
  title: string;
  screenshot: string[];
  interactiveElements?: InteractiveElement[];
  styleData?: StyleData;
  crawlOrder?: number;
}

// Language detection patterns
const LANGUAGE_PATTERNS = [
  /^\/(en|fr|de|es|it|pt|ru|ja|ko|zh)(\/|$)/i,
  /[?&]lang=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i,
  /[?&]language=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i,
  /[?&]locale=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i,
  /[?&]l=(en|fr|de|es|it|pt|ru|ja|ko|zh)(&|$)/i,
];

const COMMON_LANGUAGE_CODES = new Set([
  "en", "fr", "de", "es", "it", "pt", "ru", "ja", "ko", "zh",
]);

function detectLanguageFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const search = urlObj.search;

    for (const pattern of LANGUAGE_PATTERNS) {
      const pathnameMatch = pathname.match(pattern);
      if (pathnameMatch && pathnameMatch[1]) return pathnameMatch[1].toLowerCase();
      const searchMatch = search.match(pattern);
      if (searchMatch && searchMatch[1]) return searchMatch[1].toLowerCase();
    }

    const hostname = urlObj.hostname;
    const parts = hostname.split(".");
    if (parts.length >= 3) {
      const subdomain = parts[0]?.toLowerCase();
      if (subdomain && COMMON_LANGUAGE_CODES.has(subdomain)) return subdomain;
    }

    return null;
  } catch {
    return null;
  }
}

function getDefaultLanguage(startUrl: string): string {
  return detectLanguageFromUrl(startUrl) ?? "en";
}

function shouldCrawlUrl(
  url: string,
  options: {
    startUrl: string;
    defaultLanguageOnly?: boolean;
    maxDepth?: number;
    currentDepth?: number;
  }
): boolean {
  if (options.defaultLanguageOnly) {
    const defaultLanguage = getDefaultLanguage(options.startUrl);
    const urlLanguage = detectLanguageFromUrl(url);
    if (urlLanguage && urlLanguage !== defaultLanguage) return false;
  }

  if (
    options.maxDepth !== undefined &&
    options.maxDepth > 0 &&
    options.currentDepth !== undefined
  ) {
    if (options.currentDepth > options.maxDepth) return false;
  }

  return true;
}

interface StyleExtractionConfig {
  extractInteractiveElements: boolean;
  extractStructuralElements: boolean;
  extractTextElements: boolean;
  extractFormElements: boolean;
  extractMediaElements: boolean;
  extractColors: boolean;
  extractTypography: boolean;
  extractSpacing: boolean;
  extractLayout: boolean;
  extractBorders: boolean;
  includeSelectors: boolean;
  includeComputedStyles: boolean;
  captureOnlyVisibleElements: boolean;
}

function buildElementStyleSignature(styles?: Record<string, string>): string | undefined {
  if (!styles) return undefined;

  const properties = [
    "color",
    "background-color",
    "font-size",
    "font-family",
    "font-weight",
    "line-height",
    "border-color",
    "border-width",
    "border-radius",
    "box-shadow",
    "padding",
    "display",
    "position",
  ];

  const parts = properties
    .map((property) => {
      const normalized = normalizeStyleValue(property, styles[property]);
      return normalized ? `${property}:${normalized}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join("|") : undefined;
}

function buildElementFingerprint(element: ExtractedElement): string {
  const category = categorizeElement({
    id: "",
    pageId: "",
    projectId: "",
    type: element.type,
    selector: element.selector,
    tagName: element.tagName,
    elementId: element.id,
    classes: element.classes,
    bbox: element.boundingBox,
    href: element.href,
    text: element.text,
    styles: element.styles ?? {},
    styleTokens: element.styleTokens ?? [],
    ariaLabel: element.ariaLabel,
    role: element.role,
    value: element.value,
    placeholder: element.placeholder,
    checked: element.checked,
    src: element.src,
    alt: element.alt,
    parentTag: element.parentTag,
    parentSelector: element.parentSelector,
    ancestryPath: element.ancestryPath,
    nearestInteractiveSelector: element.nearestInteractiveSelector,
    isVisible: element.isVisible,
    regionLabel: element.regionLabel,
    styleSignature: element.styleSignature,
    componentFingerprint: element.componentFingerprint,
    cropPath: element.cropPath,
  });

  return [
    category,
    element.regionLabel || "content",
    element.parentTag || "none",
    bucketDimension(element.boundingBox?.width),
    bucketDimension(element.boundingBox?.height),
    element.styleSignature || "unstyled",
  ].join("|");
}

function shouldGenerateElementCrop(element: ExtractedElement): boolean {
  const bbox = element.boundingBox;
  if (!bbox) return false;
  if (bbox.width < 16 || bbox.height < 16) return false;
  if (bbox.width > 900 || bbox.height > 600) return false;

  const tagName = (element.tagName || "").toLowerCase();
  const role = (element.role || "").toLowerCase();
  const hasText = Boolean(element.text && element.text.trim().length > 0);
  const hasVisualStyles = Boolean(
    element.styles?.["background-color"] ||
      element.styles?.["border-color"] ||
      element.styles?.["box-shadow"]
  );

  if (
    /^h[1-6]$/.test(tagName) ||
    ["a", "button", "input", "select", "textarea", "img"].includes(tagName) ||
    role === "button" ||
    role === "link"
  ) {
    return true;
  }

  return hasText && hasVisualStyles;
}

async function extractStyleData(
  page: any,
  config: StyleExtractionConfig
): Promise<StyleData> {
  return await page.evaluate(
    (params: { config: StyleExtractionConfig; styleProperties: string[] }) => {
      const evaluateConfig = params.config;
      const styleProperties = params.styleProperties;
      interface ExtractedElementInner {
        selector: string;
        tagName: string;
        type: string;
        classes: string[];
        id?: string;
        boundingBox: { x: number; y: number; width: number; height: number };
        styles?: Record<string, string>;
        styleTokens?: string[];
        text?: string;
        href?: string;
        ariaLabel?: string;
        role?: string;
        parentTag?: string;
        parentSelector?: string;
        ancestryPath?: string;
        nearestInteractiveSelector?: string;
        isVisible?: boolean;
        regionLabel?: string;
        value?: string;
        placeholder?: string;
        checked?: boolean;
        src?: string;
        alt?: string;
      }

      const els: ExtractedElementInner[] = [];
      const allTokens = new Set<string>();
      const MAX_STYLE_ELEMENTS = 5000;
      const allElements = Array.from(document.querySelectorAll<HTMLElement>("*"));
      const maxElements = Math.min(allElements.length, MAX_STYLE_ELEMENTS);
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        window.innerHeight
      );

      const buildSelector = (node: Element | null): string | undefined => {
        if (!node) return undefined;
        if ((node as HTMLElement).id) return `#${(node as HTMLElement).id}`;
        const tag = node.tagName.toLowerCase();
        const className = (node as HTMLElement).className;
        if (typeof className === "string" && className.trim()) {
          const classes = className.trim().split(/\s+/).filter(Boolean).slice(0, 3);
          if (classes.length > 0) {
            return `${tag}.${classes.join(".")}`;
          }
        }
        return tag;
      };

      const getAncestryPath = (node: Element): string | undefined => {
        const segments: string[] = [];
        let current = node.parentElement;
        let depth = 0;
        while (current && depth < 5) {
          const selector = buildSelector(current);
          if (selector) segments.unshift(selector);
          current = current.parentElement;
          depth += 1;
        }
        return segments.length > 0 ? segments.join(" > ") : undefined;
      };

      const getNearestInteractiveSelector = (node: Element): string | undefined => {
        const interactive = node.closest(
          'a[href],button,input[type="button"],input[type="submit"],input[type="reset"],[role="button"],[role="link"]'
        );
        if (!interactive || interactive === node) return undefined;
        return buildSelector(interactive);
      };

      const detectRegionLabel = (
        node: HTMLElement,
        rect: DOMRect,
        role: string | null
      ): string => {
        const tag = node.tagName.toLowerCase();
        const idAndClass = `${node.id || ""} ${typeof node.className === "string" ? node.className : ""}`.toLowerCase();
        const absoluteTop = rect.top + window.scrollY;
        const absoluteBottom = absoluteTop + rect.height;

        if (tag === "header" || role === "banner") return "header";
        if (tag === "footer" || role === "contentinfo") return "footer";
        if (tag === "nav" || role === "navigation") return "navigation";
        if (tag === "aside" || idAndClass.includes("sidebar")) return "sidebar";
        if (tag === "form" || !!node.closest("form")) return "form";
        if (absoluteTop < Math.max(160, documentHeight * 0.15)) return "top";
        if (absoluteBottom > documentHeight * 0.85) return "bottom";
        return "content";
      };

      for (let i = 0; i < maxElements; i++) {
        const el = allElements[i];
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;

        let selector = el.tagName.toLowerCase();
        if (evaluateConfig.includeSelectors) {
          if (el.id) {
            selector = `#${el.id}`;
          } else if (el.className && typeof el.className === "string") {
            const classes = el.className.trim().split(/\s+/).filter(Boolean);
            if (classes.length > 0) {
              selector = `${el.tagName.toLowerCase()}.${classes.join(".")}`;
            }
          }
        }

        const computed = getComputedStyle(el);
        const isVisible =
          computed.display !== "none" &&
          computed.visibility !== "hidden" &&
          computed.visibility !== "collapse" &&
          computed.opacity !== "0" &&
          !el.hasAttribute("hidden") &&
          el.getAttribute("aria-hidden") !== "true" &&
          rect.width > 0 &&
          rect.height > 0;

        if (evaluateConfig.captureOnlyVisibleElements && !isVisible) continue;

        const styles: Record<string, string> = {};
        const elementTokens = new Set<string>();

        for (let p = 0; p < styleProperties.length; p++) {
          const propertyName = styleProperties[p] as string;
          if (!propertyName) continue;
          const inlineValue = el.style.getPropertyValue(propertyName)?.trim();

          if (inlineValue) {
            styles[propertyName] = inlineValue;
            if (inlineValue.startsWith("var(--")) elementTokens.add(inlineValue);
            continue;
          }

          if (!evaluateConfig.includeComputedStyles) continue;

          const computedValue = computed.getPropertyValue(propertyName)?.trim();
          if (computedValue) {
            styles[propertyName] = computedValue;
            if (computedValue.startsWith("var(--")) elementTokens.add(computedValue);
          }
        }

        elementTokens.forEach((token) => allTokens.add(token));

        const element: ExtractedElementInner = {
          selector,
          tagName: el.tagName.toLowerCase(),
          type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
          classes:
            el.className && typeof el.className === "string"
              ? el.className.trim().split(/\s+/).filter(Boolean)
              : [],
          id: el.id || undefined,
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          parentTag: el.parentElement?.tagName.toLowerCase() || undefined,
          parentSelector: buildSelector(el.parentElement),
          ancestryPath: getAncestryPath(el),
          nearestInteractiveSelector: getNearestInteractiveSelector(el),
          isVisible,
          regionLabel: detectRegionLabel(el, rect, el.getAttribute("role")),
        };

        if (Object.keys(styles).length > 0) element.styles = styles;
        if (elementTokens.size > 0) element.styleTokens = Array.from(elementTokens);

        const textContent = el.textContent?.trim();
        if (textContent) element.text = textContent.substring(0, 200);

        if (el.tagName === "A") element.href = (el as HTMLAnchorElement).href;

        const isButtonLike =
          el.tagName === "BUTTON" ||
          (el.tagName === "INPUT" &&
            ["button", "submit"].includes((el as HTMLInputElement).type));
        if (isButtonLike) {
          let btnHref =
            el.getAttribute("formaction") ||
            el.getAttribute("data-href") ||
            "";
          if (!btnHref) {
            const onclick = el.getAttribute("onclick") || "";
            const m = onclick.match(
              /(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/
            );
            if (m && m[1]) btnHref = m[1];
          }
          if (!btnHref) {
            const anchor = el.closest("a[href]") as HTMLAnchorElement | null;
            if (anchor) btnHref = anchor.href;
          }
          if (!btnHref) {
            const form = el.closest("form") as HTMLFormElement | null;
            if (form) {
              const action = form.getAttribute("action") || "";
              if (action) btnHref = action;
            }
          }
          if (btnHref) {
            try {
              element.href = new URL(btnHref, document.baseURI).href;
            } catch {
              element.href = btnHref;
            }
          }
        }

        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
          element.value = inputEl.value || undefined;
          element.placeholder = inputEl.placeholder || undefined;
          if (el.tagName === "INPUT") element.checked = (el as HTMLInputElement).checked || undefined;
        }

        if (el.tagName === "IMG") {
          const imgEl = el as HTMLImageElement;
          element.src = imgEl.src || undefined;
          element.alt = imgEl.alt || undefined;
        }

        element.ariaLabel = el.getAttribute("aria-label") || undefined;
        element.role = el.getAttribute("role") || undefined;

        els.push(element);
      }

      const rootComputed = getComputedStyle(document.documentElement);
      const cssVariables: Record<string, string> = {};

      for (let i = 0; i < rootComputed.length; i++) {
        const propName = rootComputed[i];
        if (propName && propName.startsWith("--")) {
          const value = rootComputed.getPropertyValue(propName).trim();
          if (value) cssVariables[propName] = value;
        }
      }

      const rootElement = document.documentElement as HTMLElement;
      if (rootElement && rootElement.style) {
        for (let i = 0; i < rootElement.style.length; i++) {
          const prop = rootElement.style[i];
          if (prop && prop.startsWith("--")) {
            const value = rootElement.style.getPropertyValue(prop).trim();
            if (value) cssVariables[prop] = value;
          }
        }
      }

      return { elements: els, cssVariables, tokens: Array.from(allTokens) };
    },
    { config, styleProperties: ELEMENT_STYLE_PROPERTIES }
  );
}

function buildTree(pagesList: PageData[], startUrl: string): PageData | null {
  if (pagesList.length === 0) return null;

  if (pagesList.length === 1) {
    const page = pagesList[0]!;
    const numberedTitle = page.crawlOrder ? `${page.crawlOrder}_${page.title}` : page.title;
    return { ...page, title: numberedTitle, children: [] } as PageData & { children: PageData[] };
  }

  const pageMap = new Map<string, PageData & { children: PageData[] }>();
  let root: (PageData & { children: PageData[] }) | null = null;
  const canonicalStartUrl = new URL(startUrl).toString();

  for (const page of pagesList) {
    const canonicalUrl = new URL(page.url).toString();
    const numberedTitle = page.crawlOrder ? `${page.crawlOrder}_${page.title}` : page.title;
    pageMap.set(canonicalUrl, { ...page, title: numberedTitle, children: [] });
  }

  for (const page of pagesList) {
    const canonicalUrl = new URL(page.url).toString();
    const node = pageMap.get(canonicalUrl)!;

    if (canonicalUrl === canonicalStartUrl) {
      root = node;
      continue;
    }

    let parentUrl = "";
    try {
      const urlObject = new URL(canonicalUrl);
      if (urlObject.pathname !== "/") {
        urlObject.pathname =
          urlObject.pathname.substring(0, urlObject.pathname.lastIndexOf("/")) || "/";
        parentUrl = urlObject.toString();
      }
    } catch {
      /* ignore */
    }

    const parentNode = pageMap.get(parentUrl);
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      console.log(`⚠️  Orphaned page (no parent found): ${canonicalUrl}`);
      if (root) root.children.push(node);
    }
  }

  return root;
}

const screenshotDir = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
const elementCropDir = path.join(screenshotDir, "elements");
if (!fs.existsSync(elementCropDir)) fs.mkdirSync(elementCropDir, { recursive: true });

function getSafeFilename(url: string): string {
  return url.replace(/[^a-zA-Z0-9]/g, "_");
}

async function sliceScreenshot(
  imageBuffer: Buffer,
  url: string,
  publicUrl: string,
  maxHeight: number = 4096,
  overlap: number = 0
): Promise<string[]> {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.height || !metadata.width) throw new Error("Could not get image dimensions");

    const { width, height } = metadata;
    console.log(`📐 Original screenshot dimensions: ${width}x${height} for ${url}`);

    if (width <= 0 || height <= 0) throw new Error(`Invalid image dimensions: ${width}x${height}`);

    if (height <= maxHeight) {
      const safeFileName = getSafeFilename(url);
      const screenshotFileName = `${safeFileName}.png`;
      await image.toFile(path.join(screenshotDir, screenshotFileName));
      return [`${publicUrl}/screenshots/${screenshotFileName}`];
    }

    if (height <= overlap) {
      console.log(`⚠️  Image height (${height}) <= overlap (${overlap}), saving as single slice`);
      const safeFileName = getSafeFilename(url);
      const screenshotFileName = `${safeFileName}.png`;
      await image.toFile(path.join(screenshotDir, screenshotFileName));
      return [`${publicUrl}/screenshots/${screenshotFileName}`];
    }

    const numSlices = Math.max(1, Math.ceil((height - maxHeight) / (maxHeight - overlap)) + 1);
    const slices: string[] = [];

    console.log(`🖼️  Slicing large screenshot (${width}x${height}) into ${numSlices} pieces for ${url}`);

    for (let i = 0; i < numSlices; i++) {
      let sliceTop = i * (maxHeight - overlap);
      let sliceHeight = maxHeight;

      if (i === numSlices - 1) {
        sliceHeight = height - sliceTop;
        if (sliceHeight < overlap) {
          sliceTop = height - maxHeight;
          sliceHeight = maxHeight;
        }
      }

      console.log(`📝 Processing slice ${i + 1}/${numSlices}: top=${sliceTop}, height=${sliceHeight}, image bounds=${height}`);

      if (sliceTop >= height) { console.error(`❌ Invalid sliceTop: ${sliceTop} >= ${height}`); continue; }
      if (sliceTop + sliceHeight > height) { console.error(`❌ Invalid extract area`); continue; }

      const safeFileName = getSafeFilename(url);
      const sliceFileName = `${safeFileName}_slice_${i + 1}_of_${numSlices}.png`;
      const slicePath = path.join(screenshotDir, sliceFileName);

      try {
        await image.clone().extract({ left: 0, top: sliceTop, width, height: sliceHeight }).toFile(slicePath);
        slices.push(`${publicUrl}/screenshots/${sliceFileName}`);
        console.log(`📸 Created slice ${i + 1}/${numSlices}: ${width}x${sliceHeight}px at y=${sliceTop}`);
      } catch (error) {
        console.error(`❌ Failed to create slice ${i + 1}/${numSlices}:`, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }

    return slices;
  } catch (error) {
    console.error(`❌ sliceScreenshot failed for ${url}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

const ELEMENT_INSERT_CHUNK = 200;

async function generateElementCrops(
  imageBuffer: Buffer,
  url: string,
  elements: ExtractedElement[],
  publicUrl: string,
  viewportWidth: number | null
): Promise<Array<string | undefined>> {
  const cropPaths = new Array<string | undefined>(elements.length).fill(undefined);

  try {
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      return cropPaths;
    }

    const imageWidth = metadata.width;
    const imageHeight = metadata.height;
    const scale =
      viewportWidth && viewportWidth > 0 ? imageWidth / viewportWidth : 1;
    const safeFileName = getSafeFilename(url);
    const MAX_CROPS = 200;
    let generated = 0;

    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      if (!element || !shouldGenerateElementCrop(element)) continue;
      if (generated >= MAX_CROPS) break;

      const bbox = element.boundingBox;
      if (!bbox) continue;

      const padding = 8;
      const left = Math.max(0, Math.round((bbox.x - padding) * scale));
      const top = Math.max(0, Math.round((bbox.y - padding) * scale));
      const width = Math.min(
        imageWidth - left,
        Math.max(1, Math.round((bbox.width + padding * 2) * scale))
      );
      const height = Math.min(
        imageHeight - top,
        Math.max(1, Math.round((bbox.height + padding * 2) * scale))
      );

      if (width <= 0 || height <= 0) continue;

      const cropFileName = `${safeFileName}_element_${index + 1}.png`;
      const cropPath = path.join(elementCropDir, cropFileName);

      await sharp(imageBuffer)
        .extract({ left, top, width, height })
        .resize({ width: 320, height: 240, fit: "inside", withoutEnlargement: true })
        .toFile(cropPath);

      cropPaths[index] = `${publicUrl}/screenshots/elements/${cropFileName}`;
      generated += 1;
    }
  } catch (error) {
    console.warn(
      `Failed to generate element crops for ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return cropPaths;
}

export async function runCrawler(
  startUrl: string,
  publicUrl: string,
  maxRequestsPerCrawl?: number,
  deviceScaleFactor: number = 1,
  jobId?: string,
  delay: number = 0,
  requestDelay: number = 1000,
  maxDepth?: number,
  defaultLanguageOnly: boolean = false,
  sampleSize: number = 3,
  showBrowser: boolean = false,
  detectInteractiveElements: boolean = true,
  captureOnlyVisibleElements: boolean = true,
  highlightAllElements: boolean = false,
  fullRefresh: boolean = false,
  projectId?: string,
  auth?: {
    method: "credentials" | "cookies";
    loginUrl?: string;
    username?: string;
    password?: string;
    cookies?: Array<{ name: string; value: string }>;
  },
  styleExtraction?: {
    enabled: boolean;
    preset: string;
    extractInteractiveElements: boolean;
    extractStructuralElements: boolean;
    extractTextElements: boolean;
    extractFormElements: boolean;
    extractMediaElements: boolean;
    extractColors: boolean;
    extractTypography: boolean;
    extractSpacing: boolean;
    extractLayout: boolean;
    extractBorders: boolean;
    includeSelectors: boolean;
    includeComputedStyles: boolean;
    captureOnlyVisibleElements?: boolean;
  }
): Promise<{
  visitedUrls: string[];
  visitedPageIds: string[];
  pageCount: number;
  startUrl: string;
  capturedCookies: Array<{ name: string; value: string; domain: string }>;
}> {
  console.log("🚀 Starting the crawler with URL:", startUrl);
  console.log("📊 Crawler settings:", {
    maxRequestsPerCrawl, deviceScaleFactor, delay, requestDelay, maxDepth,
    defaultLanguageOnly, sampleSize, showBrowser, detectInteractiveElements, highlightAllElements,
    captureOnlyVisibleElements,
    styleExtraction: styleExtraction?.enabled ? styleExtraction.preset : "disabled",
  });

  let projectNumId: number | null = null;
  if (projectId) {
    const n = parseInt(projectId, 10);
    if (isNaN(n) || n <= 0) {
      throw new Error(`Invalid projectId: ${projectId}`);
    }
    projectNumId = n;
  }

  const storageDir = jobId
    ? path.join(process.cwd(), "storage", `job-${jobId}`)
    : path.join(process.cwd(), "storage", "default");

  console.log(`📁 Using storage directory: ${storageDir}`);

  const userAgents = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  ];
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  const urlObj = new URL(startUrl);
  urlObj.hash = "";
  const canonicalStartUrl = urlObj.toString();
  const defaultLanguage = getDefaultLanguage(canonicalStartUrl);

  const crawledPages: PageData[] = [];
  const visitedPageIds = new Set<string>();
  let currentPage = 0;
  let totalPages = 0;
  let isTerminating = false;
  let pageCounter = 1;
  let missingProjectIdWarned = false;

  const shouldTerminate = () =>
    !!(maxRequestsPerCrawl && maxRequestsPerCrawl > 0 && currentPage >= maxRequestsPerCrawl);

  let authSuccess = false;
  if (auth) {
    console.log(`🔐 Attempting authentication via ${auth.method}`);
    try {
      if (auth.method === "cookies" && auth.cookies) {
        console.log(`🍪 Setting ${auth.cookies.length} cookies for authentication`);
        authSuccess = true;
      } else if (auth.method === "credentials" && auth.loginUrl && auth.username && auth.password) {
        console.log(`🔑 Will attempt login at ${auth.loginUrl} for user ${auth.username}`);
        authSuccess = true;
      }
    } catch (error) {
      console.error(`❌ Authentication setup failed:`, error);
      authSuccess = false;
    }
  }

  const sectionUrlMap = new Map<string, string[]>();
  const crawledUrls = new Set<string>();

  function calculateUrlDepth(url: string): number {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split("/").filter((s) => s.length > 0).length;
    } catch { return 0; }
  }

  function getSectionKey(url: string): string {
    try {
      const urlObj = new URL(url);
      const segments = urlObj.pathname.split("/").filter((s) => s.length > 0);
      if (segments.length === 0) return "root";
      const first = segments[0]!;
      if (COMMON_LANGUAGE_CODES.has(first)) return segments[1] || "root";
      return first;
    } catch { return "root"; }
  }

  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hash = "";
      return u.toString();
    } catch {
      return url;
    }
  }

  let progressUpdateWarned = false;

  const updateProgress = async (
    stage: string,
    currentPage?: number,
    totalPages?: number,
    currentUrl?: string
  ) => {
    if (!jobId) return;
    try {
      const progress =
        totalPages && currentPage ? Math.round((currentPage / totalPages) * 100) : 0;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await fetch(`${publicUrl}/progress/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, currentPage, totalPages, currentUrl, progress }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch {
      if (!progressUpdateWarned) {
        console.warn(`Progress updates disabled for job ${jobId} (backend server not available)`);
        progressUpdateWarned = true;
      }
    }
  };

  const maxRequestsPerMinute =
    requestDelay > 0 ? Math.floor(60000 / (requestDelay + 500)) : 30;

  let crawler: PlaywrightCrawler;

  const crawlerConfig = new Configuration({
    storageClientOptions: { localDataDirectory: storageDir },
  });

  crawler = new PlaywrightCrawler(
    {
      launchContext: {
        launchOptions: {
          args: [
            ...(deviceScaleFactor > 1 ? ["--device-scale-factor=2"] : []),
            "--disable-infobars",
            "--disable-extensions-except=",
            "--disable-extensions",
            "--no-first-run",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
          ],
          headless: !showBrowser,
          slowMo: 100,
          devtools: false,
        },
        userAgent: randomUserAgent,
      },
      navigationTimeoutSecs: 30,
      requestHandlerTimeoutSecs: 300,
      maxConcurrency: 1,
      maxRequestsPerMinute,
      retryOnBlocked: true,
      maxRequestRetries: 3,
      useSessionPool: true,
      persistCookiesPerSession: true,

      async requestHandler({ request, page, log, enqueueLinks }) {
        if (isTerminating) {
          log.info(`Skipping ${request.url} - crawler is terminating`);
          return;
        }

        // Cookie authentication on first request
        if (auth?.method === "cookies" && auth.cookies && !authSuccess) {
          try {
            log.info(`🍪 Setting cookies for authentication`);
            for (const cookie of auth.cookies) {
              await page.context().addCookies([{
                name: cookie.name,
                value: cookie.value,
                url: canonicalStartUrl,
                domain: new URL(canonicalStartUrl).hostname,
              }]);
            }
            authSuccess = true;
            log.info(`✅ Cookies set successfully`);
          } catch (error) {
            log.error(`❌ Failed to set cookies: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        // Use the actual landing URL after any redirects as the canonical key
        const finalUrl = normalizeUrl(page.url());
        if (finalUrl !== request.url) {
          log.info(`Redirect: ${request.url} -> ${finalUrl}`);
        }

        const currentDepth = calculateUrlDepth(finalUrl);
        if (!shouldCrawlUrl(finalUrl, { startUrl: canonicalStartUrl, defaultLanguageOnly, maxDepth, currentDepth })) {
          log.info(`Skipping ${finalUrl} due to language/depth filters`);
          return;
        }

        const sectionKey = getSectionKey(finalUrl);
        const existingSectionUrls = sectionUrlMap.get(sectionKey) || [];
        if (sampleSize > 0 && existingSectionUrls.length >= sampleSize) {
          log.info(`Skipping ${finalUrl} - section ${sectionKey} already has ${existingSectionUrls.length} pages`);
          return;
        }

        if (crawledUrls.has(finalUrl)) {
          log.info(`Skipping ${finalUrl} - already crawled`);
          return;
        }

        const isLikelyLoginPage =
          finalUrl.includes("/login") ||
          finalUrl.includes("/signin") ||
          finalUrl.includes("/auth");

        log.info(`Current page: ${currentPage}, Max requests: ${maxRequestsPerCrawl}`);
        if (shouldTerminate() && !isLikelyLoginPage) {
          log.info(`Skipping ${finalUrl} - reached max requests limit`);
          if (!isTerminating) {
            isTerminating = true;
            log.info(`🛑 Reached max requests limit, initiating early shutdown`);
            try { await crawler.autoscaledPool?.abort(); } catch (e) {
              log.info(`Graceful abort failed: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          return;
        }

        currentPage++;
        crawledUrls.add(finalUrl);
        existingSectionUrls.push(finalUrl);
        sectionUrlMap.set(sectionKey, existingSectionUrls);

        await updateProgress("crawling", currentPage, totalPages, finalUrl);

        await page.setExtraHTTPHeaders({
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"macOS"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Upgrade-Insecure-Requests": "1",
        });

        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {
          log.info("Network idle timeout, continuing anyway");
        });

        // CAPTCHA detection
        const captchaDetection = await page.evaluate(() => {
          const captchaSelectors = [
            '[src*="captcha"]', '[class*="captcha"]', '[id*="captcha"]',
            '[src*="shieldsquare"]', '[class*="shieldsquare"]',
            'iframe[src*="recaptcha"]', ".g-recaptcha", '[src*="hcaptcha"]', ".h-captcha",
          ];
          const cloudflareSelectors = [
            '[class*="cf-browser-verification"]', '[id*="cf-wrapper"]',
            ".cf-im-under-attack", ".cf-browser-verification",
          ];

          const foundElements: string[] = [];
          captchaSelectors.forEach((s) => { if (document.querySelector(s)) foundElements.push(s); });
          const foundCloudflare: string[] = [];
          cloudflareSelectors.forEach((s) => { if (document.querySelector(s)) foundCloudflare.push(s); });

          let hasSpecificText = false;
          let hasCaptchaTitle = false;
          if (foundElements.length > 0 || foundCloudflare.length > 0) {
            const bodyText = document.body.textContent?.toLowerCase() || "";
            hasSpecificText = [
              "verify you are human", "prove you are not a robot",
              "please complete the security check", "robot check", "i'm not a robot",
            ].some((t) => bodyText.includes(t));
            hasCaptchaTitle = [
              "security check", "human verification", "captcha", "are you a robot",
            ].some((t) => document.title.toLowerCase().includes(t));
          }

          return {
            hasCaptcha: (foundElements.length > 0 && (hasSpecificText || hasCaptchaTitle)) || foundCloudflare.length > 0,
            foundElements, foundCloudflare, hasSpecificText, hasCaptchaTitle,
            pageTitle: document.title,
          };
        });

        if (captchaDetection.hasCaptcha) {
          log.info(`🚨 CAPTCHA detected on ${finalUrl}`);
          log.info(`👤 Please solve CAPTCHA manually. Waiting up to 2 minutes...`);
          try {
            await Promise.race([
              page.waitForNavigation({ timeout: 120000 }),
              page.waitForFunction(
                () => {
                  const captchaElements = document.querySelectorAll(
                    '[src*="captcha"],[class*="captcha"],[id*="captcha"],[src*="shieldsquare"],[class*="shieldsquare"],iframe[src*="recaptcha"],.g-recaptcha,[src*="hcaptcha"],.h-captcha,[class*="cf-browser-verification"],[id*="cf-wrapper"]'
                  );
                  const bodyText = document.body.textContent?.toLowerCase() || "";
                  const stillHasText = [
                    "verify you are human", "prove you are not a robot", "security check",
                  ].some((t) => bodyText.includes(t));
                  return captchaElements.length === 0 && !stillHasText;
                },
                { timeout: 120000 }
              ),
              page.waitForTimeout(120000),
            ]);
            log.info(`✅ CAPTCHA appears to be resolved, continuing`);
            await page.waitForTimeout(2000);
          } catch {
            log.info(`⏰ CAPTCHA timeout on ${finalUrl}, skipping page`);
            return;
          }
        }

        if (delay > 0) {
          log.info(`Waiting ${delay}ms for dynamic content to load`);
          await page.waitForTimeout(delay);
        }

        // Hide extra sticky/fixed elements
        try {
          await page.evaluate(() => {
            const stickyElements = document.querySelectorAll(
              '[style*="position: fixed"], [style*="position: sticky"], .sticky, .fixed'
            );
            stickyElements.forEach((el, index) => {
              if (index > 0) (el as HTMLElement).style.display = "none";
            });
            document.documentElement.style.transform = "none";
            document.body.style.transform = "none";
          });
        } catch { log.info(`Could not handle sticky elements for ${finalUrl}`); }

        // Scroll to trigger lazy loading
        try {
          await page.evaluate(async () => {
            const scrollHeight = document.documentElement.scrollHeight;
            const viewportHeight = window.innerHeight;
            let pos = 0;
            while (pos < scrollHeight) {
              pos += viewportHeight;
              window.scrollTo(0, pos);
              await new Promise((r) => setTimeout(r, Math.min(500, 500)));
            }
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
          });
          await page.waitForTimeout(delay > 0 ? Math.min(2000, delay / 2) : 1000);
          log.info(`Completed scrolling through ${finalUrl}`);
        } catch { log.info(`Scrolling failed or not needed for ${finalUrl}`); }

        const title = await page.title();
        log.info(`Crawled ${finalUrl} - Title: ${title}`);

        await updateProgress("screenshot", currentPage, totalPages, finalUrl);

        // Ensure page is at the top before screenshot
        try {
          await page.evaluate(() => {
            window.scrollTo({ top: 0, behavior: "instant" });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
          });
          await page.waitForTimeout(300);
        } catch { log.info(`⚠️ Could not ensure top position for ${finalUrl}`); }

        // Interactive elements
        let interactiveElements: InteractiveElement[] = [];
        if (detectInteractiveElements) {
          log.info(`Finding interactive elements on ${finalUrl}`);
          interactiveElements = await page.evaluate(() => {
            const els: Array<{ type: "link" | "button"; x: number; y: number; width: number; height: number; href?: string; text?: string }> = [];

            document.querySelectorAll("a[href]").forEach((link) => {
              const rect = link.getBoundingClientRect();
              const href = link.getAttribute("href") || "";
              const id = link.getAttribute("id") || "";
              if (
                id === "__docusaurus_skipToContent_fallback" ||
                !href || href === "#" || href.startsWith("javascript:") ||
                rect.width < 10 || rect.height < 10
              ) return;
              if (rect.width > 0 && rect.height > 0) {
                els.push({
                  type: "link",
                  x: rect.left + window.scrollX,
                  y: rect.top + window.scrollY,
                  width: rect.width,
                  height: rect.height,
                  href: href || undefined,
                  text: link.textContent?.trim().substring(0, 100) || undefined,
                });
              }
            });

            document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"]').forEach((button) => {
              const rect = button.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                let btnHref =
                  button.getAttribute("formaction") ||
                  button.getAttribute("data-href") ||
                  "";
                if (!btnHref) {
                  const onclick = button.getAttribute("onclick") || "";
                  const m = onclick.match(
                    /(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/
                  );
                  if (m && m[1]) btnHref = m[1];
                }
                if (!btnHref) {
                  const anchor = button.closest("a[href]") as HTMLAnchorElement | null;
                  if (anchor) btnHref = anchor.href;
                }
                if (!btnHref) {
                  const form = button.closest("form") as HTMLFormElement | null;
                  if (form) {
                    const action = form.getAttribute("action") || "";
                    if (action) btnHref = action;
                  }
                }
                let resolved: string | undefined;
                if (btnHref) {
                  try {
                    resolved = new URL(btnHref, document.baseURI).href;
                  } catch {
                    resolved = btnHref;
                  }
                }
                els.push({
                  type: "button",
                  x: rect.left + window.scrollX,
                  y: rect.top + window.scrollY,
                  width: rect.width,
                  height: rect.height,
                  href: resolved,
                  text:
                    button.textContent?.trim().substring(0, 100) ||
                    (button as HTMLInputElement).value?.substring(0, 100) ||
                    undefined,
                });
              }
            });

            els.sort((a, b) => (Math.abs(a.y - b.y) < 5 ? a.x - b.x : a.y - b.y));
            return els;
          });
          log.info(`Found ${interactiveElements.length} interactive elements on ${finalUrl}`);
        }

        // Style extraction
        let styleData: StyleData | undefined;
        if (styleExtraction?.enabled) {
          log.info(`Extracting style data on ${finalUrl} (preset: ${styleExtraction.preset})`);
          styleData = await extractStyleData(page, {
            extractInteractiveElements: styleExtraction.extractInteractiveElements,
            extractStructuralElements: styleExtraction.extractStructuralElements,
            extractTextElements: styleExtraction.extractTextElements,
            extractFormElements: styleExtraction.extractFormElements,
            extractMediaElements: styleExtraction.extractMediaElements,
            extractColors: styleExtraction.extractColors,
            extractTypography: styleExtraction.extractTypography,
            extractSpacing: styleExtraction.extractSpacing,
            extractLayout: styleExtraction.extractLayout,
            extractBorders: styleExtraction.extractBorders,
            includeSelectors: styleExtraction.includeSelectors,
            includeComputedStyles: styleExtraction.includeComputedStyles,
            captureOnlyVisibleElements:
              styleExtraction.captureOnlyVisibleElements ?? captureOnlyVisibleElements,
          });
          log.info(`Extracted ${styleData.elements.length} elements and ${Object.keys(styleData.cssVariables).length} CSS variables`);
        }

        const fullPageBuffer = await page.screenshot({ fullPage: true });

        await updateProgress("processing", currentPage, totalPages, finalUrl);
        const screenshotSlices = await sliceScreenshot(fullPageBuffer, finalUrl, publicUrl);
        log.info(`Generated ${screenshotSlices.length} screenshot slice(s) for ${finalUrl}`);

        if (styleData?.elements?.length) {
          const viewportWidth = page.viewportSize()?.width ?? null;
          const cropPaths = await generateElementCrops(
            fullPageBuffer,
            finalUrl,
            styleData.elements,
            publicUrl,
            viewportWidth
          );

          styleData.elements = styleData.elements.map((element, index) => {
            const styleSignature = buildElementStyleSignature(element.styles);
            const enriched: ExtractedElement = {
              ...element,
              styleSignature,
              cropPath: cropPaths[index],
            };
            enriched.componentFingerprint = buildElementFingerprint(enriched);
            return enriched;
          });

          const cropCount = cropPaths.filter(Boolean).length;
          log.info(`Generated ${cropCount} element crop(s) for ${finalUrl}`);
        }

        // ── Persist to SQLite ───────────────────────────────────────────────
        if (projectNumId !== null) {
          try {
            const now = new Date();

            const pageResult = db
              .insert(pages)
              .values({
                projectId: projectNumId,
                url: finalUrl,
                title,
                screenshotPaths: JSON.stringify(screenshotSlices),
                interactiveElements: JSON.stringify(interactiveElements),
                globalStyles: styleData
                  ? JSON.stringify({ cssVariables: styleData.cssVariables, tokens: styleData.tokens })
                  : null,
                lastCrawledAt: now,
                lastCrawlJobId: jobId ?? null,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: [pages.projectId, pages.url],
                set: {
                  title,
                  screenshotPaths: JSON.stringify(screenshotSlices),
                  interactiveElements: JSON.stringify(interactiveElements),
                  globalStyles: styleData
                    ? JSON.stringify({ cssVariables: styleData.cssVariables, tokens: styleData.tokens })
                    : null,
                  lastCrawledAt: now,
                  lastCrawlJobId: jobId ?? null,
                  updatedAt: now,
                },
              })
              .returning({ id: pages.id })
              .get();

            if (!pageResult) throw new Error(`Page upsert returned null for ${finalUrl}`);

            const pageId = pageResult.id;
            visitedPageIds.add(String(pageId));

            // Delete old elements for this page
            db.delete(elements).where(eq(elements.pageId, pageId)).run();

            // Build elements to insert
            type InsertElement = typeof elements.$inferInsert;

            const styleElementsToInsert: InsertElement[] =
              styleData?.elements?.reduce<InsertElement[]>((acc, element) => {
                const { boundingBox } = element;
                if (!boundingBox) return acc;
                acc.push({
                  pageId,
                  projectId: projectNumId!,
                  type: element.type || element.tagName || "node",
                  selector: element.selector,
                  tagName: element.tagName,
                  elementId: element.id,
                  classes: JSON.stringify(element.classes?.slice() ?? []),
                  bbox: JSON.stringify(boundingBox),
                  href: element.href,
                  text: element.text,
                  styles: JSON.stringify(element.styles ?? {}),
                  styleTokens: JSON.stringify(element.styleTokens?.slice() ?? []),
                  ariaLabel: element.ariaLabel,
                  role: element.role,
                  parentTag: element.parentTag,
                  parentSelector: element.parentSelector,
                  ancestryPath: element.ancestryPath,
                  nearestInteractiveSelector: element.nearestInteractiveSelector,
                  isVisible: element.isVisible,
                  regionLabel: element.regionLabel,
                  styleSignature: element.styleSignature,
                  componentFingerprint: element.componentFingerprint,
                  cropPath: element.cropPath,
                  value: element.value,
                  placeholder: element.placeholder,
                  checked: element.checked,
                  src: element.src,
                  alt: element.alt,
                  createdAt: now,
                  updatedAt: now,
                });
                return acc;
              }, []) ?? [];

            const interactiveElementsToInsert: InsertElement[] =
              styleElementsToInsert.length === 0
                ? interactiveElements.map((el) => ({
                    pageId,
                    projectId: projectNumId!,
                    type: el.type,
                    selector: "",
                    tagName: el.type === "link" ? "a" : "button",
                    classes: "[]",
                    bbox: JSON.stringify({ x: el.x, y: el.y, width: el.width, height: el.height }),
                    href: el.href,
                    text: el.text,
                    styles: "{}",
                    styleTokens: "[]",
                    isVisible: true,
                    regionLabel: el.y < 200 ? "top" : "content",
                    createdAt: now,
                    updatedAt: now,
                  }))
                : [];

            const allElements = [...styleElementsToInsert, ...interactiveElementsToInsert];
            if (allElements.length > 0) {
              for (let i = 0; i < allElements.length; i += ELEMENT_INSERT_CHUNK) {
                db.insert(elements).values(allElements.slice(i, i + ELEMENT_INSERT_CHUNK)).run();
              }
              log.info(`Persisted ${allElements.length} elements for ${finalUrl}`);
            } else {
              log.info(`No elements to persist for ${finalUrl}`);
            }
          } catch (error) {
            log.error(`❌ Failed to persist page data for ${finalUrl}: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
          }
        } else if (!missingProjectIdWarned) {
          log.info(`No projectId supplied; skipping database persistence`);
          missingProjectIdWarned = true;
        }

        crawledPages.push({
          url: finalUrl,
          title,
          screenshot: screenshotSlices,
          interactiveElements,
          styleData,
          crawlOrder: pageCounter++,
        });

        // Log discovered links
        try {
          const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll("a[href]"))
              .map((a) => ({ href: a.getAttribute("href"), text: a.textContent?.trim().substring(0, 50) }))
              .slice(0, 10)
          );
          log.info(`Found ${links.length} links on ${finalUrl}: ${links.map((l) => l.href).join(", ")}`);
        } catch { log.info(`Could not extract links from ${finalUrl}`); }

        // Enqueue links
        const nearLimit = maxRequestsPerCrawl && maxRequestsPerCrawl > 0 && currentPage >= maxRequestsPerCrawl;
        if (!shouldTerminate() && !nearLimit && (!maxRequestsPerCrawl || maxRequestsPerCrawl > 1)) {
          try {
            await page.waitForTimeout(500);
            await enqueueLinks({
              strategy: "same-domain",
              transformRequestFunction: (request) => {
                const url = new URL(request.url);
                const blockedPatterns = [
                  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)$/i,
                  /\/api\//i, /\/assets\//i, /\/images\//i, /\/css\//i, /\/js\//i,
                  /\#.*$/, /\?.*$/,
                ];
                if (blockedPatterns.some((p) => p.test(url.pathname))) return false;
                return request;
              },
            });
            log.info(`Successfully enqueued links from ${finalUrl}`);
          } catch (error) {
            log.error(`Failed to enqueue links from ${finalUrl}: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          log.info(`Not enqueueing further links (limit reached or near limit)`);
        }
      },

      failedRequestHandler({ request, log }) {
        log.error(`Request ${request.url} failed.`);
      },

      preNavigationHooks: [
        async ({ request, page, log }) => {
          if (isTerminating || shouldTerminate()) {
            if (!isTerminating) {
              isTerminating = true;
              log.info(`🛑 Early termination engaged before navigating to ${request.url}`);
              try { await crawler.autoscaledPool?.abort(); } catch (e) {
                log.info(`Abort in preNavigation failed: ${e instanceof Error ? e.message : String(e)}`);
              }
            } else {
              log.info(`Skipping (pre-nav) ${request.url} - terminating`);
            }
            return;
          }

          // Credential authentication
          if (auth?.method === "credentials" && auth.loginUrl && auth.username && auth.password) {
            const loginUrlNormalized = new URL(auth.loginUrl).toString();
            const currentUrlNormalized = new URL(request.url).toString();

            if (currentUrlNormalized === loginUrlNormalized && !authSuccess) {
              log.info(`🔑 Attempting login at ${auth.loginUrl}`);
              try {
                await page.goto(auth.loginUrl, { waitUntil: "networkidle" });
                const usernameSelector = await page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"], #username, #email').first();
                const passwordSelector = await page.locator('input[type="password"], input[name*="pass"], #password').first();
                const submitSelector = await page.locator('button[type="submit"], input[type="submit"], button:has-text("login"), button:has-text("sign in")').first();

                if (usernameSelector && passwordSelector) {
                  await usernameSelector.fill(auth.username);
                  await passwordSelector.fill(auth.password);
                  if (submitSelector) {
                    await submitSelector.click();
                    await page.waitForLoadState("networkidle", { timeout: 10000 });
                    const successIndicators = await page.locator('a[href*="logout"], button:has-text("logout"), .user-menu, .profile, [data-testid*="user"]').count();
                    if (successIndicators > 0) {
                      log.info(`✅ Login successful`);
                      authSuccess = true;
                    } else {
                      log.info(`⚠️ Login may have failed`);
                    }
                  }
                }
              } catch (error) {
                log.error(`❌ Login failed: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
          }

          const baseDelay = maxRequestsPerCrawl && maxRequestsPerCrawl <= 3 ? 0 : requestDelay;
          const randomVariation = Math.floor(Math.random() * 500) - 250;
          const totalDelay = Math.max(0, baseDelay + randomVariation);
          if (totalDelay > 0) log.info(`Adding ${totalDelay}ms delay before navigating to ${request.url}`);
          await new Promise((resolve) => setTimeout(resolve, totalDelay));
        },
      ],
    },
    crawlerConfig
  );

  totalPages = maxRequestsPerCrawl || 100;
  await updateProgress("starting", 0, totalPages, canonicalStartUrl);
  await crawler.run([canonicalStartUrl]);

  // Full refresh cleanup — remove pages not visited in this job
  if (projectNumId !== null && fullRefresh) {
    if (visitedPageIds.size === 0) {
      console.log("⚠️ Full refresh requested but no pages were crawled; skipping cleanup.");
    } else {
      try {
        const keepIds = Array.from(visitedPageIds).map((id) => parseInt(id, 10));
        const stalePageRows = db
          .select({ id: pages.id })
          .from(pages)
          .where(and(eq(pages.projectId, projectNumId), notInArray(pages.id, keepIds)))
          .all();

        if (stalePageRows.length > 0) {
          const staleIds = stalePageRows.map((r) => r.id);
          console.log(`🧹 Full refresh: removing ${staleIds.length} stale page(s)`);
          db.delete(elements).where(and(eq(elements.projectId, projectNumId), notInArray(elements.pageId, keepIds))).run();
          db.delete(pages).where(notInArray(pages.id, keepIds)).run();
        } else {
          console.log("🧹 Full refresh enabled but no stale pages found.");
        }
      } catch (cleanupError) {
        console.error(`❌ Full refresh cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }
    }
  }

  // Capture cookies before teardown
  let capturedCookies: Array<{ name: string; value: string; domain: string }> = [];
  try {
    const browserPool = (crawler as any).browserPool;
    if (browserPool?.activeBrowsers?.size > 0) {
      const browserController = Array.from(browserPool.activeBrowsers.values())[0] as any;
      if (browserController?.browser) {
        const contexts = browserController.browser.contexts();
        if (contexts?.length > 0) {
          const allCookies = await contexts[0].cookies();
          capturedCookies = allCookies.map((c: any) => ({ name: c.name, value: c.value, domain: c.domain }));
          console.log(`🍪 Captured ${capturedCookies.length} cookies from browser session`);
        }
      }
    }
  } catch (error) {
    console.log(`Could not capture cookies: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await crawler.teardown();
    console.log("✅ Crawler cleaned up successfully");
  } catch (error) {
    console.error(`❌ Error cleaning up crawler: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log(`📊 Total pages crawled: ${crawledPages.length}`);
  console.log("📄 Crawled pages:", crawledPages.map((p) => p.url));
  console.log("✅ Crawler finished. Data persisted to SQLite.");

  const toCanonicalUrl = (url: string): string => {
    try {
      const n = new URL(url);
      n.hash = "";
      return n.toString();
    } catch {
      return url;
    }
  };

  return {
    visitedUrls: crawledPages.map((p) => toCanonicalUrl(p.url)),
    visitedPageIds: Array.from(visitedPageIds),
    pageCount: crawledPages.length,
    startUrl: canonicalStartUrl,
    capturedCookies,
  };
}

export async function openAuthSession(url: string): Promise<{
  cookies: Array<{ name: string; value: string; domain: string }>;
}> {
  console.log(`🔐 Opening authentication session for ${url}`);

  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-popup-blocking",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-site-isolation-trials",
    ],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  let lastSnapshotCount = 0;

  const captureCookies = async () => {
    try {
      const allCookies = await context.cookies();
      if (allCookies.length !== lastSnapshotCount) {
        console.log(`🍪 Snapshot captured with ${allCookies.length} cookies`);
        lastSnapshotCount = allCookies.length;
      }
      return allCookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain }));
    } catch (error) {
      console.warn(`⚠️ Failed to capture cookies: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  };

  let cookies: Array<{ name: string; value: string; domain: string }> = [];
  let browserClosed = false;
  let pollInterval: NodeJS.Timeout | null = null;
  let finalizingSession: Promise<void> | null = null;

  const stopPolling = () => {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  };

  const finalizeSession = async (reason: string) => {
    if (finalizingSession) return finalizingSession;
    finalizingSession = (async () => {
      if (browserClosed) return;
      console.log(`🛑 Finalizing auth session due to: ${reason}`);
      browserClosed = true;
      stopPolling();
      const latestCookies = await captureCookies();
      if (latestCookies.length > 0) {
        cookies = latestCookies;
        console.log(`📥 Final snapshot captured ${latestCookies.length} cookies`);
      }
      try { await browser.close(); } catch (error) {
        console.warn(`⚠️ Error closing auth browser: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
    return finalizingSession;
  };

  page.on("close", () => { console.log("🪟 Page closed by user"); void finalizeSession("page-close"); });
  context.on("close", () => { console.log("🧩 Browser context closed"); void finalizeSession("context-close"); });
  browser.on("disconnected", () => {
    console.log("💥 Browser disconnected");
    browserClosed = true;
    stopPolling();
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    console.log(`✅ Browser opened at ${url}`);
    console.log(`👤 Please complete login/CAPTCHA, then close the browser window.`);

    pollInterval = setInterval(async () => {
      const snapshot = await captureCookies();
      if (snapshot.length > 0) cookies = snapshot;
    }, 1000);

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (browserClosed) { clearInterval(check); stopPolling(); resolve(); }
      }, 100);
    });

    if (finalizingSession) await finalizingSession;

    console.log(`🔒 Browser closed. 🍪 Captured ${cookies.length} cookies`);
    return { cookies };
  } catch (error) {
    console.error(`❌ Auth session error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    await finalizeSession("finally-cleanup");
  }
}
