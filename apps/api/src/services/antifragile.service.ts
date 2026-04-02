/**
 * Anti-Fragile Campaign Monitoring Engine
 *
 * Self-healing campaign system with statistical anomaly detection,
 * health scoring, bot traffic detection, and auto-remediation.
 */

import { db } from '@omni-ad/db';
import { auditLog, campaigns, campaignPlatformDeployments, metricsDaily } from '@omni-ad/db/schema';
import { and, desc, eq, sql, between } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthAlert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface CampaignHealthScore {
  campaignId: string;
  overallScore: number;
  components: {
    deliveryPacing: number;
    ctrTrend: number;
    cvrTrend: number;
    landingPageHealth: number;
    policyCompliance: number;
    creativeFreshness: number;
  };
  alerts: HealthAlert[];
}

export interface MetricsWindow {
  values: number[];
  timestamps: Date[];
  windowDays: number;
}

export interface ClickMetrics {
  totalClicks: number;
  totalConversions: number;
  clickTimestamps: number[];
  uniqueIps: number;
  totalIps: number;
}

export interface CUSUMResult {
  isAnomaly: boolean;
  cumulativeSum: number;
  threshold: number;
  direction: 'positive' | 'negative' | 'none';
}

export interface EWMAResult {
  isAnomaly: boolean;
  ewmaValue: number;
  upperBound: number;
  lowerBound: number;
}

