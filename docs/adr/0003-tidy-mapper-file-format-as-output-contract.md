# Tidy Mapper's Figma file format is the binding output contract for mapping

The Figma file produced by `/ds-mapping` rendering must match exactly the file shape that the external **Tidy Mapper** plugin (`tidy-dev-team/tidy-ds-toolbox`, branch `big-ai-refactoring`, path `src/plugins/tidy-mapper`) produces from its `grab-slices` action.

The reason is the post-automation workflow: after the agent's first pass, the designer prunes wrong candidates and then **uses the manual Tidy Mapper plugin in the same Figma file** to add components the agent missed. For Tidy Mapper to append to the same pages as if a human had grabbed them, the auto-generated pages must be indistinguishable from manually-created ones.

## The file format (captured from `big-ai-refactoring` commit, May 2026)

**Source-page artifacts (left on the screenshot page after grab):**
- A `FRAME` per detected component, positioned at the source bbox (`absoluteBoundingBox` of the original slice).
- Frame name: `"{type} trail"` (e.g. `"Buttons trail"`).
- Style: magenta dashed border (`{r: 0.98, g: 0, b: 1}`), no fill, 1px stroke `INSIDE`, dash pattern `[8, 8]`, `cornerRadius: 4`.
- `visible: false` by default. Designer toggles visibility via Tidy Mapper's "show trails" action.

**Per-type page (one Figma page per component type the agent emitted):**
- Page name = exact type name from the taxonomy (`"Buttons"`, `"Cards"`, `"Other"`, etc.).
- Single top-level vertical auto-layout `FRAME` named `"{type} mapping"`, padding 80×80, item spacing 120, white fill.
  - Contains `titleRow` (horizontal auto-layout) → `TextNode` `"{type} Mapping"`, 80px font.
  - Contains `content` (vertical auto-layout, item spacing 40), whose children are numbered rows:
    - Each row: horizontal auto-layout `FRAME` named `"row"`, item spacing 56, containing:
      - `TextNode` with the 1-based row number, 48px font.
      - `FRAME` named with the type (e.g. `"Buttons"`), horizontal auto-layout, item spacing 16, containing:
        - `FRAME` named `"wrapper"` with vertical auto-layout, padding 40, dashed grey border, `cornerRadius: 4`, holding a child `FRAME` whose `fills` is the rasterized PNG (2× scale `IMAGE` fill, `scaleMode: FILL`).
        - `TextNode` `"🔗 Link"`, blue (`LINK_COLOR`), with `hyperlink: { type: "NODE", value: <trail frame id> }` pointing to the trail on the source page.

**The back-link mechanism is a Figma node hyperlink** — *not* plugin data, *not* a URL/coordinate stored on the slice. This is the entire trail mechanism.

**Default-name behaviour.** Tidy Mapper's grab logic rewrites any slice whose name starts with `"Slice"` (Figma's default) to `"Other"`. Our agent should never emit `"Slice"`-prefixed names; explicit `"Other"` is fine.

**Append behaviour.** If a `"Buttons"` page and a `"Buttons mapping"` frame already exist, Tidy Mapper appends additional numbered rows to the existing `content` frame. So Site Mapper's auto-render and Tidy Mapper's manual grab interoperate naturally as long as page/frame names match exactly.

## Consequences

- Tidy Mapper's file conventions are a versioned external contract. The constants (colours, padding, font sizes, dash patterns) and the frame-name vocabulary (`"{type} mapping"`, `"content"`, `"wrapper"`, `"row"`, `"{type} trail"`) cannot drift.
- The component-type taxonomy is fixed by Tidy Mapper's `ELEMENT_OPTIONS` list (~47 names + `"Other"`). The mapping agent may extend the list only by promoting `Other` items to new named types it's confident in.
- Site Mapper's plugin must port (or vendor) Tidy Mapper's grab logic (~400 lines across `sliceProcessor.ts`, `trailMarker.ts`, `createMappingPage.ts`, `buildAutoLayoutFrame.ts`, `constants.ts`). Pin against a known Tidy Mapper commit and re-sync deliberately.
- Inherited limitation: pruning a row from a per-type page leaves an orphaned trail on the source page (hyperlink-from is gone, but trail frame remains). This is a Tidy Mapper limitation today; we inherit it.

## Considered alternatives

- **Invent a clean file shape for mapping output, and offer Tidy Mapper an importer.** Rejected: the manual-addition workflow needs to operate on the same file with the same conventions; an import step would lose the round-trip.
- **Slices only — designer manually runs Tidy Mapper's grab page-by-page.** Rejected: page-by-page grab is unworkable for non-trivial sites; designers would skip the prune step in practice.
- **Slices + a "Grab all pages" Site Mapper command (two-step UX).** Rejected: same code duplication as auto-grab, but extra friction; one-step rendering is cleaner.
- **Deprecate Tidy Mapper and absorb its manual functionality into Site Mapper.** Rejected as premature.
