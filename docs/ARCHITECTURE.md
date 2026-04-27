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
- `src/schema.ts`: Drizzle table definitions for projects, crawl runs, discovery runs, inventory builds, pages, and elements. Source of truth for DB types.
- `src/app.ts`: all Fastify routes.
- `src/queue.ts`: BullMQ queue and Redis connection (reads `REDIS_URL` env var).
- `src/crawler.ts`: Playwright/Crawlee crawler — screenshots, element detection, style extraction, auth session.
- `src/services/manifestBuilder.ts`: queries pages and elements by ID, serializes to API response shape.

API endpoints:

- `GET /projects`, `POST /projects`
- `GET /projects/:projectId/crawl-runs`
- `POST /crawl`, `POST /recrawl-page`
- `POST /crawl/approved`
- `POST /discovery/start`, `GET /discovery/:runId`, `POST /discovery/:runId/approval`
- `GET /status/:jobId`, `GET /jobs/:jobId/pages`
- `GET /pages/by-ids`, `GET /page`
- `GET /elements`
- `GET /styles/global`, `GET /styles/element`
- `POST /inventory/prepare/:projectId`
- `GET /inventory/overview`, `GET /inventory/decisions/:projectId`
- `GET /inventory/render-data/:projectId`, `GET /inventory/tokens`
- `POST /auth-session`, `POST /progress/:jobId`

## Data Model

Stored in SQLite at `packages/backend/data/sitemapper.db`. Schema defined in `src/schema.ts` via Drizzle ORM.

`projects` — `id`, `name`, timestamps

`crawl_runs` — crawl job metadata, page counts, status, optional approved URL list, optional discovery run linkage

`inventory_builds` — generated workspace build records tied to project and crawl run

`discovery_runs` — discovery configuration, candidate/recommended/approved counts, warnings, timestamps

`discovery_candidates` — normalized candidate URLs, provenance, classification, recommendation/approval flags

`pages` — `id`, `projectId`, `url`, `title`, `screenshotPaths` (JSON), `interactiveElements` (JSON), `globalStyles` (JSON), `annotatedScreenshotPath`, `lastCrawledAt`, `lastCrawlJobId`, `lastCrawlRunId`, timestamps. Unique compound index on `(projectId, url)` — recrawling updates the same logical record.

`elements` — `id`, `pageId`, `projectId`, `type`, `selector`, `tagName`, `classes` (JSON), `bbox` (JSON), `styles` (JSON), `styleTokens` (JSON), accessibility/media/input fields, ancestry/fingerprint fields, crop metadata, global-chrome flag, timestamps. Indexed on `(pageId, type)` and `(projectId, type)`.

Array and object fields (`screenshotPaths`, `interactiveElements`, `globalStyles`, `styles`, `classes`, `bbox`, `styleTokens`) are stored as TEXT and must be `JSON.parse`/`JSON.stringify`d at the DB boundary. Serialization helpers `serializePage` and `serializeElement` in `manifestBuilder.ts` handle this for API responses.

IDs are auto-increment integers. All API responses include `_id: String(id)` for plugin compatibility.

## Crawl Flow

1. Plugin uses the `Crawling` tab in either `Recommended` or `Exact URLs` mode.
2. Recommended mode starts a discovery run via `POST /discovery/start`.
3. The backend collects candidate URLs, classifies them, scores them, and stores them in `discovery_runs` and `discovery_candidates`.
4. Plugin reviews `GET /discovery/:runId`, then submits approved candidates and optional manual URLs to `POST /discovery/:runId/approval`.
5. Exact URLs mode creates a minimal discovery run from the provided URLs and approves those URLs through the same approval path.
6. Approved capture calls `POST /crawl/approved`; the API validates that every approved URL belongs to the discovery run and enqueues a BullMQ job.
7. Worker pulls the job and calls `runCrawler`.
8. Crawler opens Chromium, navigates allowed pages, handles delays/auth/CAPTCHA, captures screenshots, extracts style/element data, and writes progress back through BullMQ.
9. Screenshots are sliced to ≤4096 px height and written to `packages/backend/screenshots/`.
10. Each page is upserted via `INSERT ... ON CONFLICT(project_id, url) DO UPDATE`.
11. Existing elements for that page are deleted and replaced with freshly extracted elements in batches of 200.
12. Worker writes visited page IDs (integer strings) and URLs back to the BullMQ job record.
13. Plugin polls `GET /status/:jobId`, then fetches the job subset and renders Figma pages.
14. Generated Figma pages store `URL`, `PROJECT_ID`, `PAGE_ID`, `SCREENSHOT_WIDTH`, and `ORIGINAL_VIEWPORT_WIDTH` in plugin data.

## Plugin

The plugin lives in `packages/plugin` and has two separate build targets:

- `vite.config.ts` — builds the React UI (`src/ui.tsx`) into a single self-contained HTML file.
- `vite.code.config.ts` — builds the Figma sandbox code (`src/main.ts`) as an ES module.

Main areas:

- `src/ui.tsx`: React entry point.
- `src/main.ts`: Figma plugin sandbox entry point.
- `src/components/`: UI views. The main user-facing tabs are `Crawling` and `Inventory`.
- `src/hooks/`: UI-side state and workflow hooks.
- `src/store/atoms.ts`: Jotai global state.
- `src/plugin/handlers/`: Figma-side message handlers.
- `src/plugin/services/apiClient.ts`: all fetch calls to the backend.
- `src/plugin/constants.ts`: compile-time constants including `BACKEND_URL`.
- `src/figmaRendering/`: sitemap, screenshot-page, and inventory-board canvas rendering.

## Plugin↔Canvas Bridge

The Figma-side code stores metadata on generated pages and frames using `figma.currentPage.setPluginData(key, value)`. Keys in use:

- `URL` — the crawled page URL
- `PROJECT_ID` — the active SQLite project ID as a string
- `PAGE_ID` — the integer DB ID as a string
- `SCREENSHOT_WIDTH` — original screenshot width
- `ORIGINAL_VIEWPORT_WIDTH` — source browser viewport width used during capture

This metadata is the only link between Figma canvas objects and DB records. These key names must not change without updating all handler code that reads them.

## Rendering Flows

**After approved capture:** poll job → read `visitedPageIds` → fetch pages/elements → render screenshot frames and index page → store plugin data.

**Inventory:** queue workspace build → backend writes `workspace/<projectId>/` → agent writes `decisions/*` → plugin fetches render data → render `DS Inventory` page and sample anchors.

**Markup/flow/styling helpers:** canvas-side handlers still exist and operate from stored page/plugin metadata plus DB data, but they are not part of the primary top-level two-tab workflow.

## Known Gaps

- `BACKEND_URL` is compiled into the plugin via `src/plugin/constants.ts`. There is no runtime configuration.
- Screenshots and workspace assets are served over HTTP from the backend; Figma requires HTTPS for reliable image loading outside local dev.
- No authentication or rate limiting on the API.
- External mapping context inputs such as client repo path/branch, Storybook, or UI library hints are not part of the current implementation yet.
