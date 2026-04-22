# Development

## Prerequisites

- Node.js 20+
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

Build plugin for production:

```bash
pnpm build:plugin
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

Create/select a project in the plugin, then run a crawl from the Crawling tab. On completion the plugin renders screenshot pages and an index page in Figma.

Use the Markup tab on a generated screenshot page. The tab requires the Figma page to have a stored `PAGE_ID` plugin data key and a `Page Overlay` frame.

Use the Flows tab after link badges exist on the current page. The flow handler queries the database first and falls back to a single-page recrawl for missing target URLs.

Use the Styling tab after a crawl with style extraction enabled. This area needs a validation pass before relying on it.

## Debugging Notes

**Screenshots**: saved under `packages/backend/screenshots/`. Figma may reject HTTP image URLs in non-local contexts — HTTPS or a tunnel is needed for reliable image loading inside Figma.

**Crawls**: Playwright/Chromium is memory-heavy. Style extraction can process thousands of DOM nodes. The worker is configured for one crawl at a time.

**Database**: SQLite file lives at `packages/backend/data/sitemapper.db`. It is created automatically on first start. Both files are git-ignored.

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
