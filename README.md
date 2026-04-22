# Figma Site Mapper

A Figma plugin + Node.js backend that crawls websites and renders them as interactive sitemaps inside Figma — with screenshots, navigation flows, element markup, and style extraction.

## How it works

1. Enter a URL in the plugin and start a crawl.
2. The backend crawls the site with Playwright, captures screenshots, detects interactive elements, and optionally extracts CSS styles. Everything is stored in a local SQLite database.
3. The plugin renders the crawl result directly onto the Figma canvas: a linked index page, per-URL screenshot frames, badge-linked navigation flows, and element markup overlays.

## Features

- Full-site and single-page crawling with configurable depth, rate limiting, and section sampling
- Screenshot capture with automatic slicing for tall pages (>4096 px)
- Link and button detection with Figma badge overlays
- CSS style/token extraction (88 properties + CSS custom properties)
- On-demand markup overlays filtered by element category
- DB-first flow navigation — jumps to an already-crawled page or triggers a recrawl
- Project snapshot rendering from stored data at any time
- Authentication support: credentials, cookies, or manual login via visible browser

## Repository structure

```
packages/backend/    Fastify API + BullMQ worker + Playwright crawler + SQLite via Drizzle
packages/plugin/     Figma plugin UI (React + Jotai) and canvas rendering code
docs/                Architecture, development, deployment, and roadmap docs
```

## Local development

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

**Start Redis**

Redis is required for the job queue. The easiest way is Docker:

```bash
docker compose up redis -d
```

This starts a Redis container on `localhost:6379` and keeps it running in the background. You only need to do this once — it persists across restarts unless you explicitly stop it.

**Run**

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

**Load the plugin in Figma Desktop**

1. Open Figma Desktop.
2. Go to `Plugins → Development → Import plugin from manifest`.
3. Select `packages/plugin/manifest.json`.
4. Run **Figma Site Mapper** from the development plugins menu.

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
```

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Development](./docs/DEVELOPMENT.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Roadmap](./docs/ROADMAP.md)

## License

ISC
