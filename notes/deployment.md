From localhost to Live: Deploying a Complex Monorepo with Docker, Linode, and CI/CD

If you've ever built a complex web application, you know that magic moment when everything works perfectly... on your local machine. Getting it from localhost:3006 to a live, public, and secure URL for your users is a whole different battle.

Our Figma Site Mapper project had grown from a simple script into a full-stack monorepo. It had a React plugin frontend, a Node.js backend API, a separate BullMQ job worker, a MongoDB database, and a headless browser (Playwright) for crawling. It was time to deploy it for real.

Here's the story of how we took this complex app and deployed it to a Linode server at fsm.dmdz.dev with a fully automated CI/CD pipeline.

## Step 1: Solving The "State" Problem (Databases & Storage)

Our first challenge was that our app was "stateful" in all the wrong ways.

**The Database:** We had already solved this. We migrated from messy manifest.json files to a MongoDB Atlas cluster. This was a huge win, as our database was already in the cloud, persistent, and secure.

**The Screenshots:** This was the real problem. Our crawler was saving screenshots to a local screenshots folder. On a real server, this folder is "ephemeral"—it gets wiped out with every new deployment.

**The Fix:** We moved all file storage to the cloud. We created a Linode Object Storage (S3-compatible) bucket and rewrote our sliceScreenshot function. Instead of saving a file, it now uploads an in-memory buffer directly to the S3 bucket and saves the permanent, public HTTPS URL to our database.

