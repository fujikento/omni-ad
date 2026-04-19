/**
 * Industry Benchmarks Worker Processor
 *
 * Runs daily. Aggregates per-org, per-platform daily metrics into
 * industry-wide percentiles (p25 / p50 / p75 for ROAS, p50 for CTR /
 * CPA), writes to industry_benchmarks. Enforces MIN_SAMPLE_SIZE = 5
 * per bucket AND per metric (CTR / CPA can have stricter subsets).
 *
 * Inlines the aggregation + percentile logic rather than importing
 * from apps/api (cross-app import is disallowed).
 */

import {
  industryBenchmarksJobSchema,
  type IndustryBenchmarksJob,
} from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import {
  campaigns,
  industryBenchmarks,
  metricsDaily,
  organizationIndustry,
} from '@omni-ad/db/schema';
import { eq, sql } from 'drizzle-orm';

const MIN_SAMPLE_SIZE = 5;

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(
      `[industry-benchmarks] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  warn(message, meta) {
    process.stdout.write(
      `[industry-benchmarks] WARN: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  error(message, meta) {
    process.stderr.write(
      `[industry-benchmarks] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;
  const clamped = Math.max(0, Math.min(1, p));
  const idx = clamped * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? null;
  const loVal = sorted[lo] ?? 0;
  const hiVal = sorted[hi] ?? 0;
  return loVal + (hiVal - loVal) * (idx - lo);
}

function yesterdayISODate(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export async function processIndustryBenchmarks(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = industryBenchmarksJobSchema.safeParse(job.data ?? {});
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: IndustryBenchmarksJob = parsed.data;
  const targetDate = data.targetDate ?? yesterdayISODate();

  logger.info('Starting benchmark aggregation', { targetDate });

  const rows = await db
    .select({
      organizationId: campaigns.organizationId,
      platform: metricsDaily.platform,
      industry: organizationIndustry.industry,
      spend: sql<number>`sum(${metricsDaily.spend})::numeric`,
      revenue: sql<number>`sum(${metricsDaily.revenue})::numeric`,
      clicks: sql<number>`sum(${metricsDaily.clicks})::bigint`,
      impressions: sql<number>`sum(${metricsDaily.impressions})::bigint`,
      conversions: sql<number>`sum(${metricsDaily.conversions})::bigint`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(campaigns.id, metricsDaily.campaignId))
    .innerJoin(
      organizationIndustry,
      eq(organizationIndustry.organizationId, campaigns.organizationId),
    )
    .where(eq(metricsDaily.date, targetDate))
    .groupBy(
      campaigns.organizationId,
      metricsDaily.platform,
      organizationIndustry.industry,
    );

  type Bucket = {
    industry: typeof organizationIndustry.$inferSelect.industry;
    platform: string;
    orgRoas: number[];
    orgCtr: number[];
    orgCpa: number[];
  };

  const buckets = new Map<string, Bucket>();
  for (const r of rows) {
    const spend = Number(r.spend);
    if (spend <= 0) continue;
    const revenue = Number(r.revenue);
    const clicks = Number(r.clicks);
    const impressions = Number(r.impressions);
    const conversions = Number(r.conversions);

    const key = `${r.industry}::${r.platform}`;
    const bucket = buckets.get(key) ?? {
      industry: r.industry,
      platform: r.platform,
      orgRoas: [],
      orgCtr: [],
      orgCpa: [],
    };
    bucket.orgRoas.push(revenue / spend);
    if (impressions > 0) bucket.orgCtr.push(clicks / impressions);
    if (conversions > 0) bucket.orgCpa.push(spend / conversions);
    buckets.set(key, bucket);
  }

  let inserted = 0;
  let skippedForAnonymity = 0;

  for (const bucket of buckets.values()) {
    if (bucket.orgRoas.length < MIN_SAMPLE_SIZE) {
      skippedForAnonymity += 1;
      continue;
    }
    const roasSorted = [...bucket.orgRoas].sort((a, b) => a - b);
    const ctrSorted = [...bucket.orgCtr].sort((a, b) => a - b);
    const cpaSorted = [...bucket.orgCpa].sort((a, b) => a - b);

    const ctrP50 =
      ctrSorted.length >= MIN_SAMPLE_SIZE
        ? percentile(ctrSorted, 0.5)
        : null;
    const cpaP50 =
      cpaSorted.length >= MIN_SAMPLE_SIZE
        ? percentile(cpaSorted, 0.5)
        : null;

    try {
      await db
        .insert(industryBenchmarks)
        .values({
          industry: bucket.industry,
          platform: bucket.platform as typeof industryBenchmarks.$inferInsert.platform,
          date: targetDate,
          sampleSize: bucket.orgRoas.length,
          roasP25: percentile(roasSorted, 0.25),
          roasP50: percentile(roasSorted, 0.5),
          roasP75: percentile(roasSorted, 0.75),
          ctrP50,
          cpaP50,
        })
        .onConflictDoUpdate({
          target: [
            industryBenchmarks.industry,
            industryBenchmarks.platform,
            industryBenchmarks.date,
          ],
          set: {
            sampleSize: bucket.orgRoas.length,
            roasP25: percentile(roasSorted, 0.25),
            roasP50: percentile(roasSorted, 0.5),
            roasP75: percentile(roasSorted, 0.75),
            ctrP50,
            cpaP50,
            computedAt: new Date(),
          },
        });
      inserted += 1;
    } catch (err) {
      logger.warn('Benchmark upsert failed', {
        industry: bucket.industry,
        platform: bucket.platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('Benchmark aggregation completed', {
    targetDate,
    inserted,
    skippedForAnonymity,
    totalBuckets: buckets.size,
  });
}
