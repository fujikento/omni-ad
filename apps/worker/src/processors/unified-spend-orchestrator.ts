/**
 * Unified Spend Orchestrator — scheduled worker processor.
 *
 * Every hour this job runs for all orgs with autopilot enabled. For
 * each org it:
 *   1. Aggregates recent ROAS from metrics_hourly (via ai-engine pure core)
 *   2. Computes a reallocation plan with identity-graph overlap dampening
 *   3. Either auto-applies (if ai_settings allows) or emits a notification
 *      for operator approval
 *   4. Backfills actualRoas on older allocations so the feedback loop runs
 *
 * Failure isolation: a per-org error never blocks the rest of the cycle.
 */

import {
  getQueue,
  QUEUE_NAMES,
  unifiedSpendOrchestratorJobSchema,
  type UnifiedSpendOrchestratorJob,
} from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import {
  aiDecisionLog,
  aiSettings,
  budgetAllocations,
  campaigns,
  campaignPlatformDeployments,
  creativeVariants,
  creatives,
  holdoutGroups,
  identityGraph,
  metricsHourly,
  notifications,
  organizations,
  unifiedSegments,
} from '@omni-ad/db/schema';
import {
  computePlatformROAS,
  computeReallocationPlan,
  computeWeightedRoas,
  orchestratorSafeDivide,
  shouldAutoApply,
  type OrchestratorMetricRow,
  type OrchestratorPlatform,
  type OverlapMatrix,
  type ReallocationPlan,
} from '@omni-ad/ai-engine';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(
      `[unified-spend-orchestrator] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  warn(message, meta) {
    process.stdout.write(
      `[unified-spend-orchestrator] WARN: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  error(message, meta) {
    process.stderr.write(
      `[unified-spend-orchestrator] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
};

// Satisfy tsc — these imports ensure the worker package's drizzle relation
// types stay in scope (unifiedSegments is re-introduced when the overlap
// helper touches it indirectly).
void unifiedSegments;

export async function processUnifiedSpendOrchestrator(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = unifiedSpendOrchestratorJobSchema.safeParse(job.data ?? {});
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: UnifiedSpendOrchestratorJob = parsed.data;
  const lookbackHours = data.lookbackHours ?? 24;

  const targetOrgs = data.organizationId
    ? [{ id: data.organizationId }]
    : await listOrgsWithAutopilot();

  logger.info('Starting orchestrator cycle', {
    orgs: targetOrgs.length,
    lookbackHours,
  });

  for (const org of targetOrgs) {
    try {
      await runForOrg(org.id, lookbackHours);
    } catch (err) {
      logger.error('Orchestrator run failed for org', {
        organizationId: org.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('Orchestrator cycle completed', { orgs: targetOrgs.length });
}

async function listOrgsWithAutopilot(): Promise<Array<{ id: string }>> {
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .innerJoin(aiSettings, eq(aiSettings.organizationId, organizations.id))
    .where(eq(aiSettings.autopilotEnabled, true));
  return rows;
}

async function runForOrg(
  organizationId: string,
  lookbackHours: number,
): Promise<void> {
  const plan = await generatePlan(organizationId, lookbackHours);

  if (plan.shifts.length === 0) {
    logger.info('No shifts proposed', { organizationId });
    await backfillActualRoas(organizationId);
    return;
  }

  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
  });

  if (settings) {
    const decision = shouldAutoApply(plan, {
      autopilotEnabled: settings.autopilotEnabled,
      autopilotMode: settings.autopilotMode,
      budgetAutoAdjust: settings.budgetAutoAdjust,
      maxBudgetChangePercent: settings.maxBudgetChangePercent,
      riskTolerance: settings.riskTolerance,
    });

    if (decision.autoApply) {
      const allocationId = await persistPlan(organizationId, plan);
      await writeDecisionLog(organizationId, plan, allocationId, 'auto');

      // Scheduled auto-apply writes to the local DB only. Platform push
      // stays human-in-loop (UI click via tRPC execute with mode='full').
      // Rationale: irreversible ad-spend mutations should not fire in an
      // unattended cron without explicit operator confirmation.
      const executeSummary = await executeDbOnly(
        organizationId,
        allocationId,
      );

      await emitNotification(organizationId, plan, 'applied');
      logger.info('Plan auto-applied', {
        organizationId,
        shifts: plan.shifts.length,
        reason: decision.reason,
        dbUpdates: executeSummary.updated,
        controlSkipped: executeSummary.skippedControl,
      });
      await maybeQueueCreativeRefill(organizationId, plan, settings);
      await backfillActualRoas(organizationId);
      return;
    }

    logger.info('Plan not auto-applied', {
      organizationId,
      reason: decision.reason,
    });
  }

  if (plan.confidence !== 'low') {
    await emitNotification(organizationId, plan, 'suggested');
  }

  if (settings) {
    await maybeQueueCreativeRefill(organizationId, plan, settings);
  }

  await backfillActualRoas(organizationId);
}

/**
 * Worker-side db-only execute: updates campaigns.dailyBudget per the
 * projection. Excludes control campaigns. Does NOT push to platform
 * adapters — that's the manual/UI-triggered 'full' mode.
 *
 * Duplicates a narrow slice of apps/api's executeAllocation so the
 * worker doesn't need an apps/api dependency. Kept minimal: if the
 * full UX surface grows, extract to @omni-ad/ai-engine/execution or
 * a new @omni-ad/orchestrator-core package.
 */
async function executeDbOnly(
  organizationId: string,
  allocationId: string,
): Promise<{ updated: number; skippedControl: number; failed: number }> {
  const allocation = await db.query.budgetAllocations.findFirst({
    where: and(
      eq(budgetAllocations.id, allocationId),
      eq(budgetAllocations.organizationId, organizationId),
    ),
  });
  if (!allocation) return { updated: 0, skippedControl: 0, failed: 0 };

  const platformBudgets = allocation.allocations as Record<string, number>;

  // Control campaigns from active holdout groups
  const holdoutRows = await db
    .select({ controlIds: holdoutGroups.controlCampaignIds })
    .from(holdoutGroups)
    .where(
      and(
        eq(holdoutGroups.organizationId, organizationId),
        eq(holdoutGroups.active, true),
      ),
    );
  const controlSet = new Set<string>();
  for (const r of holdoutRows) {
    for (const id of r.controlIds as string[]) controlSet.add(id);
  }

  // Per-campaign budget and deployment platform
  const rows = await db
    .select({
      id: campaigns.id,
      dailyBudget: campaigns.dailyBudget,
      platform: sql<string>`(
        SELECT platform FROM campaign_platform_deployments
        WHERE campaign_id = ${campaigns.id}
        LIMIT 1
      )`,
    })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId));

  const currentTotals: Record<string, number> = {};
  for (const row of rows) {
    if (!row.platform) continue;
    currentTotals[row.platform] =
      (currentTotals[row.platform] ?? 0) + Number(row.dailyBudget);
  }

  let updated = 0;
  let skippedControl = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.platform) continue;
    if (controlSet.has(row.id)) {
      skippedControl += 1;
      continue;
    }
    const current = Number(row.dailyBudget);
    const platformTotal = currentTotals[row.platform] ?? 0;
    const platformNew = platformBudgets[row.platform] ?? 0;
    const proposed =
      platformTotal > 0 ? (current / platformTotal) * platformNew : 0;
    if (Math.abs(proposed - current) < 0.01) continue;

    try {
      await db
        .update(campaigns)
        .set({
          dailyBudget: proposed.toFixed(2),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaigns.id, row.id),
            eq(campaigns.organizationId, organizationId),
          ),
        );
      updated += 1;
    } catch (err) {
      logger.warn('Campaign DB update failed', {
        campaignId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    }
  }

  // Aggregate audit log (not per-campaign to avoid spam)
  await db.insert(aiDecisionLog).values({
    organizationId,
    decisionType: 'budget_adjust',
    campaignId: null,
    reasoning: `Worker db-only execute: ${updated} updated, ${skippedControl} control-skipped, ${failed} failed`,
    recommendation: { allocationId, scope: 'worker-db-only' },
    action: { executedBy: 'orchestrator-scheduler', mode: 'db-only' },
    status: 'executed',
    confidenceScore: 1,
  });

  return { updated, skippedControl, failed };
}

// Reference kept: reads to campaignPlatformDeployments for lift helpers
void campaignPlatformDeployments;

async function enrichCreativePool(
  organizationId: string,
  plan: ReallocationPlan,
): Promise<ReallocationPlan> {
  const winnerPlatforms = Array.from(new Set(plan.shifts.map((s) => s.to)));
  if (winnerPlatforms.length === 0) return plan;

  const rows = await db
    .select({
      platform: creativeVariants.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(creativeVariants)
    .innerJoin(creatives, eq(creatives.id, creativeVariants.creativeId))
    .where(
      and(
        eq(creatives.organizationId, organizationId),
        inArray(creativeVariants.platform, winnerPlatforms),
      ),
    )
    .groupBy(creativeVariants.platform);

  const counts: Record<string, number> = {};
  for (const p of winnerPlatforms) counts[p] = 0;
  for (const r of rows) counts[r.platform] = Number(r.count);

  const MIN_POOL = 6;
  const warnings = winnerPlatforms
    .filter((p) => (counts[p] ?? 0) < MIN_POOL)
    .map((p) => ({
      platform: p,
      creativeCount: counts[p] ?? 0,
      recommendedMinimum: MIN_POOL,
      message: `${p} のクリエイティブが ${counts[p] ?? 0}/${MIN_POOL} 本。予算増でも CTR が伸びづらい可能性。`,
    }));

  if (warnings.length > 0) {
    return { ...plan, creativePoolWarnings: warnings };
  }
  return plan;
}

async function maybeQueueCreativeRefill(
  organizationId: string,
  plan: ReallocationPlan,
  settings: { creativeAutoRotate: boolean },
): Promise<void> {
  if (!settings.creativeAutoRotate) return;
  const warnings = plan.creativePoolWarnings ?? [];
  if (warnings.length === 0) return;

  const queue = getQueue(QUEUE_NAMES.CREATIVE_MASS_PRODUCTION);
  for (const w of warnings) {
    try {
      // Enqueue a synthesis job — worker's creative-mass-production
      // processor picks it up and generates variants. We intentionally
      // send a terse payload; upstream chunk jobs expect a batchId flow,
      // so this signals an intent that downstream services handle.
      await queue.add(
        `auto-refill-${organizationId}-${w.platform}-${Date.now()}`,
        {
          organizationId,
          batchId: '00000000-0000-0000-0000-000000000000',
          chunkIndex: 0,
          productInfo: {
            name: `Auto refill for ${w.platform}`,
            description: `Pool at ${w.creativeCount}/${w.recommendedMinimum} — triggered by orchestrator`,
            usp: 'auto-refill',
            targetAudience: 'existing campaigns',
          },
          platform: w.platform,
          language: 'ja',
          keigoLevel: 'polite',
          combinations: [],
        },
        { delay: 5_000 },
      );
      logger.info('Queued creative auto-refill', {
        organizationId,
        platform: w.platform,
        currentCount: w.creativeCount,
      });
    } catch (err) {
      logger.warn('Failed to queue creative auto-refill', {
        organizationId,
        platform: w.platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function writeDecisionLog(
  organizationId: string,
  plan: ReallocationPlan,
  allocationId: string,
  mode: 'auto' | 'manual',
): Promise<void> {
  const reasoning =
    `${plan.shifts.length} shifts, predicted ROAS Δ ${plan.predictedRoasImprovement.toFixed(3)}, ` +
    `confidence ${plan.confidence}. ${plan.reasoning}`;
  const confidenceScore =
    plan.confidence === 'high' ? 0.9 : plan.confidence === 'medium' ? 0.6 : 0.3;

  await db.insert(aiDecisionLog).values({
    organizationId,
    decisionType: 'budget_adjust',
    campaignId: null,
    reasoning,
    recommendation: {
      shifts: plan.shifts,
      proposedAllocations: plan.proposedAllocations,
      lookbackHours: plan.lookbackHours,
      creativePoolWarnings: plan.creativePoolWarnings ?? [],
    },
    action: {
      mode,
      appliedBy: 'orchestrator-scheduler',
      allocationId,
    },
    status: 'executed',
    confidenceScore,
  });
}

async function generatePlan(
  organizationId: string,
  lookbackHours: number,
): Promise<ReallocationPlan> {
  const since = new Date(Date.now() - lookbackHours * 3_600_000);

  const orgCampaigns = await db
    .select({ id: campaigns.id, dailyBudget: campaigns.dailyBudget })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId));

  const campaignIds = orgCampaigns.map((c) => c.id);
  if (campaignIds.length === 0) {
    return emptyPlan(lookbackHours);
  }

  const rows = await db
    .select({
      platform: metricsHourly.platform,
      spend: metricsHourly.spend,
      revenue: metricsHourly.revenue,
      conversions: metricsHourly.conversions,
      impressions: metricsHourly.impressions,
      clicks: metricsHourly.clicks,
    })
    .from(metricsHourly)
    .where(
      and(
        gte(metricsHourly.timestamp, since),
        inArray(metricsHourly.campaignId, campaignIds),
      ),
    );

  const metricRows: OrchestratorMetricRow[] = rows.map((r) => ({
    platform: r.platform,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
    conversions: r.conversions,
    impressions: r.impressions,
    clicks: r.clicks,
  }));

  const platformROAS = computePlatformROAS(metricRows);

  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
  });
  const targetFromSettings = settings?.targetRoas ?? undefined;

  const totalBudget = orgCampaigns.reduce(
    (s, c) => s + Number(c.dailyBudget),
    0,
  );
  const observedPlatforms = new Set(platformROAS.map((p) => p.platform));
  const perPlatform =
    observedPlatforms.size > 0 ? totalBudget / observedPlatforms.size : 0;
  const currentAllocations: Record<string, number> = {};
  for (const p of observedPlatforms) {
    currentAllocations[p] = Math.round(perPlatform * 100) / 100;
  }

  const overlapMatrix =
    observedPlatforms.size > 1
      ? await fetchOverlapMatrix(
          organizationId,
          Array.from(observedPlatforms),
        )
      : undefined;

  const plan = computeReallocationPlan({
    totalBudget,
    currentAllocations,
    platformROAS,
    lookbackHours,
    ...(overlapMatrix && { overlapMatrix }),
    options: {
      ...(targetFromSettings !== undefined && {
        targetRoas: targetFromSettings,
      }),
    },
  });

  return enrichCreativePool(organizationId, plan);
}

function emptyPlan(lookbackHours: number): ReallocationPlan {
  return {
    generatedAt: new Date().toISOString(),
    lookbackHours,
    totalBudget: 0,
    currentAllocations: {},
    proposedAllocations: {},
    shifts: [],
    platformROAS: [],
    predictedRoasImprovement: 0,
    confidence: 'low',
    reasoning: 'キャンペーン未登録のため再配分計算不可。',
  };
}

async function fetchOverlapMatrix(
  organizationId: string,
  platforms: OrchestratorPlatform[],
): Promise<OverlapMatrix> {
  const matrix: OverlapMatrix = {};
  const unique = Array.from(new Set(platforms));

  for (let i = 0; i < unique.length; i++) {
    for (let j = 0; j < unique.length; j++) {
      if (i === j) continue;
      const a = unique[i]!;
      const b = unique[j]!;
      try {
        const overlap = await computeOverlapPair(organizationId, a, b);
        if (!matrix[a]) matrix[a] = {};
        matrix[a]![b] = overlap;
      } catch {
        // Identity-graph unavailable — skip.
      }
    }
  }
  return matrix;
}

async function computeOverlapPair(
  organizationId: string,
  platformA: string,
  platformB: string,
): Promise<number> {
  const [aRes, bRes, overlapRes] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(identityGraph)
      .where(
        and(
          eq(identityGraph.organizationId, organizationId),
          sql`${identityGraph.platformIds} ? ${platformA}`,
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(identityGraph)
      .where(
        and(
          eq(identityGraph.organizationId, organizationId),
          sql`${identityGraph.platformIds} ? ${platformB}`,
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(identityGraph)
      .where(
        and(
          eq(identityGraph.organizationId, organizationId),
          sql`${identityGraph.platformIds} ? ${platformA}`,
          sql`${identityGraph.platformIds} ? ${platformB}`,
        ),
      ),
  ]);

  const aCount = aRes[0]?.count ?? 0;
  const bCount = bRes[0]?.count ?? 0;
  const oCount = overlapRes[0]?.count ?? 0;
  const maxTotal = Math.max(aCount, bCount, 1);
  return Math.round((oCount / maxTotal) * 10_000) / 100;
}

async function persistPlan(
  organizationId: string,
  plan: ReallocationPlan,
): Promise<string> {
  const predictedRoas = computeWeightedRoas(
    plan.platformROAS,
    plan.proposedAllocations,
  );
  const [row] = await db
    .insert(budgetAllocations)
    .values({
      organizationId,
      date: new Date().toISOString().slice(0, 10),
      allocations: plan.proposedAllocations,
      totalBudget: plan.totalBudget.toFixed(2),
      predictedRoas: Number.isFinite(predictedRoas) ? predictedRoas : null,
      actualRoas: null,
      algorithmVersion: 'unified-spend-orchestrator-v1-scheduled',
    })
    .returning({ id: budgetAllocations.id });
  return row?.id ?? '';
}

async function emitNotification(
  organizationId: string,
  plan: ReallocationPlan,
  mode: 'applied' | 'suggested',
): Promise<void> {
  const title =
    mode === 'applied'
      ? '予算を自動再配分しました'
      : '予算再配分の提案があります';
  const message = `${plan.shifts.length}件のシフト、予測 ROAS 改善 ${plan.predictedRoasImprovement.toFixed(3)}、信頼度 ${plan.confidence}`;

  await db.insert(notifications).values({
    organizationId,
    type: 'info',
    title,
    message,
    source: 'unified_spend_orchestrator',
    metadata: {
      shifts: plan.shifts.length,
      confidence: plan.confidence,
      predictedRoasImprovement: plan.predictedRoasImprovement,
      mode,
      lookbackHours: plan.lookbackHours,
    },
  });
}

async function backfillActualRoas(organizationId: string): Promise<void> {
  const minAge = new Date(Date.now() - 4 * 3_600_000);
  const maxAge = new Date(Date.now() - 30 * 24 * 3_600_000);

  const candidates = await db
    .select({ id: budgetAllocations.id, createdAt: budgetAllocations.createdAt })
    .from(budgetAllocations)
    .where(
      and(
        eq(budgetAllocations.organizationId, organizationId),
        gte(budgetAllocations.createdAt, maxAge),
      ),
    );

  let updated = 0;
  for (const c of candidates) {
    if (c.createdAt > minAge) continue;
    const row = await db.query.budgetAllocations.findFirst({
      where: eq(budgetAllocations.id, c.id),
    });
    if (!row || row.actualRoas !== null) continue;

    const since = row.createdAt;
    const orgCampaignIds = (
      await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.organizationId, organizationId))
    ).map((r) => r.id);
    if (orgCampaignIds.length === 0) continue;

    const rows = await db
      .select({
        spend: metricsHourly.spend,
        revenue: metricsHourly.revenue,
      })
      .from(metricsHourly)
      .where(
        and(
          gte(metricsHourly.timestamp, since),
          inArray(metricsHourly.campaignId, orgCampaignIds),
        ),
      );
    if (rows.length === 0) continue;

    let totalSpend = 0;
    let totalRevenue = 0;
    for (const r of rows) {
      totalSpend += Number(r.spend);
      totalRevenue += Number(r.revenue);
    }
    const actualRoas = orchestratorSafeDivide(totalRevenue, totalSpend);

    await db
      .update(budgetAllocations)
      .set({ actualRoas })
      .where(eq(budgetAllocations.id, c.id));
    updated += 1;
  }

  if (updated > 0) {
    logger.info('Backfilled actualRoas', { organizationId, updated });
  }
}
