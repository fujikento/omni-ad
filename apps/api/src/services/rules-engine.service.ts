/**
 * Automation Rules Engine Service
 *
 * Evaluates user-defined automation rules against live campaign metrics,
 * executing configured actions (pause, budget adjust, notify, etc.) when
 * conditions are met, with cooldown and execution logging.
 */

import { db } from '@omni-ad/db';
import {
  automationRules,
  automationRuleExecutions,
  campaigns,
  metricsDaily,
  metricsHourly,
} from '@omni-ad/db/schema';
import type {
  RuleCondition,
  RuleAction,
  MetricThresholdCondition,
  BudgetPacingCondition,
  CreativeFatigueCondition,
  TimeBasedCondition,
} from '@omni-ad/db/schema';
import { and, desc, eq, sql, between, gte, inArray } from 'drizzle-orm';

import { pauseCampaign, resumeCampaign } from './campaign.service.js';
import {
  createNotification,
  sendSlackNotification,
  sendLineNotification,
} from './notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AutomationRuleSelect = typeof automationRules.$inferSelect;
type AutomationRuleInsert = typeof automationRules.$inferInsert;
type ExecutionInsert = typeof automationRuleExecutions.$inferInsert;

interface CreateRuleInput {
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  cooldownMinutes?: number;
  enabled?: boolean;
}

interface UpdateRuleInput {
  name?: string;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  cooldownMinutes?: number;
  enabled?: boolean;
}

interface CampaignMetrics {
  campaignId: string;
  organizationId: string;
  dailyBudget: number;
  cpa: number;
  roas: number;
  ctr: number;
  spend: number;
  impressions: number;
  conversions: number;
  spendToday: number;
  ctrValues7d: number[];
}

