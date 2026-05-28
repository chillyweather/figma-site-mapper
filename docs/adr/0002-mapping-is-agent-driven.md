# Mapping detection is agent-driven, not in-line LLM API calls

The mapping pipeline uses the same agent-loop pattern as the rest of the inventory workspace: the backend prepares evidence (screenshots, DOM candidate manifests) under `packages/backend/workspace/<projectId>/`, the designer runs `/ds-mapping <projectId>` in Claude Code, and the agent makes vision tool calls itself, writing `decisions/components.json`. The plugin then polls and renders the decisions.

We picked agent-driven over in-line LLM API calls (called directly from the BullMQ job) because the agent's iteration, cross-page deduplication, and name-normalisation work above a single vision call adds real value; because cost is paid through the existing Claude Code subscription rather than per-API-call billing; and because this matches the architectural rule in CLAUDE.md that design-system decisions are agent-driven, not heuristic backend output.

## Consequences

The feature requires a Claude Code session to run end-to-end — designer flow is plugin → terminal → plugin, not single-click from the plugin. If the feature is later intended for non-engineer self-service, this decision should be revisited.

## Considered alternatives

- **In-line LLM API calls in the BullMQ job.** Rejected: contradicts the CLAUDE.md architectural rule; per-call billing has worse cost predictability for exploratory work; loses the agent's ability to iterate / cross-reference.
- **Hybrid (in-line detection + agent QA pass).** Rejected as "neither here nor there" — two pipelines, two sources of truth, more complexity.
