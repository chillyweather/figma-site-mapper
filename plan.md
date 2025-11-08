# Implementation Plan: DB-Driven Refactor

This plan outlines the step-by-step process to refactor the Figma Site Mapper from a file-based system to a MongoDB-backed application, supporting production deployment and token-based style extraction.

## Phase 1: Backend & Database Foundation (Local)

**Goal:** Set up the database connection and the core data models.

1.  **MongoDB Atlas:**
    - [x] Create a free-tier Atlas cluster.
    - [x] Create a `dev` database.
    - [x] Get the connection string.
    - [x] Add your development IP to the IP Access List.
2.  **Backend Config (`packages/backend`):**
    - [x] `pnpm add mongoose`
    - [x] Create a `.env` file in `packages/backend` and add `MONGO_URI="your_connection_string"`.
    - [x] Create `src/db.ts` to initialize and export the Mongoose connection.
    - [x] Update `src/index.ts` to call the `db.ts` connection logic on startup.
3.  **Data Models:**
    - [x] Create `src/models/Project.ts` (schema: `{ name: String }`).
    - [x] Create `src/models/Page.ts` (schema: `{ projectId: ObjectId, url: String, title: String, screenshotPaths: [String], globalStyles: Object }`). Add a `unique` index to `[projectId, url]`.
    - [x] Create `src/models/Element.ts` (schema: `{ pageId: ObjectId, projectId: ObjectId, type: String, bbox: Object, href: String, text: String, styles: Object }`).
4.  **API Scaffolding:**
    - [x] In `src/index.ts`, implement the `POST /projects` and `GET /projects` endpoints. These are the first requirement for the plugin refactor.

## Phase 2: Crawler Upgrade (Data Gathering)

**Goal:** Modify the crawler to extract all required data and save it to Atlas.

