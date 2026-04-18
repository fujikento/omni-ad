/**
 * Unified Spend Orchestrator — DB-bound wrappers.
 *
 * Pure core lives in @omni-ad/ai-engine/orchestrator and is tested at
 * that layer. This file provides the DB-facing glue: reading metrics /
 * settings / campaigns, persisting plans, notifying operators, and
 * writing realized ROAS back for the feedback loop.
 */

import { db } from '@omni-ad/db';
import {
  aiSettings,
  budgetAllocations,
  campaigns,
  creativeVariants,
  creatives,
  metricsHourly,
} from '@omni-ad/db/schema';
import {
  computePlatformROAS,
  computeReallocationPlan,
  computeWeightedRoas,
  orchestratorSafeDivide,
  shouldAutoApply,
  type CreativePoolWarning,
  type OrchestratorMetricRow,
  type OrchestratorPlatform,
  type OverlapMatrix,
  type ReallocationPlan,
} from '@omni-ad/ai-engine';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { getOverlap } from './identity-graph.service.js';
import { createNotification } from './notification.service.js';

// Re-export pure core for backward compatibility with existing callers
// (tRPC router, tests, UI type definitions).
export {
  ALL_PLATFORMS,
  DEFAULT_REALLOCATION_OPTIONS,
  computePlatformROAS,
  computeReallocationPlan,
  computeWeightedRoas,
  overlapMultiplier,
  shouldAutoApply,
  type AutoApplyDecision,
  type AutoApplySettings,
  type CreativePoolWarning,
  type OverlapMatrix,
  type PlatformROAS,
  type ReallocationOptions,
  type ReallocationPlan,
  type ShiftEntry,
} from '@omni-ad/ai-engine';
export { orchestratorSafeDivide as safeDivide } from '@omni-ad/ai-engine';
export type { OrchestratorMetricRow as MetricRow } from '@omni-ad/ai-engine';
export type { OrchestratorPlatform as Platform } from '@omni-ad/ai-engine';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

// ---------------------------------------------------------------------------
// DB-bound wrappers
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  lookbackHours?: number;
  targetRoas?: number;
  maxShiftPercent?: number;
  minRoasDelta?: number;
  minDataPoints?: number;
  /**
   * When true (default), fetch cross-platform audience overlap from
   * identity-graph and feed it into the reallocation algorithm.
   */
  useAudienceOverlap?: boolean;
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
        const overlap = await getOverlap(organizationId, a, b);
        if (!matrix[a]) matrix[a] = {};
        matrix[a]![b] = overlap.overlapPercentage;
      } catch {
        // Identity-graph unavailable or no data — silently skip.
      }
    }
  }
  return matrix;
}

export async function generateReallocationPlan(
  organizationId: string,
  opts: GenerateOptions = {},
): Promise<ReallocationPlan> {
  const lookbackHours = opts.lookbackHours ?? 24;
  const since = new Date(Date.now() - lookbackHours * 3_600_000);

  const orgCampaigns = await db
    .select({
      id: campaigns.id,
      dailyBudget: campaigns.dailyBudget,
    })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId));

  const campaignIds = orgCampaigns.map((c) => c.id);
  if (campaignIds.length === 0) {
    return emptyPlan(lookbackHours, 0);
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

  const settingsRow = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
  });
  const targetFromSettings = settingsRow?.targetRoas ?? undefined;

  const totalBudget = orgCampaigns.reduce(
    (s, c) => s + Number(c.dailyBudget),
    0,
  );
  const observedPlatforms = new Set(platformROAS.map((p) => p.platform));
  const perPlatform =
    observedPlatforms.size > 0 ? totalBudget / observedPlatforms.size : 0;
  const currentAllocations: Record<string, number> = {};
  for (const p of observedPlatforms) {
    currentAllocations[p] = round2(perPlatform);
  }

  const useOverlap = opts.useAudienceOverlap !== false;
  const overlapMatrix =
    useOverlap && observedPlatforms.size > 1
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
      ...(opts.targetRoas !== undefined && { targetRoas: opts.targetRoas }),
      ...(opts.maxShiftPercent !== undefined && {
        maxShiftPercent: opts.maxShiftPercent,
      }),
      ...(opts.minRoasDelta !== undefined && {
        minRoasDelta: opts.minRoasDelta,
      }),
      ...(opts.minDataPoints !== undefined && {
        minDataPoints: opts.minDataPoints,
      }),
    },
  });

  // Enrich with creative-pool warnings for winner platforms. If a
  // platform is gaining budget but has fewer than the minimum creative
  // count, CTR will regress as spend increases without creative rotation.
  const winnerPlatforms = Array.from(
    new Set(plan.shifts.map((s) => s.to)),
  );
  if (winnerPlatforms.length > 0) {
    const poolCounts = await checkCreativePool(
      organizationId,
      winnerPlatforms,
    );
    const warnings: CreativePoolWarning[] = [];
    const MIN_POOL = 6;
    for (const platform of winnerPlatforms) {
      const count = poolCounts[platform] ?? 0;
      if (count < MIN_POOL) {
        warnings.push({
          platform,
          creativeCount: count,
          recommendedMinimum: MIN_POOL,
          message: `${platform} のクリエイティブが ${count}/${MIN_POOL} 本。予算増でも CTR が伸びづらい可能性。`,
        });
      }
    }
    if (warnings.length > 0) {
      plan.creativePoolWarnings = warnings;
    }
  }

  return plan;
}

