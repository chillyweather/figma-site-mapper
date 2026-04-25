# Figma Site Mapper

A Figma plugin + Node.js backend for turning a real website into design-system evidence inside Figma.

The current workflow is not "crawl everything and hope it is useful." The plugin first helps the designer choose a meaningful page set, captures only the approved URLs, renders those pages into Figma, prepares an agent-readable inventory workspace, and then renders agent decisions back as a `DS Inventory` board.

## Overview

The app has three parts:

- **Figma plugin**: the designer-facing UI. It runs discovery/capture, renders screenshot pages, prepares inventory workspaces, and renders inventory boards.
- **Backend API + worker**: Fastify API, BullMQ worker, Playwright crawler, SQLite storage, screenshot/style extraction, and inventory workspace generation.
- **Claude Code inventory pass**: an agent reads the generated workspace and writes structured design-system decisions.

The intended end-to-end process:

1. Start Redis, backend API, backend worker, and plugin watcher.
2. Open the Figma plugin and select or create a project.
3. Use **Recommended** discovery to find candidate pages, or **Exact URLs** to provide a fixed list.
4. Approve the pages to capture.
5. The backend captures only the approved URLs and stores screenshots, DOM/style data, elements, and crawl-run metadata in SQLite.
6. The plugin renders an `Index` page plus one Figma page per captured URL.
7. In the `Inventory` tab, rebuild the inventory workspace.
8. Run `/ds-inventory <projectId>` in Claude Code from the repo root.
9. Refresh the `Inventory` tab and render `DS Inventory` boards from the agent decisions.

## User Guide

### 1. Start The Local Stack

Install dependencies once:

```bash
pnpm install
```

Create `packages/backend/.env`:

```env
REDIS_URL="redis://localhost:6379"
PUBLIC_URL="http://localhost:3006"
NODE_ENV="development"
```

Start Redis:

```bash
docker compose up redis -d
```

Start the app:

```bash
pnpm dev
```

Or split logs across terminals:

```bash
pnpm dev:backend
pnpm dev:worker
pnpm dev:plugin
```

Required running pieces:

- API server on `http://localhost:3006`
- Worker process for crawl and inventory jobs
- Plugin watcher that writes `packages/plugin/dist`

Sanity check:

```bash
curl http://localhost:3006/
```

Expected response:

```json
{"hello":"world"}
```

### 2. Load The Plugin In Figma

1. Open Figma Desktop.
2. Go to `Plugins -> Development -> Import plugin from manifest`.
3. Select `packages/plugin/manifest.json`.
4. Run **Figma Site Mapper** from development plugins.

`pnpm dev:plugin` is a build watcher, not a browser dev server. Figma reads the built files from `packages/plugin/dist`.

### 3. Choose A Project

Open plugin settings with the gear icon.

You can:

- select an existing project
- create a new project
- set screenshot width and scale
- set crawl defaults

For design-system inventory work, keep **Extract DOM & Style Data** enabled.

### 4. Choose Pages To Capture

The `Crawling` tab has three capture modes.

**Recommended**

Use this for normal design-system discovery. Enter the website URL and optional seed URLs. Set the page budget to the number of meaningful pages you want, then run discovery. The backend recommends candidate pages based on route diversity, page type, seeds, and crawl constraints. Review the candidates, select the pages you want, then start capture.

**Exact URLs**

Use this when you already know the page set. Paste one URL per line and start capture. This still goes through the approved-capture path, so the backend captures only those URLs.

**Legacy**

Use only for older broad-crawl behavior or debugging. It follows links according to crawl settings and limits. It is less controlled than Recommended or Exact URLs.

Important behavior:

- Approved capture uses the approved URL list, not the global max-request setting.
- If a selected URL redirects, blocks, or fails, the final rendered count can be lower than the requested count.
- With **Treat this crawl as a full refresh** enabled, stale project pages are removed from SQLite and stale generated Figma pages for that project are removed from the canvas.
- Interactive/link data is preserved for future flow work, but approved capture does not draw old-style interactive highlight boxes on the canvas.

### 5. Review The Rendered Capture

