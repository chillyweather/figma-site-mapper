# Development

## Prerequisites

- Node.js 18+
- pnpm
- Docker (for Redis)
- Figma Desktop

## Install

```bash
pnpm install
```

## Environment

Create `packages/backend/.env`:

```env
REDIS_URL="redis://localhost:6379"
PUBLIC_URL="http://localhost:3006"
NODE_ENV="development"
```

## Startup

Start Redis (required for the job queue):

```bash
docker compose up redis -d
```

Run everything in parallel (backend API + worker + plugin watcher):

```bash
pnpm dev
```

Run individual pieces:

```bash
pnpm dev:backend   # Fastify API on :3006
pnpm dev:worker    # BullMQ worker
pnpm dev:plugin    # Vite plugin watcher
```

Build-based verification:

```bash
pnpm build:plugin
pnpm --filter backend build
```

Inventory CLI:

```bash
pnpm --filter backend run inventory:prepare <projectId>
pnpm --filter backend run inventory:status <projectId>
pnpm --filter backend run inventory:refresh <projectId>
pnpm --filter backend run inventory:export <projectId>
```

## Load the Figma Plugin

1. Run `pnpm build:plugin` or `pnpm dev:plugin`.
2. Open Figma Desktop.
3. Go to `Plugins → Development → Import plugin from manifest`.
4. Select `packages/plugin/manifest.json`.
5. Run the plugin from Figma's development plugins menu.

The plugin calls `http://localhost:3006` — configured in `packages/plugin/src/plugin/constants.ts`.

## Sanity Checks

Backend health:

```bash
curl http://localhost:3006/
# {"hello":"world"}
```

Redis:

```bash
redis-cli ping
# PONG
```

## Logs

Backend and worker logs stream to the console and are written to `packages/backend/logs/app.log` (daily rotation, last 2 days kept). Check that file when debugging background worker issues.

## Common Workflows

Create or select a project in Settings, then use the `Crawling` tab.

For normal capture, use `Recommended` mode:

- enter the start URL
- optionally add seed URLs
- choose `Fast` or `Full site exploration`
- review candidates and approve the pages to capture

Use `Exact URLs` when you already know the full page set and want deterministic capture.

On completion the plugin renders an index page plus one Figma page per captured URL.

For inventory work:

1. run a capture
2. open `Inventory`
3. click `Rebuild Inventory Workspace`
4. run `/ds-inventory <projectId>` in Claude Code
5. return to `Inventory`, click `Refresh`, then `Render Inventory Boards`

## Debugging Notes

**Screenshots**: saved under `packages/backend/screenshots/`. Figma may reject HTTP image URLs in non-local contexts — HTTPS or a tunnel is needed for reliable image loading inside Figma.

**Crawls**: Playwright/Chromium is memory-heavy. Style extraction can process thousands of DOM nodes. The worker is configured for one crawl at a time. Full discovery may still produce shallow candidate sets on sites that block `fetch` access to `robots.txt`, sitemap XML, or homepage HTML.

**Database**: SQLite file lives at `packages/backend/data/sitemapper.db`. It is created automatically on first start.

**Runtime state**: local generated state also lives under:

```text
packages/backend/screenshots/
packages/backend/storage/
packages/backend/logs/
packages/backend/workspace/
packages/plugin/dist/
```

## Source Map

Backend:

```text
packages/backend/src/index.ts       API entry point
packages/backend/src/worker.ts      Worker entry point
packages/backend/src/logger.ts      Pino logger + console override
packages/backend/src/db.ts          SQLite connection + table creation
packages/backend/src/schema.ts      Drizzle table definitions
packages/backend/src/app.ts         Fastify routes
packages/backend/src/queue.ts       BullMQ queue
packages/backend/src/crawler.ts     Playwright/Crawlee crawler
packages/backend/src/services/manifestBuilder.ts  DB query + serialization helpers
packages/backend/src/services/discovery/         discovery, recommendations, approval
packages/backend/src/services/workspace/         inventory workspace generation
packages/backend/src/services/inventory/         render-model + token/inventory primitives
```

Plugin UI:

```text
packages/plugin/src/components/
packages/plugin/src/hooks/
packages/plugin/src/store/
packages/plugin/src/utils/
```

Plugin Figma-side code:

```text
packages/plugin/src/main.ts
packages/plugin/src/plugin/
packages/plugin/src/figmaRendering/
```
