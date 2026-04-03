import {
  abTestEvaluationJobSchema,
  type ABTestEvaluationJob,
} from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import {
  abTests,
  abTestEvents,
  type ABTestVariant,
  type ABTestResults,
} from '@omni-ad/db/schema';
import { and, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(
      `[ab-test-evaluation] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  error(message, meta) {
    process.stderr.write(
      `[ab-test-evaluation] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
};

// ---------------------------------------------------------------------------
// Inline statistical helpers (avoid cross-app imports)
// ---------------------------------------------------------------------------

interface TestArm {
  name: string;
  impressions: number;
  successes: number;
}

function qnorm(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const isLowerHalf = p < 0.5;
  const pp = isLowerHalf ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(pp));

  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  const result =
    t -
    (c0 + c1 * t + c2 * t * t) /
      (1 + d1 * t + d2 * t * t + d3 * t * t * t);

  return isLowerHalf ? -result : result;
}

function pnorm(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp((-absX * absX) / 2);

  return 0.5 * (1.0 + sign * y);
}

function checkSignificancePair(
  control: TestArm,
  treatment: TestArm,
  alpha: number,
): { isSignificant: boolean; pValue: number; zScore: number } {
  const controlRate =
    control.impressions > 0
      ? control.successes / control.impressions
      : 0;
  const treatmentRate =
    treatment.impressions > 0
      ? treatment.successes / treatment.impressions
      : 0;

  const totalImpressions = control.impressions + treatment.impressions;
  const pooledRate =
    totalImpressions > 0
      ? (control.successes + treatment.successes) / totalImpressions
      : 0;

  const se = Math.sqrt(
    pooledRate *
      (1 - pooledRate) *
      (1 / Math.max(control.impressions, 1) +
        1 / Math.max(treatment.impressions, 1)),
  );

  const zScore = se > 0 ? (treatmentRate - controlRate) / se : 0;
  const pValue = 2 * (1 - pnorm(Math.abs(zScore)));

  const zAlpha = qnorm(1 - alpha / 2);
  const isSignificant = Math.abs(zScore) > zAlpha;

  return { isSignificant, pValue, zScore };
}

