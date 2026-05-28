import type {
  MappingComponentDecision,
  MappingComponentInstance,
  MappingDecisionFile,
  MappingDecisionValidationResult,
} from "./types.js";

// Vendored from tidy-dev-team/tidy-ds-toolbox@big-ai-refactoring, May 2026
// (src/plugins/tidy-mapper/constants.ts — ELEMENT_OPTIONS)
// Pin commit before production use.
export const TIDY_MAPPER_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  "Accordion",
  "Alert",
  "Avatar",
  "Badge",
  "Banner",
  "Breadcrumb",
  "Button",
  "Buttons",
  "Card",
  "Cards",
  "Carousel",
  "Chart",
  "Checkbox",
  "Chip",
  "Color Picker",
  "Data Table",
  "Date Picker",
  "Dialog",
  "Divider",
  "Drawer",
  "Dropdown",
  "File Upload",
  "Footer",
  "Form",
  "Header",
  "Hero",
  "Icon",
  "Icon Button",
  "Image",
  "Input",
  "Link",
  "List",
  "Loading",
  "Menu",
  "Modal",
  "Navigation",
  "Notification",
  "Pagination",
  "Popover",
  "Progress",
  "Radio",
  "Search",
  "Select",
  "Sidebar",
  "Skeleton",
  "Slider",
  "Spinner",
  "Stepper",
  "Switch",
  "Table",
  "Tabs",
  "Tag",
  "Textarea",
  "Time Picker",
  "Toast",
  "Toggle",
  "Tooltip",
  "Other",
]);

// Common singular/plural or casing variants → canonical name
const TYPE_ALIASES: Record<string, string> = {
  button: "Buttons",
  buttons: "Buttons",
  card: "Cards",
  cards: "Cards",
  accordion: "Accordion",
  alert: "Alert",
  alerts: "Alert",
  avatar: "Avatar",
  avatars: "Avatar",
  badge: "Badge",
  badges: "Badge",
  banner: "Banner",
  banners: "Banner",
  breadcrumb: "Breadcrumb",
  breadcrumbs: "Breadcrumb",
  carousel: "Carousel",
  chart: "Chart",
  charts: "Chart",
  checkbox: "Checkbox",
  chip: "Chip",
  chips: "Chip",
  dialog: "Dialog",
  dialogs: "Dialog",
  divider: "Divider",
  drawer: "Drawer",
  dropdown: "Dropdown",
  footer: "Footer",
  form: "Form",
  forms: "Form",
  header: "Header",
  hero: "Hero",
  icon: "Icon",
  icons: "Icon",
  image: "Image",
  images: "Image",
  input: "Input",
  inputs: "Input",
  link: "Link",
  links: "Link",
  list: "List",
  lists: "List",
  loading: "Loading",
  menu: "Menu",
  menus: "Menu",
  modal: "Modal",
  modals: "Modal",
  navigation: "Navigation",
  notification: "Notification",
  notifications: "Notification",
  pagination: "Pagination",
  popover: "Popover",
  progress: "Progress",
  radio: "Radio",
  search: "Search",
  select: "Select",
  sidebar: "Sidebar",
  skeleton: "Skeleton",
  slider: "Slider",
  spinner: "Spinner",
  spinners: "Spinner",
  stepper: "Stepper",
  switch: "Switch",
  table: "Table",
  tables: "Table",
  tabs: "Tabs",
  tag: "Tag",
  tags: "Tag",
  textarea: "Textarea",
  toast: "Toast",
  toasts: "Toast",
  toggle: "Toggle",
  tooltip: "Tooltip",
  tooltips: "Tooltip",
  other: "Other",
};

export function normalizeComponentType(raw: string): string {
  if (!raw || typeof raw !== "string") return "Other";
  const trimmed = raw.trim();
  if (!trimmed) return "Other";
  // Starts with "Slice" → Other (Tidy Mapper convention)
  if (trimmed.startsWith("Slice")) return "Other";
  // Exact match in taxonomy
  if (TIDY_MAPPER_COMPONENT_TYPES.has(trimmed)) return trimmed;
  // Alias lookup
  const alias = TYPE_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  // Unknown but non-empty — treat as promoted type if it looks like a proper noun
  // (starts with uppercase) and has no spaces or reasonable length
  if (/^[A-Z]/.test(trimmed) && trimmed.length <= 40) return trimmed;
  return "Other";
}

function isBboxValid(bbox: unknown, pageW = 20000, pageH = 200000): boolean {
  if (!bbox || typeof bbox !== "object") return false;
  const b = bbox as Record<string, unknown>;
  return (
    typeof b.x === "number" &&
    typeof b.y === "number" &&
    typeof b.width === "number" &&
    typeof b.height === "number" &&
    b.x >= 0 &&
    b.y >= 0 &&
    (b.width as number) > 0 &&
    (b.height as number) > 0 &&
    (b.x as number) <= pageW &&
    (b.y as number) <= pageH
  );
}

function isValidSource(source: unknown): source is "dom" | "vision" {
  return source === "dom" || source === "vision";
}

