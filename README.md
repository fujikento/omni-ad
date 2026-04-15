# OMNI-AD

AI-driven cross-channel ad operations platform. Manages campaigns,
creatives, audiences, budgets, and analytics for Meta, Google, X,
TikTok, LINE/Yahoo, Amazon, and Microsoft from a single console.

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 15 (App Router), React 19, Tailwind, tRPC client |
| API | Fastify 5 + tRPC 11 + Drizzle ORM 0.45 |
| Worker | BullMQ + ioredis |
| DB / Cache | PostgreSQL 17 (pgvector image) + Redis 7 |
| Build | pnpm 9 workspaces + Turbo |

## Layout

```
apps/
  web/         Next.js dashboard (port 3000)
  api/         Fastify + tRPC server (port 3001)
  worker/      Background job processor (BullMQ)
  ml-service/  Standalone ML scoring (not yet wired into compose)
packages/
  shared/       Cross-cutting types and platform enums
  ui/           Reusable React components
  db/           Drizzle schema, client, migrations
  auth/         JWT/refresh-token vault, RBAC helpers
  ai-engine/    LLM orchestration
  platform-adapters/  Per-platform API clients (Meta, Google, ...)
  queue/        BullMQ queue/connection helpers
```

## Local development

```bash
# Prereqs: Node 20+, pnpm 9, Docker
pnpm install
cp .env.example .env  # then fill in OAuth/API keys you need

# Start Postgres + Redis
docker compose up -d postgres redis

# Push schema
pnpm --filter @omni-ad/db push

# Run web + api in watch mode (separate terminals or with turbo)
pnpm --filter @omni-ad/api dev
pnpm --filter @omni-ad/web dev
```

## Production deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

After containers are healthy:

```bash
docker compose -f docker-compose.prod.yml exec api \
  sh -c 'cd packages/db && node node_modules/drizzle-kit/bin.cjs push --force'
```

The first user must be created via `/signup` in the web UI.

## Required environment variables

See [.env.example](./.env.example) for the full list. The minimum to
boot is `POSTGRES_PASSWORD`, `JWT_SECRET`, and `TOKEN_ENCRYPTION_KEY`
(generated with `openssl rand`). All OAuth client credentials,
`ANTHROPIC_API_KEY`, and `OPENAI_API_KEY` are optional — features
that depend on them surface empty states until the keys are set.

## Quality gates

```bash
pnpm -r type-check   # tsc --noEmit across every workspace
pnpm -r test         # vitest where present
pnpm -r build        # production build
```

`next lint` is currently broken because Next.js 15.5 deprecated it; the
ESLint flat-config migration is tracked as overnight finding 2-002.

## Documentation pointers

- Architecture diagrams: `docs/` (TBD)
- Schema reference: `packages/db/src/schema/`
- tRPC procedures: `apps/api/src/trpc/procedures/`
