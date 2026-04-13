import { db } from '@omni-ad/db';
import {
  abTests,
  abTestEvents,
  creativeBatches,
  type ABTestVariant,
  type ABTestVariantResult,
  type ABTestResults,
  type TrafficAllocation,
  type StatisticalConfig,
} from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import {
  checkSignificance,
  declareWinner as declareStatisticalWinner,
  designTest,
  thompsonSampling,
  type TestArm,
} from './ab-test.service.js';
import { and, desc, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ABTestSelect = typeof abTests.$inferSelect;
type ABTestStatus = ABTestSelect['status'];
type TestType = ABTestSelect['testType'];
type MetricType = ABTestSelect['metricType'];
type EventType = (typeof abTestEvents.$inferInsert)['eventType'];

export interface CreateTestInput {
  name: string;
  campaignId?: string;
  testType: TestType;
  metricType: MetricType;
  variants: ABTestVariant[];
  trafficAllocation: TrafficAllocation;
  statisticalConfig: StatisticalConfig;
}

export interface TestResultsOutput {
  testId: string;
  status: ABTestStatus;
  winnerId: string | null;
  variants: Record<string, ABTestVariantResult>;
  sampleSize: number;
  requiredSampleSize: number;
}

export interface PaginatedTests {
  tests: ABTestSelect[];
  total: number;
}

// ---------------------------------------------------------------------------
// In-memory event buffer for high-throughput batching
// ---------------------------------------------------------------------------

interface BufferedEvent {
  testId: string;
  variantId: string;
  eventType: EventType;
  value: string | null;
  timestamp: Date;
}

const eventBuffer: BufferedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_THRESHOLD = 1_000;

function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => void flushEventBuffer(), FLUSH_INTERVAL_MS);
  // Allow the process to exit even if the timer is pending
  if (flushTimer && typeof flushTimer === 'object' && 'unref' in flushTimer) {
    flushTimer.unref();
  }
}