function validateInstance(
  raw: unknown,
  index: number,
  warnings: string[]
): MappingComponentInstance | null {
  if (!raw || typeof raw !== "object") {
    warnings.push(`Instance at index ${index}: not an object`);
    return null;
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.pageId !== "string" || !r.pageId) {
    warnings.push(`Instance at index ${index}: missing or invalid pageId`);
    return null;
  }
  if (!isBboxValid(r.bbox)) {
    warnings.push(`Instance at index ${index} (page ${r.pageId}): invalid or out-of-bounds bbox — skipped`);
    return null;
  }
  const originElementId =
    typeof r.originElementId === "number"
      ? String(r.originElementId)
      : typeof r.originElementId === "string"
      ? r.originElementId
      : undefined;
  const elementId = typeof r.elementId === "string" && r.elementId
    ? r.elementId
    : originElementId;
  const source: "dom" | "vision" = isValidSource(r.source) ? r.source : "dom";
  if (source === "dom" && !elementId) {
    warnings.push(`Instance at index ${index} (page ${r.pageId}): DOM instance missing elementId/originElementId`);
    return null;
  }
  const confidence =
    r.confidence === "high" || r.confidence === "medium" || r.confidence === "low"
      ? r.confidence
      : undefined;
  const instanceId = typeof r.instanceId === "string" && r.instanceId
    ? r.instanceId
    : elementId
    ? `${r.pageId}:${elementId}`
    : `${r.pageId}:vision:${index}`;

  return {
    instanceId,
    pageId: r.pageId as string,
    sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : undefined,
    elementId,
    originElementId: originElementId ?? elementId,
    originSelector: typeof r.originSelector === "string" ? r.originSelector : undefined,
    bbox: r.bbox as { x: number; y: number; width: number; height: number },
    source,
    confidence,
    rawLabel: typeof r.rawLabel === "string" ? r.rawLabel : undefined,
    label: typeof r.label === "string" ? r.label : typeof r.rawLabel === "string" ? r.rawLabel : undefined,
    notes: typeof r.notes === "string" ? r.notes : undefined,
  };
}

export function validateMappingDecisions(
  raw: unknown,
  warnings: string[]
): MappingComponentDecision[] {
  if (!raw || typeof raw !== "object") {
    warnings.push("Decision file is not an object");
    return [];
  }
  const file = raw as Record<string, unknown>;
  const components = Array.isArray(file.componentTypes) ? file.componentTypes : file.components;
  if (!Array.isArray(components)) {
    warnings.push("Decision file missing componentTypes/components array");
    return [];
  }

  const result: MappingComponentDecision[] = [];
  for (let i = 0; i < components.length; i += 1) {
    const comp = components[i] as Record<string, unknown>;
    const rawType = typeof comp.type === "string" ? comp.type : "";
    const type = normalizeComponentType(rawType);
    if (!rawType) {
      warnings.push(`Component at index ${i}: missing type — mapped to Other`);
    } else if (rawType !== type) {
      warnings.push(`Component at index ${i}: type "${rawType}" normalised to "${type}"`);
    }

    const instances = Array.isArray(comp.instances) ? comp.instances : [];
    const validInstances: MappingComponentInstance[] = [];
    for (let j = 0; j < instances.length; j += 1) {
      const inst = validateInstance(instances[j], j, warnings);
      if (inst) validInstances.push(inst);
    }

    if (validInstances.length > 0) {
      result.push({
        type,
        promotedFromOther: comp.promotedFromOther === true,
        instances: validInstances,
      });
    } else {
      warnings.push(`Component at index ${i} (type "${type}"): no valid instances — skipped`);
    }
  }
  if (Array.isArray(file.otherInstances)) {
    const otherInstances: MappingComponentInstance[] = [];
    for (let i = 0; i < file.otherInstances.length; i += 1) {
      const inst = validateInstance(file.otherInstances[i], i, warnings);
      if (inst) otherInstances.push(inst);
    }
    if (otherInstances.length > 0) {
      result.push({ type: "Other", instances: otherInstances });
    }
  }
  return result;
}

export function validateDecisionFile(raw: unknown): MappingDecisionValidationResult {
  const warnings: string[] = [];
  const valid = validateMappingDecisions(raw, warnings);
  return { valid, warnings };
}

export function loadAndValidateDecisionFile(content: string): MappingDecisionValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return { valid: [], warnings: [`Failed to parse decision file: ${err instanceof Error ? err.message : String(err)}`] };
  }
  return validateDecisionFile(parsed);
}

export function extractDecisionFileMetadata(raw: unknown): { generatedAt: string | null; projectId: string | null } {
  if (!raw || typeof raw !== "object") return { generatedAt: null, projectId: null };
  const f = raw as Record<string, unknown>;
  return {
    generatedAt: typeof f.generatedAt === "string" ? f.generatedAt : null,
    projectId: typeof f.projectId === "string" ? f.projectId : null,
  };
}

export function parseDecisionFile(content: string): MappingDecisionFile | null {
  try {
    const raw = JSON.parse(content);
    if (!raw || typeof raw !== "object") return null;
    return raw as MappingDecisionFile;
  } catch {
    return null;
  }
}
