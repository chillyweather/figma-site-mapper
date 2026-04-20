# Development

## Prerequisites

- Node.js 18+
- pnpm
- Redis running locally on `localhost:6379`
- MongoDB Atlas or local MongoDB
- Figma Desktop

## Install

```bash
pnpm install
```

## Environment

For local pnpm workflows, create `packages/backend/.env`:

```env
MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/dev?retryWrites=true&w=majority"
NODE_ENV="development"
```

For Docker Compose workflows, create a root `.env` from `.env.example`.

Current caveat: `packages/backend/src/queue.ts` does not read `REDIS_URL` yet. Local development expects Redis at the default local Redis address unless that code is fixed.

## Run

Run backend and plugin watcher together:

```bash
pnpm dev
```

Run one side only:

```bash
pnpm dev:backend
pnpm dev:plugin
```

Build plugin:

```bash
pnpm build:plugin
```

Build backend:

```bash
pnpm --filter backend build
```

## Load the Figma Plugin

1. Run `pnpm build:plugin` or `pnpm dev:plugin`.
2. Open Figma Desktop.
3. Go to `Plugins -> Development -> Import plugin from manifest`.
4. Select `packages/plugin/manifest.json`.
5. Run the plugin from Figma's development plugins menu.

The plugin currently points at `http://localhost:3006` through `packages/plugin/src/plugin/constants.ts`.

## Backend Local Checks

Health check:

```bash
curl http://localhost:3006/
```

Expected response:

```json
{"hello":"world"}
```

Redis check:

```bash
redis-cli ping
```

Expected response:

```text
PONG
```

## Common Workflows

Create/select a project in the plugin, then run a crawl from the Crawling tab. On completion the plugin should render generated screenshot pages and an index page in Figma.

Use the Markup tab on a generated screenshot page. The tab depends on the Figma page having a stored `PAGE_ID` and a `Page Overlay` frame.

Use the Flows tab after link badges exist on the current page. The flow handler tries the database first and falls back to a single-page recrawl for missing target URLs.

Use the Styling tab after a crawl with style extraction enabled. This area needs a validation pass before relying on it for serious work.

## Debugging Notes

Screenshots:

- Current code saves screenshots locally under the backend screenshot directory.
- Figma may reject or warn about HTTP screenshot URLs. HTTPS deployment or a tunnel is usually needed for reliable image fetches inside Figma.

Crawls:

- Playwright/Chromium is memory-heavy.
- Style extraction can process thousands of DOM nodes and increase memory use.
- The worker is configured for one crawl at a time.

Builds:

- This repo uses pnpm workspaces.
- `pnpm-lock.yaml` is currently ignored by `.gitignore`; Docker/CI expects should be reviewed before production work.

## Source Map

Backend:

```text
packages/backend/src/app.ts
packages/backend/src/crawler.ts
packages/backend/src/worker.ts
packages/backend/src/queue.ts
packages/backend/src/models/
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
