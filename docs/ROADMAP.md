# Roadmap

## Current Baseline

Working:

- SQLite-backed projects, pages, and elements (Drizzle ORM, WAL mode).
- Fastify API for projects, crawls, pages, elements, and styles.
- BullMQ + Redis worker flow for full and single-page crawls.
- Playwright/Crawlee crawler with screenshots, element detection, optional style extraction, auth helpers, and CAPTCHA detection.
- Job-scoped rendering from visited page IDs.
- Full project snapshot rendering.
- Markup tab with element filters and overlay rendering.
- DB-first flow rendering with recrawl fallback.
- React/Jotai plugin UI split into tabs/hooks/components.
- Pino logging with daily file rotation.

Needs validation:

- Styling tab end-to-end behavior.
- Auth UX for protected crawls.
- Screenshot loading in Figma over HTTPS.
- Full-refresh stale page cleanup.

## Hardening

1. **Configuration**: Replace hardcoded `http://localhost:3006` references in the plugin; decide how `BACKEND_URL` is set for dev vs production builds.

2. **Build/deployment**: Decide whether to commit `pnpm-lock.yaml`. Remove generated `dist/` from source control if not intentional.

3. **Screenshot storage**: Local `/screenshots` is fine for single-server use. Add S3/object storage only when actually implemented.

4. **Core workflow validation** (manual):
   - Create project → full crawl → render job-scoped sitemap → render full project snapshot.
   - Markup links/buttons/forms.
   - Build a flow from a cached target page.
   - Build a flow from an uncached target page.
   - Run style extraction and render global/element style tables.

5. **Automated checks**: Backend TypeScript build, plugin build, unit tests for URL normalization and manifest assembly, route-level smoke tests.

## Feature Work

Near-term:

- Clean up Styling tab implementation.
- Improve manual auth discoverability from the Crawling tab.
- Add a simple project detail view: page count, last crawled date, last start URL.
- Add recrawl controls for the active page.
- Add clear error states for missing screenshot assets.

Later:

- S3-compatible screenshot storage.
- Public/private deployment mode.
- Crawl history per project.
- Visual diff between crawls.
- Design-system grouping: detect repeated component/style patterns.
- Export Markdown/JSON reports.

## Technical Debt Watchlist

- URL canonicalization is duplicated across plugin/backend utilities.
- Plugin and backend types are separate and can drift.
- Queue/job payloads are loosely typed.
- API responses are mostly unvalidated.
- Figma plugin data keys are stringly typed.
- Some older UI naming still references "mapping" while the current tab is "flows".
- Production security is not designed yet.
