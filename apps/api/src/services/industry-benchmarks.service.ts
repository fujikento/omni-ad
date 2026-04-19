/**
 * Industry Benchmarks Service — cross-org network effect moat.
 *
 * Aggregates per-org performance into anonymous industry-wide
 * percentiles. Contributes to and reads from industry_benchmarks.
 *
 * Anonymity guard: benchmarks are only surfaced when sample_size >= 5
 * contributing organizations. Single-org results are withheld to
 * prevent re-identification.
 */

import { db } from '@omni-ad/db';
import {
  campaigns,
  industryBenchmarks,
  metricsDaily,
  organizationIndustry,
} from '@omni-ad/db/schema';
import type { Industry } from './industry-types.js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

export const MIN_SAMPLE_SIZE = 5;

export interface BenchmarkReading {
  industry: Industry;
  platform: string;
  date: string;
  sampleSize: number;
  roasP25: number | null;
  roasP50: number | null;
  roasP75: number | null;
  ctrP50: number | null;
  cpaP50: number | null;
}

export interface OrgBenchmarkComparison {
  platform: string;
  orgRoas: number;
  orgCtr: number | null;
  orgCpa: number | null;
  industryRoasP50: number | null;
  industryRoasP25: number | null;
  industryRoasP75: number | null;
  /** (orgRoas - industryP50) / industryP50 — positive = above benchmark. */
  roasDeltaPercent: number | null;
  /** 'top_quartile' | 'above_median' | 'below_median' | 'bottom_quartile' */
  band: 'top_quartile' | 'above_median' | 'below_median' | 'bottom_quartile' | 'unknown';
  sampleSize: number;
}

// ---------------------------------------------------------------------------
// Percentile pure helpers
// ---------------------------------------------------------------------------

export function percentile(sorted: number[], p: number): number | null {
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

export function classifyBand(
  value: number,
  p25: number | null,
  p50: number | null,
  p75: number | null,
): OrgBenchmarkComparison['band'] {
  if (p50 === null) return 'unknown';
  if (p75 !== null && value >= p75) return 'top_quartile';
  if (value >= p50) return 'above_median';
  if (p25 !== null && value >= p25) return 'below_median';
  return 'bottom_quartile';
}

// ---------------------------------------------------------------------------
// DB wrappers
// ---------------------------------------------------------------------------

export async function setOrgIndustry(
  organizationId: string,
  industry: Industry,
): Promise<void> {
  await db
    .insert(organizationIndustry)
    .values({ organizationId, industry })
    .onConflictDoUpdate({
      target: organizationIndustry.organizationId,
      set: { industry, updatedAt: new Date() },
    });
}

export async function getOrgIndustry(
  organizationId: string,
): Promise<Industry | null> {
  const row = await db.query.organizationIndustry.findFirst({
    where: eq(organizationIndustry.organizationId, organizationId),
  });
  return (row?.industry as Industry | undefined) ?? null;
}

/**
 * Compute industry benchmarks for a given date by aggregating across
 * all organizations that have set their industry tag. Writes one row
 * per (industry, platform, date) combination where sample_size >= 5.
 */
export async function computeIndustryBenchmarksForDate(
  targetDate: string,
): Promise<{ inserted: number; skippedForAnonymity: number }> {
  // Fetch per-org, per-platform daily aggregates for the date
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
    industry: Industry;
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
      industry: r.industry as Industry,
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

    // Per-metric anonymity: CTR and CPA are populated from stricter
    // subsets than ROAS (only orgs with impressions / conversions
    // respectively). Applying MIN_SAMPLE_SIZE per metric prevents a
    // published percentile from fewer than 5 contributing orgs.
    const ctrP50 =
      ctrSorted.length >= MIN_SAMPLE_SIZE
        ? percentile(ctrSorted, 0.5)
        : null;
    const cpaP50 =
      cpaSorted.length >= MIN_SAMPLE_SIZE
        ? percentile(cpaSorted, 0.5)
        : null;

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
  }

  return { inserted, skippedForAnonymity };
}