export interface EvaluationResult {
  ruleId: string;
  ruleName: string;
  campaignId: string;
  conditionsMatched: boolean;
  actionsExecuted: string[];
  status: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

export async function createRule(
  organizationId: string,
  userId: string,
  input: CreateRuleInput,
): Promise<AutomationRuleSelect> {
  const values: AutomationRuleInsert = {
    organizationId,
    name: input.name,
    conditions: input.conditions,
    actions: input.actions,
    cooldownMinutes: input.cooldownMinutes ?? 60,
    enabled: input.enabled ?? true,
    createdBy: userId,
  };

  const [inserted] = await db
    .insert(automationRules)
    .values(values)
    .returning();

  if (!inserted) {
    throw new Error('Failed to insert automation rule');
  }

  return inserted;
}

export async function listRules(
  organizationId: string,
  limit = 100,
): Promise<AutomationRuleSelect[]> {
  return db.query.automationRules.findMany({
    where: eq(automationRules.organizationId, organizationId),
    orderBy: [desc(automationRules.createdAt)],
    limit,
  });
}

export async function getRule(
  ruleId: string,
  organizationId: string,
): Promise<AutomationRuleSelect | undefined> {
  return db.query.automationRules.findFirst({
    where: and(
      eq(automationRules.id, ruleId),
      eq(automationRules.organizationId, organizationId),
    ),
  });
}

export async function updateRule(
  ruleId: string,
  organizationId: string,
  input: UpdateRuleInput,
): Promise<AutomationRuleSelect> {
  const updateSet: Record<string, unknown> = {
    updatedAt: sql`now()`,
  };

  if (input.name !== undefined) updateSet['name'] = input.name;
  if (input.conditions !== undefined) updateSet['conditions'] = input.conditions;
  if (input.actions !== undefined) updateSet['actions'] = input.actions;
  if (input.cooldownMinutes !== undefined) {
    updateSet['cooldownMinutes'] = input.cooldownMinutes;
  }
  if (input.enabled !== undefined) updateSet['enabled'] = input.enabled;

  const [updated] = await db
    .update(automationRules)
    .set(updateSet)
    .where(
      and(
        eq(automationRules.id, ruleId),
        eq(automationRules.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new RuleNotFoundError(ruleId);
  }

  return updated;
}

export async function deleteRule(
  ruleId: string,
  organizationId: string,
): Promise<AutomationRuleSelect> {
  // Soft delete by disabling
  const [updated] = await db
    .update(automationRules)
    .set({ enabled: false, updatedAt: sql`now()` })
    .where(
      and(
        eq(automationRules.id, ruleId),
        eq(automationRules.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new RuleNotFoundError(ruleId);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Execution History
// ---------------------------------------------------------------------------

export async function listExecutions(
  organizationId: string,
  ruleId?: string,
  limit = 50,
): Promise<(typeof automationRuleExecutions.$inferSelect)[]> {
  const conditions = [
    eq(automationRuleExecutions.organizationId, organizationId),
  ];

  if (ruleId) {
    conditions.push(eq(automationRuleExecutions.ruleId, ruleId));
  }

  return db.query.automationRuleExecutions.findMany({
    where: and(...conditions),
    orderBy: [desc(automationRuleExecutions.executedAt)],
    limit,
  });
}

// ---------------------------------------------------------------------------
// Rules Evaluation Engine
// ---------------------------------------------------------------------------

export async function evaluateRules(
  organizationId: string,
): Promise<EvaluationResult[]> {
  // 1. Fetch all enabled rules for this organization
  const rules = await db.query.automationRules.findMany({
    where: and(
      eq(automationRules.organizationId, organizationId),
      eq(automationRules.enabled, true),
    ),
  });

  if (rules.length === 0) return [];

  // 2. Fetch all active campaigns with latest metrics
  const activeCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.organizationId, organizationId),
      eq(campaigns.status, 'active'),
    ),
  });

  if (activeCampaigns.length === 0) return [];

  // 3. Batch-fetch metrics for all active campaigns (3 queries total)
  const metricsById = await fetchCampaignMetricsBatch(
    activeCampaigns.map((c) => c.id),
    organizationId,
  );

  // 4. Evaluate each rule against each campaign
  const results: EvaluationResult[] = [];

  for (const rule of rules) {
    // Check cooldown
    if (!hasCooldownPassed(rule)) {
      continue;
    }

    for (const campaign of activeCampaigns) {
      const metrics = metricsById.get(campaign.id);
      if (!metrics) continue;
      const result = await evaluateSingleRule(rule, metrics, organizationId);
      results.push(result);
    }
  }

  return results;
}

async function evaluateSingleRule(
  rule: AutomationRuleSelect,
  metrics: CampaignMetrics,
  organizationId: string,
): Promise<EvaluationResult> {
  const conditions = rule.conditions as RuleCondition[];
  const actions = rule.actions as RuleAction[];

  // Evaluate all conditions -- all must match
  const allMatch = conditions.every((condition) =>
    evaluateCondition(condition, metrics),
  );

  if (!allMatch) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      campaignId: metrics.campaignId,
      conditionsMatched: false,
      actionsExecuted: [],
      status: 'skipped',
    };
  }

  // Execute all actions
  const executedActions: string[] = [];
  const errors: string[] = [];

  for (const action of actions) {
    try {
      await executeAction(action, metrics.campaignId, organizationId);
      executedActions.push(action.type);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${action.type}: ${message}`);
    }
  }

  const status = errors.length > 0 ? 'failed' : 'success';
  const errorMessage =
    errors.length > 0 ? errors.join('; ') : undefined;

  // Log execution
  const executionValues: ExecutionInsert = {
    ruleId: rule.id,
    organizationId,
    campaignId: metrics.campaignId,
    conditionSnapshot: {
      cpa: metrics.cpa,
      roas: metrics.roas,
      ctr: metrics.ctr,
      spend: metrics.spend,
      impressions: metrics.impressions,
      conversions: metrics.conversions,
      spendToday: metrics.spendToday,
    },
    actionsExecuted: executedActions.map((type) => ({ type })),
    status,
    errorMessage: errorMessage ?? null,
  };

  await db.insert(automationRuleExecutions).values(executionValues);

  // Update rule trigger count and timestamp
  await db
    .update(automationRules)
    .set({
      lastTriggeredAt: sql`now()`,
      triggerCount: sql`${automationRules.triggerCount} + 1`,
      updatedAt: sql`now()`,
    })
    .where(eq(automationRules.id, rule.id));

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    campaignId: metrics.campaignId,
    conditionsMatched: true,
    actionsExecuted: executedActions,
    status,
    errorMessage,
  };
}

// ---------------------------------------------------------------------------
// Condition Evaluation
// ---------------------------------------------------------------------------

export function evaluateCondition(
  condition: RuleCondition,
  metrics: CampaignMetrics,
): boolean {
  switch (condition.type) {
    case 'metric_threshold':
      return evaluateMetricThreshold(condition, metrics);
    case 'frequency_threshold':
      // Frequency requires ad-level data not in standard metrics
      return false;
    case 'budget_pacing':
      return evaluateBudgetPacing(condition, metrics);
    case 'creative_fatigue':
      return evaluateCreativeFatigue(condition, metrics);
    case 'time_based':
      return evaluateTimeBased(condition);
    case 'platform_specific':
      // Platform-specific conditions require platform adapter data
      return false;
  }
}

function evaluateMetricThreshold(
  condition: MetricThresholdCondition,
  metrics: CampaignMetrics,
): boolean {
  const metricValue = getMetricValue(condition.metric, metrics);
  return compareValues(metricValue, condition.operator, condition.value);
}

function getMetricValue(
  metric: MetricThresholdCondition['metric'],
  metrics: CampaignMetrics,
): number {
  switch (metric) {
    case 'cpa':
      return metrics.cpa;
    case 'roas':
      return metrics.roas;
    case 'ctr':
      return metrics.ctr;
    case 'spend':
      return metrics.spend;
    case 'impressions':
      return metrics.impressions;
    case 'conversions':
      return metrics.conversions;
  }
}

function compareValues(
  actual: number,
  operator: MetricThresholdCondition['operator'],
  target: number,
): boolean {
  switch (operator) {
    case 'gt':
      return actual > target;
    case 'lt':
      return actual < target;
    case 'gte':
      return actual >= target;
    case 'lte':
      return actual <= target;
  }
}

function evaluateBudgetPacing(
  condition: BudgetPacingCondition,
  metrics: CampaignMetrics,
): boolean {
  if (metrics.dailyBudget <= 0) return false;

  const now = new Date();
  const hoursElapsed = now.getHours() + now.getMinutes() / 60;
  const expectedSpend = (hoursElapsed / 24) * metrics.dailyBudget;

  if (expectedSpend <= 0) return false;

  const pacingRatio = metrics.spendToday / expectedSpend;

  if (condition.pace === 'over') {
    // Overpacing: actual spend exceeds expected by threshold%
    return pacingRatio > 1 + condition.threshold / 100;
  }

  // Underpacing: actual spend is below expected by threshold%
  return pacingRatio < 1 - condition.threshold / 100;
}

function evaluateCreativeFatigue(
  condition: CreativeFatigueCondition,
  metrics: CampaignMetrics,
): boolean {
  const recentCtr = metrics.ctrValues7d.slice(-condition.days);
  if (recentCtr.length < 2) return false;

  const first = recentCtr[0];
  const last = recentCtr[recentCtr.length - 1];
  if (!first || first <= 0 || last === undefined) return false;

  const declinePercent = ((first - last) / first) * 100;
  return declinePercent >= condition.ctrDeclinePercent;
}

function evaluateTimeBased(condition: TimeBasedCondition): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  const dayMatch = condition.dayOfWeek.includes(dayOfWeek);
  const [startHour, endHour] = condition.hourRange;
  const hourMatch = hour >= startHour && hour < endHour;

  return dayMatch && hourMatch;
}

// ---------------------------------------------------------------------------
// Action Execution
// ---------------------------------------------------------------------------

export async function executeAction(
  action: RuleAction,
  campaignId: string,
  organizationId: string,
): Promise<void> {
  switch (action.type) {
    case 'pause_campaign':
      await pauseCampaign(campaignId, organizationId);
      return;

    case 'resume_campaign':
      await resumeCampaign(campaignId, organizationId);
      return;

    case 'adjust_budget':
      await adjustCampaignBudget(
        campaignId,
        organizationId,
        action.adjustmentType,
        action.value,
        action.direction,
      );
      return;

    case 'rotate_creative':
      // Creative rotation requires platform adapter integration
      // For now, log the intent and create a notification
      await createNotification({
        organizationId,
        type: 'info',
        title: 'クリエイティブローテーション推奨',
        message: `キャンペーン ${campaignId} のクリエイティブ更新が推奨されています`,
        source: 'rules_engine',
        actionUrl: `/campaigns/${campaignId}/creatives`,
        metadata: { campaignId, action: 'rotate_creative' },
      });
      return;

    case 'send_notification':
      await dispatchNotification(
        action.channels,
        action.message,
        organizationId,
        campaignId,
      );
      return;

    case 'adjust_bid':
      // Bid adjustment requires platform adapter integration
      await createNotification({
        organizationId,
        type: 'info',
        title: '入札調整推奨',
        message: `キャンペーン ${campaignId} の入札 ${action.direction === 'increase' ? '引き上げ' : '引き下げ'} ${action.value}% が推奨されています`,
        source: 'rules_engine',
        actionUrl: `/campaigns/${campaignId}`,
        metadata: { campaignId, action: 'adjust_bid', ...action },
      });
      return;
  }
}

async function adjustCampaignBudget(
  campaignId: string,
  organizationId: string,
  adjustmentType: 'percent' | 'absolute',
  value: number,
  direction: 'increase' | 'decrease',
): Promise<void> {
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.organizationId, organizationId),
    ),
  });

  if (!campaign) return;

  const currentBudget = Number(campaign.dailyBudget);
  let newBudget: number;

  if (adjustmentType === 'percent') {
    const factor = direction === 'increase'
      ? 1 + value / 100
      : 1 - value / 100;
    newBudget = currentBudget * factor;
  } else {
    newBudget = direction === 'increase'
      ? currentBudget + value
      : currentBudget - value;
  }

  // Ensure budget stays positive
  newBudget = Math.max(newBudget, 0.01);

  await db
    .update(campaigns)
    .set({
      dailyBudget: newBudget.toFixed(2),
      updatedAt: sql`now()`,
    })
    .where(eq(campaigns.id, campaignId));
}

async function dispatchNotification(
  channels: ('slack' | 'line' | 'email' | 'dashboard')[],
  message: string,
  organizationId: string,
  campaignId: string,
): Promise<void> {
  // Always create a dashboard notification
  if (channels.includes('dashboard')) {
    await createNotification({
      organizationId,
      type: 'alert',
      title: 'ルールエンジン通知',
      message,
      source: 'rules_engine',
      actionUrl: `/campaigns/${campaignId}`,
      metadata: { campaignId },
    });
  }

  // Slack/LINE webhooks would be dispatched here via notification preferences
  // The notification service handles channel routing
  if (channels.includes('slack')) {
    // Webhook URL would come from org notification preferences
    await sendSlackNotification(
      process.env['SLACK_WEBHOOK_URL'] ?? '',
      message,
    ).catch(() => {
      // Silently fail for webhook errors; logged in notification service
    });
  }

  if (channels.includes('line')) {
    await sendLineNotification(
      process.env['LINE_NOTIFY_TOKEN'] ?? '',
      message,
    ).catch(() => {
      // Silently fail for webhook errors
    });
  }
}

// ---------------------------------------------------------------------------
// Metrics Fetching
// ---------------------------------------------------------------------------

interface DailyRow {
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: string;
  revenue: string;
}

/**
 * Batch-fetch campaign metrics for many campaigns in 3 queries total
 * (daily metrics, today's hourly spend, campaign budgets) instead of
 * 3N queries. Returns a Map keyed by campaignId for O(1) lookup.
 */
async function fetchCampaignMetricsBatch(
  campaignIds: string[],
  organizationId: string,
): Promise<Map<string, CampaignMetrics>> {
  const result = new Map<string, CampaignMetrics>();
  if (campaignIds.length === 0) return result;

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [dailyByCampaign, hourlyByCampaign, budgetByCampaign] =
    await Promise.all([
      fetchDailyRowsBatch(campaignIds, sevenDaysAgo, today),
      fetchHourlySpendBatch(campaignIds, todayStart),
      fetchCampaignBudgets(campaignIds),
    ]);

  for (const campaignId of campaignIds) {
    const rows = dailyByCampaign.get(campaignId) ?? [];
    result.set(
      campaignId,
      buildMetricsBundle({
        campaignId,
        organizationId,
        rows,
        dailyBudget: budgetByCampaign.get(campaignId) ?? 0,
        spendToday: hourlyByCampaign.get(campaignId) ?? 0,
      }),
    );
  }

  return result;
}

async function fetchDailyRowsBatch(
  campaignIds: string[],
  sevenDaysAgo: string,
  today: string,
): Promise<Map<string, DailyRow[]>> {
  const rows = await db
    .select({
      campaignId: metricsDaily.campaignId,
      date: metricsDaily.date,
      impressions: sql<number>`COALESCE(${metricsDaily.impressions}, 0)::int`,
      clicks: sql<number>`COALESCE(${metricsDaily.clicks}, 0)::int`,
      conversions: sql<number>`COALESCE(${metricsDaily.conversions}, 0)::int`,
      spend: sql<string>`COALESCE(${metricsDaily.spend}, 0)::numeric(14,2)::text`,
      revenue: sql<string>`COALESCE(${metricsDaily.revenue}, 0)::numeric(14,2)::text`,
    })
    .from(metricsDaily)
    .where(
      and(
        inArray(metricsDaily.campaignId, campaignIds),
        between(metricsDaily.date, sevenDaysAgo, today),
      ),
    )
    .orderBy(metricsDaily.campaignId, metricsDaily.date);

  const grouped = new Map<string, DailyRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.campaignId) ?? [];
    list.push(row);
    grouped.set(row.campaignId, list);
  }
  return grouped;
}

async function fetchHourlySpendBatch(
  campaignIds: string[],
  todayStart: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      campaignId: metricsHourly.campaignId,
      totalSpend: sql<string>`COALESCE(SUM(${metricsHourly.spend}), 0)::numeric(14,2)::text`,
    })
    .from(metricsHourly)
    .where(
      and(
        inArray(metricsHourly.campaignId, campaignIds),
        gte(metricsHourly.timestamp, todayStart),
      ),
    )
    .groupBy(metricsHourly.campaignId);

  const spendByCampaign = new Map<string, number>();
  for (const row of rows) {
    spendByCampaign.set(row.campaignId, Number(row.totalSpend));
  }
  return spendByCampaign;
}

async function fetchCampaignBudgets(
  campaignIds: string[],
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      id: campaigns.id,
      dailyBudget: campaigns.dailyBudget,
    })
    .from(campaigns)
    .where(inArray(campaigns.id, campaignIds));

  const budgetByCampaign = new Map<string, number>();
  for (const row of rows) {
    budgetByCampaign.set(row.id, Number(row.dailyBudget));
  }
  return budgetByCampaign;
}

function buildMetricsBundle(args: {
  campaignId: string;
  organizationId: string;
  rows: DailyRow[];
  dailyBudget: number;
  spendToday: number;
}): CampaignMetrics {
  const { campaignId, organizationId, rows, dailyBudget, spendToday } = args;

  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalSpend = 0;
  let totalRevenue = 0;
  const ctrValues7d: number[] = [];

  for (const r of rows) {
    totalImpressions += r.impressions;
    totalClicks += r.clicks;
    totalConversions += r.conversions;
    totalSpend += Number(r.spend);
    totalRevenue += Number(r.revenue);
    ctrValues7d.push(r.impressions > 0 ? r.clicks / r.impressions : 0);
  }

  return {
    campaignId,
    organizationId,
    dailyBudget,
    cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
    roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    spend: totalSpend,
    impressions: totalImpressions,
    conversions: totalConversions,
    spendToday,
    ctrValues7d,
  };
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasCooldownPassed(rule: AutomationRuleSelect): boolean {
  if (!rule.lastTriggeredAt) return true;

  const cooldownMs = rule.cooldownMinutes * 60 * 1000;
  const elapsed = Date.now() - new Date(rule.lastTriggeredAt).getTime();
  return elapsed >= cooldownMs;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RuleNotFoundError extends Error {
  constructor(ruleId: string) {
    super(`Automation rule not found: ${ruleId}`);
    this.name = 'RuleNotFoundError';
  }
}
