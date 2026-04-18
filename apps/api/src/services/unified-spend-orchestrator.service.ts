/**
 * Unified Spend Orchestrator
 *
 * Real-time cross-platform budget rebalancer. Given recent performance
 * metrics across all 8 ad platforms, computes a proposed budget shift
 * from low-ROAS platforms to high-ROAS platforms.
 *
 * Pure core (computePlatformROAS + computeReallocationPlan) is DB-free
 * and deterministic — covered by unit tests. The DB-bound wrappers
 * (generate / apply) read live metrics and persist plans.
 */

import { db } from '@omni-ad/db';
import {
  budgetAllocations,
  campaigns,
  metricsHourly,
} from '@omni-ad/db/schema';
import { and, eq, gte, inArray } from 'drizzle-orm';

import { createNotification } from './notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Platform =
  | 'meta'
  | 'google'
  | 'x'
  | 'tiktok'
  | 'line_yahoo'
  | 'amazon'
  | 'microsoft';

export const ALL_PLATFORMS: readonly Platform[] = [
  'meta',
  'google',
  'x',
  'tiktok',
  'line_yahoo',
  'amazon',
  'microsoft',
] as const;

export interface MetricRow {
  platform: Platform;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
}

export interface PlatformROAS {
  platform: Platform;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  cpa: number;
  ctr: number;
  dataPoints: number;
}

export interface ReallocationOptions {
  targetRoas: number;
  maxShiftPercent: number;
  minRoasDelta: number;
  minDataPoints: number;
}

export const DEFAULT_REALLOCATION_OPTIONS: ReallocationOptions = {
  targetRoas: 2.0,
  maxShiftPercent: 0.25,
  minRoasDelta: 0.2,
  minDataPoints: 3,
};

export interface ShiftEntry {
  from: Platform;
  to: Platform;
  amount: number;
  reason: string;
}

