import { anomalyDetectionJobSchema, type AnomalyDetectionJob } from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import { campaigns, metricsDaily } from '@omni-ad/db/schema';
import { and, eq, sql, between } from 'drizzle-orm';

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(`[anomaly-detection] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
  warn(message, meta) {
    process.stdout.write(`[anomaly-detection] WARN: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
  error(message, meta) {
    process.stderr.write(`[anomaly-detection] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
};

interface HealthAlert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

type CheckType = AnomalyDetectionJob['checkTypes'][number];

export async function processAnomalyDetection(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = anomalyDetectionJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: AnomalyDetectionJob = parsed.data;
  const { organizationId, campaignId, checkTypes } = data;

  logger.info('Running anomaly detection checks', {
    organizationId,
    campaignId,
    checkTypes,
  });

  const alerts: HealthAlert[] = [];

  if (!campaignId) {
    logger.info('No campaign ID provided, skipping per-campaign checks', {
      organizationId,
    });
    return;
  }

  // Fetch 7-day metrics window for this campaign
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

  const spendValues = dailyMetrics.map((m) => Number(m.spend));
  const ctrValues = dailyMetrics.map((m) =>
    m.impressions > 0 ? m.clicks / m.impressions : 0,
  );
  const conversionValues = dailyMetrics.map((m) => m.conversions);

  for (const checkType of checkTypes) {
    try {
      const checkAlerts = runCheck(checkType, campaignId, spendValues, ctrValues, conversionValues);
      alerts.push(...checkAlerts);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Check ${checkType} failed`, { checkType, error: message });
    }
  }

  // Auto-pause for critical alerts
  for (const alert of alerts) {
    if (alert.severity === 'critical') {
      logger.warn('Critical alert, pausing campaign', {
        campaignId,
        alertType: alert.type,
        message: alert.message,
      });

      await db
        .update(campaigns)
        .set({ status: 'paused', updatedAt: sql`now()` })
        .where(
          and(
            eq(campaigns.id, campaignId),
            eq(campaigns.organizationId, organizationId),
          ),
        );
    }
  }

  logger.info('Anomaly detection completed', {
    organizationId,
    campaignId,
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
  });
}

// ---------------------------------------------------------------------------
// Check Implementations (inline CUSUM / trend detection)
// ---------------------------------------------------------------------------

function runCheck(
  checkType: CheckType,
  _campaignId: string,
  spendValues: number[],
  ctrValues: number[],
  conversionValues: number[],
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  switch (checkType) {
    case 'spend_spike': {
      if (spendValues.length < 3) break;
      const mean = computeMean(spendValues);
      const latest = spendValues[spendValues.length - 1] ?? 0;
      if (mean > 0 && latest > mean * 3) {
        alerts.push({
          type: 'spend_spike',
          severity: 'critical',
          message: `Spend spike: ${latest.toFixed(2)} is ${(latest / mean).toFixed(1)}x above average (${mean.toFixed(2)})`,
        });
      }
      break;
    }

    case 'ctr_drop': {
      if (ctrValues.length < 5) break;
      const recent = ctrValues.slice(-5);
      const slope = computeLinearTrendSlope(recent);
      const initial = recent[0] ?? 0;
      if (initial > 0 && slope / initial < -0.1) {
        alerts.push({
          type: 'ctr_drop',
          severity: 'warning',
          message: `CTR declining: ${(Math.abs(slope / initial) * 100).toFixed(1)}% trend per day`,
        });
      }
      break;
    }

    case 'conversion_tracking': {
      if (conversionValues.length < 3) break;
      const predicted = computeMean(conversionValues.slice(0, -1));
      const actual = conversionValues[conversionValues.length - 1] ?? 0;
      if (predicted > 0 && Math.abs(actual - predicted) / predicted > 0.5) {
        alerts.push({
          type: 'conversion_tracking',
          severity: 'critical',
          message: `Conversion tracking anomaly: expected ~${predicted.toFixed(0)}, got ${actual}`,
        });
      }
      break;
    }

    case 'creative_fatigue': {
      if (ctrValues.length < 5) break;
      const recent = ctrValues.slice(-5);
      const slope = computeLinearTrendSlope(recent);
      const initial = recent[0] ?? 0;
      if (initial > 0 && slope / initial < -0.15) {
        alerts.push({
          type: 'creative_fatigue',
          severity: 'warning',
          message: `Creative fatigue: CTR declined ${(Math.abs(slope / initial) * 100).toFixed(1)}% over 5 days`,
        });
      }
      break;
    }

    case 'budget_pacing': {
      if (spendValues.length < 2) break;
      const mean = computeMean(spendValues);
      const stdDev = computeStdDev(spendValues, mean);
      const cv = mean > 0 ? stdDev / mean : 0;
      if (cv > 0.5) {
        alerts.push({
          type: 'budget_pacing',
          severity: 'warning',
          message: `Inconsistent budget pacing: coefficient of variation is ${cv.toFixed(2)}`,
        });
      }
      break;
    }

    case 'bot_traffic': {
      // Bot traffic detection requires click-level data not available in daily metrics
      // This is a placeholder -- full implementation uses click timestamps and IP data
      break;
    }
  }

  return alerts;
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
