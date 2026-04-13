# Multi-stage Dockerfile for OMNI-AD API and Worker services
# Usage:
#   docker build --target api -t omni-ad-api .
#   docker build --target worker -t omni-ad-worker .

# ============================================================================
# Stage 1: Build all packages
# ============================================================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile

# Build shared packages first, then apps
RUN pnpm turbo run build --filter=@omni-ad/shared --filter=@omni-ad/auth --filter=@omni-ad/db --filter=@omni-ad/queue --filter=@omni-ad/platform-adapters --filter=@omni-ad/ai-engine && \
    pnpm turbo run build --filter=@omni-ad/api --filter=@omni-ad/worker

# Prune dev dependencies after build
RUN pnpm prune --prod

# ============================================================================
# Stage 2a: API server
# ============================================================================
FROM node:20-alpine AS api

RUN apk add --no-cache tini wget
WORKDIR /app

# Copy the entire workspace with pruned node_modules + built dist
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3001/health || exit 1

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/server.js"]

# ============================================================================
# Stage 2b: Worker
# ============================================================================
FROM node:20-alpine AS worker

RUN apk add --no-cache tini
WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker ./apps/worker
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/worker/dist/worker.js"]
