import { categorizeElement } from "./elementCategory.js";
import { getNormalizedStyle, normalizeStyleValue } from "./normalizeStyles.js";
import type {
  InventoryCategory,
  InventoryTokenFrequency,
  InventoryTokenFrequencyTable,
  InventoryTokenCandidate,
  InventoryTokenGroup,
  InventoryTokenOccurrence,
  ParsedInventoryElement,
  ParsedInventoryPage,
} from "./types.js";

type BucketEntry = {
  elementId: string;
  bbox: [number, number, number, number];
  area: number;
  pageId: string;
  classKey: string;
  tagName: string;
};

type TokenAccumulator = {
  group: InventoryTokenGroup;
  property: string;
  value: string;
  usageCount: number;
  pageIds: Set<string>;
  categories: Set<InventoryCategory>;
  interactiveUsageCount: number;
  cssVariableNames: Set<string>;
  styleTokenNames: Set<string>;
  bucketed: Map<string, BucketEntry>;
};

function classKeyFor(element: ParsedInventoryElement): string {
  // One representative per HTML tag per page — e.g. one <p>, one <a>, one <h2>.
  return (element.tagName ?? element.type ?? "node").toLowerCase();
}

const PROPERTY_GROUPS: Array<{ group: InventoryTokenGroup; properties: string[] }> = [
  { group: "color", properties: ["color", "background-color", "border-color", "fill", "stroke"] },
  {
    group: "typography",
    properties: ["font-size", "font-family", "font-weight", "line-height"],
  },
  {
    group: "spacing",
    properties: [
      "padding",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "margin",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
    ],
  },
  { group: "radius", properties: ["border-radius"] },
  { group: "shadow", properties: ["box-shadow"] },
];

function buildCssVariableIndex(pages: ParsedInventoryPage[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const page of pages) {
    for (const [name, rawValue] of Object.entries(page.cssVariables || {})) {
      const normalized = normalizeStyleValue("color", rawValue) || normalizeStyleValue("font-size", rawValue) || rawValue;
      const value = String(normalized || rawValue).trim();
      if (!value) continue;
      if (!map.has(value)) map.set(value, new Set<string>());
      map.get(value)!.add(name);
    }
  }

  return map;
}

function isInteractiveCategory(category: InventoryCategory): boolean {
  return category === "button" || category === "link" || category === "input" || category === "select" || category === "textarea";
}

function emptyTable(): InventoryTokenFrequencyTable {
  return {
    colors: [],
    typography: [],
    spacing: [],
    radii: [],
    shadows: [],
  };
}

function tableKeyForGroup(group: InventoryTokenGroup): keyof InventoryTokenFrequencyTable {
  switch (group) {
    case "color":
      return "colors";
    case "radius":
      return "radii";
    case "shadow":
      return "shadows";
    default:
      return group;
  }
}

function shouldKeepValue(value: string): boolean {
  return Boolean(value && value !== "none" && value !== "normal" && value !== "0px");
}

const TEXT_PAINT_CATEGORIES = new Set<InventoryCategory>([
  "button",
  "link",
  "input",
  "select",
  "textarea",
  "heading",
  "text-block",
]);

const TEXT_PAINT_TAGS = new Set([
  "a",
  "button",
  "label",
  "li",
  "option",
  "p",
  "small",
  "span",
  "strong",
  "em",
  "b",
  "i",
  "td",
  "th",
  "figcaption",
  "caption",
  "summary",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

const FORM_CONTROL_TAGS = new Set(["input", "select", "textarea"]);

// The CSS `color` property is inherited down the DOM, so many wrapper nodes
// inherit a computed color even when they do not paint anything themselves.
// Count `color` only when the element paints text directly, or when its own
// fill/stroke matches the computed color.
function elementPaintsWithCssColor(
  element: ParsedInventoryElement,
  category: InventoryCategory
): boolean {
  const color = getNormalizedStyle(element.styles, "color");
  if (!color) return false;

  const fill = getNormalizedStyle(element.styles, "fill");
  if (fill && fill !== "none" && fill === color) return true;

  const stroke = getNormalizedStyle(element.styles, "stroke");
  if (stroke && stroke !== "none" && stroke === color) return true;

  const tagName = (element.tagName ?? element.type ?? "").toLowerCase();
  const text = typeof element.text === "string" ? element.text.trim() : "";

  if (FORM_CONTROL_TAGS.has(tagName)) {
    return true;
  }

  if (TEXT_PAINT_CATEGORIES.has(category) || TEXT_PAINT_TAGS.has(tagName)) {
    return text.length > 0;
  }

  return false;
}

function buildFrequencyRows(accumulators: Iterable<TokenAccumulator>): InventoryTokenFrequency[] {
  return Array.from(accumulators)
    .map((token) => {
      const occurrences: InventoryTokenOccurrence[] = Array.from(token.bucketed.values())
        .sort((a, b) => {
          const pageDelta = Number(a.pageId) - Number(b.pageId);
          if (pageDelta !== 0) return pageDelta;
          return b.area - a.area;
        })
        .map((entry) => ({
          pageId: entry.pageId,
          elementId: entry.elementId,
          bbox: entry.bbox,
          classKey: entry.classKey,
          tagName: entry.tagName,
        }));
      return {
        value: token.value,
        type: token.property,
        usageCount: token.usageCount,
        pageCount: token.pageIds.size,
        pageIds: Array.from(token.pageIds).sort((a, b) => Number(a) - Number(b)),
        categoriesUsedIn: Array.from(token.categories).sort(),
        interactiveUsageCount: token.interactiveUsageCount,
        tokenBacked: token.cssVariableNames.size > 0 || token.styleTokenNames.size > 0,
        cssVariableSources: Array.from(token.cssVariableNames).sort(),
        styleTokenSources: Array.from(token.styleTokenNames).sort(),
        exampleElementIds: occurrences.slice(0, 5).map((o) => o.elementId),
        representativeOccurrences: occurrences,
      } satisfies InventoryTokenFrequency;
    })
    .sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      if (b.pageCount !== a.pageCount) return b.pageCount - a.pageCount;
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.value.localeCompare(b.value);
    });
}

