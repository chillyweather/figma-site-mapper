# CONTEXT — figma-sitemapper

This file is the project's glossary. It defines the language the team uses for concepts so terminology stays consistent across docs, code, and conversations.

It is not a spec, not a roadmap, not implementation notes. Implementation lives in `docs/ARCHITECTURE.md` and `CLAUDE.md`. Decisions live in `docs/adr/`.

## Glossary

### Project
A unit of work for one client website. Has its own captured pages, crawl runs, mapping decisions, and inventory workspace.

### Crawl
The discovery + capture pipeline. Discovers candidate URLs, designer approves, Playwright captures screenshots and DOM data for each approved page.

### Mapping
The process of identifying design-system component candidates on a captured site and producing a Figma file organised one-page-per-component-type for designer review. Replaces what the manual [[tidy-mapper]] plugin did by hand. See ADR-0001 for the relationship to [[ds-inventory-legacy]].

### Component candidate
A single detected instance of a UI component on a captured page — e.g. one specific button on the pricing page. Has a source URL, a bbox on the source screenshot, a crop image, and an assigned [[component-type]]. The unit emitted by [[ds-mapping-command]] and rendered as a slice in the Figma output.

### Component type
The named bucket a [[component-candidate]] belongs to. The taxonomy is the fixed list inherited from [[tidy-mapper]]:

Accordion, Avatar, Background, Breadcrumbs, Buttons, Checkbox, Cards, Chip, Date Picker, Dropdown-menu, Drawer, Divider, Filters, Header, Icon, Input, Info Messages, KPI, List, Link, Loader, Modal (Dialogue), Navigation, Pagination, Progress-bar, Pop-up, Popover, Pie chart, Radio Button, Scroll Bar, Search, Slider, Slot, Severity, Status, Stepper, Segment Control, Tabs, Table, Tags, Toast, Tooltips, Toggle, Toolbar/Header, Widgets, Wizard, Upload element, Other.

The mapping agent may promote candidates from `Other` to a new named type only when confident.

### Source back-link
The pointer from a rendered component on a [[mapper-page]] back to where it was found on the source screenshot. Implemented as a [[trail]] (a frame on the source screenshot page at the component's bbox) plus a Figma node hyperlink from the per-type page's link text to the trail frame. Not plugin data, not a URL — a Figma-node-graph reference. Inherited from [[tidy-mapper]]'s convention.

### Trail
A magenta dashed-border `FRAME` left on a source screenshot page after a component is processed, positioned at the original bbox. Named `"{component-type} trail"`, hidden by default, toggled via the [[tidy-mapper]] "show trails" / "show chosen" actions. The target of the [[source-back-link]].

### Slice (intermediate)
A Figma `SLICE` node drawn on a screenshot page during the detection step, named with a [[component-type]]. Slices are consumed by the grab step (rasterized → trail created → original slice removed), so they only exist between detection and grab. Site Mapper's `/ds-mapping` renders the entire pipeline in one shot, so slices are an internal intermediate; designers see [[trail]]s and rasters, not slices.

### Over-delivery
The mapping detection policy: bias hard toward recall. False positives (wrong candidates the designer deletes) are cheap; false negatives (missed components) are expensive. A designer pruning 30% of crops is preferred over missing 10% of real components.

### Mapper page
A Figma page in the auto-generated mapping output, named exactly for a [[component-type]] (`Buttons`, `Cards`, etc.). Contains one top-level auto-layout frame named `"{type} mapping"`, with a title row and a `content` frame of numbered rows. Each row holds a rasterized component image and a hyperlink to the [[trail]] on its source page. Matches [[tidy-mapper]]'s output exactly so its `grab-slices` action will append further candidates to the same page when the designer adds manual slices later.

### DS Inventory (legacy)
The original pipeline for design-system audit (clusters, tokens, inconsistencies, templates, notes). The clusters portion is being replaced by [[mapping]]; the rest is dormant — the data infrastructure stays, no plugin rendering. See ADR-0001.

### `/ds-mapping` command
The Claude Code slash command that runs the mapping agent. Reads the prepared mapping workspace under `packages/backend/workspace/<projectId>/`, makes vision tool calls to detect [[component-candidate]]s, writes `decisions/components.json`. Designer triggers workspace prep from the Site Mapper plugin, runs `/ds-mapping <projectId>` in their terminal, returns to the plugin to render.

Re-runs only happen on failure of the first run. After the designer accepts the output, additions are made manually via [[tidy-mapper]] in the same Figma file.

### Tidy Mapper (external plugin)
The manual mapping Figma plugin, lives at `tidy-dev-team/tidy-ds-toolbox`, branch `big-ai-refactoring`, path `src/plugins/tidy-mapper`. Used today for manual component labeling. Reads and writes a specific Figma file shape that figma-sitemapper's mapping output must match exactly. After auto-mapping, the designer uses Tidy Mapper to add components the agent missed — same file, same conventions.
