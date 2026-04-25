# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A Figma plugin + Node.js backend that discovers meaningful website pages, captures approved URLs, renders them as screenshot pages in Figma, and prepares agent-reviewed design-system inventories. The backend crawls with Playwright, stores results in SQLite, generates an agent-ready workspace on disk, and serves data via a REST API. The plugin renders screenshot pages, markup/styling tools, inventory status, and `DS Inventory` boards directly onto the Figma canvas.

## Dev startup

Requires Redis (Docker) + two backend processes + plugin watcher:

```bash
docker compose up redis -d   # once; Redis persists across restarts

pnpm dev                     # API server + job worker + plugin watcher in one terminal
```

Or split:
```bash
pnpm dev:backend    # Fastify API on :3006
pnpm dev:worker     # BullMQ job worker
pnpm dev:plugin     # Figma plugin watcher
```

Backend environment — create `packages/backend/.env`:
```env
REDIS_URL="redis://localhost:6379"
PUBLIC_URL="http://localhost:3006"
NODE_ENV="development"
```

No database setup needed. SQLite DB is created automatically at `packages/backend/data/sitemapper.db` on first run.

Load the plugin in Figma Desktop: `Plugins → Development → Import plugin from manifest` → select `packages/plugin/manifest.json`.

## Build commands

```bash
pnpm build:plugin              # production Figma plugin build
pnpm --filter backend build    # compile backend TypeScript to dist/
```

Inventory CLI commands:

```bash
pnpm --filter backend run inventory:prepare <projectId>
pnpm --filter backend run inventory:status <projectId>
pnpm --filter backend run inventory:refresh <projectId>
pnpm --filter backend run inventory:export <projectId>
```

## Key architecture decisions

**Two separate build targets in the plugin.** The plugin has two Vite configs:
- `vite.config.ts` — builds the React UI (`src/ui.tsx` → `dist/ui.html`), bundled as a single HTML file via `vite-plugin-singlefile`.
- `vite.code.config.ts` — builds the Figma plugin code (`src/main.ts` → `dist/code.js`) as an ES module library. These run in separate contexts: the UI runs in an iframe, the code runs in Figma's plugin sandbox.

**Two-process backend.** The API server (`src/index.ts`) and job worker (`src/worker.ts`) are separate Node processes. The API enqueues jobs to Redis/BullMQ; the worker consumes them and runs the crawler. They share the same SQLite DB file (WAL mode enabled, safe for concurrent access).

**SQLite via Drizzle ORM.** Schema lives in `src/schema.ts`. Tables are created with `CREATE TABLE IF NOT EXISTS` in `src/db.ts` at startup — no migration tool needed. JSON columns (`screenshotPaths`, `interactiveElements`, `globalStyles`, `styles`, `classes`, `bbox`, `styleTokens`) are stored as TEXT and must be `JSON.parse`/`JSON.stringify`d at the DB boundary. Integer IDs, not ObjectIds.

**API response shape.** All responses include `_id: String(row.id)` alongside `id: number` so the plugin (which checks `_id`) stays compatible. Serialization helpers `serializePage` and `serializeElement` in `services/manifestBuilder.ts` handle this.

**ID validation.** Replace any ObjectId validation with `isValidId(s)` — checks that a string is a positive integer. Pattern used throughout `app.ts`.

**Plugin↔canvas bridge via plugin data.** The Figma-side code stores `URL`, `PAGE_ID`, and `SCREENSHOT_WIDTH` on generated Figma pages/frames using `figma.currentPage.setPluginData(...)`. This is the only link between Figma canvas objects and DB records — don't rename these keys.

Current required plugin-data keys are `URL`, `PROJECT_ID`, `PAGE_ID`, `SCREENSHOT_WIDTH`, and `ORIGINAL_VIEWPORT_WIDTH`. These are used by page lookup, markup, flows, styling, and DS Inventory sample links. Renaming them breaks multiple features.

**Console logging is captured automatically.** `src/logger.ts` overrides `console.*` globally, so all existing `console.log` calls in `crawler.ts` and elsewhere land in the pino log file at `packages/backend/logs/app.log` (daily rotation, keeps 2 days). Import `logger.ts` first in any new entry point.

**Backend URL is compiled into the plugin.** `packages/plugin/src/plugin/constants.ts` exports `BACKEND_URL = "http://localhost:3006"`. Change it there before building for a different environment.

**Design-system inventory is agent-driven, not heuristic-output-driven.** The backend prepares evidence; Claude Code writes decisions; the plugin renders decisions. Do not reintroduce backend "final answer" routes for clusters/inconsistencies/regions. The old public routes `/inventory/clusters`, `/inventory/inconsistencies`, and `/inventory/regions` are intentionally removed.

**Workspace files are generated operational data.** `packages/backend/workspace/<projectId>/` contains manifests, contact sheets, token tables, screenshots links, region hints, decision files, and exports. It is ignored by Git. Treat it as local runtime state unless explicitly creating a fixture.

## Data flow

### Discovery, capture, and sitemap flow