export function buildTokenFrequencyTable(
  pages: ParsedInventoryPage[],
  elements: ParsedInventoryElement[]
): InventoryTokenFrequencyTable {
  const cssVariableIndex = buildCssVariableIndex(pages);
  const accumulators = new Map<string, TokenAccumulator>();

  for (const element of elements) {
    const category = categorizeElement(element);

    const paintsWithColor = elementPaintsWithCssColor(element, category);

    for (const { group, properties } of PROPERTY_GROUPS) {
      for (const property of properties) {
        const value = getNormalizedStyle(element.styles, property);
        if (!value || !shouldKeepValue(value)) {
          continue;
        }

        // Skip the inherited `color` cascade when nothing on this element
        // actually paints with it. Other color-group properties
        // (background-color, border-color, fill, stroke) always paint when present.
        if (property === "color" && !paintsWithColor) {
          continue;
        }

        const key = `${group}:${property}:${value}`;
        if (!accumulators.has(key)) {
          accumulators.set(key, {
            group,
            property,
            value,
            usageCount: 0,
            pageIds: new Set<string>(),
            categories: new Set<InventoryCategory>(),
            interactiveUsageCount: 0,
            cssVariableNames: new Set<string>(),
            styleTokenNames: new Set<string>(),
            bucketed: new Map<string, BucketEntry>(),
          });
        }

        const acc = accumulators.get(key)!;
        acc.usageCount += 1;
        acc.pageIds.add(element.pageId);
        acc.categories.add(category);
        if (isInteractiveCategory(category)) {
          acc.interactiveUsageCount += 1;
        }
        if (element.bbox && element.isVisible !== false) {
          const { x, y, width, height } = element.bbox;
          const area = Math.max(0, width) * Math.max(0, height);
          if (area >= 4 && Number.isFinite(x) && Number.isFinite(y)) {
            const classKey = classKeyFor(element);
            const bucketKey = `${element.pageId}::${classKey}`;
            const existing = acc.bucketed.get(bucketKey);
            if (!existing || area > existing.area) {
              acc.bucketed.set(bucketKey, {
                elementId: element.id,
                bbox: [x, y, width, height],
                area,
                pageId: element.pageId,
                classKey,
                tagName: element.tagName ?? element.type ?? "node",
              });
            }
          }
        }

        for (const token of element.styleTokens) {
          acc.styleTokenNames.add(token);
        }

        const cssVariables = cssVariableIndex.get(value);
        if (cssVariables) {
          for (const variable of cssVariables) {
            acc.cssVariableNames.add(variable);
          }
        }
      }
    }
  }

  const table = emptyTable();
  for (const group of PROPERTY_GROUPS.map((entry) => entry.group)) {
    const rows = Array.from(accumulators.values()).filter(
      (token) => token.group === group
    );
    table[tableKeyForGroup(group)] = buildFrequencyRows(rows);
  }

  return table;
}

export function flattenTokenFrequencyTable(
  table: InventoryTokenFrequencyTable
): InventoryTokenFrequency[] {
  return [
    ...table.colors,
    ...table.typography,
    ...table.spacing,
    ...table.radii,
    ...table.shadows,
  ];
}

// Backwards-compatible adapter for the old heuristic inconsistency pass.
// API consumers should use buildTokenFrequencyTable instead.
export function analyzeTokenCandidates(
  pages: ParsedInventoryPage[],
  elements: ParsedInventoryElement[]
): InventoryTokenCandidate[] {
  return flattenTokenFrequencyTable(buildTokenFrequencyTable(pages, elements)).map(
    (token) => ({
      candidateId: `${token.type}:${token.value}`,
      group:
        token.type.includes("color")
          ? "color"
          : token.type.includes("font") || token.type === "line-height"
            ? "typography"
            : token.type.includes("radius")
              ? "radius"
              : token.type.includes("shadow")
                ? "shadow"
                : "spacing",
      property: token.type,
      value: token.value,
      usageCount: token.usageCount,
      pageCount: token.pageCount,
      interactiveUsageCount: token.interactiveUsageCount,
      categoriesUsedIn: token.categoriesUsedIn,
      tokenBacked: token.tokenBacked,
      cssVariableNames: token.cssVariableSources,
      styleTokenNames: token.styleTokenSources,
    })
  );
}
