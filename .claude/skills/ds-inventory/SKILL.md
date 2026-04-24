---
name: ds-inventory
description: Use when turning a prepared site crawl workspace into a design-system inventory by reviewing screenshots, crops, token frequency tables, and writing decision files for clusters, tokens, inconsistencies, and reusable templates.
---

# Design-System Inventory

Use this skill after a crawl has been prepared with `pnpm --filter backend run inventory:prepare <projectId>` or `POST /inventory/prepare/:projectId`.

## Workspace Contract

The workspace lives at `packages/backend/workspace/<projectId>/`.

Read these first:

- `README.md` for workspace layout and current project counts.
- `project.json` for pages, categories, token summary, and generated timestamp.
- `pages/*.json` plus `pages/screenshots/*` for page-level context.
- `catalog/<category>/index.json` and `catalog/<category>/contact-sheet.png` for repeated element review.
- `tokens/*.json`, `tokens/colors-swatches.png`, and `tokens/typography-specimens.png` for raw token frequency review.

Do not treat backend-generated clusters or token names as final decisions. The workspace is evidence; the agent makes the decision.

## Decision Files

Write human-reviewed results under `decisions/`.

Use `clusters.json` for component group decisions:

```json
{
  "clusters": [
    {
      "id": "button.primary",
      "name": "Primary Button",
      "category": "buttons",
      "memberFingerprints": ["..."],
      "representativeElementIds": ["123"],
      "confidence": "high",
      "notes": "Shared visual treatment and interaction role."
    }
  ]
}
```

Use `tokens.json` for approved design tokens:

```json
{
  "colors": [
    {
      "name": "color.action.primary",
      "value": "#0057ff",
      "sourceValues": ["#0057ff"],
      "usage": "Primary CTA backgrounds"
    }
  ],
  "typography": [],
  "spacing": [],
  "radii": [],
  "shadows": []
}
```

Use `inconsistencies.json` for issues worth reviewing:

```json
{
  "issues": [
    {
      "id": "button-radius-mismatch",
      "severity": "medium",
      "description": "Primary buttons use two close radius values.",
      "evidence": ["catalog/buttons/index.json"],
      "recommendation": "Normalize to the dominant token."
    }
  ]
}
```

Use `templates.json` for reusable page or section patterns:

```json
{
  "templates": [
    {
      "id": "marketing.hero",
      "name": "Marketing Hero",
      "pageIds": ["1", "2"],
      "regions": ["hero"],
      "notes": "Hero structure repeats across top-level pages."
    }
  ]
}
```

Use `notes.md` for plain-language reasoning, unresolved questions, and assumptions.

## Workflow

1. Review page screenshots to understand global chrome, repeated regions, and page templates.
2. Review category contact sheets to group components by visual and behavioral intent.
3. Review token frequency tables and swatches to promote stable tokens and flag near-duplicates.
4. Write decision files with stable ids and evidence paths.
5. Run `pnpm --filter backend run inventory:status <projectId>` to confirm decisions are visible to the app.