1.  **Upgrade Crawler (`crawler.ts`):** - [x] Modify `runCrawler` to accept a `projectId`. - [x] This is the most complex task: rewrite the `page.evaluate` script. It must: - [x] Iterate over _all_ elements (not just links/buttons). - [x] For each element, iterate over a predefined list of CSS properties (`color`, `backgroundColor`, `font-size`, `font-family`, etc.). - [x] For each property, call `element.style.getPropertyValue('property-name')`. - [x] If the result starts with `var(--`, store that token. - [x] If not, get the `getComputedStyle(element).getPropertyValue('property-name')` as a fallback. - [x] Store this as a `styles: { color: "var(--color-primary)", "font-size": "16px" }` object. - [x] Separately, extract all CSS Custom Properties from the `:root`.
2.  **Refactor Data Persistence:**

    - [x] Remove all `fs.writeFileSync` logic for `manifest.json`.
    - [x] Inside the `requestHandler`, after gathering data for a page:

    1. [x] `const page = await Page.findOneAndUpdate({ url: page.url, projectId }, { ...pageData }, { new: true, upsert: true });`
    2. [x] `await Element.deleteMany({ pageId: page._id });`
    3. [x] `await Element.insertMany(elementsData.map(e => ({ ...e, pageId: page.\_id, projectId }));

3.  **Update API Endpoints:** - [x] Modify `POST /crawl` to require `projectId` and pass it to `runCrawler`. - [x] Create `POST /recrawl-page` that does the same but with `maxRequestsPerCrawl: 1`. - [x] Remove the `manifestUrl` from the `/status/:jobId` response. - [x] Implement `GET /page`, `GET /elements`, `GET /styles/global`, `GET /styles/element` to query the new collections.

## Phase 3: Plugin Refactoring (Adapting to DB)

**Goal:** Update the plugin to use the "Project" model and fetch data from the API.

1.  **Project UI:**
    - [x] Add `projectsAtom` and `activeProjectAtom` to `store/atoms.ts`.
    - [x] Update `App.tsx` to fetch projects from `GET /projects` on load and display a "Project Selector" dropdown.
    - [x] Disable all tabs until a project is selected.
    - [x] Remove credential inputs from `SettingsView.tsx`.
2.  **Update Crawl Workflow:**
    - [x] Update `useCrawl.ts` to pass the `activeProjectId` in the `start-crawl` message.
    - [x] Refactor the `get-status` handler in `uiMessageHandlers.ts`. On job "completed", it now:
      1.  [x] `figma.notify("Crawl complete! Fetching data...")`
      2.  [x] Calls `buildManifestFromProject(projectId, startUrl, options)` which fetches pages and elements from the API.
      3.  [x] Passes this manifest data to `renderSitemap`.
3.  **Data Linking & Markup Decoupling:**
    - [x] Modified `renderSitemap.ts`: It now creates the index and screenshot pages using database-sourced manifest.
    - [x] Added `buildManifestFromProject.ts` utility to reconstruct the manifest tree from database pages and elements.
    - [x] Backend now persists `interactiveElements` on Page documents for flow visualization.
    - [x] Plugin handlers (`stylingHandlers.ts`, `flowHandlers.ts`) now rebuild manifests on demand from database.
    - [x] Fixed type definitions in `types/index.ts` to properly support `TreeNode.styleData` with `ExtractedElement[]`, `cssVariables`, and `tokens`.
    - [x] Fixed corrupted import statements and missing helper functions in `uiMessageHandlers.ts`.
    - [x] Added `FlowProgress` interface and removed duplicate type definitions.
    - [x] Added `checked` and `styleTokens` properties to `ExtractedElement` interface.

## Current Status (November 3, 2025)

**Recently Completed:**

- [x] Fixed all TypeScript type errors by replacing `BadgeLink` with `FlowLink` throughout the plugin.
- [x] Added missing helper utilities (`storeDomainCookies`, `handleLoadSettings`, `getActiveProjectId`, `extractDomain`, `loadDomainCookies`).
- [x] Resolved Figma plugin sandbox incompatibilities by targeting ES2018 and replacing optional chaining, nullish coalescing, and optional catch bindings.
- [x] Corrected `handleStartCrawl` initialization order so manual auth works reliably.
- [x] Updated `extractStyleData` to pass a single config object into `page.evaluate`.
- [x] Verified end-to-end crawl: plugin builds, project creation works, crawls complete with screenshots, interactive elements, and style data stored in MongoDB.
- [x] Tightened plugin type safety by defining CSS variable snapshots, reusing `TreeNode` traversal helpers, and enforcing project selection before starting crawls.
- [x] Hardened Figma rendering pipeline: added resilient screenshot loading, HTTPS guidance, and placeholder output when assets cannot be fetched.

**Known Issues:**

- Screenshot frames rely on HTTPS assets; placeholder fallback appears when the backend serves images over HTTP.
- styleq warnings indicate some UI style definitions receive `undefined` values.
- Legacy backup files (e.g., `main.ts.backup`, `ui.tsx.backup`) are still in the repo.

**Next Steps:**

- [ ] Implement job-scoped rendering: capture visited pages per crawl, expose them via the status API, and render only those frames in the current document.
- [ ] Add an optional "Render project snapshot" action that rebuilds the full sitemap from Atlas on demand.
- [ ] Stand up an HTTPS endpoint for the backend (tunnel or prod deploy) so Figma can fetch real screenshots.
- [ ] Address styleq warnings by normalizing dynamic style props within React components.
- [ ] Remove backup files and any obsolete manifest download code.
- [ ] Validate full-refresh crawl path now that the toggle exists (ensure stale pages are pruned, partial crawls remain additive).

## Phase 4: Job-Scoped Rendering

**Goal:** Limit automatic rendering to the pages processed in the most recent crawl while keeping full-project rebuilds available on demand.

1.  **Backend Tracking & APIs:**
    - [x] Record visited URLs/IDs during each crawl job and include them in job status responses.
          [x] Provide lightweight endpoints to fetch page snapshots by job or by ID list.
2.  **Plugin Rendering:**
    - [x] Build a `buildManifestFromPageIds` helper and update the status handler to render only the job’s pages.
    - [x] Cache the last job subset locally for quick re-renders.
3.  **Snapshot Control:**
    - [ ] Expose a "Render project snapshot" button that invokes the full-project manifest when needed.

## Phase 5: New Feature Implementation

**Goal:** Build the new on-demand workflows using the database.

1.  **"Markup" Tab:**
    - [ ] Create `MarkupTab.tsx` and add it to `MainView.tsx`.
    - [ ] Add a `figma.on("selectionchange")` handler in `pageEventHandlers.ts` that checks if the selected node has a `pageId` in its `plugindata` and enables the Markup tab.
    - [ ] Create a new file `src/plugin/handlers/markupHandler.ts`.
    - [ ] The "Add Markup" button will call this handler, which will fetch from `GET /elements` and draw the highlights/badges (using the logic we just removed from `createScreenshotPages`).
2.  **"Flows" Tab Update:**
    - [ ] Refactor `flowHandlers.ts` to use the "Check DB first" logic.
    - [ ] `const page = await apiClient.getPage(url, activeProjectId);`
    - [ ] `if (page) { cloneFigmaFrame(page._id); } else { apiClient.recrawlPage(url, activeProjectId); ...poll for completion... }`
3.  **"Styling" Tab:**
    - [ ] Create `StylingTab.tsx` and add it to `MainView.tsx`.
    - [ ] Implement the "Global Styles" button and its handler to fetch from `GET /styles/global` and render a new Figma frame with text nodes.
    - [ ] Implement the "Element Style" selection logic (similar to the "Flows" tab list) to fetch from `GET /styles/element` and render a style table.

## Phase 6: Deployment (DigitalOcean)

**Goal:** Deploy the backend to a public server.

1.  **Prepare Backend for Production:**
    - [ ] Ensure all dependencies are in `package.json` (not just devDependencies).
    - [ ] Add a `start` script in `packages/backend/package.json` (e.g., `node dist/index.js`).
    - [ ] Ensure the `build` script (`tsc`) runs correctly.
2.  **DigitalOcean App Platform:**
    - [ ] Create a new "App" and connect it to your GitHub repository.
    - [ ] Set the "Root Directory" to `packages/backend`.
    - [ ] Configure the build command: `pnpm install && pnpm build`.
    - [ ] Configure the start command: `pnpm start`.
    - [ ] Add Environment Variables for `MONGO_URI` (pointing to your **production** Atlas DB) and `NODE_ENV="production"`.
3.  **Final Plugin Update:**
    - [ ] Change the `BACKEND_URL` in `packages/plugin/src/plugin/constants.ts` to your new DigitalOcean app URL.
    - [ ] Re-build the plugin (`pnpm build:plugin`).
    - [ ] Collaborators can now install this production plugin and will all connect to the same shared backend and database.
