# Implementation Plan: DB-Driven Refactor

This plan outlines the step-by-step process to refactor the Figma Site Mapper from a file-based system to a MongoDB-backed application, supporting production deployment and token-based style extraction.

## Phase 1: Backend & Database Foundation (Local)

**Goal:** Set up the database connection and the core data models.

1.  **MongoDB Atlas:**
    - Create a free-tier Atlas cluster.
    - Create a `dev` database.
    - Get the connection string.
    - Add your development IP to the IP Access List.
2.  **Backend Config (`packages/backend`):**
    - `pnpm add mongoose`
    - Create a `.env` file in `packages/backend` and add `MONGO_URI="your_connection_string"`.
    - Create `src/db.ts` to initialize and export the Mongoose connection.
    - Update `src/index.ts` to call the `db.ts` connection logic on startup.
3.  **Data Models:**
    - Create `src/models/Project.ts` (schema: `{ name: String }`).
    - Create `src/models/Page.ts` (schema: `{ projectId: ObjectId, url: String, title: String, screenshotPaths: [String], globalStyles: Object }`). Add a `unique` index to `[projectId, url]`.
    - Create `src/models/Element.ts` (schema: `{ pageId: ObjectId, projectId: ObjectId, type: String, bbox: Object, href: String, text: String, styles: Object }`).
4.  **API Scaffolding:**
    - In `src/index.ts`, implement the `POST /projects` and `GET /projects` endpoints. These are the first requirement for the plugin refactor.

## Phase 2: Crawler Upgrade (Data Gathering)

**Goal:** Modify the crawler to extract all required data and save it to Atlas.

1.  **Upgrade Crawler (`crawler.ts`):**
    - Modify `runCrawler` to accept a `projectId`.
    - This is the most complex task: rewrite the `page.evaluate` script. It must:
      - Iterate over _all_ elements (not just links/buttons).
      - For each element, iterate over a predefined list of CSS properties (`color`, `backgroundColor`, `font-size`, `font-family`, etc.).
      - For each property, call `element.style.getPropertyValue('property-name')`.
      - If the result starts with `var(--`, store that token.
      - If not, get the `getComputedStyle(element).getPropertyValue('property-name')` as a fallback.
      - Store this as a `styles: { color: "var(--color-primary)", "font-size": "16px" }` object.
      - Separately, extract all CSS Custom Properties from the `:root`.
2.  **Refactor Data Persistence:**
    - Remove all `fs.writeFileSync` logic for `manifest.json`.
    - Inside the `requestHandler`, after gathering data for a page:
      1.  `const page = await Page.findOneAndUpdate({ url: page.url, projectId }, { ...pageData }, { new: true, upsert: true });`
      2.  `await Element.deleteMany({ pageId: page._id });`
      3.  `await Element.insertMany(elementsData.map(e => ({ ...e, pageId: page._id, projectId })));`
3.  **Update API Endpoints:**
    - Modify `POST /crawl` to require `projectId` and pass it to `runCrawler`.
    - Create `POST /recrawl-page` that does the same but with `maxRequestsPerCrawl: 1`.
    - Remove the `manifestUrl` from the `/status/:jobId` response.
    - Implement `GET /page`, `GET /elements`, `GET /styles/global`, `GET /styles/element` to query the new collections.

## Phase 3: Plugin Refactoring (Adapting to DB)

**Goal:** Update the plugin to use the "Project" model and fetch data from the API.

1.  **Project UI:**
    - Add `projectsAtom` and `activeProjectAtom` to `store/atoms.ts`.
    - Update `App.tsx` to fetch projects from `GET /projects` on load and display a "Project Selector" dropdown.
    - Disable all tabs until a project is selected.
    - Remove credential inputs from `SettingsView.tsx`.
2.  **Update Crawl Workflow:**
    - Update `useCrawl.ts` to pass the `activeProjectId` in the `start-crawl` message.
    - Refactor the `get-status` handler in `uiMessageHandlers.ts`. On job "completed", it must now:
      1.  `figma.notify("Crawl complete! Fetching data...")`
      2.  Call `apiClient.getPages(activeProjectId)`.
      3.  Pass this page data to `renderSitemap`.
3.  **Data Linking & Markup Decoupling:**
    - Modify `renderSitemap.ts`: It should _only_ create the index and the screenshot pages.
    - Inside `createScreenshotPages.ts`, **remove all logic** for creating highlights and badges.
    - Add the `frame.setPluginData("projectId", ...)` and `frame.setPluginData("pageId", ...)` calls inside this function.

## Phase 4: New Feature Implementation

**Goal:** Build the new on-demand workflows using the database.

1.  **"Markup" Tab:**
    - Create `MarkupTab.tsx` and add it to `MainView.tsx`.
    - Add a `figma.on("selectionchange")` handler in `pageEventHandlers.ts` that checks if the selected node has a `pageId` in its `plugindata` and enables the Markup tab.
    - Create a new file `src/plugin/handlers/markupHandler.ts`.
    - The "Add Markup" button will call this handler, which will fetch from `GET /elements` and draw the highlights/badges (using the logic we just removed from `createScreenshotPages`).
2.  **"Flows" Tab Update:**
    - Refactor `flowHandlers.ts` to use the "Check DB first" logic.
    - `const page = await apiClient.getPage(url, activeProjectId);`
    - `if (page) { cloneFigmaFrame(page._id); } else { apiClient.recrawlPage(url, activeProjectId); ...poll for completion... }`
3.  **"Styling" Tab:**
    - Create `StylingTab.tsx` and add it to `MainView.tsx`.
    - Implement the "Global Styles" button and its handler to fetch from `GET /styles/global` and render a new Figma frame with text nodes.
    - Implement the "Element Style" selection logic (similar to the "Flows" tab list) to fetch from `GET /styles/element` and render a style table.

## Phase 5: Deployment (DigitalOcean)

**Goal:** Deploy the backend to a public server.

1.  **Prepare Backend for Production:**
    - Ensure all dependencies are in `package.json` (not just devDependencies).
    - Add a `start` script in `packages/backend/package.json` (e.g., `node dist/index.js`).
    - Ensure the `build` script (`tsc`) runs correctly.
2.  **DigitalOcean App Platform:**
    - Create a new "App" and connect it to your GitHub repository.
    - Set the "Root Directory" to `packages/backend`.
    - Configure the build command: `pnpm install && pnpm build`.
    - Configure the start command: `pnpm start`.
    - Add Environment Variables for `MONGO_URI` (pointing to your **production** Atlas DB) and `NODE_ENV="production"`.
3.  **Final Plugin Update:**
    - Change the `BACKEND_URL` in `packages/plugin/src/plugin/constants.ts` to your new DigitalOcean app URL.
    - Re-build the plugin (`pnpm build:plugin`).
    - Collaborators can now install this production plugin and will all connect to the same shared backend and database.
