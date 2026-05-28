# Mapping extends DS Inventory, replacing the clusters view

The new automated mapping feature (per-component-type Figma pages of detected candidates) is implemented as an *extension* of the existing DS Inventory pipeline rather than as a parallel feature. It replaces the existing `clusters.json` decision artifact and the cluster board rendering; tokens / inconsistencies / templates / notes remain in the pipeline as dormant data (no plugin rendering, no active maintenance).

The reason is infrastructure overlap: DS Inventory already provides workspace generation, manifest building, crop catalog, agent-written decision files, and Figma board rendering with source back-links. Mapping shares all of these. Building it as a parallel feature would duplicate this stack and create two competing "design system from a crawl" features that answer the same question with different shapes. Tokens / inconsistencies / templates are preserved (cheap to keep, expected to revive) but currently unrendered.

## Considered alternatives

- **Parallel "Mapping" feature next to DS Inventory.** Rejected: would duplicate workspace/decision/rendering plumbing and confuse the user-facing mental model.
- **Replace DS Inventory entirely (delete tokens/inconsistencies/templates).** Rejected: those artifacts are expected to return as real workstreams. Cheap to leave the pipeline generating them.