/**
 * Count active creative variants per platform for an organization.
 * Returns 0 for platforms with no variants.
 */
export async function checkCreativePool(
  organizationId: string,
  platforms: OrchestratorPlatform[],
): Promise<Record<string, number>> {
  if (platforms.length === 0) return {};

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
        inArray(creativeVariants.platform, platforms),
      ),
    )
    .groupBy(creativeVariants.platform);

  const result: Record<string, number> = {};
  for (const p of platforms) result[p] = 0;
  for (const r of rows) result[r.platform] = Number(r.count);
  return result;
}

function emptyPlan(lookbackHours: number, totalBudget: number): ReallocationPlan {
  return {
    generatedAt: new Date().toISOString(),
    lookbackHours,
    totalBudget,
    currentAllocations: {},
    proposedAllocations: {},
    shifts: [],
    platformROAS: [],
    predictedRoasImprovement: 0,
    confidence: 'low',
    reasoning: 'キャンペーン未登録のため再配分計算不可。',
  };
}

export interface ApplyPlanResult {
  allocationId: string;
  shiftsApplied: number;
}

export async function applyReallocationPlan(
  organizationId: string,
  plan: ReallocationPlan,
  userId: string,
): Promise<ApplyPlanResult> {
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
      algorithmVersion: 'unified-spend-orchestrator-v1',
    })
    .returning();

  if (!row) {
    throw new Error('Failed to persist reallocation plan');
  }

  await createNotification({
    organizationId,
    type: 'info',
    title: '予算再配分プランを記録しました',
    message: `${plan.shifts.length}件のシフト。信頼度: ${plan.confidence}。`,
    source: 'unified_spend_orchestrator',
    metadata: {
      allocationId: row.id,
      shifts: plan.shifts.length,
      predictedRoasImprovement: plan.predictedRoasImprovement,
      confidence: plan.confidence,
      algorithmVersion: 'unified-spend-orchestrator-v1',
      appliedBy: userId,
    },
  });

  return {
    allocationId: row.id,
    shiftsApplied: plan.shifts.length,
  };
}

// ---------------------------------------------------------------------------
// Feedback loop: predicted vs actual ROAS
// ---------------------------------------------------------------------------

export interface ActualRoasResult {
  allocationId: string;
  predictedRoas: number | null;
  actualRoas: number;
  spend: number;
  revenue: number;
  sampleHours: number;
}

export async function computeActualRoasForAllocation(
  allocationId: string,
  organizationId: string,
): Promise<ActualRoasResult | null> {
  const allocation = await db.query.budgetAllocations.findFirst({
    where: and(
      eq(budgetAllocations.id, allocationId),
      eq(budgetAllocations.organizationId, organizationId),
    ),
  });

  if (!allocation) return null;

  const since = allocation.createdAt;
  const hoursElapsed = (Date.now() - since.getTime()) / 3_600_000;
  if (hoursElapsed < 4) return null;

  const orgCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId));
  const campaignIds = orgCampaigns.map((c) => c.id);
  if (campaignIds.length === 0) return null;

  const rows = await db
    .select({
      spend: metricsHourly.spend,
      revenue: metricsHourly.revenue,
    })
    .from(metricsHourly)
    .where(
      and(
        gte(metricsHourly.timestamp, since),
        inArray(metricsHourly.campaignId, campaignIds),
      ),
    );

  if (rows.length === 0) return null;

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
    .where(eq(budgetAllocations.id, allocationId));

  return {
    allocationId,
    predictedRoas: allocation.predictedRoas,
    actualRoas: round4(actualRoas),
    spend: round2(totalSpend),
    revenue: round2(totalRevenue),
    sampleHours: Math.round(hoursElapsed),
  };
}

