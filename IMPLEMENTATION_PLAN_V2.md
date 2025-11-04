# Implementation Plan: Job-Scoped Rendering

This plan sequences the work needed to deliver the updated crawl behavior while keeping existing features stable.

## Phase 0 – Discovery & Safety Nets

1. Audit current job records in the queue/DB to confirm what metadata is persisted (URLs, timestamps, status).
2. Add unit or integration tests around `buildManifestFromProject` to protect it before refactoring.
3. Capture fixtures for a small project (e.g., four URLs) to use in later regression tests.

## Phase 1 – Backend Job Tracking

1. Update the crawl worker to accumulate `visitedUrls` and resolve each to a page `_id` after the upsert call.
2. Extend the job result schema/model to include `visitedUrls`, `visitedPageIds`, and `pageCount`.
3. Write unit tests for job completion ensuring the arrays contain canonical URLs and matching IDs (dedupe as needed).
4. Ensure `fullRefresh` continues to prune untouched pages, but only when that flag is true.

## Phase 2 – API Surface

1. Extend `/status/:jobId` (or equivalent) to return the new fields; update docs and TypeScript types.
2. Implement `GET /jobs/:jobId/pages` that hydrates the pages/elements for a completed job.
   - Reuse existing mongoose models and avoid N+1 queries by batching page IDs.
3. Add `GET /pages/by-ids` with `projectId` + `ids[]` query params for the plugin’s subset fetches.
4. Create shared helpers to assemble a manifest payload (pages + elements) given a page ID list.
5. Add tests for each endpoint, including error paths (job not ready, page not found, wrong project).

## Phase 3 – Plugin Data Access Layer

1. Introduce a new client method `fetchPagesByIds(projectId, pageIds)` that wraps the new endpoint.
2. Add `buildManifestFromPageIds` utility that mirrors `buildManifestFromProject` but consumes a subset.
3. Update TypeScript types and atoms/selectors storing job status to include `visitedPageIds` and `visitedUrls`.
4. Implement caching in `clientStorage` for the latest job subset to support re-renders without re-crawling.

## Phase 4 – Crawl Completion Flow

1. Modify the polling handler (`handleGetStatus`) to branch on the new job fields:
   - If `visitedPageIds` is empty, show an error toast.
   - Otherwise, fetch subset data and call `renderSitemap`.
2. Ensure progress messages reflect the number of pages being rendered (e.g., "Rendering 4 pages").
3. Verify deduplication still works: frames from previous jobs must be reused when re-rendering the same URL in the same document.
4. Add analytics/logging hooks if desired to capture job-level metrics.

## Phase 5 – "Render Project Snapshot" Action

1. Add a new button (e.g., in Settings or Project tab) with copy such as "Render project snapshot".
2. Wire it to call the existing `buildManifestFromProject` helper and then `renderSitemap`.
3. Add guardrails: disable the button until a project is selected and warn if the project has a large page count.
4. Update UI copy and documentation to explain the difference between job renders and full snapshot renders.

## Phase 6 – QA & Regression

1. Manual smoke test the three target scenarios outlined by the product owner.
2. Verify existing flows (flow builder, markup, styling tab) still function when only a subset of pages exists on the canvas.
3. Run end-to-end crawl tests with both HTTP screenshot fallback and HTTPS success paths.
4. Update `plan.md` and any public docs to reflect the new behavior.

## Phase 7 – Deployment & Monitoring

1. Deploy backend changes to staging/prod with feature flags if available.
2. Release updated plugin build (ensure the runtime bundle avoids unsupported syntax).
3. Monitor logs for malformed job payloads or missing page IDs; add alerts if counts mismatch.
4. Gather user feedback on the new workflow and iterate on the optional "Render project snapshot" entry point.
