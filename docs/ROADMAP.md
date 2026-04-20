# Roadmap

This document is the working recovery plan for resurrecting the project.

## Current Baseline

Implemented:

- MongoDB-backed projects, pages, and elements.
- Fastify API for projects, crawls, pages, elements, and styles.
- BullMQ worker flow for full and single-page crawls.
- Playwright/Crawlee crawler with screenshots, element detection, optional style extraction, auth helpers, and CAPTCHA detection.
- Job-scoped rendering from visited page IDs.
- Full project snapshot rendering.
- Markup tab with element filters and overlay rendering.
- DB-first flow rendering with recrawl fallback.
- React/Jotai plugin UI split into tabs/hooks/components.

Needs validation:

- Styling tab end-to-end behavior.
- Auth UX for protected crawls.
- Docker deployment from a clean checkout.
- Screenshot loading in Figma over HTTPS.
- Full-refresh stale page cleanup.

## Cleanup And Hardening

1. Centralize configuration.

   - Replace hardcoded `http://localhost:3006` references.
   - Decide how plugin backend URL is configured for dev vs production builds.
   - Make Redis use `REDIS_URL`.

2. Fix build/deployment assumptions.

   - Decide whether `pnpm-lock.yaml` should be committed.
   - Verify Dockerfile from a clean checkout.
   - Remove generated backend `dist` from source control if it is not intentionally committed.
   - Align Docker Compose commands with actual built paths.

3. Reconcile screenshot storage.

   - Keep local `/screenshots` for local development.
   - Add S3/object storage only when actually implemented.
   - Ensure stored screenshot URLs are HTTPS in production.

4. Validate core workflows manually.

   - Create project.
   - Full crawl.
   - Render job-scoped sitemap.
   - Render full project snapshot.
   - Markup links/buttons/forms.
   - Build a flow from a cached target page.
   - Build a flow from an uncached target page.
   - Run style extraction and render global/element style tables.

5. Add basic automated checks.

   - Backend TypeScript build.
   - Plugin build.
   - Unit tests for URL normalization and manifest assembly.
   - Route-level smoke tests for project/page/element APIs.

## Feature Work

Near-term:

- Clean up Styling tab implementation and remove direct backend URL usage.
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
- Better collaboration model across Figma users.

## Technical Debt Watchlist

- URL canonicalization is duplicated in several plugin/backend utilities.
- Plugin and backend types are separate and can drift.
- Queue/job payloads are loosely typed.
- API responses are mostly unvalidated.
- Figma plugin data keys are stringly typed.
- Some older UI naming still references "mapping" while the current tab is "flows".
- Production security is not designed yet.
