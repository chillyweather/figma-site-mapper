# Deployment

The backend runs as two processes — a Fastify API and a BullMQ worker — backed by Redis and a local SQLite database. The Figma plugin is a static build that must be compiled with the backend URL it will call.

## Runtime Services

| Service | Description |
|---------|-------------|
| API     | Fastify server on port `3006` |
| Worker  | BullMQ worker running Playwright/Crawlee jobs |
| Redis   | Job queue (BullMQ) |
| SQLite  | Persistent storage at `packages/backend/data/sitemapper.db` |
| Screenshots | Local filesystem under `packages/backend/screenshots/` |
| Workspace assets | Generated inventory workspace under `packages/backend/workspace/` and served by `/workspace/...` |

## Docker Compose

`docker-compose.yml` at the repo root starts Redis only. The API and worker are run as Node processes (locally with `pnpm dev`, or separately in production).

Start Redis:

```bash
docker compose up redis -d
```

## Environment

Create `packages/backend/.env` (or set these as environment variables in production):

```env
REDIS_URL="redis://localhost:6379"
PUBLIC_URL="https://YOUR_HOST:3006"
NODE_ENV="production"
```

## Logs

Logs are written to `packages/backend/logs/app.log` with daily rotation (last 2 days retained). The `logs/` directory is git-ignored.

## Figma Plugin Build

The backend URL is compiled into the plugin at build time. Before building for production:

1. Update `BACKEND_URL` in `packages/plugin/src/plugin/constants.ts` to your HTTPS backend URL.
2. Build:

```bash
pnpm build:plugin
```

Then load the plugin in Figma Desktop via `packages/plugin/manifest.json`.

## Production Checklist

- [ ] Set `PUBLIC_URL` and `REDIS_URL` in the production environment.
- [ ] Serve the backend over HTTPS — Figma requires HTTPS for reliable image loading.
- [ ] Update `BACKEND_URL` in `packages/plugin/src/plugin/constants.ts` before building the plugin.
- [ ] Add API authentication or restrict network access (no auth by default).
- [ ] Provision sufficient RAM — Playwright needs 2 GB minimum, 4 GB recommended.
- [ ] Set up a process manager (systemd, PM2) for the API and worker.
- [ ] Configure backup or retention for `packages/backend/data/sitemapper.db`, `packages/backend/screenshots/`, and `packages/backend/workspace/` if you need to preserve generated evidence or agent decisions.
- [ ] Decide on screenshot storage: local filesystem works for single-server setups; add S3-compatible storage when scaling.