1. Recommended mode: Plugin UI calls `POST /discovery/start`, reviews candidates from `GET /discovery/:runId`, then submits selected candidates to `POST /discovery/:runId/approval`.
2. Exact URLs mode: Plugin creates a minimal discovery run from the pasted URLs and approves those URLs through the same approval path.
3. Approved capture calls `POST /crawl/approved` with an explicit approved URL list. This path sets `maxRequestsPerCrawl` to the approved URL count and disables automatic interactive highlight rendering.
4. Legacy mode still calls `POST /crawl` with broad crawl settings. Use it only for backwards-compatible broad crawl/debug behavior.
5. API validates project/run IDs in SQLite and enqueues a BullMQ job.
6. Worker calls `runCrawler()` → Playwright crawls only allowed URLs when an approved allowlist is present → screenshots sliced to ≤4096px → page upserted via `INSERT ... ON CONFLICT DO UPDATE` on `(project_id, url)` → old elements deleted → new elements batch-inserted in chunks of 200.
7. Worker writes `visitedPageIds` (integer strings), `visitedUrls`, and `pageCount` back to the BullMQ job.
8. Plugin polls `GET /status/:jobId` → fetches only the job subset from `GET /pages/by-ids` → renders Figma pages → stores `PROJECT_ID`, `URL`, and `PAGE_ID` in Figma plugin data.
9. If the job was a full refresh, backend removes stale SQLite pages and the plugin removes stale generated Figma pages for the same project.

### Design-system inventory flow

1. User crawls and renders sitemap pages in the plugin.
2. Plugin Inventory tab calls `POST /inventory/prepare/:projectId`.
3. API enqueues an `inventory-prepare` BullMQ job on the same queue used for crawls.
4. Worker branches on `job.data.type === "inventory-prepare"` and calls `buildWorkspace(projectId)`.
5. Workspace is written under `packages/backend/workspace/<projectId>/`.
6. User runs `/ds-inventory <projectId>` in Claude Code from repo root.
7. Claude reads workspace artifacts and writes:
   - `decisions/clusters.json`
   - `decisions/tokens.json`
   - `decisions/inconsistencies.json`
   - `decisions/templates.json`
   - `decisions/notes.md`
8. Plugin Inventory tab calls `GET /inventory/overview` and `GET /inventory/decisions/:projectId` to show status/counts.
9. Plugin renders `DS Inventory` boards using `GET /inventory/render-data/:projectId`.
10. `render-data` resolves decision fingerprints to catalog groups, crop URLs, and first-sample metadata (`pageId`, `elementId`, `bbox`) for `View sample` links.

### Inventory endpoints

- `GET /inventory/overview?projectId=<id>` — workspace status: `hasWorkspace`, `lastBuiltAt`, counts, decision summary.
- `POST /inventory/prepare/:projectId` — async workspace build via BullMQ.
- `GET /inventory/decisions/:projectId` — raw decision files plus workspace metadata.
- `GET /inventory/render-data/:projectId` — decisions enriched with component crop URLs and sample anchor metadata for Figma board rendering.
- `GET /inventory/tokens?projectId=<id>` — raw token frequency table.
- `/workspace/...` — static workspace assets such as catalog crop images.

## Package structure

```
packages/backend/src/
  index.ts          entry point — imports logger first, then starts server
  worker.ts         entry point — imports logger first, then starts worker
  logger.ts         pino logger + console override + daily file rotation
  db.ts             opens SQLite, creates tables, exports Drizzle `db`
  schema.ts         Drizzle table definitions + inferred types
  app.ts            all Fastify routes
  crawler.ts        Playwright/Crawlee crawler + style extractor + auth session
  queue.ts          BullMQ queue + Redis connection
  services/
    manifestBuilder.ts  page/element queries + serialization to API shape
    workspace/           workspace generator, manifests, contact sheets, token images, decisions/meta helpers
    inventory/           deterministic primitives and raw token frequency tables

packages/plugin/src/
  main.ts                     Figma plugin sandbox entry
  ui.tsx                      React app entry
  plugin/constants.ts         BACKEND_URL and other compile-time constants
  plugin/handlers/            Figma-side message handlers (crawl, flow, markup, styling)
  plugin/services/apiClient.ts  all fetch calls to the backend
  figmaRendering/             canvas rendering (sitemap index, screenshot pages, overlays, DS Inventory boards)
  hooks/                      React hooks for crawl, projects, flows, markup, elements
  store/atoms.ts              Jotai atoms for global UI state
```

## Current implementation state

- Discovery and approved capture are implemented:
  - Recommended discovery proposes candidate pages before capture
  - Exact URLs capture uses the same approved-capture path
  - approved capture no longer uses the global max-request setting
  - approved capture preserves interactive data but does not draw old interactive highlight overlays
  - full refresh removes stale generated Figma pages for the active project
- Phases A-D of the agent-driven inventory pivot are complete.
- Phase E is MVP complete:
  - plugin renders a `DS Inventory` page from decisions
  - component cards include crop thumbnails when available
  - component cards include `View sample` links to anchors on rendered screenshot pages
  - token, inconsistency, template, and notes sections render as basic cards
- Remaining Phase E polish:
  - make typography/spacing/radius/shadow boards more visual
  - link inconsistency/template cards to sample anchors or source pages
  - improve board layout and split large boards if needed
  - tighten render-data schema validation

Flow-building will be revisited later with a different model. Preserve link/interactive data in the DB, but do not rebuild the old visible flow/highlight behavior as the default capture experience.

## Generated and ignored runtime state

Do not treat these as source of truth:

```text
packages/backend/data/
packages/backend/screenshots/
packages/backend/storage/
packages/backend/logs/
packages/backend/workspace/
packages/plugin/dist/
```

Source of truth for implementation remains `packages/**/src`.
