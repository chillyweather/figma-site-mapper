# Figma Site Mapper

Figma Site Mapper is a Figma plugin plus backend crawler for turning a website into a visual, inspectable map inside Figma.

The backend crawls pages with Playwright/Crawlee, captures screenshots, extracts links/buttons and optional style data, and stores the result in MongoDB. The Figma plugin then renders screenshot pages, an index, markup overlays, user-flow diagrams, and style tables from that stored crawl data.

## Repository Structure

```text
packages/backend/       Fastify API, BullMQ worker, Playwright crawler, Mongo models
packages/plugin/        Figma plugin UI and Figma canvas rendering code
docs/                   Maintained project documentation
```

## Main Capabilities

- Project-based crawls stored in MongoDB.
- Full-site and single-page crawling.
- Screenshot capture and slicing for tall pages.
- Link and button detection with Figma badges.
- Optional DOM/style extraction for CSS variables, tokens, and element styles.
- On-demand markup overlays for selected element categories.
- DB-first flow building: reuse crawled target pages or recrawl a missing target.
- Project snapshot rendering from persisted data.
- Manual/cookie authentication support for protected sites.

## Current State

The core DB-backed crawl and render loop exists. Project creation, crawl jobs, screenshot rendering, job-scoped rendering, markup, and DB-first flow handling are implemented.

The project still needs a cleanup/hardening pass before treating it as production-ready:

- Backend/plugin URL configuration is still local by default.
- Redis configuration should be made environment-driven.
- Deployment docs and code need to be reconciled around screenshot storage.
- Docker build assumptions need verification, especially lockfile handling.
- Styling UI exists, but the styling workflow needs another pass.
- There is little automated test coverage.

See [docs/ROADMAP.md](./docs/ROADMAP.md) for the working recovery plan.

## Local Development

Prerequisites:

- Node.js 18+
- pnpm
- Redis
- MongoDB Atlas or local MongoDB
- Figma Desktop for plugin development

Install dependencies:

```bash
pnpm install
```

For local pnpm development, create `packages/backend/.env` with at least:

```env
MONGO_URI="mongodb+srv://..."
```

Run both the backend and plugin watcher:

```bash
pnpm dev
```

This starts the backend on `http://localhost:3006` and builds/watches the Figma plugin.

Load the plugin in Figma Desktop:

1. Open Figma Desktop.
2. Go to `Plugins -> Development -> Import plugin from manifest`.
3. Select `packages/plugin/manifest.json`.
4. Run `Figma Site Mapper` from the development plugins menu.

More setup details are in [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md).

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Development](./docs/DEVELOPMENT.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Roadmap](./docs/ROADMAP.md)

## Useful Commands

```bash
pnpm dev
pnpm dev:backend
pnpm dev:plugin
pnpm build:plugin
pnpm --filter backend build
```

## License

ISC
