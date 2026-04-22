# Architecture

Figma Site Mapper has two main runtime surfaces:

- A backend service that crawls websites, stores crawl results, and serves data to the plugin.
- A Figma plugin that provides the UI and renders crawl results onto the Figma canvas.

## System Overview

```mermaid
graph TB
    UI[React Plugin UI] --> Plugin[Figma Plugin Code]
    UI --> API[Fastify API]
    Plugin --> API
    API --> Queue[BullMQ Queue]
    Queue --> Worker[Worker Process]
    Worker --> Crawler[Playwright/Crawlee Crawler]
    Crawler --> DB[(SQLite DB)]
    Crawler --> Files[Screenshot Files]
    API --> DB
    API --> Files
    Plugin --> Figma[Figma Canvas]
```

## Backend

The backend lives in `packages/backend`.

Main modules:

- `src/index.ts`: entry point — imports logger, then starts the Fastify server.
- `src/worker.ts`: entry point — imports logger, then starts the BullMQ worker.
- `src/logger.ts`: pino logger with daily rotating file output + console override. Import this first in any new entry point.
- `src/db.ts`: opens the SQLite file, creates tables with `CREATE TABLE IF NOT EXISTS`, exports the Drizzle `db` instance.
- `src/schema.ts`: Drizzle table definitions for `projects`, `pages`, and `elements`. Source of truth for DB types.
- `src/app.ts`: all Fastify routes.
- `src/queue.ts`: BullMQ queue and Redis connection (reads `REDIS_URL` env var).
- `src/crawler.ts`: Playwright/Crawlee crawler — screenshots, element detection, style extraction, auth session.
- `src/services/manifestBuilder.ts`: queries pages and elements by ID, serializes to API response shape.

API endpoints:

- `GET /projects`, `POST /projects`
- `POST /crawl`, `POST /recrawl-page`
- `GET /status/:jobId`, `GET /jobs/:jobId/pages`
- `GET /pages/by-ids`, `GET /page`
- `GET /elements`
- `GET /styles/global`, `GET /styles/element`
- `POST /auth-session`, `POST /progress/:jobId`

## Data Model

Stored in SQLite at `packages/backend/data/sitemapper.db`. Schema defined in `src/schema.ts` via Drizzle ORM.

`projects` — `id`, `name`, timestamps

`pages` — `id`, `projectId`, `url`, `title`, `screenshotPaths` (JSON), `interactiveElements` (JSON), `globalStyles` (JSON), `lastCrawledAt`, `lastCrawlJobId`, timestamps. Unique compound index on `(projectId, url)` — recrawling updates the same logical record.

`elements` — `id`, `pageId`, `projectId`, `type`, `selector`, `tagName`, `classes` (JSON), `bbox` (JSON), `styles` (JSON), `styleTokens` (JSON), accessibility and media/input fields, timestamps. Indexed on `(pageId, type)` and `(projectId, type)`.

Array and object fields (`screenshotPaths`, `interactiveElements`, `globalStyles`, `styles`, `classes`, `bbox`, `styleTokens`) are stored as TEXT and must be `JSON.parse`/`JSON.stringify`d at the DB boundary. Serialization helpers `serializePage` and `serializeElement` in `manifestBuilder.ts` handle this for API responses.

IDs are auto-increment integers. All API responses include `_id: String(id)` for plugin compatibility.

## Crawl Flow

1. Plugin sends `POST /crawl` with URL, project ID, and crawl settings.
2. API validates the project exists in SQLite and queues a BullMQ job.
3. Worker pulls the job and calls `runCrawler`.
4. Crawler opens Chromium, navigates pages, handles delays/auth/CAPTCHA, scrolls for lazy loading, captures screenshots.
5. Screenshots are sliced to ≤4096 px height and written to `packages/backend/screenshots/`.
6. Each page is upserted via `INSERT ... ON CONFLICT(project_id, url) DO UPDATE`.
7. Existing elements for that page are deleted and replaced with freshly extracted elements in batches of 200.
8. Worker writes visited page IDs (integer strings) and URLs back to the BullMQ job record.
9. Plugin polls `GET /status/:jobId`, then fetches `GET /jobs/:jobId/pages` when complete.
10. Plugin renders Figma pages and stores `PAGE_ID` (integer string) and `URL` in Figma plugin data.

## Plugin

The plugin lives in `packages/plugin` and has two separate build targets:

- `vite.config.ts` — builds the React UI (`src/ui.tsx`) into a single self-contained HTML file.
- `vite.code.config.ts` — builds the Figma sandbox code (`src/main.ts`) as an ES module.

Main areas:

- `src/ui.tsx`: React entry point.
- `src/main.ts`: Figma plugin sandbox entry point.
- `src/components/`: UI views and tabs (Crawling, Markup, Flows, Styling).
- `src/hooks/`: UI-side state and workflow hooks.
- `src/store/atoms.ts`: Jotai global state.
- `src/plugin/handlers/`: Figma-side message handlers.
- `src/plugin/services/apiClient.ts`: all fetch calls to the backend.
- `src/plugin/constants.ts`: compile-time constants including `BACKEND_URL`.
- `src/figmaRendering/`: sitemap/screenshot/overlay canvas rendering.

## Plugin↔Canvas Bridge

The Figma-side code stores metadata on generated pages and frames using `figma.currentPage.setPluginData(key, value)`. Keys in use:

- `URL` — the crawled page URL
- `PAGE_ID` — the integer DB ID as a string
- `SCREENSHOT_WIDTH` — original screenshot width

This metadata is the only link between Figma canvas objects and DB records. These key names must not change without updating all handler code that reads them.

## Rendering Flows

**After crawl:** poll job → read `visitedPageIds` → fetch pages/elements → render screenshot frames and index page → store plugin data.

**Snapshot:** fetch all project pages from DB → render full sitemap.

**Markup:** read `PAGE_ID` from active Figma page → fetch elements → filter by category → draw overlays in a `Page Overlay` frame.

**Flows:** scan badge links on current page → check if target URL exists in DB → render from DB or trigger single-page recrawl.

## Known Gaps

- `BACKEND_URL` is compiled into the plugin via `src/plugin/constants.ts`. There is no runtime configuration.
- Screenshots are served over HTTP from `localhost:3006`. Figma requires HTTPS for reliable image loading outside local dev.
- No authentication or rate limiting on the API.
- Styling tab workflow needs a validation pass.
