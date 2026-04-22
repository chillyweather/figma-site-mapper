# AGENTS.md

- Read `CLAUDE.md` after this file if you need the longer architecture/data-flow note; use `packages/**/src` as source of truth over prose and generated output.

## Run

- Required local services: Redis plus three dev processes. Start Redis with `docker compose up redis -d`.
- Backend env lives in `packages/backend/.env`: set `REDIS_URL`, `PUBLIC_URL`, and `NODE_ENV`.
- Full dev stack: `pnpm dev`.
- Split dev processes when debugging: `pnpm dev:backend`, `pnpm dev:worker`, `pnpm dev:plugin`.
- `pnpm dev:plugin` is not a Vite dev server; it runs both plugin builds in watch mode and updates `packages/plugin/dist` for Figma.
- Load the plugin from `packages/plugin/manifest.json` in Figma Desktop (`Plugins -> Development -> Import plugin from manifest`).

## Verify

- There is no real test/lint/typecheck pipeline in this repo. `pnpm test` and `pnpm --filter backend test` are placeholder failing scripts.
- No CI workflows or pre-commit config are checked in.
- Real verification is build-based: `pnpm build:plugin` and `pnpm --filter backend build`.
- Quick backend sanity check: `curl http://localhost:3006/` should return `{"hello":"world"}` once the API is up.

## Repo Shape

- `packages/backend` is a two-process app: API entrypoint `src/index.ts`, worker entrypoint `src/worker.ts`. Crawls will not run with the API alone.
- `packages/plugin` has two build targets: UI `src/ui.tsx` via `vite.config.ts` -> `dist/ui.html`, and Figma sandbox code `src/main.ts` via `vite.code.config.ts` -> `dist/code.js`. `manifest.json` points at those built files.

## Gotchas

- Do not infer backend architecture from `packages/backend/dist`. It currently contains stale pre-SQLite/Mongoose/ObjectId output; use `packages/backend/src` and rebuild if you need fresh compiled JS.
- SQLite tables are created directly in `packages/backend/src/db.ts`; there is no migration tool. JSON fields are stored as TEXT and must be `JSON.parse`/`JSON.stringify`d at the DB boundary.
- Backend/project/page/element IDs are positive integer strings at the API boundary. Preserve `_id: String(id)` in responses and use the `isValidId` pattern, not ObjectId validation.
- The plugin<->canvas bridge depends on page plugin-data keys already used across handlers: `URL`, `PROJECT_ID`, `PAGE_ID`, `SCREENSHOT_WIDTH`, and `ORIGINAL_VIEWPORT_WIDTH`. Renaming them breaks page lookup, markup, flows, and styling.
- `packages/plugin/src/plugin/constants.ts` hardcodes `BACKEND_URL = "http://localhost:3006"`; changing backend host/port requires editing that file and rebuilding the plugin.
- Import `./logger.js` first in any new backend entrypoint so console output is captured. Runtime logs are written to `packages/backend/logs/app.log`.
- Local generated state lives under `packages/backend/data/`, `packages/backend/screenshots/`, and `packages/backend/logs/`.