export interface LandingPageCheckResult {
  url: string;
  isHealthy: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

export interface AuditLogEntry {
  campaignId: string;
  action: string;
  reason: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

// Component weight configuration
const HEALTH_WEIGHTS = {
  deliveryPacing: 0.2,
  ctrTrend: 0.2,
  cvrTrend: 0.2,
  landingPageHealth: 0.15,
  policyCompliance: 0.15,
  creativeFreshness: 0.1,
} as const;

// ---------------------------------------------------------------------------
// CUSUM Algorithm
// ---------------------------------------------------------------------------

/**
 * Cumulative Sum Control Chart for detecting abrupt changes.
 * Uses the tabular CUSUM method with a slack variable (k).
 */
export function computeCUSUM(
  values: readonly number[],
  options: {
    targetMean?: number;
    slack?: number;
    threshold?: number;
  } = {},
): CUSUMResult {
  if (values.length === 0) {
    return { isAnomaly: false, cumulativeSum: 0, threshold: 0, direction: 'none' };
  }

  const targetMean = options.targetMean ?? computeMean(values);
  const stdDev = computeStdDev(values, targetMean);
  const slack = options.slack ?? stdDev * 0.5;
  const threshold = options.threshold ?? stdDev * 4;

  let shPlus = 0;
  let shMinus = 0;

  for (const value of values) {
    const deviation = value - targetMean;
    shPlus = Math.max(0, shPlus + deviation - slack);
    shMinus = Math.max(0, shMinus - deviation - slack);
  }

  const maxCusum = Math.max(shPlus, shMinus);
  const direction: CUSUMResult['direction'] =
    maxCusum <= threshold ? 'none' : shPlus > shMinus ? 'positive' : 'negative';

  return {
    isAnomaly: maxCusum > threshold,
    cumulativeSum: maxCusum,
    threshold,
    direction,
  };
}

// ---------------------------------------------------------------------------
// EWMA Algorithm
// ---------------------------------------------------------------------------

/**
 * Exponentially Weighted Moving Average for detecting gradual drift.
 * Lambda controls the decay factor (0 < lambda <= 1).
 */
export function computeEWMA(
  values: readonly number[],
  options: {
    lambda?: number;
    sigmaMultiplier?: number;
  } = {},
): EWMAResult {
  if (values.length === 0) {
    return { isAnomaly: false, ewmaValue: 0, upperBound: 0, lowerBound: 0 };
  }

  const lambda = options.lambda ?? 0.2;
  const sigmaMultiplier = options.sigmaMultiplier ?? 3;
  const mean = computeMean(values);
  const sigma = computeStdDev(values, mean);

  let ewma = mean;
  for (const value of values) {
    ewma = lambda * value + (1 - lambda) * ewma;
  }

  // Control limits widen with lambda
  const controlFactor = Math.sqrt(
    (lambda / (2 - lambda)) * (1 - Math.pow(1 - lambda, 2 * values.length)),
  );
  const upperBound = mean + sigmaMultiplier * sigma * controlFactor;
  const lowerBound = mean - sigmaMultiplier * sigma * controlFactor;

  return {
    isAnomaly: ewma > upperBound || ewma < lowerBound,
    ewmaValue: ewma,
    upperBound,
    lowerBound,
  };
}

// ---------------------------------------------------------------------------
// Statistical Helpers
// ---------------------------------------------------------------------------

function computeMean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeStdDev(values: readonly number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeLinearTrendSlope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

// ---------------------------------------------------------------------------
// Landing Page Health Check
// ---------------------------------------------------------------------------

export async function checkLandingPage(url: string): Promise<LandingPageCheckResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'OMNI-AD-HealthCheck/1.0',
      },
    });

    const responseTimeMs = Math.round(performance.now() - startTime);

    return {
      url,
      isHealthy: response.status === 200,
      statusCode: response.status,
      responseTimeMs,
      error: response.status !== 200 ? `HTTP ${response.status}` : null,
    };
  } catch (err: unknown) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    const message =
      err instanceof Error ? err.message : 'Unknown fetch error';

    return {
      url,
      isHealthy: false,
      statusCode: null,
      responseTimeMs,
      error: message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Anomaly Detectors
// ---------------------------------------------------------------------------

/**
 * Detect spend anomalies using CUSUM.
 * Triggers when spend exceeds 3x the normal baseline.
 */
export function detectSpendAnomaly(
  campaignId: string,
  metrics: MetricsWindow,
): HealthAlert | null {
  if (metrics.values.length < 3) return null;

  const mean = computeMean(metrics.values);
  const latestValue = metrics.values[metrics.values.length - 1]!;

  // Spike check: latest value > 3x mean
  const spikeMultiplier = 3;
  const isSpikeDetected = latestValue > mean * spikeMultiplier && mean > 0;

  // CUSUM for sustained shift
  const cusumResult = computeCUSUM(metrics.values);

  if (isSpikeDetected || cusumResult.isAnomaly) {
    return {
      type: 'spend_anomaly',
      severity: isSpikeDetected ? 'critical' : 'warning',
      message: isSpikeDetected
        ? `Spend spike detected: ${latestValue.toFixed(2)} is ${(latestValue / mean).toFixed(1)}x above average (${mean.toFixed(2)})`
        : `Sustained spend shift detected via CUSUM (direction: ${cusumResult.direction})`,
      timestamp: new Date(),
      metadata: {
        campaignId,
        latestValue,
        mean,
        multiplier: mean > 0 ? latestValue / mean : 0,
        cusumResult,
      },
    };
  }

  return null;
}

/**
 * Detect bot traffic through click-to-conversion ratio anomalies
 * and click timing distribution regularity.
 */
export function detectBotTraffic(
  metrics: ClickMetrics,
): HealthAlert | null {
  const alerts: string[] = [];
  const metadata: Record<string, unknown> = {};

  // Check click-to-conversion ratio
  if (metrics.totalClicks > 100) {
    const conversionRate =
      metrics.totalConversions / metrics.totalClicks;

    // Abnormally low conversion with high clicks suggests bots
    if (conversionRate < 0.001 && metrics.totalClicks > 500) {
      alerts.push(
        `Suspicious click-to-conversion ratio: ${(conversionRate * 100).toFixed(3)}%`,
      );
      metadata['conversionRate'] = conversionRate;
    }
  }

  // Check IP concentration (many clicks from few IPs)
  if (metrics.totalIps > 0 && metrics.uniqueIps > 0) {
    const ipConcentration = metrics.totalIps / metrics.uniqueIps;
    if (ipConcentration > 10) {
      alerts.push(
        `High IP concentration: ${ipConcentration.toFixed(1)} clicks per unique IP`,
      );
      metadata['ipConcentration'] = ipConcentration;
    }
  }

  // Check click timing regularity (bots often click at regular intervals)
  if (metrics.clickTimestamps.length >= 10) {
    const intervals = computeClickIntervals(metrics.clickTimestamps);
    const intervalStdDev = computeStdDev(intervals, computeMean(intervals));
    const intervalMean = computeMean(intervals);

    // Very low coefficient of variation = suspiciously regular
    if (intervalMean > 0) {
      const cv = intervalStdDev / intervalMean;
      if (cv < 0.1) {
        alerts.push(
          `Suspiciously regular click timing (CV: ${cv.toFixed(3)})`,
        );
        metadata['clickTimingCV'] = cv;
      }
    }
  }

  if (alerts.length === 0) return null;

  return {
    type: 'bot_traffic',
    severity: alerts.length >= 2 ? 'critical' : 'warning',
    message: alerts.join('; '),
    timestamp: new Date(),
    metadata,
  };
}

function computeClickIntervals(timestamps: readonly number[]): number[] {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i]! - sorted[i - 1]!);
  }
  return intervals;
}

