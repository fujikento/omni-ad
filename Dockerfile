# Multi-stage Dockerfile for OMNI-AD API and Worker services
# Uses tsx to run TypeScript directly — avoids ESM import extension issues.
# Usage:
#   docker build --target api -t omni-ad-api .
#   docker build --target worker -t omni-ad-worker .

# ============================================================================
# Stage 1: Install dependencies
# ============================================================================
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile

# ============================================================================
# Stage 2a: API server
# ============================================================================
FROM node:20-alpine AS api

RUN apk add --no-cache tini wget && npm install -g tsx
WORKDIR /app

COPY --from=deps /app .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3001/health || exit 1

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["tsx", "apps/api/src/server.ts"]

# ============================================================================
# Stage 2b: Worker
# ============================================================================
FROM node:20-alpine AS worker

RUN apk add --no-cache tini && npm install -g tsx
WORKDIR /app

COPY --from=deps /app .

ENV NODE_ENV=production

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["tsx", "apps/worker/src/worker.ts"]
