# Contributing

## Branches

- `main` — production. Never commit directly.
- `feature/<short>` — new feature work.
- `fix/<short>` — bug fix.
- `chore/<short>` — tooling, deps, refactor.
- `hotfix/<short>` — urgent production patch only.

Branches are short-lived. Open a PR within a few days, delete on merge.

## Commits

Conventional commits, lowercase, imperative subject ≤72 chars:

```
<type>(<scope>): <subject>

<body explaining WHY, wrapped at 72 chars>

Refs: <ticket or overnight finding id>
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`,
`style`, `build`, `ci`, `revert`.

One logical change per commit. Don't bundle unrelated work.

## Pull requests

Title in commit format. Body must include:

```
## What
1-3 sentences describing what the PR does.

## Why
Motivation, what triggered the change.

## Changes
- bullet list of key modifications

## Impact
Areas affected, breaking changes, migrations, config changes.

## Testing
How to verify — commands, steps, what to check.
```

Every section is required. Use "None" rather than omitting.

Push from your branch and open the PR with `gh pr create`. The
review gate runs Tier 0 (codex-gate) and Tier 1 (qa-reviewer +
product-manager + product-strategist) before allowing merge.

## Quality gates (must pass before requesting review)

```bash
pnpm -r type-check    # tsc --noEmit
pnpm -r test          # vitest where present
pnpm --filter @omni-ad/web build   # Next standalone build
```

`next lint` is currently disabled pending the ESLint flat-config
migration tracked as overnight finding 2-002.

## TypeScript standards

- `strict: true` always, no `any` (use `unknown` + narrowing or
  generics).
- Public APIs get explicit parameter and return types.
- Interfaces for object shapes that may be extended; `type` for
  unions/intersections/utilities.
- Don't use `React.FC`.
- Components/exports get named props interfaces.

## File hygiene

- Functions ≤50 lines (hard), ≤20 (soft).
- Max 3 levels of nesting; extract helpers above that.
- No `console.log` in production code paths.
- Comments only when the *why* is non-obvious.

## Database changes

Migrations under `packages/db/src/migrations/`. Generate with
`pnpm --filter @omni-ad/db generate`. Apply with
`pnpm --filter @omni-ad/db push`.

Never edit a previously-applied migration. Add a new one instead.

## Security

- No hardcoded secrets — read from `process.env`.
- Validate every external input with Zod at the boundary.
- Use parameterized SQL only. `sql.raw` is forbidden in
  user-input paths (see overnight 2-001).
- Password hashing must use `crypto.scrypt` + `timingSafeEqual` (the
  `auth.ts` pattern) or argon2 — never plain hash.

## Reporting issues found by overnight

The autonomous overnight loop writes findings to
`.overnight-state/phases/{phase}-output.json`. When fixing,
reference the issue id in the commit footer:

```
Refs: overnight 2-001
```