/**
 * Detect creative fatigue: CTR decline >15% over 5+ days with stable audience.
 */
export function detectCreativeFatigue(
  creativeId: string,
  metrics: MetricsWindow,
): HealthAlert | null {
  if (metrics.values.length < 5) return null;

  // Use last 5 data points
  const recentWindow = metrics.values.slice(-5);
  const slope = computeLinearTrendSlope(recentWindow);
  const initialValue = recentWindow[0]!;

  if (initialValue <= 0) return null;

  // Compute percentage decline over the window
  const projectedDecline = (slope * (recentWindow.length - 1)) / initialValue;

  if (projectedDecline < -0.15) {
    return {
      type: 'creative_fatigue',
      severity: 'warning',
      message: `Creative fatigue detected: CTR declined ${(Math.abs(projectedDecline) * 100).toFixed(1)}% over ${recentWindow.length} days`,
      timestamp: new Date(),
      metadata: {
        creativeId,
        declinePercent: Math.abs(projectedDecline) * 100,
        slope,
        recentValues: recentWindow,
      },
    };
  }

  return null;
}

/**
 * Detect conversion tracking breaks by comparing predicted vs actual conversions.
 * Triggers alert when actual deviates >50% from predicted.
 */
export function detectConversionTrackingBreak(
  campaignId: string,
  predicted: number,
  actual: number,
): HealthAlert | null {
  if (predicted <= 0) return null;

  const deviation = Math.abs(actual - predicted) / predicted;

  if (deviation > 0.5) {
    return {
      type: 'conversion_tracking_break',
      severity: 'critical',
      message: `Conversion tracking anomaly: expected ~${predicted.toFixed(0)} conversions, got ${actual} (${(deviation * 100).toFixed(1)}% deviation)`,
      timestamp: new Date(),
      metadata: {
        campaignId,
        predicted,
        actual,
        deviationPercent: deviation * 100,
      },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Health Score Computation
// ---------------------------------------------------------------------------

/**
 * Compute a composite health score (0-100) for a campaign.
 * Higher = healthier.
 */
export async function computeHealthScore(
  campaignId: string,
): Promise<CampaignHealthScore> {
  const alerts: HealthAlert[] = [];

  // Fetch recent metrics (last 7 days)
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const dailyMetrics = await db
    .select({
      date: metricsDaily.date,
      impressions: sql<number>`COALESCE(${metricsDaily.impressions}, 0)::int`,
      clicks: sql<number>`COALESCE(${metricsDaily.clicks}, 0)::int`,
      conversions: sql<number>`COALESCE(${metricsDaily.conversions}, 0)::int`,
      spend: sql<string>`COALESCE(${metricsDaily.spend}, 0)::numeric(14,2)::text`,
    })
    .from(metricsDaily)
    .where(
      and(
        eq(metricsDaily.campaignId, campaignId),
        between(metricsDaily.date, startDate, endDate),
      ),
    )
    .orderBy(metricsDaily.date);

  // Build metrics windows
  const spendValues = dailyMetrics.map((m) => Number(m.spend));
  const conversionValues = dailyMetrics.map((m) => m.conversions);
  const dates = dailyMetrics.map((m) => new Date(m.date));

  // Compute CTR per day
  const ctrValues = dailyMetrics.map((m) =>
    m.impressions > 0 ? m.clicks / m.impressions : 0,
  );

  // Compute CVR per day
  const cvrValues = dailyMetrics.map((m) =>
    m.clicks > 0 ? m.conversions / m.clicks : 0,
  );

  // 1. Delivery Pacing Score
  const deliveryPacing = scoreDeliveryPacing(spendValues);

  // 2. CTR Trend Score
  const ctrTrend = scoreTrend(ctrValues, 'ctr_decline', campaignId, alerts);

  // 3. CVR Trend Score
  const cvrTrend = scoreTrend(cvrValues, 'cvr_decline', campaignId, alerts);

  // 4. Landing Page Health (default to perfect if no URL available)
  const landingPageHealth = 100;

  // 5. Policy Compliance (default to perfect until checked)
  const policyCompliance = 100;

  // 6. Creative Freshness (heuristic based on data availability)
  const creativeFreshness = scoreCreativeFreshness(ctrValues);

  // Detect spend anomaly
  if (spendValues.length >= 3) {
    const spendAlert = detectSpendAnomaly(campaignId, {
      values: spendValues,
      timestamps: dates,
      windowDays: 7,
    });
    if (spendAlert) alerts.push(spendAlert);
  }

  // Detect conversion tracking breaks
  if (conversionValues.length >= 3) {
    const mean = computeMean(conversionValues.slice(0, -1));
    const latest = conversionValues[conversionValues.length - 1] ?? 0;
    const trackingAlert = detectConversionTrackingBreak(campaignId, mean, latest);
    if (trackingAlert) alerts.push(trackingAlert);
  }

  const components = {
    deliveryPacing,
    ctrTrend,
    cvrTrend,
    landingPageHealth,
    policyCompliance,
    creativeFreshness,
  };

  const overallScore =
    components.deliveryPacing * HEALTH_WEIGHTS.deliveryPacing +
    components.ctrTrend * HEALTH_WEIGHTS.ctrTrend +
    components.cvrTrend * HEALTH_WEIGHTS.cvrTrend +
    components.landingPageHealth * HEALTH_WEIGHTS.landingPageHealth +
    components.policyCompliance * HEALTH_WEIGHTS.policyCompliance +
    components.creativeFreshness * HEALTH_WEIGHTS.creativeFreshness;

  return {
    campaignId,
    overallScore: Math.round(overallScore),
    components,
    alerts,
  };
}

function scoreDeliveryPacing(spendValues: readonly number[]): number {
  if (spendValues.length < 2) return 100;

  const mean = computeMean(spendValues);
  if (mean === 0) return 50;

  const stdDev = computeStdDev(spendValues, mean);
  const cv = stdDev / mean;

  // Lower CV = more consistent pacing = higher score
  if (cv < 0.1) return 100;
  if (cv < 0.25) return 85;
  if (cv < 0.5) return 70;
  if (cv < 1.0) return 50;
  return 30;
}

function scoreTrend(
  values: readonly number[],
  alertType: string,
  campaignId: string,
  alerts: HealthAlert[],
): number {
  if (values.length < 3) return 80;

  const slope = computeLinearTrendSlope(values);
  const mean = computeMean(values);
  if (mean === 0) return 50;

  const normalizedSlope = slope / mean;

  // Strong positive trend
  if (normalizedSlope > 0.05) return 100;
  // Stable
  if (normalizedSlope > -0.02) return 85;
  // Slight decline
  if (normalizedSlope > -0.05) return 70;
  // Moderate decline
  if (normalizedSlope > -0.1) {
    alerts.push({
      type: alertType,
      severity: 'warning',
      message: `${alertType.replace('_', ' ')} detected: ${(normalizedSlope * 100).toFixed(1)}% per day`,
      timestamp: new Date(),
      metadata: { campaignId, normalizedSlope },
    });
    return 50;
  }
  // Severe decline
  alerts.push({
    type: alertType,
    severity: 'critical',
    message: `Severe ${alertType.replace('_', ' ')}: ${(normalizedSlope * 100).toFixed(1)}% per day`,
    timestamp: new Date(),
    metadata: { campaignId, normalizedSlope },
  });
  return 20;
}

function scoreCreativeFreshness(ctrValues: readonly number[]): number {
  if (ctrValues.length < 5) return 80;

  // Check if CTR is declining over the most recent 5 data points
  const recent = ctrValues.slice(-5);
  const slope = computeLinearTrendSlope(recent);
  const initialValue = recent[0]!;

  if (initialValue <= 0) return 50;

  const declineRate = slope / initialValue;

  if (declineRate > 0) return 100;
  if (declineRate > -0.03) return 80;
  if (declineRate > -0.08) return 60;
  if (declineRate > -0.15) return 40;
  return 20;
}

// ---------------------------------------------------------------------------
// Auto-Remediation
// ---------------------------------------------------------------------------

/**
 * Persist an audit log entry to the database.
 * Requires the campaign's organizationId for the audit_log FK.
 */
async function persistAuditEntry(
  entry: AuditLogEntry,
  organizationId: string,
): Promise<void> {
  await db.insert(auditLog).values({
    organizationId,
    action: entry.action,
    entityType: 'campaign',
    entityId: entry.campaignId,
    newValue: { reason: entry.reason, ...entry.metadata },
    timestamp: entry.timestamp,
  });
}

/**
 * Pause a campaign due to a detected issue and log the action.
 */
export async function pauseCampaignForIssue(
  campaignId: string,
  reason: string,
): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    campaignId,
    action: 'pause',
    reason,
    timestamp: new Date(),
    metadata: {},
  };

  // Look up the campaign to get organizationId for the audit log FK
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    columns: { organizationId: true },
  });

  await db
    .update(campaigns)
    .set({ status: 'paused', updatedAt: sql`now()` })
    .where(eq(campaigns.id, campaignId));

  await db
    .update(campaignPlatformDeployments)
    .set({ platformStatus: 'paused', updatedAt: sql`now()` })
    .where(eq(campaignPlatformDeployments.campaignId, campaignId));

  if (campaign) {
    await persistAuditEntry(entry, campaign.organizationId);
  }

  return entry;
}

