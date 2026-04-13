# Multi-stage Dockerfile for OMNI-AD API and Worker services
# Usage:
#   docker build --target api -t omni-ad-api .
#   docker build --target worker -t omni-ad-worker .

# ============================================================================
# Stage 1: Install dependencies
# ============================================================================
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy all package.json files to leverage Docker layer caching
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/platform-adapters/package.json packages/platform-adapters/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ai-engine/package.json packages/ai-engine/package.json

RUN pnpm install --frozen-lockfile --prod=false

# ============================================================================
# Stage 2: Build all packages
# ============================================================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared packages first, then apps
RUN pnpm turbo run build --filter=@omni-ad/shared --filter=@omni-ad/auth --filter=@omni-ad/db --filter=@omni-ad/queue --filter=@omni-ad/platform-adapters --filter=@omni-ad/ai-engine && \
    pnpm turbo run build --filter=@omni-ad/api --filter=@omni-ad/worker

# ============================================================================
# Stage 3: Production dependencies only
# ============================================================================
FROM node:20-alpine AS prod-deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/platform-adapters/package.json packages/platform-adapters/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ai-engine/package.json packages/ai-engine/package.json

RUN pnpm install --frozen-lockfile --prod

# ============================================================================
# Stage 4a: API server
# ============================================================================
FROM node:20-alpine AS api

RUN apk add --no-cache tini
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/auth/package.json ./packages/auth/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/queue/dist ./packages/queue/dist
COPY --from=builder /app/packages/queue/package.json ./packages/queue/package.json
COPY --from=builder /app/packages/platform-adapters/dist ./packages/platform-adapters/dist
COPY --from=builder /app/packages/platform-adapters/package.json ./packages/platform-adapters/package.json
COPY --from=builder /app/packages/ai-engine/dist ./packages/ai-engine/dist
COPY --from=builder /app/packages/ai-engine/package.json ./packages/ai-engine/package.json
COPY package.json pnpm-workspace.yaml ./

RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3001/health || exit 1

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/server.js"]

# ============================================================================
# Stage 4b: Worker
# ============================================================================
FROM node:20-alpine AS worker

RUN apk add --no-cache tini
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/auth/package.json ./packages/auth/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/queue/dist ./packages/queue/dist
COPY --from=builder /app/packages/queue/package.json ./packages/queue/package.json
COPY --from=builder /app/packages/platform-adapters/dist ./packages/platform-adapters/dist
COPY --from=builder /app/packages/platform-adapters/package.json ./packages/platform-adapters/package.json
COPY --from=builder /app/packages/ai-engine/dist ./packages/ai-engine/dist
COPY --from=builder /app/packages/ai-engine/package.json ./packages/ai-engine/package.json
COPY package.json pnpm-workspace.yaml ./

ENV NODE_ENV=production

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/worker/dist/worker.js"]
