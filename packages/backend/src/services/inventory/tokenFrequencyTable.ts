import { categorizeElement } from "./elementCategory.js";
import { getNormalizedStyle, normalizeStyleValue } from "./normalizeStyles.js";
import type {
  InventoryCategory,
  InventoryTokenFrequency,
  InventoryTokenFrequencyTable,
  InventoryTokenCandidate,
  InventoryTokenGroup,
  ParsedInventoryElement,
  ParsedInventoryPage,
} from "./types.js";

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
  exampleElementIds: string[];
};

const PROPERTY_GROUPS: Array<{ group: InventoryTokenGroup; properties: string[] }> = [
  { group: "color", properties: ["color", "background-color", "border-color"] },
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

function buildFrequencyRows(accumulators: Iterable<TokenAccumulator>): InventoryTokenFrequency[] {
  return Array.from(accumulators)
    .map((token) => ({
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
      exampleElementIds: token.exampleElementIds.slice(0, 5),
    }))
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

    for (const { group, properties } of PROPERTY_GROUPS) {
      for (const property of properties) {
        const value = getNormalizedStyle(element.styles, property);
        if (!value || !shouldKeepValue(value)) {
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
            exampleElementIds: [],
          });
        }

        const acc = accumulators.get(key)!;
        acc.usageCount += 1;
        acc.pageIds.add(element.pageId);
        acc.categories.add(category);
        if (isInteractiveCategory(category)) {
          acc.interactiveUsageCount += 1;
        }
        if (acc.exampleElementIds.length < 5) {
          acc.exampleElementIds.push(element.id);
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
