# @omni-ad/ui

Shared React component library for OMNI-AD apps. Tailwind v4 + class-variance-authority.

## Components

| Component | Use |
|-----------|-----|
| `Button` | Primary CTA, variants via `variant`/`size`. Supports loading + leadingIcon |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Content container with optional border/shadow |
| `Badge` | Status/count chip with optional dot |
| `PlatformIcon`, `PlatformBadge` | 7-platform (Meta/Google/X/TikTok/LINE-Yahoo/Amazon/Microsoft) icons + brand chips |
| `StatCard` | KPI cell with delta + sparkline |
| `DataTable` | Generic typed table with sort + selection |
| `Tabs` | Horizontal tab strip |
| `Skeleton` | Animated placeholder |
| `EmptyState` | Icon + title + description + action for empty data UIs |
| `ErrorState` | Same shape as EmptyState with retry button |
| `PageHeader` | Top of page eyebrow + title + actions |
| `NavyHero`, `NavyHeroCell` | Dark gradient KPI strip |
| `Sparkline` | Inline svg micro-chart |
| `Timeline`, `TimelineItem` | Vertical activity feed |
| `SegmentedControl` | iOS-style multi-option toggle |
| `KbdHint` | `<kbd>` label for keyboard shortcuts |

## Conventions

- Every component is a named export — no default exports.
- Props are typed via a named `*Props` interface (also exported).
- Variants live in CVA functions (e.g. `buttonVariants`) so consumers can compose className.
- Theme tokens (color, spacing, radius) come from the consuming app's `globals.css` CSS variables; the library never hardcodes hex.
- Uses NodeNext-style `.js` extensions on internal imports (matched by Next.js `webpack.resolve.extensionAlias`).

## Adding a new component

1. Create `src/components/<name>.tsx`.
2. Export named: `export function MyThing(...) {}` and `export interface MyThingProps {}`.
3. Add to `src/index.ts`.
4. Use `cn()` from `./utils.js` for class merging.
5. Theme via Tailwind classes + CSS variables — never raw hex.

## Testing

The library is consumed by `apps/web` and any future Next.js app. Run the consumer's `pnpm dev` to see changes hot-reload.
