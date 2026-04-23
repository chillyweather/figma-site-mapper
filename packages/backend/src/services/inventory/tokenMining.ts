import { categorizeElement } from "./elementCategory.js";
import { getNormalizedStyle, normalizeStyleValue } from "./normalizeStyles.js";
import type {
  InventoryCategory,
  InventoryTokenCandidate,
  InventoryTokenGroup,
  ParsedInventoryElement,
  ParsedInventoryPage,
} from "./types.js";

type CandidateAccumulator = {
  candidateId: string;
  group: InventoryTokenGroup;
  property: string;
  value: string;
  usageCount: number;
  pageIds: Set<string>;
  categories: Set<InventoryCategory>;
  interactiveUsageCount: number;
  cssVariableNames: Set<string>;
  styleTokenNames: Set<string>;
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

export function analyzeTokenCandidates(
  pages: ParsedInventoryPage[],
  elements: ParsedInventoryElement[]
): InventoryTokenCandidate[] {
  const cssVariableIndex = buildCssVariableIndex(pages);
  const accumulators = new Map<string, CandidateAccumulator>();

  for (const element of elements) {
    const category = categorizeElement(element);

    for (const { group, properties } of PROPERTY_GROUPS) {
      for (const property of properties) {
        const value = getNormalizedStyle(element.styles, property);
        if (!value || value === "none" || value === "normal" || value === "0px") {
          continue;
        }

        const key = `${group}:${property}:${value}`;
        if (!accumulators.has(key)) {
          accumulators.set(key, {
            candidateId: key,
            group,
            property,
            value,
            usageCount: 0,
            pageIds: new Set<string>(),
            categories: new Set<InventoryCategory>(),
            interactiveUsageCount: 0,
            cssVariableNames: new Set<string>(),
            styleTokenNames: new Set<string>(),
          });
        }

        const acc = accumulators.get(key)!;
        acc.usageCount += 1;
        acc.pageIds.add(element.pageId);
        acc.categories.add(category);
        if (isInteractiveCategory(category)) {
          acc.interactiveUsageCount += 1;
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

  return Array.from(accumulators.values())
    .filter((candidate) => candidate.usageCount >= 2)
    .map((candidate) => ({
      candidateId: candidate.candidateId,
      group: candidate.group,
      property: candidate.property,
      value: candidate.value,
      usageCount: candidate.usageCount,
      pageCount: candidate.pageIds.size,
      interactiveUsageCount: candidate.interactiveUsageCount,
      categoriesUsedIn: Array.from(candidate.categories).sort(),
      tokenBacked:
        candidate.cssVariableNames.size > 0 || candidate.styleTokenNames.size > 0,
      cssVariableNames: Array.from(candidate.cssVariableNames).sort(),
      styleTokenNames: Array.from(candidate.styleTokenNames).sort(),
    }))
    .sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      if (b.pageCount !== a.pageCount) return b.pageCount - a.pageCount;
      return a.candidateId.localeCompare(b.candidateId);
    });
}
