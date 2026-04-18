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
  aiSettings,
  budgetAllocations,
  campaigns,
  metricsHourly,
} from '@omni-ad/db/schema';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';

import { getOverlap } from './identity-graph.service.js';
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
  /**
   * Cross-platform audience overlap (0-100) between `from` and `to`.
   * Undefined when identity-graph data is unavailable.
   */
  overlapPercent?: number;
}

/**
 * overlap[from][to] = 0-100 percentage of the `from` platform's audience
 * that also exists on the `to` platform (per identity-graph). Used to
 * dampen shifts when winner and loser already reach the same users.
 */
export type OverlapMatrix = Record<string, Record<string, number>>;

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
// ---------------------------------------------------------------------------
// Auto-apply decision (pure)
// ---------------------------------------------------------------------------

export interface AutoApplySettings {
  autopilotEnabled: boolean;
  autopilotMode: 'full_auto' | 'suggest_only' | 'approve_required';
  budgetAutoAdjust: boolean;
  maxBudgetChangePercent: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

export type AutoApplyDecision =
  | { autoApply: true; reason: string }
  | { autoApply: false; reason: string };

/**
 * Decide whether the orchestrator may auto-apply a plan without human
 * approval. Pure function — all state comes from arguments.
 *
 * Rules (all must pass for auto-apply):
 *   - autopilotEnabled
 *   - autopilotMode === 'full_auto'
 *   - budgetAutoAdjust
 *   - shift % of total budget <= maxBudgetChangePercent
 *   - confidence meets riskTolerance floor (conservative=high, moderate=>=medium, aggressive=any)
 */
export function shouldAutoApply(
  plan: ReallocationPlan,
  settings: AutoApplySettings,
): AutoApplyDecision {
  if (!settings.autopilotEnabled) {
    return { autoApply: false, reason: 'autopilot disabled' };
  }
  if (settings.autopilotMode !== 'full_auto') {
    return {
      autoApply: false,
      reason: `autopilot mode is ${settings.autopilotMode}`,
    };
  }
  if (!settings.budgetAutoAdjust) {
    return { autoApply: false, reason: 'budget auto-adjust disabled' };
  }
  if (plan.shifts.length === 0) {
    return { autoApply: false, reason: 'no shifts proposed' };
  }

  const totalShifted = plan.shifts.reduce((s, x) => s + x.amount, 0);
  const shiftPercent =
    plan.totalBudget > 0 ? (totalShifted / plan.totalBudget) * 100 : 0;
  if (shiftPercent > settings.maxBudgetChangePercent) {
    return {
      autoApply: false,
      reason: `shift ${shiftPercent.toFixed(1)}% exceeds cap ${settings.maxBudgetChangePercent}%`,
    };
  }

  const requiredConfidence: 'low' | 'medium' | 'high' =
    settings.riskTolerance === 'conservative'
      ? 'high'
      : settings.riskTolerance === 'moderate'
        ? 'medium'
        : 'low';

  const confidenceOrder = { low: 0, medium: 1, high: 2 } as const;
  if (
    confidenceOrder[plan.confidence] < confidenceOrder[requiredConfidence]
  ) {
    return {
      autoApply: false,
      reason: `confidence ${plan.confidence} below ${settings.riskTolerance} requirement (${requiredConfidence})`,
    };
  }

  return {
    autoApply: true,
    reason: `confidence ${plan.confidence}, shift ${shiftPercent.toFixed(1)}% under ${settings.maxBudgetChangePercent}%`,
  };
}

/**
 * overlap 0 → full shift (new audience), overlap 100 → 60% shift (saturation).
 * Pure. Returns 1.0 when overlap is unknown to preserve backward compat.
 */
export function overlapMultiplier(overlap: number | undefined): number {
  if (overlap === undefined || !Number.isFinite(overlap)) return 1.0;
  const clamped = Math.max(0, Math.min(100, overlap));
  return 1.0 - 0.4 * (clamped / 100);
}

export function computeReallocationPlan(params: {
  totalBudget: number;
  currentAllocations: Record<string, number>;
  platformROAS: PlatformROAS[];
  options?: Partial<ReallocationOptions>;
  lookbackHours: number;
  generatedAt?: string;
  overlapMatrix?: OverlapMatrix;
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
  let actualTotalShifted = 0;
  for (const l of losers) {
    const pull = perLoserPull.get(l.platform) ?? 0;
    if (pull <= 0) continue;

    let pulledFromLoser = 0;
    // Distribute this loser's pull to winners proportionally, damped by
    // audience overlap (high overlap = smaller shift to avoid saturation).
    for (const w of winners) {
      const winnerWeight = safeDivide(
        Math.max(0, w.roas - options.targetRoas),
        winnerSurplus,
      );
      const rawGive = pull * winnerWeight;
      const overlap = params.overlapMatrix?.[l.platform]?.[w.platform];
      const multiplier = overlapMultiplier(overlap);
      const give = rawGive * multiplier;
      if (give <= 0) continue;
      proposed[w.platform] = round2((proposed[w.platform] ?? 0) + give);
      pulledFromLoser += give;
      shifts.push({
        from: l.platform,
        to: w.platform,
        amount: round2(give),
        reason: buildShiftReason(l, w, options.targetRoas, overlap),
        ...(overlap !== undefined && { overlapPercent: round2(overlap) }),
      });
    }

    if (pulledFromLoser > 0) {
      proposed[l.platform] = round2(
        (proposed[l.platform] ?? 0) - pulledFromLoser,
      );
      actualTotalShifted += pulledFromLoser;
    }
  }

  return finalizePlan({
    params,
    options,
    proposed,
    shifts,
    confidenceInputs: eligible,
    totalShifted: actualTotalShifted,
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

/**
 * Weighted ROAS for a budget allocation: Σ(roas × amount) / Σ(amount).
 * Pure. Platforms without ROAS data are skipped (not treated as zero) so
 * the weighted average reflects only observable signal.
 */
export function computeWeightedRoas(
  platformROAS: PlatformROAS[],
  allocation: Record<string, number>,
): number {
  const roasOf = new Map(platformROAS.map((p) => [p.platform, p.roas]));
  let total = 0;
  let weightSum = 0;
  for (const [platform, amount] of Object.entries(allocation)) {
    const roas = roasOf.get(platform as Platform);
    if (roas === undefined || amount <= 0) continue;
    total += roas * amount;
    weightSum += amount;
  }
  return safeDivide(total, weightSum);
}

function estimateRoasImprovement(
  platformROAS: PlatformROAS[],
  proposed: Record<string, number>,
  current: Record<string, number>,
): number {
  return (
    computeWeightedRoas(platformROAS, proposed) -
    computeWeightedRoas(platformROAS, current)
  );
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
  overlap?: number,
): string {
  const base =
    `${loser.platform} ROAS ${loser.roas.toFixed(2)} < 目標 ${target.toFixed(2)}、` +
    `${winner.platform} ROAS ${winner.roas.toFixed(2)} へ再配分`;
  if (overlap === undefined) return base;
  return `${base}（audience overlap ${overlap.toFixed(0)}%）`;
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
  /**
   * When true (default), fetch cross-platform audience overlap from
   * identity-graph and feed it into the reallocation algorithm. Set to
   * false to skip the extra DB queries (e.g. in tests or low-identity orgs).
   */
  useAudienceOverlap?: boolean;
}

/**
 * Fetch pairwise platform overlaps for all (loser, winner) combinations.
 * Skips self-overlap (same platform) and caches inverse pairs.
 */
async function fetchOverlapMatrix(
  organizationId: string,
  platforms: Platform[],
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

  const metricRows: MetricRow[] = rows.map((r) => ({
    platform: r.platform,
    spend: Number(r.spend),
    revenue: Number(r.revenue),
    conversions: r.conversions,
    impressions: r.impressions,
    clicks: r.clicks,
  }));

  const platformROAS = computePlatformROAS(metricRows);

  // Use the org's configured target ROAS as the default cutoff so the
  // plan reflects what the operator actually optimizes for. Falls back
  // to the algorithm default when unset.
  const settingsRow = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
  });
  const targetFromSettings = settingsRow?.targetRoas ?? undefined;

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

  // Optionally enrich with cross-platform overlap from identity-graph.
  const useOverlap = opts.useAudienceOverlap !== false;
  const overlapMatrix =
    useOverlap && observedPlatforms.size > 1
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
  // predictedRoas is the weighted ROAS of the PROPOSED allocation — this is
  // what the orchestrator believes will happen if the operator applies the
  // plan. Later, computeActualRoasForAllocation fills in actualRoas so the
  // model can learn from prediction / reality divergence.
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

/**
 * Compute realized ROAS for an allocation from metrics_hourly since the
 * allocation was created. Writes actualRoas back to the row so the
 * predicted/actual delta can be mined for model improvement.
 *
 * Returns null when the allocation has too little post-creation data to
 * produce a meaningful signal (< 4 hours of metrics), so we don't
 * overwrite with noise.
 */
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

  const actualRoas = safeDivide(totalRevenue, totalSpend);

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

/**
 * Scan recent allocations lacking actualRoas and fill them in. Returns
 * the number of allocations updated so the caller can log progress.
 */
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

/**
 * Convenience wrapper: generate plan, fetch settings, and either apply
 * (autopilot in full_auto) or emit a notification for operator approval.
 * Intended for the scheduled worker processor.
 */
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

/**
 * Summarize prediction accuracy across recent paired (predicted, actual)
 * allocations. MAE tells you how wrong the model is; mean bias tells you
 * if it's systematically optimistic (>0) or pessimistic (<0).
 */
export async function getAccuracySummary(
  organizationId: string,
  limit = 20,
): Promise<AccuracySummary> {
  const rows = await db.query.budgetAllocations.findMany({
    where: eq(budgetAllocations.organizationId, organizationId),
    orderBy: [desc(budgetAllocations.createdAt)],
    limit: limit * 3, // overfetch since many will lack actualRoas
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