After capture completes, the plugin renders:

- an `Index` page
- one generated Figma page per captured URL
- screenshot slices for tall pages
- navigation back to the index
- source URL links in page navigation

Generated screenshot pages store plugin data keys used by markup, styling, inventory, and sample links: `URL`, `PROJECT_ID`, `PAGE_ID`, `SCREENSHOT_WIDTH`, and `ORIGINAL_VIEWPORT_WIDTH`.

### 6. Prepare Inventory Workspace

Open the `Inventory` tab.

Click `Rebuild Inventory Workspace`.

The backend generates:

```text
packages/backend/workspace/<projectId>/
```

That workspace contains contact sheets, crop images, token tables, page metadata, element metadata, region hints, and decision file scaffolding. It is generated runtime data and is ignored by Git.

### 7. Run The Agent Inventory Pass

From the repo root, run Claude Code and invoke:

```text
/ds-inventory <projectId>
```

Example:

```text
/ds-inventory 4
```

The agent reads the workspace and writes decisions to:

```text
packages/backend/workspace/<projectId>/decisions/
```

Expected decision files:

- `clusters.json`
- `tokens.json`
- `inconsistencies.json`
- `templates.json`
- `notes.md`

### 8. Render DS Inventory Boards

Back in the plugin:

1. Open `Inventory`.
2. Click `Refresh`.
3. Confirm decision counts appear.
4. Click `Render Inventory Boards`.

The plugin creates or replaces a `DS Inventory` page. The board includes component clusters, token cards, inconsistencies, templates, notes, crop thumbnails where available, and `View sample` links back to the source screenshot pages.

`View sample` links require the captured screenshot pages to exist in the same Figma file. If those pages were deleted, cards may show `Sample page not rendered`.

## Features

- Recommended discovery flow for selecting a meaningful page set before capture
- Exact URL capture for designer-provided page lists
- Legacy broad crawl for debugging and backwards-compatible runs
- Approved capture that only crawls selected URLs
- Screenshot capture with automatic slicing for tall pages (>4096 px)
- DOM and style extraction for inventory evidence
- On-demand markup overlays filtered by element category
- DB-first page lookup and single-page recrawl
- Project snapshot rendering from stored data at any time
- Authentication support: credentials, cookies, or manual login via visible browser
- Agent-driven design-system inventory workspace with contact sheets, token tables, annotated screenshots, and persisted decision files
- Figma `DS Inventory` board rendering from agent decisions, including component crops and links back to source screenshot samples

## Repository structure

```
packages/backend/    Fastify API + BullMQ worker + Playwright crawler + SQLite via Drizzle
packages/plugin/     Figma plugin UI (React + Jotai) and canvas rendering code
docs/                Architecture, development, deployment, and roadmap docs
```

## Local Development

**Prerequisites**

- Node.js 18+
- pnpm
- Redis (for the job queue)
- Figma Desktop (for plugin development)

**Install**

```bash
pnpm install
```

**Environment**

Create `packages/backend/.env`:

```env
REDIS_URL="redis://localhost:6379"   # optional, defaults to localhost:6379
PUBLIC_URL="http://localhost:3006"   # URL the crawler uses to report progress back
NODE_ENV="development"
```

No database config needed — SQLite is used automatically. The DB file is created at `packages/backend/data/sitemapper.db` on first run.

### Start Redis

Redis is required for the job queue. The easiest way is Docker:

```bash
docker compose up redis -d
```

This starts a Redis container on `localhost:6379` and keeps it running in the background. You only need to do this once — it persists across restarts unless you explicitly stop it.

### Start The App

Everything in one terminal:

```bash
pnpm dev
```

This starts the API server, job worker, and plugin watcher concurrently.

Or split across terminals for separate logs:

```bash
pnpm dev:backend   # API server on :3006
pnpm dev:worker    # job worker
pnpm dev:plugin    # Figma plugin watcher
```

Required processes:

- Backend API: `http://localhost:3006`
- Backend worker: processes crawl and inventory-prepare jobs
- Plugin watcher: rebuilds `packages/plugin/dist` for Figma Desktop

