# Stage 1: Build the monorepo
FROM node:18-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy backend package.json
COPY packages/backend/package.json ./packages/backend/

# Install ALL dependencies (including dev) to run the build
RUN pnpm install --filter backend

# Copy all source code
COPY . .

# Run the build (this will now find 'tsc')
RUN pnpm --filter backend build

# Stage 2: Create the final production image
FROM node:18-alpine
RUN npm install -g pnpm
WORKDIR /app

# Copy package manifests for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/

# Install only production dependencies
RUN pnpm install --filter backend --prod

# Copy the built backend code
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Set node environment to production
ENV NODE_ENV=production

# Expose the API port
EXPOSE 3006

# The command to start the API server
CMD ["node", "packages/backend/dist/index.js"]