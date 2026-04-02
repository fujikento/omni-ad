/**
 * LTV/CAC Tracking Service
 *
 * Records customer conversions, computes cohort analysis with CAC/LTV/ratio,
 * provides LTV overviews and top customer queries.
 */

import { db } from '@omni-ad/db';
import {
  customerProfiles,
  cohortAnalysis,
  metricsDaily,
} from '@omni-ad/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CustomerProfileSelect = typeof customerProfiles.$inferSelect;
type CohortAnalysisSelect = typeof cohortAnalysis.$inferSelect;
type Platform = typeof customerProfiles.$inferInsert['acquisitionPlatform'];

interface RecordConversionInput {
  organizationId: string;
  hashedId: string;
  revenue: number;
  campaignId?: string;
  platform?: Platform;
}

export interface LtvOverview {
  totalCustomers: number;
  avgLtv: number;
  avgCac: number;
  overallLtvCacRatio: number;
  totalRevenue: number;
  totalAcquisitionCost: number;
}

export interface CohortTrendEntry {
  cohortMonth: string;
  customersAcquired: number;
  cac: number;
  avgLtv: number;
  ltvCacRatio: number;
}

export interface TopCustomer {
  id: string;
  hashedIdentifier: string;
  totalConversions: number;
  totalRevenue: number;
  ltv: number;
  firstConversionAt: Date;
  lastConversionAt: Date;
  acquisitionPlatform: string | null;
}

// ---------------------------------------------------------------------------
// Record Customer Conversion
// ---------------------------------------------------------------------------

/**
 * Upsert a customer profile on conversion, incrementing conversions and revenue.
 * On first conversion, also records the acquisition campaign and platform.
 */
export async function recordCustomerConversion(
  input: RecordConversionInput,
): Promise<CustomerProfileSelect> {
  const { organizationId, hashedId, revenue, campaignId, platform } = input;
  const now = new Date();
  const revenueStr = revenue.toFixed(2);

  // Check if customer profile already exists
  const existing = await db.query.customerProfiles.findFirst({
    where: and(
      eq(customerProfiles.organizationId, organizationId),
      eq(customerProfiles.hashedIdentifier, hashedId),
    ),
  });

  if (existing) {
    // Update existing profile
    const newTotalRevenue = (Number(existing.totalRevenue) + revenue).toFixed(2);
    const newConversions = existing.totalConversions + 1;

    const [updated] = await db
      .update(customerProfiles)
      .set({
        lastConversionAt: now,
        totalConversions: newConversions,
        totalRevenue: newTotalRevenue,
        ltv: newTotalRevenue,
        updatedAt: sql`now()`,
      })
      .where(eq(customerProfiles.id, existing.id))
      .returning();

    if (!updated) {
      throw new LtvTrackingError(`Failed to update customer profile: ${existing.id}`);
    }

    return updated;
  }

  // Create new customer profile
  const acquisitionCost = campaignId
    ? await estimateAcquisitionCost(organizationId, campaignId)
    : null;

  const [created] = await db
    .insert(customerProfiles)
    .values({
      organizationId,
      hashedIdentifier: hashedId,
      firstConversionAt: now,
      lastConversionAt: now,
      totalConversions: 1,
      totalRevenue: revenueStr,
      acquisitionCampaignId: campaignId ?? null,
      acquisitionPlatform: platform ?? null,
      acquisitionCost: acquisitionCost?.toFixed(2) ?? null,
      ltv: revenueStr,
    })
    .returning();

  if (!created) {
    throw new LtvTrackingError('Failed to create customer profile');
  }

  return created;
}

// ---------------------------------------------------------------------------
// Cohort Analysis
// ---------------------------------------------------------------------------

/**
 * Compute CAC, avg LTV, LTV/CAC ratio for a given cohort month.
 * Cohort month format: '2026-04'
 */
