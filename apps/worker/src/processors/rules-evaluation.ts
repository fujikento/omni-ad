import { evaluateRulesJobSchema } from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import {
  automationRules,
  automationRuleExecutions,
  campaigns,
  metricsDaily,
  metricsHourly,
} from '@omni-ad/db/schema';
import type { RuleCondition, RuleAction } from '@omni-ad/db/schema';
import { and, eq, sql, between, gte } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(
      `[rules-evaluation] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  warn(message, meta) {
    process.stdout.write(
      `[rules-evaluation] WARN: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  error(message, meta) {
    process.stderr.write(
      `[rules-evaluation] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignMetrics {
  campaignId: string;
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

// ---------------------------------------------------------------------------
// Main Processor
// ---------------------------------------------------------------------------

export async function processRulesEvaluation(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = evaluateRulesJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const { organizationId } = parsed.data;

  logger.info('Starting rules evaluation', { organizationId });

  // Fetch enabled rules
  const rules = await db.query.automationRules.findMany({
    where: and(
      eq(automationRules.organizationId, organizationId),
      eq(automationRules.enabled, true),
    ),
  });

  if (rules.length === 0) {
    logger.info('No enabled rules found', { organizationId });
    return;
  }

  // Fetch active campaigns
  const activeCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.organizationId, organizationId),
      eq(campaigns.status, 'active'),
    ),
  });

  if (activeCampaigns.length === 0) {
    logger.info('No active campaigns', { organizationId });
    return;
  }

  // Fetch metrics for each campaign
  const metricsMap = await fetchAllCampaignMetrics(
    activeCampaigns.map((c) => ({ id: c.id, dailyBudget: Number(c.dailyBudget) })),
  );

  let triggeredCount = 0;
  let failedCount = 0;

  for (const rule of rules) {
    // Check cooldown
    if (rule.lastTriggeredAt) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      const elapsed = Date.now() - new Date(rule.lastTriggeredAt).getTime();
      if (elapsed < cooldownMs) continue;
    }

    const conditions = rule.conditions as RuleCondition[];
    const actions = rule.actions as RuleAction[];

    for (const metrics of metricsMap) {
      const allMatch = conditions.every((c) => evaluateCondition(c, metrics));
      if (!allMatch) continue;

      // Execute actions
      const executedActions: string[] = [];
      const errors: string[] = [];

      for (const action of actions) {
        try {
          await executeAction(action, metrics.campaignId, organizationId);
          executedActions.push(action.type);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${action.type}: ${msg}`);
        }
      }

      const status = errors.length > 0 ? 'failed' : 'success';
      if (errors.length > 0) failedCount++;
      triggeredCount++;

      // Log execution
      await db.insert(automationRuleExecutions).values({
        ruleId: rule.id,
        organizationId,
        campaignId: metrics.campaignId,
        conditionSnapshot: {
          cpa: metrics.cpa,
          roas: metrics.roas,
          ctr: metrics.ctr,
          spend: metrics.spend,
        },
        actionsExecuted: executedActions.map((type) => ({ type })),
        status: status as 'success' | 'failed',
        errorMessage: errors.length > 0 ? errors.join('; ') : null,
      });

      // Update trigger count
      await db
        .update(automationRules)
        .set({
          lastTriggeredAt: sql`now()`,
          triggerCount: sql`${automationRules.triggerCount} + 1`,
          updatedAt: sql`now()`,
        })
        .where(eq(automationRules.id, rule.id));
    }
  }

  logger.info('Rules evaluation completed', {
    organizationId,
    rulesEvaluated: rules.length,
    triggered: triggeredCount,
    failed: failedCount,
  });
}

// ---------------------------------------------------------------------------
// Condition Evaluation
// ---------------------------------------------------------------------------

function evaluateCondition(
  condition: RuleCondition,
  metrics: CampaignMetrics,
): boolean {
  switch (condition.type) {
    case 'metric_threshold': {
      const value = getMetricValue(condition.metric, metrics);
      return compareValues(value, condition.operator, condition.value);
    }
    case 'budget_pacing': {
      if (metrics.dailyBudget <= 0) return false;
      const now = new Date();
      const hoursElapsed = now.getHours() + now.getMinutes() / 60;
      const expected = (hoursElapsed / 24) * metrics.dailyBudget;
      if (expected <= 0) return false;
      const ratio = metrics.spendToday / expected;
      return condition.pace === 'over'
        ? ratio > 1 + condition.threshold / 100
        : ratio < 1 - condition.threshold / 100;
    }
    case 'creative_fatigue': {
      const recent = metrics.ctrValues7d.slice(-condition.days);
      if (recent.length < 2) return false;
      const first = recent[0];
      const last = recent[recent.length - 1];
      if (!first || first <= 0 || last === undefined) return false;
      const decline = ((first - last) / first) * 100;
      return decline >= condition.ctrDeclinePercent;
    }
    case 'time_based': {
      const now = new Date();
      const dayMatch = condition.dayOfWeek.includes(now.getDay());
      const hour = now.getHours();
      const [start, end] = condition.hourRange;
      return dayMatch && hour >= start && hour < end;
    }
    case 'frequency_threshold':
    case 'platform_specific':
      return false;
  }
}

