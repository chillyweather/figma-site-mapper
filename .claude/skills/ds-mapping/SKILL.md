---
name: ds-mapping
description: Use when generating component-mapping decisions from prepared mapping evidence. Reads DOM candidates and screenshots to classify visual component types, cross-reference recurring patterns across pages, and write timestamped decision files consumed by the plugin's Render Mapping action.
---

# Component Mapping

Use this skill after mapping evidence has been prepared — either via the plugin's **Prepare Mapping** button or `POST /mapping/prepare/<projectId>`.

Invoke as: `/ds-mapping <projectId>`

---

## Workspace Contract

The mapping workspace lives at `packages/backend/workspace/<projectId>/mapping/`.

Read in this order:

1. `README.md` — workspace layout, page count, candidate count.
2. `manifest.json` — schemaVersion, generatedAt, pageCount, candidateCount.
3. `pages/<pageId>/page.json` — url, title, screenshotPaths, viewportWidth.
4. `pages/<pageId>/candidates.json` — DOM elements with confirmed bboxes in CSS-pixel coordinates.
5. Existing `decisions/latest.json` (if present) — previous run for context and deduplication.

**What candidates.json contains:** visible DOM elements extracted by the crawler. Each entry has:
- `id` — element DB row ID (string)
- `pageId` — page DB row ID (string)
- `type` — crawler-assigned type ("button", "link", "heading", "image", etc.)
- `bbox` — `{ x, y, width, height }` in CSS-pixel coordinates relative to viewport
- `text`, `ariaLabel`, `role`, `classes`, `tagName`, `selector`
- `componentFingerprint` — style-based fingerprint for deduplication

---

## Classification Approach

### Step 1 — DOM-anchored candidates

For each page, scan candidates.json. Group by `type` and `componentFingerprint`. For clusters of visually similar elements (same fingerprint, similar bbox size), classify into a Tidy Mapper component type.

**Trust DOM bboxes** from candidates.json — these are ground-truth CSS coordinates. Set `source: "dom"` for these instances.

### Step 2 — Vision-discovered candidates

Review screenshot images at the paths in page.json. Identify component regions that weren't captured as interactive DOM candidates (e.g. data-table rows, complex cards, navigation structures, hero sections). These are supplementary. Set `source: "vision"` and estimate bboxes from visual inspection.

**Only add vision candidates for high-confidence observations.** Unclassifiable regions go to "Other".

### Step 3 — Cross-page deduplication

If the same component fingerprint appears on multiple pages, pick representative instances (spread across pages). Aim for ≤5 instances per component type unless there is important variation.

### Step 4 — Over-delivery policy

**Do not output a separate component type for every visual variant.** Group variants of the same component under one type. For example, all button variants (primary, secondary, ghost, icon) go under "Buttons", not separate types.

Only create a new type for visually and semantically distinct UI patterns. When in doubt, use "Other".

---

## Component Type Taxonomy

Use the Tidy Mapper taxonomy. Exact names only — these are a fixed external contract:

```
Accordion, Alert, Avatar, Badge, Banner, Breadcrumb, Button, Buttons, Card, Cards,
Carousel, Chart, Checkbox, Chip, Color Picker, Data Table, Date Picker, Dialog,
Divider, Drawer, Dropdown, File Upload, Footer, Form, Header, Hero, Icon,
Icon Button, Image, Input, Link, List, Loading, Menu, Modal, Navigation,
Notification, Pagination, Popover, Progress, Radio, Search, Select, Sidebar,
Skeleton, Slider, Spinner, Stepper, Switch, Table, Tabs, Tag, Textarea,
Time Picker, Toast, Toggle, Tooltip, Other
```

**Normalisation rules:**
- Use the exact taxonomy name, not variants ("Buttons" not "Button", "Cards" not "Card").
- Unknown types that you're confident in but don't have a taxonomy name → promote as a new named type starting with an uppercase letter (e.g. "ProductCard").
- Low-confidence or unclassifiable → "Other".
- Never use "Slice"-prefixed names.

---

## Decision File Format

Write to `decisions/components-<timestamp>.json`:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-28T12:34:56.789Z",
  "projectId": "<projectId>",
  "componentTypes": [
    {
      "type": "Buttons",
      "promotedFromOther": false,
      "instances": [
        {
          "instanceId": "buttons-5-42",
          "pageId": "5",
          "sourceUrl": "https://example.com/pricing",
          "bbox": { "x": 100, "y": 200, "width": 120, "height": 40 },
          "originElementId": 42,
          "originSelector": "button.primary",
          "source": "dom",
          "confidence": "high",
          "rawLabel": "Primary CTA"
        }
      ]
    },
    {
      "type": "Navigation",
      "instances": [
        {
          "instanceId": "navigation-5-hero",
          "pageId": "5",
          "bbox": { "x": 0, "y": 0, "width": 1440, "height": 72 },
          "source": "vision",
          "confidence": "high"
        }
      ]
    }
  ],
  "otherInstances": []
}
```

Field notes:
- `instanceId` is stable within a run. Use DOM row IDs where possible; use a descriptive generated ID for vision candidates.
- `bbox` coordinates are **CSS-pixel** values matching candidates.json — do NOT scale them.
- `source`: `"dom"` for candidates from evidence, `"vision"` for agent-observed visual regions.
- `originElementId` / `originSelector` are present only for DOM-anchored candidates.
- `confidence`: `"high"` | `"medium"` | `"low"`. Omit for obvious cases.
- `rawLabel`: optional short description of this specific instance before type normalisation.
- `otherInstances`: low-confidence or unclassifiable candidates with no component type.

Then update `decisions/latest.json` to be a copy of the timestamped file (or write it as a JSON file pointing to the timestamped one):

```bash
# Write the timestamped file, then copy to latest.json
cp decisions/components-<timestamp>.json decisions/latest.json
```

Or write `latest.json` directly with the same content — the backend reads `latest.json`.

---

## Workflow

1. Validate projectId is a positive integer string.
2. Read `manifest.json` to confirm the workspace is present.
3. Read `README.md` for page and candidate counts.
4. For each page: read `page.json` then `candidates.json`.
5. Group DOM candidates by `componentFingerprint` and `type`.
6. Classify into Tidy Mapper component types.
7. Review screenshots for vision-discovered candidates.
8. Cross-reference recurring patterns; deduplicate.
9. Write `decisions/components-<ISO-timestamp>.json`.
10. Copy or re-write as `decisions/latest.json`.
11. Report: component types found, instance count, any ambiguities.

---

## Re-runs

Each run produces a fresh timestamped file and overwrites `latest.json`. Previous timestamped files are kept for audit. The plugin's **Render Mapping** action reads `latest.json`.

Re-renders in the plugin cleanly remove the previous generated mapper pages and trails before creating new ones — safe to iterate.

---

## Validation

The backend validator (`packages/backend/src/services/mapping/validator.ts`) will:
- Normalise type name variants (e.g. "button" → "Buttons").
- Skip instances with missing pageId, elementId, or invalid bbox.
- Warn but preserve valid entries when malformed instances are present.

Run `GET /mapping/decisions/<projectId>` after writing to check what the backend accepts.
