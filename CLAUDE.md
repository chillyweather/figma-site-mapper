# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A Figma plugin + Node.js backend that crawls websites and renders them as interactive sitemaps in Figma. The backend crawls with Playwright, stores results in SQLite, and serves data via a REST API. The plugin renders screenshots, navigation flows, element markup overlays, and style tables directly onto the Figma canvas.

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

## Key architecture decisions

**Two separate build targets in the plugin.** The plugin has two Vite configs:
- `vite.config.ts` — builds the React UI (`src/ui.tsx` → `dist/ui.html`), bundled as a single HTML file via `vite-plugin-singlefile`.
- `vite.code.config.ts` — builds the Figma plugin code (`src/main.ts` → `dist/code.js`) as an ES module library. These run in separate contexts: the UI runs in an iframe, the code runs in Figma's plugin sandbox.

**Two-process backend.** The API server (`src/index.ts`) and job worker (`src/worker.ts`) are separate Node processes. The API enqueues jobs to Redis/BullMQ; the worker consumes them and runs the crawler. They share the same SQLite DB file (WAL mode enabled, safe for concurrent access).

**SQLite via Drizzle ORM.** Schema lives in `src/schema.ts`. Tables are created with `CREATE TABLE IF NOT EXISTS` in `src/db.ts` at startup — no migration tool needed. JSON columns (`screenshotPaths`, `interactiveElements`, `globalStyles`, `styles`, `classes`, `bbox`, `styleTokens`) are stored as TEXT and must be `JSON.parse`/`JSON.stringify`d at the DB boundary. Integer IDs, not ObjectIds.

**API response shape.** All responses include `_id: String(row.id)` alongside `id: number` so the plugin (which checks `_id`) stays compatible. Serialization helpers `serializePage` and `serializeElement` in `services/manifestBuilder.ts` handle this.

**ID validation.** Replace any ObjectId validation with `isValidId(s)` — checks that a string is a positive integer. Pattern used throughout `app.ts`.

**Plugin↔canvas bridge via plugin data.** The Figma-side code stores `URL`, `PAGE_ID`, and `SCREENSHOT_WIDTH` on generated Figma pages/frames using `figma.currentPage.setPluginData(...)`. This is the only link between Figma canvas objects and DB records — don't rename these keys.

**Console logging is captured automatically.** `src/logger.ts` overrides `console.*` globally, so all existing `console.log` calls in `crawler.ts` and elsewhere land in the pino log file at `packages/backend/logs/app.log` (daily rotation, keeps 2 days). Import `logger.ts` first in any new entry point.

**Backend URL is compiled into the plugin.** `packages/plugin/src/plugin/constants.ts` exports `BACKEND_URL = "http://localhost:3006"`. Change it there before building for a different environment.

## Data flow

1. Plugin UI → `POST /crawl` with project ID and settings
2. API validates project exists in SQLite, enqueues BullMQ job
3. Worker calls `runCrawler()` → Playwright crawls → screenshots sliced to ≤4096px → page upserted via `INSERT ... ON CONFLICT DO UPDATE` on `(project_id, url)` → old elements deleted → new elements batch-inserted in chunks of 200
4. Worker writes `visitedPageIds` (integer strings) back to the BullMQ job
5. Plugin polls `GET /status/:jobId` → fetches `GET /jobs/:jobId/pages` → renders Figma frames → stores `PAGE_ID` in Figma plugin data

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

packages/plugin/src/
  main.ts                     Figma plugin sandbox entry
  ui.tsx                      React app entry
  plugin/constants.ts         BACKEND_URL and other compile-time constants
  plugin/handlers/            Figma-side message handlers (crawl, flow, markup, styling)
  plugin/services/apiClient.ts  all fetch calls to the backend
  figmaRendering/             canvas rendering (sitemap index, screenshot pages, overlays)
  hooks/                      React hooks for crawl, projects, flows, markup, elements
  store/atoms.ts              Jotai atoms for global UI state
```
