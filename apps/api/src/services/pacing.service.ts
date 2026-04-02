/**
 * Budget Pacing Service
 *
 * Tracks daily and monthly budget pacing for active campaigns,
 * providing projected spend, delivery status, and over/under alerts.
 */

import { db } from '@omni-ad/db';
import {
  auditLog,
  campaigns,
  metricsHourly,
  metricsDaily,
} from '@omni-ad/db/schema';
import { and, eq, sql, gte, between } from 'drizzle-orm';
import { createNotification } from './notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PacingStatus =
  | 'on_track'
  | 'under_delivery'
  | 'over_delivery'
  | 'overspend_risk'
  | 'critical_overspend';

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
  dailyTargetSpend: number;
  currentDailyAverage: number;
  projectedMonthEnd: number;
  overUnderProjection: number;
  pacingStatus: PacingStatus;
  adjustmentNeeded: string | null;
}

interface MonthlyPacingAdjustment {
  campaignId: string;
  campaignName: string;
  previousDailyBudget: number;
  newDailyBudget: number;
  reason: string;
}

export interface MonthlyPacingAdjustmentReport {
  organizationId: string;
  adjustments: MonthlyPacingAdjustment[];
  timestamp: Date;
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
const CRITICAL_OVERSPEND_THRESHOLD = 0.30;
const UNDERDELIVERY_THRESHOLD = 0.30;
const MONTH_END_WINDOW_DAYS = 5;

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

    // Daily target to stay on budget for remaining days
    const remainingBudget = monthlyBudget - spentThisMonth;
    const dailyTargetSpend =
      daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

    // Determine pacing status
    const expectedByNow = (daysElapsed / daysInMonth) * monthlyBudget;
    const pacingRatio =
      expectedByNow > 0 ? spentThisMonth / expectedByNow : 1;
    const pacingStatus = computeMonthlyPacingStatus(pacingRatio);

    // Calculate adjustment recommendation
    const adjustmentNeeded = computeAdjustmentRecommendation(
      dailyBudget,
      dailyTargetSpend,
      pacingStatus,
    );

    campaignPacings.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      monthlyBudget,
      spentThisMonth,
      daysRemaining,
      daysElapsed,
      dailyTargetSpend,
      currentDailyAverage: dailyAverage,
      projectedMonthEnd,
      overUnderProjection,
      pacingStatus,
      adjustmentNeeded,
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
  if (pacingRatio > 1 + CRITICAL_OVERSPEND_THRESHOLD)
    return 'critical_overspend';
  if (pacingRatio > 1 + OVERSPEND_THRESHOLD) return 'overspend_risk';
  if (pacingRatio < 1 - UNDERDELIVERY_THRESHOLD) return 'under_delivery';
  return 'on_track';
}

function computeMonthlyPacingStatus(pacingRatio: number): PacingStatus {
  if (pacingRatio > 1 + CRITICAL_OVERSPEND_THRESHOLD)
    return 'critical_overspend';
  if (pacingRatio > 1 + OVERSPEND_THRESHOLD) return 'over_delivery';
  if (pacingRatio < 1 - UNDERDELIVERY_THRESHOLD) return 'under_delivery';
  return 'on_track';
}