export async function getRecentBenchmarks(
  industry: Industry,
  platforms: string[],
  daysBack = 7,
): Promise<BenchmarkReading[]> {
  const since = new Date(Date.now() - daysBack * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const rows = await db
    .select()
    .from(industryBenchmarks)
    .where(
      and(
        eq(industryBenchmarks.industry, industry),
        inArray(
          industryBenchmarks.platform,
          platforms as typeof industryBenchmarks.$inferInsert.platform[],
        ),
        sql`${industryBenchmarks.date} >= ${since}`,
      ),
    )
    .orderBy(desc(industryBenchmarks.date));

  return rows.map((r) => ({
    industry: r.industry as Industry,
    platform: r.platform,
    date: r.date,
    sampleSize: r.sampleSize,
    roasP25: r.roasP25,
    roasP50: r.roasP50,
    roasP75: r.roasP75,
    ctrP50: r.ctrP50,
    cpaP50: r.cpaP50,
  }));
}

/**
 * Compare an org's recent per-platform performance to industry
 * benchmarks. Returns null when the org has no industry tag.
 */
export async function compareOrgToIndustry(
  organizationId: string,
  platforms: string[],
  windowDays = 7,
): Promise<OrgBenchmarkComparison[] | null> {
  const industry = await getOrgIndustry(organizationId);
  if (!industry) return null;

  const since = new Date(Date.now() - windowDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Org's per-platform aggregate in the window.
  const orgRows = await db
    .select({
      platform: metricsDaily.platform,
      spend: sql<number>`sum(${metricsDaily.spend})::numeric`,
      revenue: sql<number>`sum(${metricsDaily.revenue})::numeric`,
      clicks: sql<number>`sum(${metricsDaily.clicks})::bigint`,
      impressions: sql<number>`sum(${metricsDaily.impressions})::bigint`,
      conversions: sql<number>`sum(${metricsDaily.conversions})::bigint`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(campaigns.id, metricsDaily.campaignId))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        sql`${metricsDaily.date} >= ${since}`,
        inArray(
          metricsDaily.platform,
          platforms as typeof metricsDaily.$inferInsert.platform[],
        ),
      ),
    )
    .groupBy(metricsDaily.platform);

  const latestBenchmarks = await getRecentBenchmarks(industry, platforms, 7);
  const byPlatform = new Map<string, BenchmarkReading>();
  for (const b of latestBenchmarks) {
    if (!byPlatform.has(b.platform)) byPlatform.set(b.platform, b);
  }

  return orgRows.map((row) => {
    const spend = Number(row.spend);
    const revenue = Number(row.revenue);
    const clicks = Number(row.clicks);
    const impressions = Number(row.impressions);
    const conversions = Number(row.conversions);

    const orgRoas = spend > 0 ? revenue / spend : 0;
    const orgCtr = impressions > 0 ? clicks / impressions : null;
    const orgCpa = conversions > 0 ? spend / conversions : null;

    const bench = byPlatform.get(row.platform);
    const p50 = bench?.roasP50 ?? null;
    const p25 = bench?.roasP25 ?? null;
    const p75 = bench?.roasP75 ?? null;
    const roasDeltaPercent =
      p50 !== null && p50 > 0 ? ((orgRoas - p50) / p50) * 100 : null;
    const band = classifyBand(orgRoas, p25, p50, p75);

    return {
      platform: row.platform,
      orgRoas: Math.round(orgRoas * 10_000) / 10_000,
      orgCtr:
        orgCtr !== null ? Math.round(orgCtr * 10_000) / 10_000 : null,
      orgCpa: orgCpa !== null ? Math.round(orgCpa * 100) / 100 : null,
      industryRoasP50: p50,
      industryRoasP25: p25,
      industryRoasP75: p75,
      roasDeltaPercent:
        roasDeltaPercent !== null
          ? Math.round(roasDeltaPercent * 100) / 100
          : null,
      band,
      sampleSize: bench?.sampleSize ?? 0,
    };
  });
}