function sampleBeta(alpha: number, beta: number): number {
  if (alpha > 50 && beta > 50) {
    const mean = alpha / (alpha + beta);
    const variance =
      (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const normal =
      Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Math.max(0, Math.min(1, mean + Math.sqrt(variance) * normal));
  }

  let u1: number, u2: number, x: number, y: number;
  do {
    u1 = Math.random();
    u2 = Math.random();
    x = Math.pow(u1, 1 / alpha);
    y = Math.pow(u2, 1 / beta);
  } while (x + y > 1);

  return x / (x + y);
}

function thompsonSamplingWinner(
  arms: TestArm[],
  numSimulations = 10_000,
): { winner: string | null; winProbabilities: Record<string, number> } {
  const winCounts = new Map<string, number>();
  for (const arm of arms) {
    winCounts.set(arm.name, 0);
  }

  for (let sim = 0; sim < numSimulations; sim++) {
    let bestValue = -Infinity;
    let bestName = '';

    for (const arm of arms) {
      const alpha = 1 + arm.successes;
      const beta = 1 + (arm.impressions - arm.successes);
      const sampled = sampleBeta(alpha, beta);
      if (sampled > bestValue) {
        bestValue = sampled;
        bestName = arm.name;
      }
    }

    const current = winCounts.get(bestName) ?? 0;
    winCounts.set(bestName, current + 1);
  }

  const winProbabilities: Record<string, number> = {};
  let highestProb = 0;
  let winner: string | null = null;

  for (const arm of arms) {
    const prob = (winCounts.get(arm.name) ?? 0) / numSimulations;
    winProbabilities[arm.name] = prob;
    if (prob > highestProb) {
      highestProb = prob;
      winner = arm.name;
    }
  }

  return {
    winner: highestProb > 0.95 ? winner : null,
    winProbabilities,
  };
}

// ---------------------------------------------------------------------------
// Variant metrics computation
// ---------------------------------------------------------------------------

async function computeVariantMetrics(
  testId: string,
  variants: ABTestVariant[],
  alpha: number,
): Promise<ABTestResults> {
  const aggregated = await db
    .select({
      variantId: abTestEvents.variantId,
      eventType: abTestEvents.eventType,
      eventCount: sql<number>`count(*)::int`,
    })
    .from(abTestEvents)
    .where(eq(abTestEvents.testId, testId))
    .groupBy(abTestEvents.variantId, abTestEvents.eventType);

  const results: ABTestResults = {};

  for (const variant of variants) {
    const variantEvents = aggregated.filter(
      (a) => a.variantId === variant.id,
    );

    const impressions =
      variantEvents.find((e) => e.eventType === 'impression')?.eventCount ??
      0;
    const clicks =
      variantEvents.find((e) => e.eventType === 'click')?.eventCount ?? 0;
    const conversions =
      variantEvents.find((e) => e.eventType === 'conversion')?.eventCount ??
      0;

    const rate = impressions > 0 ? clicks / impressions : 0;

    results[variant.id] = {
      impressions,
      clicks,
      conversions,
      rate,
      pValue: null,
      ci: null,
    };
  }

  // Compute pairwise significance against control (first variant)
  const controlVariant = variants[0];
  if (controlVariant && results[controlVariant.id]) {
    const controlMetrics = results[controlVariant.id]!;

    for (let i = 1; i < variants.length; i++) {
      const treatmentVariant = variants[i]!;
      const treatmentMetrics = results[treatmentVariant.id];
      if (!treatmentMetrics) continue;

      const sigResult = checkSignificancePair(
        {
          name: controlVariant.id,
          impressions: controlMetrics.impressions,
          successes: controlMetrics.clicks,
        },
        {
          name: treatmentVariant.id,
          impressions: treatmentMetrics.impressions,
          successes: treatmentMetrics.clicks,
        },
        alpha,
      );

      treatmentMetrics.pValue = sigResult.pValue;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processAbTestEvaluation(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = abTestEvaluationJobSchema.safeParse(job.data);
  if (!parsed.success) {
    logger.error('Invalid job data', { errors: parsed.error.issues });
    return;
  }

  const data: ABTestEvaluationJob = parsed.data;

  logger.info('Starting A/B test evaluation', {
    organizationId: data.organizationId,
    testId: data.testId ?? 'all',
  });

  try {
    const runningTests = await db.query.abTests.findMany({
      where: and(
        eq(abTests.organizationId, data.organizationId),
        eq(abTests.status, 'running'),
      ),
    });

    let winnersFound = 0;

    for (const test of runningTests) {
      const alpha = test.statisticalConfig.alpha;
      const variantMetrics = await computeVariantMetrics(
        test.id,
        test.variants,
        alpha,
      );

      const arms: TestArm[] = test.variants.map((v) => {
        const metrics = variantMetrics[v.id];
        const impressions = metrics?.impressions ?? 0;
        const successes =
          test.metricType === 'ctr'
            ? (metrics?.clicks ?? 0)
            : (metrics?.conversions ?? 0);
        return { name: v.id, impressions, successes };
      });

      const totalImpressions = arms.reduce(
        (s, a) => s + a.impressions,
        0,
      );

      // Update current sample size + results
      await db
        .update(abTests)
        .set({
          currentSampleSize: totalImpressions,
          results: variantMetrics,
          updatedAt: new Date(),
        })
        .where(eq(abTests.id, test.id));

      // Check for winner using Thompson Sampling
      const tsResult = thompsonSamplingWinner(arms);

      if (tsResult.winner) {
        await db
          .update(abTests)
          .set({
            status: 'completed',
            winnerId: tsResult.winner,
            winnerDeclaredAt: new Date(),
            completedAt: new Date(),
            results: variantMetrics,
            updatedAt: new Date(),
          })
          .where(eq(abTests.id, test.id));

        winnersFound++;
      } else if (totalImpressions >= test.requiredSampleSize) {
        // Reached max sample size, pick the best performer
        const bestArm = arms.reduce((best, arm) =>
          arm.impressions > 0 &&
          arm.successes / arm.impressions >
            (best.impressions > 0
              ? best.successes / best.impressions
              : 0)
            ? arm
            : best,
        );

        await db
          .update(abTests)
          .set({
            status: 'completed',
            winnerId: bestArm.name,
            winnerDeclaredAt: new Date(),
            completedAt: new Date(),
            results: variantMetrics,
            updatedAt: new Date(),
          })
          .where(eq(abTests.id, test.id));

        winnersFound++;
      } else if (
        test.trafficAllocation.method === 'thompson_sampling' &&
        arms.every((a) => a.impressions > 0)
      ) {
        // Reallocate traffic weights
        const updatedVariants = test.variants.map((v) => ({
          ...v,
          config: {
            ...v.config,
            allocationWeight:
              tsResult.winProbabilities[v.id] ?? 0,
          },
        }));

        await db
          .update(abTests)
          .set({
            variants: updatedVariants,
            results: variantMetrics,
            updatedAt: new Date(),
          })
          .where(eq(abTests.id, test.id));
      }
    }

    logger.info('A/B test evaluation completed', {
      organizationId: data.organizationId,
      evaluated: runningTests.length,
      winnersFound,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('A/B test evaluation failed', {
      organizationId: data.organizationId,
      error: message,
    });
    throw err;
  }
}
