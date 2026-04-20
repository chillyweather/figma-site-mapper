# Multi-stage Dockerfile for Figma Site Mapper Backend
# Uses Playwright's official image to avoid complex dependency installation

FROM mcr.microsoft.com/playwright:v1.54.2-jammy AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install all dependencies (including devDependencies for build)
RUN pnpm install

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Production stage
FROM mcr.microsoft.com/playwright:v1.54.2-jammy AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create screenshots directory
RUN mkdir -p /app/screenshots

# Expose API port
EXPOSE 3006

# Default command (can be overridden in docker-compose)
CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