export async function backfillActualRoas(
  organizationId: string,
  options: { maxAgeHours?: number; minAgeHours?: number } = {},
): Promise<{ updated: number; skipped: number }> {
  const maxAgeHours = options.maxAgeHours ?? 30 * 24;
  const minAgeHours = options.minAgeHours ?? 4;
  const maxAge = new Date(Date.now() - maxAgeHours * 3_600_000);
  const minAge = new Date(Date.now() - minAgeHours * 3_600_000);

  const candidates = await db
    .select({ id: budgetAllocations.id })
    .from(budgetAllocations)
    .where(
      and(
        eq(budgetAllocations.organizationId, organizationId),
        gte(budgetAllocations.createdAt, maxAge),
      ),
    );

  let updated = 0;
  let skipped = 0;
  for (const c of candidates) {
    const row = await db.query.budgetAllocations.findFirst({
      where: eq(budgetAllocations.id, c.id),
    });
    if (!row || row.actualRoas !== null || row.createdAt > minAge) {
      skipped += 1;
      continue;
    }
    const result = await computeActualRoasForAllocation(c.id, organizationId);
    if (result) {
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return { updated, skipped };
}

export interface AutoApplyRunResult {
  attempted: boolean;
  applied: boolean;
  reason: string;
  allocationId?: string;
  shiftsApplied?: number;
}

export async function autoApplyIfEligible(
  organizationId: string,
  plan: ReallocationPlan,
  userId: string,
): Promise<AutoApplyRunResult> {
  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
  });

  if (!settings) {
    return {
      attempted: false,
      applied: false,
      reason: 'no ai_settings row for org',
    };
  }

  const decision = shouldAutoApply(plan, {
    autopilotEnabled: settings.autopilotEnabled,
    autopilotMode: settings.autopilotMode,
    budgetAutoAdjust: settings.budgetAutoAdjust,
    maxBudgetChangePercent: settings.maxBudgetChangePercent,
    riskTolerance: settings.riskTolerance,
  });

  if (!decision.autoApply) {
    return {
      attempted: true,
      applied: false,
      reason: decision.reason,
    };
  }

  const result = await applyReallocationPlan(organizationId, plan, userId);
  return {
    attempted: true,
    applied: true,
    reason: decision.reason,
    allocationId: result.allocationId,
    shiftsApplied: result.shiftsApplied,
  };
}

export interface AccuracySummary {
  samples: number;
  meanAbsoluteError: number;
  meanBias: number;
  recent: Array<{
    allocationId: string;
    predictedRoas: number;
    actualRoas: number;
    createdAt: Date;
  }>;
}

export async function getAccuracySummary(
  organizationId: string,
  limit = 20,
): Promise<AccuracySummary> {
  const rows = await db.query.budgetAllocations.findMany({
    where: eq(budgetAllocations.organizationId, organizationId),
    orderBy: [desc(budgetAllocations.createdAt)],
    limit: limit * 3,
  });

  const paired = rows
    .filter(
      (r): r is typeof r & { predictedRoas: number; actualRoas: number } =>
        r.predictedRoas !== null && r.actualRoas !== null,
    )
    .slice(0, limit);

  if (paired.length === 0) {
    return { samples: 0, meanAbsoluteError: 0, meanBias: 0, recent: [] };
  }

  let errorSum = 0;
  let biasSum = 0;
  for (const p of paired) {
    const diff = p.predictedRoas - p.actualRoas;
    errorSum += Math.abs(diff);
    biasSum += diff;
  }

  return {
    samples: paired.length,
    meanAbsoluteError: round4(errorSum / paired.length),
    meanBias: round4(biasSum / paired.length),
    recent: paired.map((p) => ({
      allocationId: p.id,
      predictedRoas: p.predictedRoas,
      actualRoas: p.actualRoas,
      createdAt: p.createdAt,
    })),
  };
}
