/**
 * Unified Spend Orchestrator — pure core.
 *
 * Cross-platform budget rebalancer. Given recent ROAS per platform and
 * current allocations, proposes a shift from low-ROAS to high-ROAS
 * platforms. Optionally dampens shifts when winner / loser already
 * share audience (from identity-graph overlap).
 *
 * DB-free and deterministic — covered by unit tests in the consuming
 * package. DB-bound wrappers live in apps/api.
 */

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
  overlapPercent?: number;
}

export type OverlapMatrix = Record<string, Record<string, number>>;

export interface CreativePoolWarning {
  platform: Platform;
  creativeCount: number;
  recommendedMinimum: number;
  message: string;
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
  /**
   * Populated by DB-bound wrappers (generateReallocationPlan). The pure
   * core leaves this undefined — creative pool size is DB state, not a
   * function of the metrics input.
   */
  creativePoolWarnings?: CreativePoolWarning[];
}

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

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

export function safeDivide(n: number, d: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return n / d;
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

export function overlapMultiplier(overlap: number | undefined): number {
  if (overlap === undefined || !Number.isFinite(overlap)) return 1.0;
  const clamped = Math.max(0, Math.min(100, overlap));
  return 1.0 - 0.4 * (clamped / 100);
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Weighted ROAS
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Reallocation plan (pure)
// ---------------------------------------------------------------------------

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

  if (winners.length === 0 || losers.length === 0) {
    return finalizePlan({ params, proposed, shifts, eligible, totalShifted: 0 });
  }

  const maxPull = params.totalBudget * options.maxShiftPercent;
  const loserDeficit = losers.reduce(
    (sum, p) => sum + Math.max(0, options.targetRoas - p.roas),
    0,
  );

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
    return finalizePlan({ params, proposed, shifts, eligible, totalShifted: 0 });
  }

  const winnerSurplus = winners.reduce(
    (sum, p) => sum + Math.max(0, p.roas - options.targetRoas),
    0,
  );

  let actualTotalShifted = 0;
  for (const l of losers) {
    const pull = perLoserPull.get(l.platform) ?? 0;
    if (pull <= 0) continue;

    let pulledFromLoser = 0;
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
    proposed,
    shifts,
    eligible,
    totalShifted: actualTotalShifted,
  });
}

function finalizePlan(args: {
  params: Parameters<typeof computeReallocationPlan>[0];
  proposed: Record<string, number>;
  shifts: ShiftEntry[];
  eligible: PlatformROAS[];
  totalShifted: number;
}): ReallocationPlan {
  const { params, proposed, shifts, eligible, totalShifted } = args;

  const predictedRoasImprovement = estimateRoasImprovement(
    params.platformROAS,
    proposed,
    params.currentAllocations,
  );

  const confidence = classifyConfidence(eligible);

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

// ---------------------------------------------------------------------------
// Auto-apply decision (pure)
// ---------------------------------------------------------------------------

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