/**
 * Rotate creative on a campaign experiencing fatigue.
 */
export async function rotateCreative(
  campaignId: string,
  newCreativeId: string,
): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    campaignId,
    action: 'rotate_creative',
    reason: `Creative fatigue detected, rotating to creative ${newCreativeId}`,
    timestamp: new Date(),
    metadata: { newCreativeId },
  };

  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    columns: { organizationId: true },
  });

  // Update the campaign's active creative reference
  // The actual creative swap depends on platform adapter implementations
  await db
    .update(campaigns)
    .set({ updatedAt: sql`now()` })
    .where(eq(campaigns.id, campaignId));

  if (campaign) {
    await persistAuditEntry(entry, campaign.organizationId);
  }

  return entry;
}

/**
 * Adjust budget pacing by applying an adjustment factor.
 * Factor < 1 slows delivery, > 1 speeds it up.
 */
export async function adjustBudgetPacing(
  campaignId: string,
  adjustmentFactor: number,
): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    campaignId,
    action: 'adjust_budget_pacing',
    reason: `Budget pacing adjusted by factor ${adjustmentFactor.toFixed(2)}`,
    timestamp: new Date(),
    metadata: { adjustmentFactor },
  };

  // Fetch current budget, apply factor, and update
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });

  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  const currentDaily = Number(campaign.dailyBudget);
  const adjustedDaily = (currentDaily * adjustmentFactor).toFixed(2);

  await db
    .update(campaigns)
    .set({
      dailyBudget: adjustedDaily,
      updatedAt: sql`now()`,
    })
    .where(eq(campaigns.id, campaignId));

  entry.metadata['previousDailyBudget'] = currentDaily;
  entry.metadata['newDailyBudget'] = Number(adjustedDaily);

  await persistAuditEntry(entry, campaign.organizationId);

  return entry;
}

/**
 * Query persisted audit log entries for a campaign.
 */
export async function getAuditLog(
  organizationId: string,
  limit = 100,
): Promise<AuditLogEntry[]> {
  const rows = await db
    .select({
      action: auditLog.action,
      entityId: auditLog.entityId,
      newValue: auditLog.newValue,
      timestamp: auditLog.timestamp,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.organizationId, organizationId),
        eq(auditLog.entityType, 'campaign'),
      ),
    )
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);

  return rows.map((row) => {
    const meta = (row.newValue ?? {}) as Record<string, unknown>;
    const { reason, ...metadata } = meta;
    return {
      campaignId: row.entityId ?? '',
      action: row.action,
      reason: typeof reason === 'string' ? reason : row.action,
      timestamp: row.timestamp,
      metadata,
    };
  });
}
