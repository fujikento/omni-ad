# tRPC Procedure Audit

> Snapshot of every procedure defined in `apps/api/src/trpc/procedures/`
> cross-referenced against `trpc.<router>.<procedure>` call sites in
> `apps/web/`. Used to steer web-app porting work, flag procedures that
> look like dead code, and confirm procedures that are intentionally
> API-only (worker / cron / RBAC-gated admin tooling).
>
> Refs: overnight 7-003
>
> Generated: 2026-04-14 — refresh by re-grepping both trees and
> rebuilding the categorised lists below.

## Method

1. `rg '^\s*\w+:\s*(publicProcedure|protectedProcedure|organizationProcedure|rbacProcedure)'`
   over `apps/api/src/trpc/procedures/` to enumerate every procedure,
   including those inside nested sub-routers (e.g. `approvals.requests.*`,
   `approvals.policies.*`, `conversions.endpoints.*`, `competitiveIntel.competitors.*`,
   `aiAutopilot.settings.*`, `aiAutopilot.decisions.*`).
2. `rg 'trpc\.\w+(\.\w+)+\.(useQuery|useMutation|useInfiniteQuery|useSuspenseQuery)'`
   over `apps/web/` to enumerate every client-side invocation.
3. Flatten to dotted paths (e.g. `competitiveIntel.competitors.list`) and diff.

## Totals

- Total procedures exposed via `appRouter` (including nested sub-routers): **143**
- Called from `apps/web/` (tRPC React hooks): **45**
- Not called from `apps/web/`: **98**

## Called from web (45)

| Path | Notes |
| --- | --- |
| `accountAnalysis.latest` | `account-analysis/[connectionId]` detail page. |
| `aiAutopilot.decisions.list` | `ai-pilot` page. |
| `aiAutopilot.decisions.approve` | `ai-pilot` page. |
| `aiAutopilot.decisions.reject` | `ai-pilot` page. |
| `aiAutopilot.settings.get` | `ai-pilot`, `settings/ai`. |
| `aiAutopilot.settings.update` | `settings/ai`. |
| `aiAutopilot.settings.testConnection` | `settings/ai`. |
| `aiAutopilot.trigger` | `ai-pilot`. |
| `analytics.overview` | `analytics`. |
| `analytics.byPlatform` | `analytics`. |
| `analytics.byCampaign` | `analytics`. |
| `approvals.policies.list` | `approvals`. |
| `approvals.requests.list` | `approvals`. |
| `audiences.list` | `audiences`. |
| `budgets.current` | `budgets`. |
| `budgets.history` | `budgets`. |
| `budgets.monthlyPacing` | `budgets`. |
| `campaigns.list` | `campaigns`. |
| `campaigns.get` | `campaigns/[id]`. |
| `campaigns.create` | `campaigns` wizard. |
| `campaigns.pause` | `campaigns`. |
| `campaigns.resume` | `campaigns`. |
| `competitiveIntel.alerts.list` | `competitors`. |
| `competitiveIntel.auctionInsights.trend` | `competitors`. |
| `competitiveIntel.competitors.list` | `competitors`. |
| `competitiveIntel.counterActions.list` | `competitors`. |
| `conversions.endpoints.list` | `settings/conversions`. |
| `creativeMass.generate` | `creatives/mass-production`. |
| `creatives.list` | `creatives`, `creatives/optimization`, `campaigns` wizard. |
| `dashboard.activity` | `home`. |
| `dashboard.healthScores` | `home`. |
| `dashboard.overview` | `home`. |
| `funnels.list` | `funnels`. |
| `identityGraph.listSegments` | `audiences/identity-graph`. |
| `ltvTracking.cohortTrend` | `ltv`. |
| `ltvTracking.overview` | `ltv`. |
| `ltvTracking.topCustomers` | `ltv`. |
| `platforms.connect` | `settings`. |
| `platforms.disconnect` | `settings`. |
| `platforms.list` | `settings`, `account-analysis`. |
| `platforms.syncNow` | `settings`. |
| `reports.list` | `reports`. |
| `rules.evaluate` | `auto-rules`. |
| `rules.executions` | `auto-rules`. |
| `rules.list` | `auto-rules`. |