export interface ReallocationPlan {
  generatedAt: string;
  lookbackHours: number;
  totalBudget: number;
  currentAllocations: Record<string, number>;
  proposedAllocations: Record<string, number>;
  shifts: ShiftEntry[];
  platformROAS: PlatformROAS[];
  predictedRoasImprovement: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Pure Core
// ---------------------------------------------------------------------------

export function safeDivide(n: number, d: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return n / d;
}

/**
 * Aggregate raw metric rows into per-platform ROAS summaries. Pure.
 */
export function computePlatformROAS(rows: MetricRow[]): PlatformROAS[] {
  const byPlatform = new Map<
    Platform,
    {
      spend: number;
      revenue: number;
      conversions: number;
      impressions: number;
      clicks: number;
      dataPoints: number;
    }
  >();

  for (const row of rows) {
    const current = byPlatform.get(row.platform) ?? {
      spend: 0,
      revenue: 0,
      conversions: 0,
      impressions: 0,
      clicks: 0,
      dataPoints: 0,
    };
    current.spend += row.spend;
    current.revenue += row.revenue;
    current.conversions += row.conversions;
    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.dataPoints += 1;
    byPlatform.set(row.platform, current);
  }

  const result: PlatformROAS[] = [];
  for (const [platform, agg] of byPlatform) {
    result.push({
      platform,
      spend: round2(agg.spend),
      revenue: round2(agg.revenue),
      conversions: agg.conversions,
      impressions: agg.impressions,
      clicks: agg.clicks,
      roas: round4(safeDivide(agg.revenue, agg.spend)),
      cpa: round2(safeDivide(agg.spend, agg.conversions)),
      ctr: round4(safeDivide(agg.clicks, agg.impressions)),
      dataPoints: agg.dataPoints,
    });
  }
  result.sort((a, b) => b.roas - a.roas);
  return result;
}

/**
 * Compute a reallocation plan. Pure.
 *
 * Algorithm:
 *   1. Classify platforms as winner / loser / neutral vs target ROAS.
 *   2. Budget is pulled from losers proportional to (target - roas).
 *      Total pull is capped at maxShiftPercent * totalBudget and at
 *      50% of each loser's current budget to avoid starvation.
 *   3. Pulled budget is distributed to winners proportional to
 *      (roas - target).
 */
export function computeReallocationPlan(params: {
  totalBudget: number;
  currentAllocations: Record<string, number>;
  platformROAS: PlatformROAS[];
  options?: Partial<ReallocationOptions>;
  lookbackHours: number;
  generatedAt?: string;
}): ReallocationPlan {
  const options: ReallocationOptions = {
    ...DEFAULT_REALLOCATION_OPTIONS,
    ...(params.options ?? {}),
  };

  const byPlatform = new Map(
    params.platformROAS.map((p) => [p.platform, p] as const),
  );

  const eligible = params.platformROAS.filter(
    (p) => p.dataPoints >= options.minDataPoints && p.spend > 0,
  );

  const winners = eligible.filter(
    (p) => p.roas >= options.targetRoas + options.minRoasDelta,
  );
  const losers = eligible.filter(
    (p) => p.roas <= options.targetRoas - options.minRoasDelta,
  );

  const current: Record<string, number> = { ...params.currentAllocations };
  const proposed: Record<string, number> = { ...params.currentAllocations };
  const shifts: ShiftEntry[] = [];

  // Early exits
  if (winners.length === 0 || losers.length === 0) {
    return finalizePlan({
      params,
      options,
      proposed,
      shifts,
      confidenceInputs: eligible,
      totalShifted: 0,
    });
  }

  const maxPull = params.totalBudget * options.maxShiftPercent;
  const loserDeficit = losers.reduce(
    (sum, p) => sum + Math.max(0, options.targetRoas - p.roas),
    0,
  );

  // Total to pull capped by maxPull AND by per-loser 50% cap
  const perLoserPull = new Map<Platform, number>();
  let totalPullable = 0;
  for (const l of losers) {
    const weight = safeDivide(
      Math.max(0, options.targetRoas - l.roas),
      loserDeficit,
    );
    const budgetCap = (current[l.platform] ?? 0) * 0.5;
    const request = maxPull * weight;
    const pull = Math.min(request, budgetCap);
    perLoserPull.set(l.platform, pull);
    totalPullable += pull;
  }

  const totalShift = Math.min(totalPullable, maxPull);
  if (totalShift <= 0) {
    return finalizePlan({
      params,
      options,
      proposed,
      shifts,
      confidenceInputs: eligible,
      totalShifted: 0,
    });
  }

  const winnerSurplus = winners.reduce(
    (sum, p) => sum + Math.max(0, p.roas - options.targetRoas),
    0,
  );

  // Apply pulls to losers
  for (const l of losers) {
    const pull = perLoserPull.get(l.platform) ?? 0;
    if (pull <= 0) continue;
    proposed[l.platform] = round2((proposed[l.platform] ?? 0) - pull);

    // Distribute this loser's pull to winners proportionally
    for (const w of winners) {
      const winnerWeight = safeDivide(
        Math.max(0, w.roas - options.targetRoas),
        winnerSurplus,
      );
      const give = pull * winnerWeight;
      if (give <= 0) continue;
      proposed[w.platform] = round2((proposed[w.platform] ?? 0) + give);
      shifts.push({
        from: l.platform,
        to: w.platform,
        amount: round2(give),
        reason: buildShiftReason(l, w, options.targetRoas),
      });
    }
  }

  return finalizePlan({
    params,
    options,
    proposed,
    shifts,
    confidenceInputs: eligible,
    totalShifted: totalShift,
    byPlatform,
  });
}

// ---------------------------------------------------------------------------
// Plan helpers
// ---------------------------------------------------------------------------

function finalizePlan(args: {
  params: Parameters<typeof computeReallocationPlan>[0];
  options: ReallocationOptions;
  proposed: Record<string, number>;
  shifts: ShiftEntry[];
  confidenceInputs: PlatformROAS[];
  totalShifted: number;
  byPlatform?: Map<Platform, PlatformROAS>;
}): ReallocationPlan {
  const { params, proposed, shifts, confidenceInputs, totalShifted } = args;

  const predictedRoasImprovement = estimateRoasImprovement(
    params.platformROAS,
    proposed,
    params.currentAllocations,
  );

  const confidence = classifyConfidence(confidenceInputs);

  const reasoning = shifts.length
    ? buildReasoning(shifts, totalShifted, params.totalBudget, confidence)
    : 'すべてのプラットフォームがターゲット ROAS 近傍。再配分なし。';

  return {
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    lookbackHours: params.lookbackHours,
    totalBudget: round2(params.totalBudget),
    currentAllocations: roundAll(params.currentAllocations),
    proposedAllocations: roundAll(proposed),
    shifts,
    platformROAS: params.platformROAS,
    predictedRoasImprovement: round4(predictedRoasImprovement),
    confidence,
    reasoning,
  };
}

function estimateRoasImprovement(
  platformROAS: PlatformROAS[],
  proposed: Record<string, number>,
  current: Record<string, number>,
): number {
  // Weighted ROAS using each plan's allocation distribution.
  const roasOf = new Map(platformROAS.map((p) => [p.platform, p.roas]));

  const weightedROAS = (alloc: Record<string, number>): number => {
    let total = 0;
    let weightSum = 0;
    for (const [platform, amount] of Object.entries(alloc)) {
      const roas = roasOf.get(platform as Platform);
      if (roas === undefined || amount <= 0) continue;
      total += roas * amount;
      weightSum += amount;
    }
    return safeDivide(total, weightSum);
  };

  return weightedROAS(proposed) - weightedROAS(current);
}

function classifyConfidence(
  eligible: PlatformROAS[],
): 'low' | 'medium' | 'high' {
  if (eligible.length < 2) return 'low';
  const totalDataPoints = eligible.reduce((s, p) => s + p.dataPoints, 0);
  if (totalDataPoints >= 48 && eligible.length >= 3) return 'high';
  if (totalDataPoints >= 12) return 'medium';
  return 'low';
}

function buildShiftReason(
  loser: PlatformROAS,
  winner: PlatformROAS,
  target: number,
): string {
  return (
    `${loser.platform} ROAS ${loser.roas.toFixed(2)} < 目標 ${target.toFixed(2)}、` +
    `${winner.platform} ROAS ${winner.roas.toFixed(2)} へ再配分`
  );
}

function buildReasoning(
  shifts: ShiftEntry[],
  totalShifted: number,
  totalBudget: number,
  confidence: 'low' | 'medium' | 'high',
): string {
  const percent = round2((totalShifted / totalBudget) * 100);
  return (
    `計${shifts.length}件のシフトで¥${Math.round(totalShifted).toLocaleString('ja-JP')}` +
    ` (予算の${percent}%) を低ROASプラットフォームから高ROASへ移動。信頼度: ${confidence}。`
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function roundAll(record: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(record)) out[k] = round2(v);
  return out;
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

  const metricRows: MetricRow[] = rows.map((r) => ({
    platform: r.platform,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
    conversions: r.conversions,
    impressions: r.impressions,
    clicks: r.clicks,
  }));

  const platformROAS = computePlatformROAS(metricRows);

  // Current allocations = sum of dailyBudget by campaign; we can't infer
  // per-platform split without deployments, so distribute evenly across
  // the platforms actually observed in metrics.
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

  return computeReallocationPlan({
    totalBudget,
    currentAllocations,
    platformROAS,
    lookbackHours,
    options: {
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

/**
 * Persist a reallocation plan as a budget_allocations row and emit a
 * notification. This does NOT automatically push to platform adapters —
 * human-in-the-loop approval is intentional. The `approvals` flow (or a
 * future auto-apply flag) handles platform deployment.
 */
export async function applyReallocationPlan(
  organizationId: string,
  plan: ReallocationPlan,
  userId: string,
): Promise<ApplyPlanResult> {
  const [row] = await db
    .insert(budgetAllocations)
    .values({
      organizationId,
      date: new Date().toISOString().slice(0, 10),
      allocations: plan.proposedAllocations,
      totalBudget: plan.totalBudget.toFixed(2),
      predictedRoas: plan.platformROAS[0]?.roas ?? null,
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