function getMetricValue(
  metric: 'cpa' | 'roas' | 'ctr' | 'spend' | 'impressions' | 'conversions',
  metrics: CampaignMetrics,
): number {
  return metrics[metric];
}

function compareValues(
  actual: number,
  operator: 'gt' | 'lt' | 'gte' | 'lte',
  target: number,
): boolean {
  switch (operator) {
    case 'gt': return actual > target;
    case 'lt': return actual < target;
    case 'gte': return actual >= target;
    case 'lte': return actual <= target;
  }
}

// ---------------------------------------------------------------------------
// Action Execution
// ---------------------------------------------------------------------------

async function executeAction(
  action: RuleAction,
  campaignId: string,
  organizationId: string,
): Promise<void> {
  const scoped = and(
    eq(campaigns.id, campaignId),
    eq(campaigns.organizationId, organizationId),
  );

  switch (action.type) {
    case 'pause_campaign':
      await db
        .update(campaigns)
        .set({ status: 'paused', updatedAt: sql`now()` })
        .where(scoped);
      logger.info('Campaign paused by rule', { campaignId });
      return;

    case 'resume_campaign':
      await db
        .update(campaigns)
        .set({ status: 'active', updatedAt: sql`now()` })
        .where(scoped);
      logger.info('Campaign resumed by rule', { campaignId });
      return;

    case 'adjust_budget': {
      const campaign = await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, organizationId),
        ),
      });
      if (!campaign) return;

      const current = Number(campaign.dailyBudget);
      let newBudget: number;
      if (action.adjustmentType === 'percent') {
        const factor = action.direction === 'increase'
          ? 1 + action.value / 100
          : 1 - action.value / 100;
        newBudget = current * factor;
      } else {
        newBudget = action.direction === 'increase'
          ? current + action.value
          : current - action.value;
      }
      newBudget = Math.max(newBudget, 0.01);

      await db
        .update(campaigns)
        .set({ dailyBudget: newBudget.toFixed(2), updatedAt: sql`now()` })
        .where(scoped);
      logger.info('Budget adjusted by rule', {
        campaignId,
        previous: current,
        new: newBudget,
      });
      return;
    }

    case 'send_notification':
      logger.info('Notification action triggered', {
        campaignId,
        channels: action.channels,
        message: action.message,
      });
      return;

    case 'rotate_creative':
      logger.info('Creative rotation recommended', { campaignId });
      return;

    case 'adjust_bid':
      logger.info('Bid adjustment recommended', {
        campaignId,
        direction: action.direction,
        value: action.value,
      });
      return;
  }
}

// ---------------------------------------------------------------------------
// Metrics Fetching
// ---------------------------------------------------------------------------

async function fetchAllCampaignMetrics(
  campaignInfos: { id: string; dailyBudget: number }[],
): Promise<CampaignMetrics[]> {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const results: CampaignMetrics[] = [];

  for (const info of campaignInfos) {
    const dailyRows = await db
      .select({
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
          eq(metricsDaily.campaignId, info.id),
          between(metricsDaily.date, sevenDaysAgo, today),
        ),
      )
      .orderBy(metricsDaily.date);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [hourlySpend] = await db
      .select({
        totalSpend: sql<string>`COALESCE(SUM(${metricsHourly.spend}), 0)::numeric(14,2)::text`,
      })
      .from(metricsHourly)
      .where(
        and(
          eq(metricsHourly.campaignId, info.id),
          gte(metricsHourly.timestamp, todayStart),
        ),
      );

    const totalImpressions = dailyRows.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = dailyRows.reduce((s, r) => s + r.clicks, 0);
    const totalConversions = dailyRows.reduce((s, r) => s + r.conversions, 0);
    const totalSpend = dailyRows.reduce((s, r) => s + Number(r.spend), 0);
    const totalRevenue = dailyRows.reduce((s, r) => s + Number(r.revenue), 0);

    results.push({
      campaignId: info.id,
      dailyBudget: info.dailyBudget,
      cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      spend: totalSpend,
      impressions: totalImpressions,
      conversions: totalConversions,
      spendToday: Number(hourlySpend?.totalSpend ?? '0'),
      ctrValues7d: dailyRows.map((r) =>
        r.impressions > 0 ? r.clicks / r.impressions : 0,
      ),
    });
  }

  return results;
}
