# Stage 1: Build the monorepo
FROM node:18-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy backend package.json to leverage Docker layer caching
COPY packages/backend/package.json ./packages/backend/

# Install ONLY backend production dependencies
RUN pnpm install --filter backend --prod

# Copy the rest of the source code
COPY . .

# Build the backend (TypeScript -> JavaScript)
RUN pnpm --filter backend build

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
# We will override this for the worker
CMD ["node", "packages/backend/dist/index.js"]