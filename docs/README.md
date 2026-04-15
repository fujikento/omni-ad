# OMNI-AD docs

Project-level documentation home. Code-level documentation lives next to the source it describes.

## Index

| Doc | Topic |
|---|---|
| [README.md](../README.md) | Stack, layout, local + production deploy |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Branches, commits, PRs, quality gates |
| [trpc-procedure-audit.md](./trpc-procedure-audit.md) | tRPC procedure usage triage |
| [.env.example](../.env.example) | All required + optional environment variables |

## Per-package docs

- [@omni-ad/ui README](../packages/ui/README.md) — component library

## Where to find things

- Architecture diagrams: TBD (proposed `docs/architecture/`)
- API procedures: source of truth in `apps/api/src/trpc/procedures/`
- DB schema: `packages/db/src/schema/` (Drizzle)
- Background jobs: `apps/worker/src/processors/` + `packages/queue/src/queues.ts`
- Platform adapters: `packages/platform-adapters/src/<platform>/`
- Overnight QA reports: `.overnight-state/MORNING_REPORT.md` (per run)

## Adding a doc

1. Drop a `.md` file in `docs/`.
2. Link it from this index.
3. Keep narrative docs separate from auto-generated reports.