async function flushEventBuffer(): Promise<void> {
  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, eventBuffer.length);
  const rows = batch.map((e) => ({
    testId: e.testId,
    variantId: e.variantId,
    eventType: e.eventType,
    value: e.value,
    timestamp: e.timestamp,
  }));

  try {
    await db.insert(abTestEvents).values(rows);
  } catch (err: unknown) {
    // On flush failure, push events back for retry
    eventBuffer.unshift(...batch);
    const message = err instanceof Error ? err.message : 'Unknown error';
    process.stderr.write(
      `[ab-test-engine] Event flush failed: ${message}\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function createTest(
  organizationId: string,
  input: CreateTestInput,
): Promise<ABTestSelect> {
  if (input.variants.length < 2) {
    throw new ABTestValidationError('At least 2 variants required');
  }

  // Calculate required sample size
  const sampleSizeResult = designTest({
    metricType: input.metricType === 'cpa' ? 'cvr' : input.metricType,
    minimumDetectableEffect: input.statisticalConfig.mde,
    alpha: input.statisticalConfig.alpha,
    power: input.statisticalConfig.power,
    variants: input.variants.length,
  });

  const [test] = await db
    .insert(abTests)
    .values({
      organizationId,
      name: input.name,
      campaignId: input.campaignId ?? null,
      testType: input.testType,
      metricType: input.metricType,
      variants: input.variants,
      trafficAllocation: input.trafficAllocation,
      statisticalConfig: input.statisticalConfig,
      requiredSampleSize: sampleSizeResult.total,
      currentSampleSize: 0,
    })
    .returning();

  if (!test) {
    throw new ABTestCreationError('Failed to create A/B test');
  }

  return test;
}

export async function bulkCreateTests(
  organizationId: string,
  tests: CreateTestInput[],
): Promise<ABTestSelect[]> {
  const results: ABTestSelect[] = [];
  for (const testInput of tests) {
    const created = await createTest(organizationId, testInput);
    results.push(created);
  }
  return results;
}

export async function startTest(
  testId: string,
  organizationId: string,
): Promise<ABTestSelect> {
  const test = await getTestOrThrow(testId, organizationId);

  if (test.status !== 'draft' && test.status !== 'paused') {
    throw new ABTestStateError(
      `Cannot start test in status: ${test.status}`,
    );
  }

  const [updated] = await db
    .update(abTests)
    .set({
      status: 'running',
      startedAt: test.startedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(abTests.id, testId))
    .returning();

  if (!updated) {
    throw new ABTestNotFoundError(testId);
  }

  return updated;
}

export async function recordEvent(
  testId: string,
  variantId: string,
  eventType: EventType,
  organizationId: string,
  value?: number,
): Promise<void> {
  // Tenancy guard: confirm the test belongs to the caller's org before
  // buffering. Without this, any authenticated user can forge events
  // against any other tenant's A/B tests (result manipulation).
  const test = await db.query.abTests.findFirst({
    where: and(
      eq(abTests.id, testId),
      eq(abTests.organizationId, organizationId),
    ),
    columns: { id: true },
  });
  if (!test) {
    throw new Error('Test not found');
  }

  eventBuffer.push({
    testId,
    variantId,
    eventType,
    value: value != null ? String(value) : null,
    timestamp: new Date(),
  });

  // Flush if buffer exceeds threshold
  if (eventBuffer.length >= FLUSH_THRESHOLD) {
    await flushEventBuffer();
  }

  ensureFlushTimer();
}

export async function getTestResults(
  testId: string,
  organizationId: string,
): Promise<TestResultsOutput> {
  const test = await getTestOrThrow(testId, organizationId);

  // Aggregate events per variant
  const variantResults = await computeVariantMetrics(testId, test.variants);

  return {
    testId: test.id,
    status: test.status,
    winnerId: test.winnerId,
    variants: variantResults,
    sampleSize: test.currentSampleSize,
    requiredSampleSize: test.requiredSampleSize,
  };
}

export async function evaluateAllTests(
  organizationId: string,
): Promise<{ evaluated: number; winnersFound: number }> {
  const runningTests = await db.query.abTests.findMany({
    where: and(
      eq(abTests.organizationId, organizationId),
      eq(abTests.status, 'running'),
    ),
  });

  let winnersFound = 0;

  for (const test of runningTests) {
    const variantMetrics = await computeVariantMetrics(
      test.id,
      test.variants,
    );

    // Build TestArm array for the statistical engine
    const arms: TestArm[] = test.variants.map((v) => {
      const metrics = variantMetrics[v.id];
      const impressions = metrics?.impressions ?? 0;
      const successes =
        test.metricType === 'ctr'
          ? (metrics?.clicks ?? 0)
          : (metrics?.conversions ?? 0);
      return { name: v.id, impressions, successes };
    });

    const totalImpressions = arms.reduce((s, a) => s + a.impressions, 0);

    // Update current sample size
    await db
      .update(abTests)
      .set({
        currentSampleSize: totalImpressions,
        results: variantMetrics,
        updatedAt: new Date(),
      })
      .where(eq(abTests.id, test.id));

    // Check significance using the sequential testing engine
    const maxLooks = 10;
    const currentLook = Math.max(
      1,
      Math.ceil(
        (totalImpressions / test.requiredSampleSize) * maxLooks,
      ),
    );

    const result = declareStatisticalWinner(test.id, arms, {
      alpha: test.statisticalConfig.alpha,
      maxLooks,
      currentLook: Math.min(currentLook, maxLooks),
    });

    if (result.isSignificant && result.winner) {
      await db
        .update(abTests)
        .set({
          status: 'completed',
          winnerId: result.winner,
          winnerDeclaredAt: new Date(),
          completedAt: new Date(),
          results: variantMetrics,
          updatedAt: new Date(),
        })
        .where(eq(abTests.id, test.id));

      winnersFound++;
    } else if (
      totalImpressions >= test.requiredSampleSize &&
      currentLook >= maxLooks
    ) {
      // Reached max sample size without significance: find best performer
      const bestArm = arms.reduce((best, arm) =>
        arm.impressions > 0 &&
        arm.successes / arm.impressions >
          (best.impressions > 0 ? best.successes / best.impressions : 0)
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
      // Reallocate traffic via Thompson Sampling
      const tsResult = thompsonSampling(arms);
      const updatedVariants = test.variants.map((v) => ({
        ...v,
        config: {
          ...v.config,
          allocationWeight: tsResult.allocationWeights[v.id] ?? 0,
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

  return { evaluated: runningTests.length, winnersFound };
}

export async function manualDeclareWinner(
  testId: string,
  organizationId: string,
  winnerId: string,
): Promise<ABTestSelect> {
  const test = await getTestOrThrow(testId, organizationId);

  const variantExists = test.variants.some((v) => v.id === winnerId);
  if (!variantExists) {
    throw new ABTestValidationError(`Variant not found: ${winnerId}`);
  }

  const [updated] = await db
    .update(abTests)
    .set({
      status: 'completed',
      winnerId,
      winnerDeclaredAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(abTests.id, testId))
    .returning();

  if (!updated) {
    throw new ABTestNotFoundError(testId);
  }

  return updated;
}

export async function pauseTest(
  testId: string,
  organizationId: string,
): Promise<ABTestSelect> {
  return updateTestStatus(testId, organizationId, 'running', 'paused');
}

export async function resumeTest(
  testId: string,
  organizationId: string,
): Promise<ABTestSelect> {
  return updateTestStatus(testId, organizationId, 'paused', 'running');
}

export async function cancelTest(
  testId: string,
  organizationId: string,
): Promise<ABTestSelect> {
  const test = await getTestOrThrow(testId, organizationId);

  if (test.status === 'completed' || test.status === 'cancelled') {
    throw new ABTestStateError(
      `Cannot cancel test in status: ${test.status}`,
    );
  }

  const [updated] = await db
    .update(abTests)
    .set({
      status: 'cancelled',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(abTests.id, testId))
    .returning();

  if (!updated) {
    throw new ABTestNotFoundError(testId);
  }

  return updated;
}

export async function listTests(
  organizationId: string,
  status?: ABTestStatus,
  limit = 50,
  offset = 0,
): Promise<PaginatedTests> {
  const conditions = [eq(abTests.organizationId, organizationId)];
  if (status) {
    conditions.push(eq(abTests.status, status));
  }

  const whereClause = and(...conditions);

  const [tests, countResult] = await Promise.all([
    db.query.abTests.findMany({
      where: whereClause,
      orderBy: [desc(abTests.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(abTests)
      .where(whereClause ?? sql`true`),
  ]);

  return {
    tests,
    total: countResult[0]?.count ?? 0,
  };
}

export async function getActiveTestCount(
  organizationId: string,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(abTests)
    .where(
      and(
        eq(abTests.organizationId, organizationId),
        eq(abTests.status, 'running'),
      ),
    );

  return result[0]?.count ?? 0;
}

/**
 * Auto-create A/B tests from a mass production batch.
 * Groups creatives by headline angle and creates one test per group.
 */
export async function autoCreateTestsFromBatch(
  organizationId: string,
  batchId: string,
  campaignId: string,
): Promise<ABTestSelect[]> {
  const batch = await db.query.creativeBatches.findFirst({
    where: and(
      eq(creativeBatches.id, batchId),
      eq(creativeBatches.organizationId, organizationId),
    ),
  });

  if (!batch) {
    throw new ABTestValidationError(`Batch not found: ${batchId}`);
  }

  if (batch.status !== 'completed') {
    throw new ABTestStateError(
      `Batch must be completed to create tests, current status: ${batch.status}`,
    );
  }

  const creativeIds = batch.creativeIds ?? [];
  if (creativeIds.length < 2) {
    throw new ABTestValidationError(
      'Batch must have at least 2 creatives to create A/B tests',
    );
  }

  // Group creatives by angle (stored in config)
  const angles = batch.config?.angles ?? [];
  const testsToCreate: CreateTestInput[] = [];

  if (angles.length === 0) {
    // No angles, create a single test with all creatives
    const variants: ABTestVariant[] = creativeIds.map((cId, idx) => ({
      id: `variant-${idx}`,
      name: `Variant ${idx + 1}`,
      description: `Creative ${cId}`,
      creativeId: cId,
    }));

    testsToCreate.push({
      name: `${batch.name} - A/B Test`,
      campaignId,
      testType: 'creative',
      metricType: 'ctr',
      variants,
      trafficAllocation: {
        method: 'thompson_sampling',
      },
      statisticalConfig: {
        mde: 0.1,
        alpha: 0.05,
        power: 0.8,
        sequentialTesting: true,
      },
    });
  } else {
    // Create one test per angle group
    const creativesPerGroup = Math.ceil(creativeIds.length / angles.length);

    for (let i = 0; i < angles.length; i++) {
      const groupCreatives = creativeIds.slice(
        i * creativesPerGroup,
        (i + 1) * creativesPerGroup,
      );

      if (groupCreatives.length < 2) continue;

      const variants: ABTestVariant[] = groupCreatives.map((cId, idx) => ({
        id: `variant-${idx}`,
        name: `${angles[i]} Variant ${idx + 1}`,
        description: `Creative ${cId} (${angles[i]})`,
        creativeId: cId,
      }));

      testsToCreate.push({
        name: `${batch.name} - ${angles[i]}`,
        campaignId,
        testType: 'headline',
        metricType: 'ctr',
        variants,
        trafficAllocation: {
          method: 'thompson_sampling',
        },
        statisticalConfig: {
          mde: 0.1,
          alpha: 0.05,
          power: 0.8,
          sequentialTesting: true,
        },
      });
    }
  }

  return bulkCreateTests(organizationId, testsToCreate);
}

/**
 * Enqueue a batch evaluation job for all running tests in an organization.
 */
export async function enqueueEvaluation(
  organizationId: string,
): Promise<{ jobId: string }> {
  const queue = getQueue(QUEUE_NAMES.AB_TEST_EVALUATION);
  const job = await queue.add(`evaluate-${organizationId}`, {
    organizationId,
  });

  return { jobId: job.id ?? organizationId };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

async function getTestOrThrow(
  testId: string,
  organizationId: string,
): Promise<ABTestSelect> {
  const test = await db.query.abTests.findFirst({
    where: and(
      eq(abTests.id, testId),
      eq(abTests.organizationId, organizationId),
    ),
  });

  if (!test) {
    throw new ABTestNotFoundError(testId);
  }

  return test;
}

async function updateTestStatus(
  testId: string,
  organizationId: string,
  expectedStatus: ABTestStatus,
  newStatus: ABTestStatus,
): Promise<ABTestSelect> {
  const test = await getTestOrThrow(testId, organizationId);

  if (test.status !== expectedStatus) {
    throw new ABTestStateError(
      `Cannot transition from ${test.status} to ${newStatus}`,
    );
  }

  const [updated] = await db
    .update(abTests)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(abTests.id, testId))
    .returning();

  if (!updated) {
    throw new ABTestNotFoundError(testId);
  }

  return updated;
}

async function computeVariantMetrics(
  testId: string,
  variants: ABTestVariant[],
): Promise<ABTestResults> {
  // Aggregate events grouped by variant + eventType
  const aggregated = await db
    .select({
      variantId: abTestEvents.variantId,
      eventType: abTestEvents.eventType,
      eventCount: sql<number>`count(*)::int`,
      totalValue: sql<string>`coalesce(sum(${abTestEvents.value}), '0')`,
    })
    .from(abTestEvents)
    .where(eq(abTestEvents.testId, testId))
    .groupBy(abTestEvents.variantId, abTestEvents.eventType);

  // Build results map
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

  // Compute pairwise significance against the first variant (control)
  const controlVariant = variants[0];
  if (controlVariant && results[controlVariant.id]) {
    const controlMetrics = results[controlVariant.id]!;

    for (let i = 1; i < variants.length; i++) {
      const treatmentVariant = variants[i]!;
      const treatmentMetrics = results[treatmentVariant.id];
      if (!treatmentMetrics) continue;

      const sigResult = checkSignificance(
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
        { alpha: 0.05 },
      );

      treatmentMetrics.pValue = sigResult.pValue;
      treatmentMetrics.ci = sigResult.confidenceInterval;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class ABTestNotFoundError extends Error {
  constructor(testId: string) {
    super(`A/B test not found: ${testId}`);
    this.name = 'ABTestNotFoundError';
  }
}

export class ABTestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ABTestValidationError';
  }
}

export class ABTestStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ABTestStateError';
  }
}

export class ABTestCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ABTestCreationError';
  }
}
