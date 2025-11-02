# Technical Requirements: Figma Site Mapper (DB-Driven)

This document outlines the technical requirements for refactoring the Figma Site Mapper to use a persistent MongoDB Atlas database, enabling multi-stage, collaborative workflows for sitemap generation, user flow mapping, and style analysis.

## 1.0 Global Architecture

1.1. **Database:** The system will use **MongoDB Atlas** as its persistent data store, replacing the current file-based `manifest.json` system.
1.2. **Deployment Model:** The architecture is a client-server model.
_ **Backend:** A Node.js application deployed to a cloud host (e.g., DigitalOcean, Linode) which connects to the Atlas DB.
_ **Plugin:** A Figma plugin (React UI) that communicates with the deployed backend via a public API.
1.3. **Security:**
_ The Figma plugin **must not** store or handle any database credentials.
_ The **Backend Server** is the _only_ component authorized to connect to the Atlas database. It will load its `MONGO_URI` connection string from secure environment variables.
1.4. **Data Model (MongoDB):**
_ **`Projects` Collection:** Stores a `name` and `_id`. This is the top-level container for a single website.
_ **`Pages` Collection:** Stores `projectId`, `url` (unique per project), `title`, screenshot file paths, and a `globalStyles` object. \* **`Elements` Collection:** Stores `pageId`, `projectId`, `type` (link, button, text, input), `bbox` (x, y, width, height), `href`, `text`, and a `styles` object.

## 2.0 Backend (`packages/backend`)

2.1. **Database Connection:** The Fastify server will establish a persistent connection to the MongoDB Atlas cluster on startup.
2.2. **Crawler (`crawler.ts`):**
_ **Data Extraction (Primary Goal):** The crawler must be upgraded to extract a comprehensive data set for each page:
_ **Page Data:** URL, Title.
_ **Global Styles:** All CSS Custom Properties (e.g., `--token-name: value`), fonts, and a palette of all colors.
_ **Element Data:** For all specified elements (links, buttons, text, inputs):
_ Bounding box (`x`, `y`, `width`, `height`).
_ Link `href`.
_ Inner text.
_ **Styling (Token-First):** The crawler must attempt to find the raw CSS token (e.g., `var(--color-primary)`). If a token is not found for a property, it will fall back to the `getComputedStyle()` value (e.g., `rgb(0, 0, 0)`).
_ **Data Persistence:** On successful crawl of a page, the crawler must perform an **upsert** operation (update if `url` and `projectId` match, insert if not) to the `Pages` collection.
_ **Element Persistence:** The crawler will then **delete all** existing `Elements` for that `pageId` and perform a new `insertMany` with the fresh element data ("replace all" strategy).
2.3. **API Endpoints:** The Fastify API must be refactored and expanded:
_ `POST /projects`: Create a new project.
_ `GET /projects`: List all available projects.
_ `POST /crawl`: (Existing) Initiates a full crawl. Now accepts `projectId`. Will save data to DB, not a file.
_ `POST /recrawl-page`: Initiates a single-page crawl to refresh its data in the DB.
_ `GET /page`: Fetch a single page's data from the DB (e.g., `?url=...&projectId=...`).
_ `GET /elements`: Fetch all elements for a specific page (e.g., `?pageId=...`).
_ `GET /styles/global`: Fetch global style/token data for a project (e.g., `?projectId=...`).
_ `GET /styles/element`: Fetch style data for a specific element (e.g., `?elementId=...`).

## 3.0 Figma Plugin (`packages/plugin`)

3.1. **Configuration:**
_ The `BACKEND_URL` constant will be updated to point to the production server URL.
_ A **"Project" selection UI** must be added to the main view, allowing users to select an active project.
_ All plugin operations (crawl, markup, flow) must be scoped to the `activeProjectId`.
3.2. **Data-Figma Linking:**
_ All Figma frames created by the plugin **must** have the `projectId` and relevant `pageId` or `elementId` stored in their `plugindata`. This is the sole mechanism for linking Figma objects to database entries.
3.3. **"Crawl" Tab:**
_ The "Start Crawl" button will initiate the crawl. It now sends the `activeProjectId` with the crawl request.
_ The render logic will be simplified to only render the screenshots and index page. Markup generation will be moved.
_ A "Re-crawl Page" button will be added (perhaps in the "Markup" tab) that calls the `POST /recrawl-page` endpoint for the selected page.
3.4. **New "Markup" Tab:**
_ A new tab will be added to `MainView.tsx`.
_ When a user selects a screenshot frame on the canvas, this tab will: 1. Read `pageId` from `plugindata`. 2. Display checkboxes (e.g., "Links/Buttons", "Text", "Inputs").
_ An "Add Markup" button will: 1. Fetch element data from `GET /elements?pageId=...`. 2. Filter for the selected types. 3. Draw the highlights/badges on top of the screenshot (on-demand).
3.5. **"Flows" Tab:**
_ The flow-building logic must be updated.
_ When "Build Flow" is clicked for a target URL: 1. Plugin will call the backend `GET /page?url=...&projectId=...`. 2. **If page exists in DB:** The plugin will find the corresponding Figma screenshot frame (by iterating through pages and checking `plugindata`) and _clone_ it into the flow. 3. **If page does not exist in DB:** The plugin will trigger a single-page crawl via `POST /recrawl-page`, which saves it to the DB and renders the new screenshot.
_ A checkbox "Add markup to new page" will be provided.
3.6. **New "Styling" Tab:**
_ **Global Styles:** A button "Show Global Styles" will fetch data from `GET /styles/global?projectId=...` and render a table of all CSS variables, fonts, and colors.
_ **Element Styles:** The user can select a markup highlight (e.g., "link_1") on the canvas. The tab will show a list.
_ On clicking "Show Element Style," the plugin will fetch data from `GET /styles/element?elementId=...` and render a table on the canvas detailing its **token-based** and computed styles.