We even added a 7-day expiration policy (using the awscli and a lifecycle.json file, since Linode doesn't have a UI for it) to keep our storage costs from exploding.

## Step 2: Taming the "It Works On My Machine" Problem (Docker)

Our backend isn't just Node.js; it's Node.js plus Playwright, which requires a specific set of browser binaries and system libraries. Installing this on a server alongside other sites (like blog.dmdz.dev) is a recipe for dependency hell.

**The Fix:** We created a Dockerfile.

A Dockerfile is a recipe for building a self-contained "box" that includes not only our app but all of its system dependencies. This guarantees that the app runs identically on our local machine and on the Linode server.

We created a two-stage build. The "builder" stage installed all dependencies (including devDependencies like TypeScript) to compile our code. The "production" stage then installed only production dependencies (--prod) and copied the compiled dist folder, making our final image small and secure.

## Step 3: The "CI" Pipeline (Automating the Build with GitHub Actions)

With a Dockerfile in hand, we were ready to automate. I was not going to manually build and upload this image every time I made a change.

**The Fix:** We set up a GitHub Actions CI workflow by creating .github/workflows/deploy.yml.

This file tells GitHub: "When anyone pushes to the main or deployment-to-linode branch, spin up a server, check out the code, and run our docker buildx command to build a multi-platform (AMD64 and ARM64) image."

Then, it logs into the GitHub Container Registry (GHCR) using a GHCR_PAT secret we added to the repo, and pushes the new image.

This, of course, broke multiple times:

- **Fail #1:** Dockerfile: no such file or directory. (We forgot to git add Dockerfile).
- **Fail #2:** pnpm-lock.yaml: not found. (It was in our .gitignore, but the CI server needs it).
- **Fail #3:** "pnpm --filter backend build" did not complete. (Our Dockerfile was installing with --prod before building, so TypeScript wasn't available!)

After fixing the Dockerfile logic (install all deps, build, then reinstall with --prod), it finally went green. Our CI pipeline was complete.

## Step 4: The Server Setup (Docker Compose & Nginx)

The image is in the registry... now what?

**The Fix:** We used docker-compose.yml on the server at `/var/www/fsm.dmdz.dev/`. This file defines how to run our app.

**Two Services, One Image:** We defined two services, api and worker. Both use the exact same `ghcr.io/chillyweather/figma-site-mapper:latest` image. The only difference is the command they run:

- **api** runs `node --experimental-specifier-resolution=node packages/backend/dist/index.js` (our Fastify server)
- **worker** runs `node --experimental-specifier-resolution=node packages/backend/dist/worker.js` (our job processor)

**The ESM Challenge:** We hit a critical issue where Node.js couldn't recognize our compiled code as ES Modules. The error was:

```
SyntaxError: Cannot use import statement outside a module
```

We solved this by:

1. Ensuring `"type": "module"` was set in `packages/backend/package.json`
2. Using the `--experimental-specifier-resolution=node` flag in our Docker commands
3. Keeping `tsconfig.json` with `"module": "NodeNext"` to preserve ESM features like `import.meta` and top-level `await`

**Secrets:** We created a .env file on the server (and added it to .gitignore!) to hold our production secrets:

- `MONGO_URI` (MongoDB Atlas connection string)
- `S3_SECRET_KEY`, `S3_ACCESS_KEY`, `S3_ENDPOINT_URL`, `S3_BUCKET_NAME`, `S3_REGION` (Linode Object Storage)
- `REDIS_URL=redis://127.0.0.1:6379` (local Redis instance)
- `NODE_ENV=production`

**Networking:** We installed Redis locally on the server (`sudo apt install redis-server`) and used `network_mode: "host"` in our compose file so the containers could talk to it on `127.0.0.1`.

**Exposing the App:** We configured our existing nginx with a new server block at `/etc/nginx/sites-available/fsm.dmdz.dev`, proxying all traffic to `http://127.0.0.1:3006` (where our api container was listening).

**Security:** We ran `sudo certbot --nginx` to get free, auto-renewing SSL for our new domain.

## Step 5: The "CD" Pipeline (Automating the Deploy with Watchtower)

We had CI (auto-building) and Deployment (running on the server), but they weren't connected. We still had to manually ssh in and run `docker compose pull` and `docker compose up -d` to get the new version.

**The Fix:** We added a third service to our docker-compose.yml: Watchtower.

Watchtower is a tiny container with one job: watch for new versions of your other containers. We configured it to poll GHCR every 5 minutes (300 seconds).

**The Watchtower Challenge:** Initially, Watchtower failed with:

```
Error response from daemon: client version 1.25 is too old. Minimum supported API version is 1.44
```

We fixed this by adding the `DOCKER_API_VERSION=1.44` environment variable to the Watchtower service in docker-compose.yml.

## The Final Workflow

Now, our deployment is a thing of beauty:

1. I make a change and run `git push` from my laptop.
2. GitHub Actions sees the push, builds a new multi-platform Docker image, and pushes it to `ghcr.io/chillyweather/figma-site-mapper:latest`.
3. Within 5 minutes, Watchtower on my server sees the new image.
4. Watchtower automatically stops the old `fsm-api` and `fsm-worker` containers, pulls the new image, and starts the new containers with the same configuration.
5. The entire backend deploys itself, with minimal downtime, just from a git push.

The last step? I changed one line in my plugin's config (`packages/plugin/src/plugin/constants.ts`) to point `BACKEND_URL` to `https://fsm.dmdz.dev`, rebuilt the plugin, and sent the zip to my collaborators.

## Key Debugging Steps We Learned

When things went wrong during deployment, here's how we debugged:

1. **Check container status:** `sudo docker ps -a`
2. **View logs:** `sudo docker logs fsm-api` (or `--tail 50` for recent logs)
3. **Inspect running container:** `sudo docker exec -it fsm-api sh`
4. **Force fresh image pull:** `sudo docker pull ghcr.io/chillyweather/figma-site-mapper:latest`
5. **Test API directly:** `curl http://127.0.0.1:3006/` (from the server)
6. **Test via nginx:** `curl https://fsm.dmdz.dev/` (from anywhere)
7. **Check nginx logs:** `sudo tail -20 /var/log/nginx/error.log`
8. **Verify environment variables:** `sudo docker exec fsm-api sh -c 'env | grep MONGO_URI'`

## Final docker-compose.yml

```yaml
services:
  api:
    image: ghcr.io/chillyweather/figma-site-mapper:latest
    container_name: fsm-api
    network_mode: "host"
    env_file:
      - .env
    command: node --experimental-specifier-resolution=node packages/backend/dist/index.js
    restart: unless-stopped

  worker:
    image: ghcr.io/chillyweather/figma-site-mapper:latest
    container_name: fsm-worker
    network_mode: "host"
    env_file:
      - .env
    command: node --experimental-specifier-resolution=node packages/backend/dist/worker.js
    restart: unless-stopped

  watchtower:
    image: containrrr/watchtower
    container_name: fsm-watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DOCKER_API_VERSION=1.44
      - WATCHTOWER_POLL_INTERVAL=300
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_INCLUDE_STOPPED=true
      - WATCHTOWER_REVIVE_STOPPED=false
      - WATCHTOWER_LABEL_ENABLE=false
      - WATCHTOWER_MONITOR_ONLY=false
      - WATCHTOWER_NO_PULL=false
      - WATCHTOWER_SCHEDULE=0 */5 * * * *
    command: fsm-api fsm-worker
    restart: unless-stopped
```

From localhost to a fully automated, professional-grade deployment. Not bad for a day's work.