Quick API sanity check:

```bash
curl http://localhost:3006/
```

Expected:

```json
{"hello":"world"}
```

### Load The Plugin In Figma Desktop

1. Open Figma Desktop.
2. Go to `Plugins → Development → Import plugin from manifest`.
3. Select `packages/plugin/manifest.json`.
4. Run **Figma Site Mapper** from the development plugins menu.

`pnpm dev:plugin` is a build watcher, not a web dev server. Figma loads the built files from `packages/plugin/dist`.

## Current Workflow Summary

Use this order for a normal run:

1. Start Redis and `pnpm dev`.
2. Load the Figma development plugin.
3. Select/create a project.
4. Use `Recommended` discovery or `Exact URLs`.
5. Approve/capture the chosen pages.
6. Verify generated screenshot pages in Figma.
7. Open `Inventory` and rebuild the workspace.
8. Run `/ds-inventory <projectId>` in Claude Code.
9. Refresh `Inventory`.
10. Render `DS Inventory` boards.

## CLI Inventory Commands

The plugin can prepare and render inventory, but the backend also exposes CLI commands for debugging and manual runs:

```bash
pnpm --filter backend run inventory:prepare <projectId>
pnpm --filter backend run inventory:status <projectId>
pnpm --filter backend run inventory:refresh <projectId>
pnpm --filter backend run inventory:export <projectId>
```

Usage:

- `inventory:prepare` builds `packages/backend/workspace/<projectId>/`.
- `inventory:status` prints workspace and decision counts.
- `inventory:refresh` rebuilds deterministic artifacts after a recrawl and writes merge-review files without overwriting decisions.
- `inventory:export` writes a plugin-ready decision export under `workspace/<projectId>/exports/`.

## Runtime Data

Local generated state lives under:

```text
packages/backend/data/
packages/backend/screenshots/
packages/backend/storage/
packages/backend/logs/
packages/backend/workspace/
packages/plugin/dist/
```

These are ignored by Git. Do not commit them unless you intentionally need a fixture.

## Troubleshooting

**Plugin cannot start a crawl or prepare inventory**

- Confirm Redis is running: `docker compose up redis -d`.
- Confirm API is running: `curl http://localhost:3006/`.
- Confirm the worker process is running. Crawls and inventory preparation require the worker.

**Inventory tab says workspace is missing**

- Click `Prepare Inventory`.
- Or run `pnpm --filter backend run inventory:prepare <projectId>`.

**Inventory tab says waiting for agent decisions**

- Run `/ds-inventory <projectId>` in Claude Code from the repo root.
- Then click `Refresh` in the plugin Inventory tab.

**`View sample` links do not work**

- Render the crawl/sitemap pages first.
- The links target Figma pages with `PAGE_ID` plugin data and anchor frames placed over source element bounding boxes.

**Backend URL changed**

The plugin hardcodes:

```text
packages/plugin/src/plugin/constants.ts
```

Update `BACKEND_URL` and rebuild the plugin if the backend host or port changes.

## Stack

| Layer | Technology |
|---|---|
| Plugin UI | React 18, Jotai, Tabler Icons |
| Canvas rendering | Figma Plugin API (TypeScript) |
| API server | Fastify 5 |
| Job queue | BullMQ + Redis |
| Crawler | Crawlee + Playwright |
| Database | SQLite via Drizzle ORM + better-sqlite3 |
| Image processing | Sharp |
| Build | Vite (plugin), tsc (backend) |

## Commands

```bash
pnpm dev               # API + worker + plugin watcher
pnpm dev:backend       # API server only
pnpm dev:worker        # job worker only
pnpm dev:plugin        # plugin watcher only
pnpm build:plugin      # production plugin build
pnpm --filter backend build   # compile backend TypeScript
pnpm --filter backend run inventory:prepare <projectId>
pnpm --filter backend run inventory:status <projectId>
pnpm --filter backend run inventory:refresh <projectId>
pnpm --filter backend run inventory:export <projectId>
```

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Development](./docs/DEVELOPMENT.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Roadmap](./docs/ROADMAP.md)

## License

ISC