export async function computeCohortAnalysis(
  organizationId: string,
  cohortMonth: string,
): Promise<CohortAnalysisSelect> {
  // Parse cohort month boundaries
  const [year, month] = cohortMonth.split('-').map(Number) as [number, number];
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // Get all customer profiles acquired in this cohort month
  const cohortCustomers = await db.query.customerProfiles.findMany({
    where: and(
      eq(customerProfiles.organizationId, organizationId),
      sql`${customerProfiles.firstConversionAt} >= ${monthStart}`,
      sql`${customerProfiles.firstConversionAt} <= ${monthEnd}`,
    ),
  });

  const customersAcquired = cohortCustomers.length;

  if (customersAcquired === 0) {
    // Upsert empty cohort record
    return upsertCohortRecord(organizationId, cohortMonth, {
      customersAcquired: 0,
      totalAcquisitionCost: 0,
      cac: 0,
      avgLtv: 0,
      ltvCacRatio: 0,
      retentionRates: {},
    });
  }

  // Calculate total acquisition cost
  const totalAcquisitionCost = cohortCustomers.reduce(
    (sum, c) => sum + Number(c.acquisitionCost ?? 0),
    0,
  );

  // CAC = total acquisition cost / customers acquired
  const cac =
    customersAcquired > 0 ? totalAcquisitionCost / customersAcquired : 0;

  // Average LTV
  const totalLtv = cohortCustomers.reduce(
    (sum, c) => sum + Number(c.ltv),
    0,
  );
  const avgLtv = customersAcquired > 0 ? totalLtv / customersAcquired : 0;

  // LTV/CAC ratio
  const ltvCacRatio = cac > 0 ? avgLtv / cac : 0;

  // Compute retention rates (how many customers converted again in subsequent months)
  const retentionRates = await computeRetentionRates(
    cohortCustomers,
    monthStart,
  );

  return upsertCohortRecord(organizationId, cohortMonth, {
    customersAcquired,
    totalAcquisitionCost,
    cac,
    avgLtv,
    ltvCacRatio,
    retentionRates,
  });
}

// ---------------------------------------------------------------------------
// LTV Overview
// ---------------------------------------------------------------------------

/**
 * Get overall LTV/CAC metrics for the organization.
 */
export async function getLtvOverview(
  organizationId: string,
): Promise<LtvOverview> {
  const [result] = await db
    .select({
      totalCustomers: sql<number>`COUNT(*)::int`,
      totalRevenue: sql<string>`COALESCE(SUM(${customerProfiles.totalRevenue}), 0)::numeric(14,2)::text`,
      avgLtv: sql<string>`COALESCE(AVG(${customerProfiles.ltv}), 0)::numeric(14,2)::text`,
      totalAcquisitionCost: sql<string>`COALESCE(SUM(${customerProfiles.acquisitionCost}), 0)::numeric(14,2)::text`,
    })
    .from(customerProfiles)
    .where(eq(customerProfiles.organizationId, organizationId));

  const totalCustomers = result?.totalCustomers ?? 0;
  const totalRevenue = Number(result?.totalRevenue ?? '0');
  const avgLtv = Number(result?.avgLtv ?? '0');
  const totalAcquisitionCost = Number(result?.totalAcquisitionCost ?? '0');
  const avgCac =
    totalCustomers > 0 ? totalAcquisitionCost / totalCustomers : 0;
  const overallLtvCacRatio = avgCac > 0 ? avgLtv / avgCac : 0;

  return {
    totalCustomers,
    avgLtv,
    avgCac,
    overallLtvCacRatio,
    totalRevenue,
    totalAcquisitionCost,
  };
}

// ---------------------------------------------------------------------------
// Cohort Trend
// ---------------------------------------------------------------------------

/**
 * Get cohort trend over the specified number of months.
 */
export async function getCohortTrend(
  organizationId: string,
  months: number,
): Promise<CohortTrendEntry[]> {
  const cohorts = await db.query.cohortAnalysis.findMany({
    where: eq(cohortAnalysis.organizationId, organizationId),
    orderBy: [desc(cohortAnalysis.cohortMonth)],
    limit: months,
  });

  return cohorts.map((c) => ({
    cohortMonth: c.cohortMonth,
    customersAcquired: c.customersAcquired,
    cac: Number(c.cac),
    avgLtv: Number(c.avgLtv),
    ltvCacRatio: c.ltvCacRatio,
  }));
}

// ---------------------------------------------------------------------------
// Top Customers
// ---------------------------------------------------------------------------

/**
 * Get highest LTV customers for the organization.
 */