## Not called from web (98)

Each row is pre-categorised by name-based heuristics. `Unknown` rows need
a human pass — they may be web features still to port, or dead helpers
to drop.

### 1. Web not yet implemented — future dashboard work (90)

These map to existing product surfaces (detail modals, edit flows,
wizards) where the current page only reads data but will eventually need
the write/detail procedures. Porting priority roughly mirrors the task
board in `WORKFLOW_STATE.md`.

| Path | Likely consumer |
| --- | --- |
| `accountAnalysis.analyze` | `account-analysis/[id]` — trigger analysis button. |
| `accountAnalysis.list` | `account-analysis` index page. |
| `accountAnalysis.reanalyze` | `account-analysis/[id]` — manual re-run. |
| `aiAutopilot.settings.testKey` | `settings/ai` — per-provider key test. |
| `aiAutopilot.settings.getKeyStatus` | `settings/ai` — key freshness badge. |
| `approvals.requests.get` | `approvals/[id]` detail drawer. |
| `approvals.requests.create` | approval-required action flows. |
| `approvals.requests.approve` | `approvals` row action. |
| `approvals.requests.reject` | `approvals` row action. |
| `approvals.requests.cancel` | requester-side cancel. |
| `approvals.requests.comment` | approvals thread. |
| `approvals.policies.create` | `approvals` → policies tab. |
| `approvals.policies.update` | `approvals` → policies tab. |
| `approvals.checkPolicy` | inline gating in action modals. |
| `audiences.overlaps` | `audiences/identity-graph` overlap chart. |
| `audiences.sync` | `audiences` — push-to-platform button. |
| `budgets.optimize` | `budgets` — optimiser CTA. |
| `budgets.forecast` | `budgets` — forecast tab. |
| `budgets.pacing` | `budgets` — pacing panel. |
| `budgets.autoAdjustMonthlyPacing` | `budgets` — auto-adjust toggle. |
| `campaigns.update` | `campaigns/[id]` edit form. |
| `campaigns.deploy` | wizard final step. |
| `campaigns.delete` | row action. |
| `competitiveIntel.auctionInsights.weakWindows` | `competitors` weak-window widget. |
| `competitiveIntel.auctionInsights.position` | `competitors` positioning block. |
| `competitiveIntel.competitors.add` | `competitors` add dialog. |
| `competitiveIntel.competitors.update` | `competitors` edit dialog. |
| `competitiveIntel.competitors.remove` | `competitors` row action. |
| `competitiveIntel.alerts.acknowledge` | alert ack button. |
| `competitiveIntel.counterActions.rollback` | counter-action rollback. |
| `competitiveIntel.trigger` | `competitors` manual refresh. |
| `conversions.stats` | `settings/conversions` stats tiles. |
| `conversions.endpoints.create` | `settings/conversions` add flow. |
| `conversions.endpoints.update` | `settings/conversions` edit. |
| `conversions.endpoints.delete` | `settings/conversions` row action. |
| `creatives.get` | creative detail drawer. |
| `creatives.generate` | creative wizard. |
| `creatives.adapt` | variant adapt flow. |
| `creativeMass.batchStatus` | mass-production progress polling. |
| `creativeMass.listBatches` | mass-production history tab. |
| `creativeMass.cancelBatch` | mass-production cancel. |
| `dashboard.pendingDecisions` | `home` pending card. |
| `funnels.get` | `funnels/[id]` detail. |
| `funnels.create` | `funnels` wizard. |
| `funnels.update` | `funnels` editor. |
| `identityGraph.importCustomers` | customers CSV upload. |
| `identityGraph.resolve` | identity resolver widget. |
| `identityGraph.getProfile` | profile drawer. |
| `identityGraph.createSegment` | segment builder. |
| `identityGraph.getOverlap` | overlap visualisation. |
| `ltvTracking.recordConversion` | manual conversion entry. |
| `ltvTracking.computeCohort` | cohort compute CTA. |
| `notifications.list` | notification bell. |
| `notifications.unreadCount` | notification bell badge. |
| `notifications.markRead` | bell row action. |
| `notifications.markAllRead` | bell clear-all. |
| `notifications.preferences` | `settings` → notifications tab. |
| `notifications.updatePreferences` | `settings` → notifications tab. |
| `platforms.status` | `settings` connection status chip. |
| `reports.generate` | `reports` — generate CTA. |
| `reports.export` | `reports` — download CTA. |
| `rules.create` | `auto-rules` builder. |
| `rules.update` | `auto-rules` editor. |
| `rules.delete` | `auto-rules` row action. |
| `emergency.stopAll` | emergency-stop panel (referenced from UI designs). |
| `emergency.stopCampaign` | emergency-stop per campaign. |
| `emergency.resume` | emergency resume. |
| `emergency.status` | emergency badge. |
| `analytics.attribution` | `analytics` — attribution drill-down tab. |
| `abTestEngine.create` | `ab-tests` page currently mock-only — wire on next port. |
| `abTestEngine.bulkCreate` | `ab-tests` bulk-create CTA. |
| `abTestEngine.start` | `ab-tests` row action. |
| `abTestEngine.pause` | `ab-tests` row action. |
| `abTestEngine.resume` | `ab-tests` row action. |
| `abTestEngine.cancel` | `ab-tests` row action. |
| `abTestEngine.declareWinner` | `ab-tests` detail modal. |
| `abTestEngine.getResults` | `ab-tests` detail modal. |
| `abTestEngine.list` | `ab-tests` list view. |
| `abTestEngine.activeCount` | `ab-tests` summary badge. |
| `videoProjects.create` | `creatives/video-studio` wizard — static stub today. |
| `videoProjects.getScript` | Same. |
| `videoProjects.regenerateScript` | Same. |
| `videoProjects.getStatus` | Same. |
| `videoProjects.list` | Same — list view not wired. |
| `groupBuy.createCampaign` | `campaigns/group-buy` wizard — currently static. |
| `groupBuy.createGroup` | Same. |
| `groupBuy.joinGroup` | Same (shopper-facing surface TBD). |
| `groupBuy.getGroupStatus` | Same. |
| `groupBuy.listGroups` | Inline comment in source already notes this is missing. |
| `groupBuy.getShareLink` | Share button in wizard. |

