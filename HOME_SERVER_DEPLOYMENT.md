# Home Server Deployment Guide

Deployment instructions for running the Figma Site Mapper backend on a home Ubuntu server with Docker Compose.

## Architecture Overview

The backend consists of three main services:
- **API Server** (Fastify, port 3006) - handles HTTP requests from the Figma plugin
- **Worker** (BullMQ) - processes crawl jobs using Playwright
- **Redis** - job queue storage (internal Docker network only)

External services:
- **MongoDB Atlas** - already cloud-hosted (no changes needed)
- **Screenshots** - stored locally in Docker volume (ready for future S3 migration)

## Prerequisites

### On Home Server (Ubuntu)
- Docker installed
- Docker Compose installed
- Tailscale installed and connected
- Git (to pull the repository)

### On MongoDB Atlas
- Add your home server's Tailscale IP to the IP Access List
- Verify your connection string works

## Deployment Steps

### 1. Prepare Environment Variables

Create `.env` file in project root (copy from `.env.example`):

```bash
# MongoDB Connection (same as development)
MONGO_URI="mongodb+srv://your_user:your_password@cluster.mongodb.net/dev?retryWrites=true&w=majority"

# Node Environment
NODE_ENV="production"

# Redis URL (internal Docker network)
REDIS_URL="redis://redis:6379"

# Public URL for screenshots (your Tailscale IP)
PUBLIC_URL="http://100.x.x.x:3006"

# S3 Configuration (leave empty for now, add later when migrating to cloud storage)
# S3_ENDPOINT_URL=""
# S3_BUCKET_NAME=""
# S3_REGION=""
# S3_ACCESS_KEY=""
# S3_SECRET_KEY=""
```

**Important**: Replace `100.x.x.x` with your home server's actual Tailscale IP.

### 2. Build and Start Services

```bash
# On your home server
cd /path/to/figma-sitemapper

# Build and start all services
docker compose up -d --build

# Check service status
docker compose ps

# View logs
docker compose logs -f api
docker compose logs -f worker
```

### 3. Verify Installation

```bash
# Test API is running
curl http://localhost:3006/
# Should return: {"hello":"world"}

# Check Redis connection
docker compose exec redis redis-cli ping
# Should return: PONG
```

### 4. Update Figma Plugin

Edit `packages/plugin/src/plugin/constants.ts`:

```typescript
export const BACKEND_URL = "http://100.x.x.x:3006"; // Your Tailscale IP
```

Rebuild the plugin:
```bash
pnpm build:plugin
```

Load the updated plugin in Figma Desktop and test a crawl.

## Service Configuration

### Memory Limits

With 12GB total RAM and no concurrent crawls:
- API: 1GB limit
- Worker: 4GB limit (Playwright is memory-intensive)
- Redis: 512MB limit

### Screenshot Storage

Screenshots are stored in the `screenshots/` directory via Docker volume mount:
- Path on host: `./screenshots/`
- Path in container: `/app/screenshots/`
- Accessible via: `http://tailscale-ip:3006/screenshots/filename.png`

**Future S3 Migration**: When ready to move screenshots to cloud storage:
1. Uncomment S3 variables in `.env`
2. Update `crawler.ts` to use S3 upload instead of local files
3. No Docker changes needed

## Useful Commands

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f redis

# Restart services
docker compose restart

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes screenshots)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# Enter container shell
docker compose exec api sh
docker compose exec worker sh

# Check Redis queue
docker compose exec redis redis-cli
> LLEN bull: crawl-jobs:wait
```

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker compose logs api

# Verify environment variables
docker compose exec api env | grep MONGO
```

### Redis connection errors

- Ensure `REDIS_URL` uses `redis://redis:6379` (service name, not localhost)
- Check Redis is running: `docker compose ps redis`

### MongoDB connection errors

- Verify IP is whitelisted in MongoDB Atlas
- Test connection string: `mongosh "your-connection-string"`

### Screenshots not loading in Figma

- Check screenshot exists: `ls screenshots/`
- Test direct URL: `curl http://tailscale-ip:3006/screenshots/filename.png`
- Verify Tailscale is connected on both machines

### Out of memory

- Reduce worker memory in docker-compose.yml
- Limit concurrent crawls to 1 (already default)
- Add swap space if needed

## Security Considerations

- Redis is NOT exposed externally (only internal Docker network)
- API is accessible on Tailscale network only
- MongoDB credentials are in `.env` (never commit this file)
- Screenshots directory has no authentication (acceptable for local development)

## Updating the Deployment

When you make code changes:

```bash
# On home server
cd /path/to/figma-sitemapper
git pull
docker compose up -d --build
```

## Migration to Cloud (Future)

When you're ready to move screenshots to S3:

1. Set up S3-compatible storage (Linode, AWS, etc.)
2. Uncomment S3 variables in `.env`
3. Modify `crawler.ts` sliceScreenshot function to upload to S3
4. Update screenshot URL generation to use S3 URLs
5. Screenshots volume can be removed from docker-compose.yml

---

**Note**: This setup is optimized for development use on your home network via Tailscale. For production deployment with external access, additional security measures (HTTPS, authentication, rate limiting) would be required.