export async function getTopCustomers(
  organizationId: string,
  limit: number,
): Promise<TopCustomer[]> {
  const topCustomers = await db.query.customerProfiles.findMany({
    where: eq(customerProfiles.organizationId, organizationId),
    orderBy: [desc(customerProfiles.ltv)],
    limit,
  });

  return topCustomers.map((c) => ({
    id: c.id,
    hashedIdentifier: c.hashedIdentifier,
    totalConversions: c.totalConversions,
    totalRevenue: Number(c.totalRevenue),
    ltv: Number(c.ltv),
    firstConversionAt: c.firstConversionAt,
    lastConversionAt: c.lastConversionAt,
    acquisitionPlatform: c.acquisitionPlatform,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function estimateAcquisitionCost(
  _organizationId: string,
  campaignId: string,
): Promise<number | null> {
  // Estimate cost per acquisition from the campaign's metrics
  const [metrics] = await db
    .select({
      totalSpend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      totalConversions: sql<number>`COALESCE(SUM(${metricsDaily.conversions}), 0)::int`,
    })
    .from(metricsDaily)
    .where(
      and(
        eq(metricsDaily.campaignId, campaignId),
      ),
    );

  if (!metrics || metrics.totalConversions === 0) return null;

  return Number(metrics.totalSpend) / metrics.totalConversions;
}

interface CohortUpsertData {
  customersAcquired: number;
  totalAcquisitionCost: number;
  cac: number;
  avgLtv: number;
  ltvCacRatio: number;
  retentionRates: Record<string, number>;
}

async function upsertCohortRecord(
  organizationId: string,
  cohortMonth: string,
  data: CohortUpsertData,
): Promise<CohortAnalysisSelect> {
  // Check if cohort record already exists
  const existing = await db.query.cohortAnalysis.findFirst({
    where: and(
      eq(cohortAnalysis.organizationId, organizationId),
      eq(cohortAnalysis.cohortMonth, cohortMonth),
      sql`${cohortAnalysis.platform} IS NULL`,
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(cohortAnalysis)
      .set({
        customersAcquired: data.customersAcquired,
        totalAcquisitionCost: data.totalAcquisitionCost.toFixed(2),
        cac: data.cac.toFixed(2),
        avgLtv: data.avgLtv.toFixed(2),
        ltvCacRatio: data.ltvCacRatio,
        retentionRates: data.retentionRates,
        computedAt: sql`now()`,
      })
      .where(eq(cohortAnalysis.id, existing.id))
      .returning();

    if (!updated) {
      throw new LtvTrackingError('Failed to update cohort analysis');
    }

    return updated;
  }

  const [created] = await db
    .insert(cohortAnalysis)
    .values({
      organizationId,
      cohortMonth,
      platform: null,
      customersAcquired: data.customersAcquired,
      totalAcquisitionCost: data.totalAcquisitionCost.toFixed(2),
      cac: data.cac.toFixed(2),
      avgLtv: data.avgLtv.toFixed(2),
      ltvCacRatio: data.ltvCacRatio,
      retentionRates: data.retentionRates,
    })
    .returning();

  if (!created) {
    throw new LtvTrackingError('Failed to create cohort analysis');
  }

  return created;
}

async function computeRetentionRates(
  cohortCustomers: typeof customerProfiles.$inferSelect[],
  cohortStart: Date,
): Promise<Record<string, number>> {
  const rates: Record<string, number> = {};
  const totalCustomers = cohortCustomers.length;
  if (totalCustomers === 0) return rates;

  const now = new Date();
  const monthsSinceCohort = Math.floor(
    (now.getTime() - cohortStart.getTime()) / (30 * 86_400_000),
  );

  // For each subsequent month, calculate what percentage of customers converted again
  for (let m = 1; m <= Math.min(monthsSinceCohort, 12); m++) {
    const checkDate = new Date(cohortStart);
    checkDate.setMonth(checkDate.getMonth() + m);

    const retainedCount = cohortCustomers.filter((c) => {
      return c.lastConversionAt >= checkDate;
    }).length;

    rates[`month${m}`] = retainedCount / totalCustomers;
  }

  return rates;
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class LtvTrackingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LtvTrackingError';
  }
}
