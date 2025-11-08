# Phase 4 Todo List

## Backend Tracking & APIs

- [x] Capture `visitedUrls` and `visitedPageIds` inside the crawler/worker and include them in job completion data.
- [x] Extend `/status/:jobId` to surface the new job fields and expose page counts.
- [x] Add lightweight endpoints for job-scoped page retrieval (`GET /jobs/:jobId/pages`) and arbitrary ID lookups (`GET /pages/by-ids`).
- [x] Create a shared manifest builder that accepts a list of page IDs.

## Plugin Rendering

- [x] Add an API client helper to fetch pages by ID list.
- [x] Implement `buildManifestFromPageIds` and wire `handleGetStatus` to render job subsets.
- [x] Cache the latest job subset in `clientStorage` for quick re-renders.

## Snapshot Control

- [ ] Add the "Render project snapshot" UI control and handler.
