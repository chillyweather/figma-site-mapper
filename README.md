# Figma Site Mapper

A Figma plugin + Node.js backend that crawls websites, renders interactive sitemap pages in Figma, extracts design-system evidence, and prepares an agent-reviewed design-system inventory.

## How it works

1. In the plugin, create/select a project and start a crawl.
2. The backend worker crawls the site with Playwright, captures screenshots, detects elements, extracts styles, and stores everything in local SQLite.
3. The plugin renders the crawl result onto the Figma canvas: a linked index page, per-URL screenshot pages, badge-linked navigation flows, and optional markup overlays.
4. In the plugin Inventory tab, prepare an agent-ready workspace from the crawl.
5. Outside the plugin, run `/ds-inventory <projectId>` in Claude Code. The agent reviews workspace contact sheets, screenshots, and token tables, then writes decisions to `packages/backend/workspace/<projectId>/decisions/`.
6. Back in the plugin, refresh Inventory and render a `DS Inventory` Figma page from those decisions.

## Features

- Full-site and single-page crawling with configurable depth, rate limiting, and section sampling
- Screenshot capture with automatic slicing for tall pages (>4096 px)
- Link and button detection with Figma badge overlays
- CSS style/token extraction (88 properties + CSS custom properties)
- On-demand markup overlays filtered by element category
- DB-first flow navigation — jumps to an already-crawled page or triggers a recrawl
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

### 1. Start Redis

Redis is required for the job queue. The easiest way is Docker:

```bash
docker compose up redis -d
```

This starts a Redis container on `localhost:6379` and keeps it running in the background. You only need to do this once — it persists across restarts unless you explicitly stop it.

### 2. Start The App

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

### 3. Load The Plugin In Figma Desktop

1. Open Figma Desktop.
2. Go to `Plugins → Development → Import plugin from manifest`.
3. Select `packages/plugin/manifest.json`.
4. Run **Figma Site Mapper** from the development plugins menu.

`pnpm dev:plugin` is a build watcher, not a web dev server. Figma loads the built files from `packages/plugin/dist`.

## Full Workflow

This is the recommended order for a normal run.

### A. Outside The Plugin

1. Start Redis:

```bash
docker compose up redis -d
```

2. Start the dev stack:

```bash
pnpm dev
```

Or run the three processes separately:

```bash
pnpm dev:backend
pnpm dev:worker
pnpm dev:plugin
```

3. Open Figma Desktop and run the development plugin.

### B. Inside The Plugin: Crawl And Render Sitemap

1. Select or create a project.
2. Enter the target site URL.
3. Configure crawl limits:
   - `Max requests` controls how many pages are crawled.
   - `Max depth` controls link traversal depth.
   - Style extraction should stay enabled for inventory work.
4. Click the crawl/start button.
5. Wait for crawl progress to complete.
6. The plugin renders:
   - an `Index` page
   - one Figma page per crawled URL
   - screenshot frames
   - navigation badges/links
7. Optional: use Mapping/Flows/Markup/Styling tools on the rendered screenshot pages.

### C. Inside The Plugin: Prepare Inventory Workspace

1. Open the `Inventory` tab.
2. Confirm the active project is correct.
3. Click `Prepare Inventory` or `Rebuild Inventory Workspace`.
4. Wait for the prepare job to finish.
5. The tab should show:
   - workspace ready
   - page count
   - element count
   - workspace path

The workspace is generated at:

```text
packages/backend/workspace/<projectId>/
```

Generated workspace/data folders are intentionally ignored by Git.

### D. Outside The Plugin: Agent Inventory Pass

Run Claude Code from the repository root and invoke the inventory skill:

```text
/ds-inventory <projectId>
```

Example:

```text
/ds-inventory 4
```

The agent reads:

- `packages/backend/workspace/<projectId>/README.md`
- `project.json`
- `pages/*`
- `catalog/*/contact-sheet.png`
- `catalog/*/groups.json`
- `tokens/*`
- `regions/*`

The agent writes decisions to:

```text
packages/backend/workspace/<projectId>/decisions/
```

Expected decision files:

- `clusters.json`
- `tokens.json`
- `inconsistencies.json`
- `templates.json`
- `notes.md`

### E. Inside The Plugin: Render Design-System Inventory

1. Return to the plugin.
2. Open `Inventory`.
3. Click `Refresh`.
4. Confirm decision counts appear.
5. Click `Render Inventory Boards`.
6. The plugin creates or replaces a `DS Inventory` Figma page.

The rendered board currently includes:

- component cards
- token cards and color swatches
- inconsistency cards
- template cards
- notes
- component crop thumbnails where available
- `View sample` links from component cards back to source screenshot anchors

`View sample` links require the crawl screenshot pages to exist in the Figma file. If the screenshot pages are not present, cards may show `Sample page not rendered`.

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
