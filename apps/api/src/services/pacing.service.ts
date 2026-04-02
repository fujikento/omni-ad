/**
 * Budget Pacing Service
 *
 * Tracks daily and monthly budget pacing for active campaigns,
 * providing projected spend, delivery status, and over/under alerts.
 */

import { db } from '@omni-ad/db';
import {
  campaigns,
  metricsHourly,
  metricsDaily,
} from '@omni-ad/db/schema';
import { and, eq, sql, gte, between } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PacingStatus = 'on_track' | 'under_delivery' | 'overspend_risk';

interface DailyCampaignPacing {
  campaignId: string;
  campaignName: string;
  dailyBudget: number;
  spendToday: number;
  expectedSpendByNow: number;
  projectedTotalSpend: number;
  pacingStatus: PacingStatus;
  hoursRemaining: number;
  pacingPercent: number;
}

export interface DailyPacingReport {
  organizationId: string;
  timestamp: Date;
  campaigns: DailyCampaignPacing[];
  summary: {
    totalDailyBudget: number;
    totalSpendToday: number;
    onTrack: number;
    underDelivery: number;
    overspendRisk: number;
  };
}

interface MonthlyCampaignPacing {
  campaignId: string;
  campaignName: string;
  monthlyBudget: number;
  spentThisMonth: number;
  daysRemaining: number;
  daysElapsed: number;
  projectedMonthEnd: number;
  overUnderProjection: number;
  pacingStatus: PacingStatus;
}

export interface MonthlyPacingReport {
  organizationId: string;
  month: string;
  campaigns: MonthlyCampaignPacing[];
  summary: {
    totalMonthlyBudget: number;
    totalSpentThisMonth: number;
    projectedMonthEnd: number;
    overUnderProjection: number;
  };
}

// Pacing thresholds (percentage deviation from expected)
const OVERSPEND_THRESHOLD = 0.15;
const UNDERDELIVERY_THRESHOLD = 0.30;

// ---------------------------------------------------------------------------
// Daily Pacing
// ---------------------------------------------------------------------------

export async function getDailyPacing(
  organizationId: string,
): Promise<DailyPacingReport> {
  // Fetch active campaigns
  const activeCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.organizationId, organizationId),
      eq(campaigns.status, 'active'),
    ),
  });

  const now = new Date();
  const hoursElapsed = now.getHours() + now.getMinutes() / 60;
  const hoursRemaining = Math.max(0, 24 - hoursElapsed);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const campaignPacings: DailyCampaignPacing[] = [];

  for (const campaign of activeCampaigns) {
    // Fetch today's spend from hourly metrics
    const [spendRow] = await db
      .select({
        totalSpend: sql<string>`COALESCE(SUM(${metricsHourly.spend}), 0)::numeric(14,2)::text`,
      })
      .from(metricsHourly)
      .where(
        and(
          eq(metricsHourly.campaignId, campaign.id),
          gte(metricsHourly.timestamp, todayStart),
        ),
      );

    const dailyBudget = Number(campaign.dailyBudget);
    const spendToday = Number(spendRow?.totalSpend ?? '0');
    const expectedSpendByNow =
      hoursElapsed > 0 ? (hoursElapsed / 24) * dailyBudget : 0;

    // Project total spend based on current rate
    const projectedTotalSpend =
      hoursElapsed > 0
        ? (spendToday / hoursElapsed) * 24
        : 0;

    const pacingPercent =
      expectedSpendByNow > 0
        ? spendToday / expectedSpendByNow
        : spendToday > 0
          ? 2 // Spending before expected = overspend signal
          : 1;

    const pacingStatus = computePacingStatus(pacingPercent);

    campaignPacings.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      dailyBudget,
      spendToday,
      expectedSpendByNow,
      projectedTotalSpend,
      pacingStatus,
      hoursRemaining,
      pacingPercent,
    });
  }

  const totalDailyBudget = campaignPacings.reduce(
    (sum, c) => sum + c.dailyBudget,
    0,
  );
  const totalSpendToday = campaignPacings.reduce(
    (sum, c) => sum + c.spendToday,
    0,
  );

  return {
    organizationId,
    timestamp: now,
    campaigns: campaignPacings,
    summary: {
      totalDailyBudget,
      totalSpendToday,
      onTrack: campaignPacings.filter(
        (c) => c.pacingStatus === 'on_track',
      ).length,
      underDelivery: campaignPacings.filter(
        (c) => c.pacingStatus === 'under_delivery',
      ).length,
      overspendRisk: campaignPacings.filter(
        (c) => c.pacingStatus === 'overspend_risk',
      ).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Monthly Pacing
// ---------------------------------------------------------------------------

export async function getMonthlyPacing(
  organizationId: string,
): Promise<MonthlyPacingReport> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // First day of current month and today
  const monthStart = new Date(year, month, 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysElapsed = dayOfMonth;
  const daysRemaining = daysInMonth - dayOfMonth;

  // Fetch active campaigns
  const activeCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.organizationId, organizationId),
      eq(campaigns.status, 'active'),
    ),
  });

  const campaignPacings: MonthlyCampaignPacing[] = [];

  for (const campaign of activeCampaigns) {
    // Fetch month-to-date spend from daily metrics
    const [spendRow] = await db
      .select({
        totalSpend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      })
      .from(metricsDaily)
      .where(
        and(
          eq(metricsDaily.campaignId, campaign.id),
          between(metricsDaily.date, monthStart, today),
        ),
      );

    const dailyBudget = Number(campaign.dailyBudget);
    const monthlyBudget = dailyBudget * daysInMonth;
    const spentThisMonth = Number(spendRow?.totalSpend ?? '0');

    // Project end-of-month spend based on daily average so far
    const dailyAverage =
      daysElapsed > 0 ? spentThisMonth / daysElapsed : 0;
    const projectedMonthEnd = spentThisMonth + dailyAverage * daysRemaining;
    const overUnderProjection = projectedMonthEnd - monthlyBudget;

    // Determine pacing status
    const expectedByNow = (daysElapsed / daysInMonth) * monthlyBudget;
    const pacingRatio =
      expectedByNow > 0 ? spentThisMonth / expectedByNow : 1;
    const pacingStatus = computePacingStatus(pacingRatio);

    campaignPacings.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      monthlyBudget,
      spentThisMonth,
      daysRemaining,
      daysElapsed,
      projectedMonthEnd,
      overUnderProjection,
      pacingStatus,
    });
  }

  const totalMonthlyBudget = campaignPacings.reduce(
    (sum, c) => sum + c.monthlyBudget,
    0,
  );
  const totalSpentThisMonth = campaignPacings.reduce(
    (sum, c) => sum + c.spentThisMonth,
    0,
  );
  const projectedMonthEnd = campaignPacings.reduce(
    (sum, c) => sum + c.projectedMonthEnd,
    0,
  );

  return {
    organizationId,
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    campaigns: campaignPacings,
    summary: {
      totalMonthlyBudget,
      totalSpentThisMonth,
      projectedMonthEnd,
      overUnderProjection: projectedMonthEnd - totalMonthlyBudget,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePacingStatus(pacingRatio: number): PacingStatus {
  if (pacingRatio > 1 + OVERSPEND_THRESHOLD) return 'overspend_risk';
  if (pacingRatio < 1 - UNDERDELIVERY_THRESHOLD) return 'under_delivery';
  return 'on_track';
}
