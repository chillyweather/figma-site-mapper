// Vendored from tidy-dev-team/tidy-ds-toolbox@big-ai-refactoring, May 2026
// (src/plugins/tidy-mapper/constants.ts — ELEMENT_OPTIONS)
// Pin the upstream commit before production use.

export const TIDY_MAPPER_COMPONENT_TYPES = [
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
] as const;

export type TidyMapperComponentType = (typeof TIDY_MAPPER_COMPONENT_TYPES)[number];

export const TIDY_MAPPER_COMPONENT_TYPE_SET: ReadonlySet<string> = new Set(
  TIDY_MAPPER_COMPONENT_TYPES
);

export function isTidyMapperType(value: string): value is TidyMapperComponentType {
  return TIDY_MAPPER_COMPONENT_TYPE_SET.has(value);
}
