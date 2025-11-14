# Stage 1: Build the monorepo
FROM node:18-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy backend package.json
COPY packages/backend/package.json ./packages/backend/

# --- FIX IS HERE ---
# 1. Install ALL dependencies (including dev) to run the build
RUN pnpm install --filter backend

# 2. Copy all source code
COPY . .

# 3. Run the build (this will now find 'tsc')
RUN pnpm --filter backend build

# 4. Re-install *only* production dependencies for a clean final node_modules
RUN pnpm install --filter backend --prod
# --- END FIX ---

# Stage 2: Create the final production image
FROM node:18-alpine
RUN npm install -g pnpm
WORKDIR /app

# Copy only production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/node_modules ./packages/backend/node_modules

# Copy the built backend code
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Set node environment to production
ENV NODE_ENV=production

# Expose the API port
EXPOSE 3006

# The command to start the API server
CMD ["node", "packages/backend/dist/index.js"]