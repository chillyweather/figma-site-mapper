# Technical Requirements: DB-Driven Crawl Rendering (v2)

This document updates the system requirements so that crawl results render only the pages processed in the most recent job, while preserving the broader DB-driven architecture outlined in the original brief.

## 1.0 Target Experience

- **Job-scoped rendering:** When a crawl completes (single page or multi-page), the plugin must render only the pages touched by that job. Previously crawled pages that were not part of the current run stay untouched unless the user triggers an explicit rebuild.
- **Canonical job examples:**
  - Crawling `https://crawlee.dev/python` (1 request) adds/updates that page in Atlas and renders only that page in the current Figma file.
  - Crawling `https://crawlee.dev/js` (already stored) refreshes its data and renders only that page.
  - Crawling `https://crawlee.dev/` with `maxRequests=4` touches four URLs; two already exist in Atlas, two are new. The crawl updates/creates all four in Atlas and renders all four.
- **Rebuild on demand:** Provide a plugin action (e.g., "Render project snapshot") that recreates the entire sitemap from Atlas when desired.
- **State isolation:** Multiple Figma documents can request different subsets of the same project without overwriting each other’s canvas content.

## 2.0 Data Responsibilities

2.1 **Projects** (MongoDB `projects` collection) remain the top-level grouping. No schema changes.

2.2 **Pages** (MongoDB `pages` collection):

- Upsert on each crawl using `(projectId, canonicalUrl)`.
- Store metadata and screenshot paths as already implemented.
- Record `lastCrawledJobId` (string) to track the most recent job that refreshed that page.

  2.3 **Elements** (MongoDB `elements` collection):

- Continue to use the replace-all strategy per page.
- Extend schema to include `lastCrawledJobId` for traceability (optional but recommended for debugging).

  2.4 **Jobs / Queue State**:

- Persist `jobId`, `projectId`, `startUrl`, crawl options, and an ordered list of `visitedUrls`. If the queue already stores result blobs, extend them to include this list.
- A job record must expose `visitedPageIds` after persistence (resolve `(projectId, url)` to `_id` during completion handling).

## 3.0 Backend Requirements

3.1 **Crawler Worker**

- Track every unique page processed (canonical URL) in the job.
- After finishing a page:
  - Upsert the page.
  - Replace its elements.
  - Collect the page `_id`.
- When the job completes, publish `visitedUrls` and `visitedPageIds` alongside other job metadata.

  3.2 **Status & Result APIs**

- `GET /status/:jobId` (or the existing handler) must include:
  - `visitedUrls: string[]`
  - `visitedPageIds: string[]`
  - `pageCount: number`
- Add `GET /jobs/:jobId/pages` which returns the hydrated page documents and any cached crawl metadata (screenshot paths, interactive elements).
- Add `GET /pages/by-ids?ids=...` that returns page records for arbitrary subsets (used by the plugin when it has page IDs).
- Ensure all new endpoints enforce `projectId` scoping to prevent cross-project leakage.

  3.3 **Manifest Assembly Helpers**

- Provide a backend helper to convert a list of page IDs into the simplified manifest structure (tree, screenshots, elements). This can be re-used for both job-scoped responses and the "Render project snapshot" action.

  3.4 **Job Clean-Up**

- Retain existing full refresh logic (prune pages untouched when `fullRefresh=true`).
- For partial crawls, do not delete unattended pages.

## 4.0 Plugin Requirements

4.1 **Job Completion Flow**

- After polling detects `status=completed`, extract `visitedPageIds` / `visitedUrls` from the job payload.
- Call a new client helper `buildManifestFromPageIds(pageIds, startUrl, options)` that fetches only those pages/elements.
- Render results using the existing `renderSitemap` pipeline (still reuses existing frames; the input list is now scoped).

  4.2 **All-Pages Rebuild**

- Add a new UI control (e.g., in Settings or a dedicated "Project" tab) labeled "Render project snapshot".
- Triggering this action should use the existing `buildManifestFromProject` helper (all pages) and re-render.

  4.3 **Local State**

- Store the last job’s `visitedPageIds` in `clientStorage` so the user can re-run the same render without a new crawl if desired.
- Continue to annotate frames with `projectId`, `pageId`, and `URL` plugin data to avoid duplicates across sessions.

  4.4 **Flow & Markup Tabs**

- Flow-building still consults the DB first. When cloning existing frames, respect the current document’s subset (clone from job results or global snapshot depending on user action).
- Markup tab uses the selected frame’s `pageId` regardless of job scope.

## 5.0 Reliability & UX

- Maintain crash-safe rendering: the plugin should skip pages that fail to hydrate, log the issue, and continue with the others.
- When the job returns zero pages (e.g., crawl constrained by robots.txt), notify the user and avoid touching the canvas.
- Provide toast notifications summarizing how many pages were rendered for the job and how many already existed.
- Ensure the optional HTTPS warning and placeholder fallback continue to operate on the new job-scoped renders.

## 6.0 Open Questions & Assumptions

- **Auth Scope:** Assumes the backend already associates jobs with a user/session; no additional auth changes are required.
- **Large Jobs:** If job output exceeds plugin transport limits, paginate `visitedPageIds` across multiple requests.
- **All-pages action:** If performance becomes an issue, consider server-side export (e.g., zipped manifest) instead of client-side assembly.