function computeAdjustmentRecommendation(
  currentDailyBudget: number,
  dailyTargetSpend: number,
  status: PacingStatus,
): string | null {
  if (status === 'on_track') return null;

  const diff = currentDailyBudget - dailyTargetSpend;

  if (
    status === 'over_delivery' ||
    status === 'overspend_risk' ||
    status === 'critical_overspend'
  ) {
    return `日次予算を${Math.abs(diff).toLocaleString('ja-JP')}円削減して${dailyTargetSpend.toLocaleString('ja-JP')}円に調整してください`;
  }

  if (status === 'under_delivery') {
    return `日次予算を${Math.abs(diff).toLocaleString('ja-JP')}円増加して${dailyTargetSpend.toLocaleString('ja-JP')}円に調整してください`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Auto-Adjust Monthly Pacing
// ---------------------------------------------------------------------------

/**
 * Automatically adjust daily budgets based on monthly pacing:
 * - If over_delivery: reduce daily budgets proportionally
 * - If under_delivery near month end (last 5 days): increase daily budgets
 * - Logs adjustments to audit trail and sends notifications
 */
export async function autoAdjustMonthlyPacing(
  organizationId: string,
): Promise<MonthlyPacingAdjustmentReport> {
  const pacingReport = await getMonthlyPacing(organizationId);
  const adjustments: MonthlyPacingAdjustment[] = [];

  for (const campaignPacing of pacingReport.campaigns) {
    const {
      campaignId,
      campaignName,
      pacingStatus,
      dailyTargetSpend,
      daysRemaining,
    } = campaignPacing;

    // Fetch current campaign to get the actual daily budget
    const campaign = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.id, campaignId),
        eq(campaigns.organizationId, organizationId),
      ),
    });

    if (!campaign) continue;

    const currentDailyBudget = Number(campaign.dailyBudget);
    let newDailyBudget: number | null = null;
    let reason = '';

    // Over-delivery: reduce daily budgets proportionally
    if (
      pacingStatus === 'over_delivery' ||
      pacingStatus === 'critical_overspend'
    ) {
      newDailyBudget = Math.max(0, dailyTargetSpend);
      reason = `月次ペーシングが予算超過 (${pacingStatus}): 日次予算を${currentDailyBudget.toLocaleString('ja-JP')}円から${newDailyBudget.toLocaleString('ja-JP')}円に削減`;
    }

    // Under-delivery near month end: increase daily budgets
    if (
      pacingStatus === 'under_delivery' &&
      daysRemaining <= MONTH_END_WINDOW_DAYS
    ) {
      newDailyBudget = dailyTargetSpend;
      reason = `月末${daysRemaining}日で配信不足: 日次予算を${currentDailyBudget.toLocaleString('ja-JP')}円から${newDailyBudget.toLocaleString('ja-JP')}円に増加`;
    }

    if (newDailyBudget === null) continue;

    // Skip if adjustment is negligible (< 1% difference)
    if (
      Math.abs(newDailyBudget - currentDailyBudget) /
        currentDailyBudget <
      0.01
    ) {
      continue;
    }

    // Apply budget adjustment
    await db
      .update(campaigns)
      .set({
        dailyBudget: newDailyBudget.toFixed(2),
        updatedAt: sql`now()`,
      })
      .where(eq(campaigns.id, campaignId));

    // Audit log
    await db.insert(auditLog).values({
      organizationId,
      userId: null,
      action: 'auto_adjust_monthly_pacing',
      entityType: 'campaign',
      entityId: campaignId,
      oldValue: { dailyBudget: currentDailyBudget },
      newValue: {
        dailyBudget: newDailyBudget,
        reason,
        pacingStatus,
      },
    });

    adjustments.push({
      campaignId,
      campaignName,
      previousDailyBudget: currentDailyBudget,
      newDailyBudget,
      reason,
    });
  }

  // Send summary notification if adjustments were made
  if (adjustments.length > 0) {
    const summaryLines = adjustments.map(
      (a) =>
        `${a.campaignName}: ${a.previousDailyBudget.toLocaleString('ja-JP')}円 -> ${a.newDailyBudget.toLocaleString('ja-JP')}円`,
    );

    await createNotification({
      organizationId,
      type: 'info',
      title: '月次予算ペーシング自動調整',
      message: `${adjustments.length}件のキャンペーンの日次予算が自動調整されました:\n${summaryLines.join('\n')}`,
      source: 'monthly_pacing_auto_adjust',
      metadata: {
        adjustmentCount: adjustments.length,
        adjustments,
      },
    });
  }

  return {
    organizationId,
    adjustments,
    timestamp: new Date(),
  };
}
