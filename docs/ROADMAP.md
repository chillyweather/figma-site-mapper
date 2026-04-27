# Roadmap

## Current Baseline

Working:

- SQLite-backed projects, pages, elements, crawl runs, discovery runs, and inventory builds (Drizzle ORM, WAL mode).
- Fastify API for discovery, approved capture, pages/elements/styles, and inventory workspace/render-data endpoints.
- BullMQ + Redis worker flow for approved capture, single-page recrawl, and inventory-prepare jobs.
- Playwright/Crawlee crawler with screenshots, element detection, optional style extraction, auth helpers, and CAPTCHA detection.
- Recommended discovery with `Fast` and `Full site exploration` modes.
- Exact URL capture through the same approved-capture path.
- Job-scoped rendering from visited page IDs plus stale-page cleanup on full refresh.
- Inventory workspace generation under `packages/backend/workspace/<projectId>/`.
- Agent-driven decision flow for clusters, tokens, inconsistencies, templates, and notes.
- `DS Inventory` board rendering with crop thumbnails and `View sample` links.
- React/Jotai plugin UI with top-level `Crawling` and `Inventory` tabs.
- Pino logging with daily file rotation.

Needs validation:

- Auth UX for protected crawls on difficult sites.
- Screenshot loading in Figma over HTTPS outside local development.
- Inventory board behavior on very large projects and very large decision sets.
- Decision-file validation ergonomics for agent-written outputs.

## Hardening

1. **Configuration**: Replace hardcoded `http://localhost:3006` references in the plugin; decide how `BACKEND_URL` is set for dev vs production builds.

2. **Build/deployment**: Decide whether to commit `pnpm-lock.yaml`. Remove generated `dist/` from source control if not intentional.

3. **Screenshot storage**: Local `/screenshots` is fine for single-server use. Add S3/object storage only when actually implemented.

4. **Core workflow validation** (manual):
   - Create project → recommended discovery → approved capture → render job-scoped sitemap.
   - Exact URL capture for a known page set.
   - Full refresh cleanup on a project with stale pages.
   - Inventory workspace prepare → agent decisions → inventory board render.
   - Protected-site capture with manual auth or cookies.

5. **Automated checks**: Backend TypeScript build, plugin build, discovery/approved-capture validation CLIs, unit tests for URL normalization and manifest assembly, route-level smoke tests.

## Feature Work

Near-term:

- Add mapping-input support for future repo-backed workflows:
  - local repo path
  - explicit branch name
  - Storybook URL/path
  - known UI library hints
- Generate a normalized `mapping-context` workspace layer from optional evidence sources.
- Improve manual auth discoverability from the Crawling tab.
- Add clearer warnings when discovery is blocked or degraded on target sites.
- Improve inventory-board presentation for large token/template/inconsistency sets.

Later:

- S3-compatible screenshot storage.
- Public/private deployment mode.
- Crawl history per project.
- Visual diff between crawls.
- Repo/storybook-assisted mapping automation on top of crawl workspace evidence.
- Export Markdown/JSON reports.

## Technical Debt Watchlist

- URL canonicalization is duplicated across plugin/backend utilities.
- Plugin and backend types are separate and can drift.
- Queue/job payloads are loosely typed.
- API responses are mostly unvalidated.
- Figma plugin data keys are stringly typed.
- Some older UI/service naming still references "mapping" even though the top-level plugin workflow is now crawl/inventory oriented.
- Production security is not designed yet.
