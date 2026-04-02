/**
 * Dashboard Aggregation Service
 *
 * Powers the home dashboard with real-time overview, campaign health,
 * activity feed, and pending AI decisions.
 */

import { db } from '@omni-ad/db';
import {
  auditLog,
  campaigns,
  metricsDaily,
  aiDecisionLog,
} from '@omni-ad/db/schema';
import { and, desc, eq, sql, count } from 'drizzle-orm';
import { computeHealthScore } from './antifragile.service.js';
import type { CampaignHealthScore } from './antifragile.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardOverview {
  todaySpend: number;
  todayRevenue: number;
  todayRoas: number;
  activeCampaignCount: number;
  alerts: DashboardAlert[];
  budgetPacing: BudgetPacingInfo;
}

interface DashboardAlert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
}

interface BudgetPacingInfo {
  totalDailyBudget: number;
  todaySpend: number;
  pacingPercent: number;
  status: 'on_track' | 'underspend' | 'overspend';
}

export interface RecentActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
}

export interface PendingDecision {
  id: string;
  decisionType: string;
  campaignId: string | null;
  reasoning: string;
  confidenceScore: number;
  createdAt: Date;
}

interface ActiveABTest {
  id: string;
  name: string;
  status: string;
  startedAt: Date;
  variantCount: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DashboardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardError';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the main dashboard overview for an organization.
 */
export async function getDashboardOverview(
  organizationId: string,
): Promise<DashboardOverview> {
  const today = new Date().toISOString().slice(0, 10);

  // Run queries in parallel
  const [todayMetrics, activeCampaigns, totalBudget] = await Promise.all([
    // Today's aggregate metrics across all campaigns
    db
      .select({
        totalSpend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
        totalRevenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
      })
      .from(metricsDaily)
      .innerJoin(campaigns, eq(metricsDaily.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.organizationId, organizationId),
          eq(metricsDaily.date, today),
        ),
      ),

    // Active campaign count
    db
      .select({ value: count() })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.organizationId, organizationId),
          eq(campaigns.status, 'active'),
        ),
      ),

    // Sum of daily budgets for active campaigns
    db
      .select({
        total: sql<string>`COALESCE(SUM(${campaigns.dailyBudget}), 0)::numeric(14,2)::text`,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.organizationId, organizationId),
          eq(campaigns.status, 'active'),
        ),
      ),
  ]);

  const todaySpend = Number(todayMetrics[0]?.totalSpend ?? '0');
  const todayRevenue = Number(todayMetrics[0]?.totalRevenue ?? '0');
  const todayRoas = todaySpend > 0 ? todayRevenue / todaySpend : 0;
  const activeCampaignCount = activeCampaigns[0]?.value ?? 0;
  const totalDailyBudget = Number(totalBudget[0]?.total ?? '0');

  // Budget pacing
  const now = new Date();
  const hoursElapsed = now.getHours() + now.getMinutes() / 60;
  const expectedPacing = hoursElapsed / 24;
  const actualPacing = totalDailyBudget > 0 ? todaySpend / totalDailyBudget : 0;
  const pacingPercent = expectedPacing > 0 ? (actualPacing / expectedPacing) * 100 : 0;

  let pacingStatus: BudgetPacingInfo['status'] = 'on_track';
  if (pacingPercent < 70) pacingStatus = 'underspend';
  if (pacingPercent > 130) pacingStatus = 'overspend';

  // Build alerts from pacing
  const alerts: DashboardAlert[] = [];
  if (pacingStatus === 'overspend') {
    alerts.push({
      type: 'budget_pacing',
      severity: 'warning',
      message: `Budget pacing at ${Math.round(pacingPercent)}% -- overspending today`,
      timestamp: now,
    });
  }
  if (pacingStatus === 'underspend' && hoursElapsed > 6) {
    alerts.push({
      type: 'budget_pacing',
      severity: 'info',
      message: `Budget pacing at ${Math.round(pacingPercent)}% -- delivery may be slow`,
      timestamp: now,
    });
  }

  return {
    todaySpend,
    todayRevenue,
    todayRoas: Math.round(todayRoas * 100) / 100,
    activeCampaignCount,
    alerts,
    budgetPacing: {
      totalDailyBudget,
      todaySpend,
      pacingPercent: Math.round(pacingPercent),
      status: pacingStatus,
    },
  };
}

/**
 * Returns health scores for all active campaigns in an organization.
 */
export async function getCampaignHealthScores(
  organizationId: string,
): Promise<CampaignHealthScore[]> {
  const activeCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        eq(campaigns.status, 'active'),
      ),
    );

  // Compute health scores in parallel (bounded concurrency)
  const CONCURRENCY = 5;
  const results: CampaignHealthScore[] = [];

  for (let i = 0; i < activeCampaigns.length; i += CONCURRENCY) {
    const batch = activeCampaigns.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((c) => computeHealthScore(c.id)),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Returns recent audit log entries for the organization.
 */
export async function getRecentActivity(
  organizationId: string,
  limit = 20,
): Promise<RecentActivityEntry[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      timestamp: auditLog.timestamp,
      newValue: auditLog.newValue,
    })
    .from(auditLog)
    .where(eq(auditLog.organizationId, organizationId))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    timestamp: row.timestamp,
    metadata: row.newValue as Record<string, unknown> | null,
  }));
}

/**
 * Returns pending AI autopilot decisions awaiting approval.
 */
export async function getPendingDecisions(
  organizationId: string,
): Promise<PendingDecision[]> {
  const rows = await db
    .select({
      id: aiDecisionLog.id,
      decisionType: aiDecisionLog.decisionType,
      campaignId: aiDecisionLog.campaignId,
      reasoning: aiDecisionLog.reasoning,
      confidenceScore: aiDecisionLog.confidenceScore,
      createdAt: aiDecisionLog.createdAt,
    })
    .from(aiDecisionLog)
    .where(
      and(
        eq(aiDecisionLog.organizationId, organizationId),
        eq(aiDecisionLog.status, 'pending_approval'),
      ),
    )
    .orderBy(desc(aiDecisionLog.createdAt))
    .limit(50);

  return rows;
}

/**
 * Returns active A/B tests for the organization.
 * Placeholder until the AB test service is fully integrated.
 */
export async function getActiveABTests(
  organizationId: string,
): Promise<ActiveABTest[]> {
  // The AB test service exists but doesn't have a list query yet.
  // Return an empty array for now -- this will be wired once the
  // ab-test schema has a proper status field to query.
  void organizationId;
  return [];
}
