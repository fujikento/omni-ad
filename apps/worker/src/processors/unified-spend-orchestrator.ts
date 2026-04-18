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
  unifiedSpendOrchestratorJobSchema,
  type UnifiedSpendOrchestratorJob,
} from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import {
  aiSettings,
  budgetAllocations,
  campaigns,
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
      await persistPlan(organizationId, plan);
      await emitNotification(organizationId, plan, 'applied');
      logger.info('Plan auto-applied', {
        organizationId,
        shifts: plan.shifts.length,
        reason: decision.reason,
      });
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

  await backfillActualRoas(organizationId);
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

  return computeReallocationPlan({
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
): Promise<void> {
  const predictedRoas = computeWeightedRoas(
    plan.platformROAS,
    plan.proposedAllocations,
  );
  await db.insert(budgetAllocations).values({
    organizationId,
    date: new Date().toISOString().slice(0, 10),
    allocations: plan.proposedAllocations,
    totalBudget: plan.totalBudget.toFixed(2),
    predictedRoas: Number.isFinite(predictedRoas) ? predictedRoas : null,
    actualRoas: null,
    algorithmVersion: 'unified-spend-orchestrator-v1-scheduled',
  });
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