### 2. API-only — worker/cron/auth plumbing (8)

Deliberately not invoked by the web app; either reached via REST/auth
middleware, or kicked off by the worker queue / schedulers.

| Path | Reason |
| --- | --- |
| `auth.register` | Public sign-up — consumed via REST, not a tRPC React hook. |
| `auth.login` | Public auth flow — credentialed POST, tokens wired separately. |
| `auth.refresh` | Token refresh interceptor, server-side. |
| `auth.me` | Session bootstrap — called from `apps/web/app/(dashboard)/layout.tsx` via `fetch('${API_URL}/auth.me', …)` rather than `trpc.auth.me.useQuery`. |
| `architect.generatePlan` | Invoked by the onboarding worker + scheduled planner jobs. |
| `architect.deployPlan` | Invoked by the same planner jobs; also reused by the admin CLI. |
| `abTestEngine.recordEvent` | Event ingestion endpoint, hit by the tracker SDK / webhook. |
| `abTestEngine.autoCreateFromBatch` | Worker hook triggered after a creative batch completes. |

### 3. Dead code — delete candidates (0)

Nothing currently matches the "no web caller and no non-web caller" pattern.
Re-run this audit after the category-1 porting work lands — any procedure
still at zero callers (excluding queue/worker entry points) becomes a
delete candidate at that point.

### 4. Unknown — requires reviewer (0)

The earlier pass bucketed `abTestEngine.*`, `videoProjects.*`, and
`groupBuy.*` here, but each has a matching dashboard page that is still
using static mock data. They have been moved into category 1 with that
context noted. If product decides any of those surfaces are being cut,
flip the affected rows into category 3 on the next refresh.

## Next actions

- For category 1 entries, add them to the porting backlog as they come
  up in dashboard page work; do not remove them from the API.
- For category 2, leave untouched; add an `// @api-only` marker if we
  want an in-code signal (deferred — not part of this audit).
- For category 3, re-run the diff after category 1 lands.
- For category 4, request a 15-minute review with product to convert
  each row into a category-1 or category-3 decision.
