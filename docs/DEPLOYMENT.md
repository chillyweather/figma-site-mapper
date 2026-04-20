# Deployment

This project is deployable as a backend API plus a worker process. The Figma plugin is built separately and compiled with the backend URL it should call.

## Runtime Services

- API: Fastify server on port `3006`.
- Worker: BullMQ worker that runs Playwright/Crawlee jobs.
- Redis: queue storage.
- MongoDB: persistent project/page/element storage.
- Screenshot storage: local filesystem in the current code.

## Current Docker Compose

The root `docker-compose.yml` defines:

- `redis`
- `api`
- `worker`

The API and worker both build from `packages/backend/Dockerfile` and share screenshot storage through a mounted `./screenshots` directory.

Start services:

```bash
docker compose up -d --build
```

Check services:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f worker
```

Health check:

```bash
curl http://localhost:3006/
```

## Environment

For Docker Compose, create a root `.env`:

```env
MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/dev?retryWrites=true&w=majority"
NODE_ENV="production"
REDIS_URL="redis://redis:6379"
PUBLIC_URL="http://YOUR_HOST:3006"
```

S3-related variables exist in `.env.example`, but current crawler code still writes screenshots to the local filesystem. Treat S3 migration as future work unless code is updated.

## Important Caveats

Before deploying again, verify these:

- `packages/backend/src/queue.ts` should read `REDIS_URL`; current code creates Redis with default options.
- `packages/plugin/src/plugin/constants.ts` and any direct hardcoded URLs should be changed to the deployed HTTPS backend URL before building the plugin.
- `pnpm-lock.yaml` is ignored by `.gitignore`, while Dockerfile expects it. Decide whether to commit the lockfile or adjust the Dockerfile.
- Current screenshots are served from `/screenshots/` by the API. Figma is much happier with HTTPS image URLs than HTTP URLs.
- API has permissive CORS and no authentication. That is acceptable for local/Tailscale experiments, not a public production API.

## Memory Notes

Playwright is the expensive part. A small crawl can easily add hundreds of MB of memory usage, especially with style extraction enabled.

Practical minimum:

- 2 GB RAM for basic single-worker use.
- 4 GB RAM for more comfortable development/deployment.

Avoid 1 GB servers unless the crawler workload is aggressively limited.

## Figma Plugin Deployment

The plugin is not dynamically configured at runtime. Build it with the backend URL you want it to use:

1. Update `packages/plugin/src/plugin/constants.ts`.
2. Check for other hardcoded `http://localhost:3006` references.
3. Run:

```bash
pnpm build:plugin
```

Then load or distribute the built plugin using `packages/plugin/manifest.json`.

## Production Checklist

- Centralize backend URL configuration.
- Make Redis connection environment-driven.
- Decide local screenshots vs S3/object storage and align docs/code.
- Serve backend over HTTPS.
- Add API authentication or network-level protection.
- Add request limits and crawl safety controls.
- Verify Docker build from a clean checkout.
- Verify worker memory limits.
- Add health checks.
- Add backup/retention policy for MongoDB and screenshots.
