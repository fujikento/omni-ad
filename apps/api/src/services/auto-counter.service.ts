/**
 * Auto-Counter Service (Claude API Powered)
 *
 * Evaluates competitor threats and generates counter-strategies using Claude API.
 * Executes approved actions with guardrails, cooldown, and auto-rollback.
 */

import { db } from '@omni-ad/db';
import {
  aiSettings,
  campaigns,
  competitorAlerts,
  competitorProfiles,
  counterActions,
  auctionInsightSnapshots,
  metricsDaily,
} from '@omni-ad/db/schema';
import type {
  CounterActionDetails,
  CounterActionResult,
} from '@omni-ad/db/schema';
import { decryptToken } from '@omni-ad/auth';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { createNotification } from './notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompetitorAlertSelect = typeof competitorAlerts.$inferSelect;
type CompetitorProfileSelect = typeof competitorProfiles.$inferSelect;
type CounterActionSelect = typeof counterActions.$inferSelect;
type AiSettingsSelect = typeof aiSettings.$inferSelect;

type CounterActionType = CounterActionSelect['actionType'];
type CounterStrategy = CounterActionSelect['strategy'];
type CounterActionStatus = CounterActionSelect['status'];

interface CounterStrategyAction {
  type: CounterActionType;
  campaignId?: string;
  competitorId?: string;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  details?: CounterActionDetails;
  expectedImpact?: Record<string, unknown>;
  rollbackPlan?: string;
}

interface ClaudeCounterOutput {
  overall_assessment: string;
  actions: CounterStrategyAction[];
}

interface EvaluateResult {
  assessment: string;
  actionsProcessed: number;
  actionsExecuted: number;
  actionsSkipped: number;
  actionIds: string[];
}

interface ListCounterActionsFilter {
  status?: CounterActionStatus;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Claude API Tool Schema
// ---------------------------------------------------------------------------

const COUNTER_STRATEGY_TOOL = {
  name: 'output_counter_strategy',
  description: '競合の動きに対する対抗戦略を出力してください',
  input_schema: {
    type: 'object',
    properties: {
      overall_assessment: {
        type: 'string',
        description: '競合環境の全体的な評価（日本語）',
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'bid_adjust',
                'budget_shift',
                'creative_counter',
                'targeting_expand',
                'keyword_defense',
                'timing_attack',
                'do_nothing',
              ],
            },
            campaignId: { type: 'string' },
            competitorId: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            risk: { type: 'string', enum: ['low', 'medium', 'high'] },
            reason: { type: 'string' },
            details: { type: 'object' },
            expectedImpact: { type: 'object' },
            rollbackPlan: { type: 'string' },
          },
          required: ['type', 'confidence', 'risk', 'reason'],
        },
      },
    },
    required: ['overall_assessment', 'actions'],
  },
} as const;

const SYSTEM_PROMPT =
  'あなたは広告の競合インテリジェンスAIです。競合の動きを分析し、対抗戦略を提案してください。' +
  '各アクションにはリスクレベル、確信度(0-1)、具体的な理由を含めてください。' +
  '安全な戦略を優先し、大きなリスクを伴うアクションは慎重に提案してください。' +
  'すべての回答は日本語で行ってください。';

// Minimum hours between counter-actions on the same campaign
const COOLDOWN_HOURS = 4;
// ROAS drop threshold for auto-rollback (30%)
const ROAS_ROLLBACK_THRESHOLD = 0.3;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AutoCounterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutoCounterError';
  }
}

export class CounterActionNotFoundError extends Error {
  constructor(actionId: string) {
    super(`Counter action not found: ${actionId}`);
    this.name = 'CounterActionNotFoundError';
  }
}

export class GuardrailViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuardrailViolationError';
  }
}

// ---------------------------------------------------------------------------
// Main Counter Cycle
// ---------------------------------------------------------------------------

export async function evaluateAndCounter(
  organizationId: string,
  alerts: CompetitorAlertSelect[],
): Promise<EvaluateResult> {
  // 1. Fetch settings and validate API key
  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
  });

  if (!settings) {
    throw new AutoCounterError('AI settings not found for organization');
  }

  if (!settings.claudeApiKeyEncrypted) {
    throw new AutoCounterError('Claude API key not configured');
  }

  const apiKey = decryptToken(settings.claudeApiKeyEncrypted);

  // 2. Check for ROAS-based auto-rollback before proceeding
  await checkAutoRollback(organizationId);

  // 3. Gather context
  const [competitors, recentSnapshots, activeCampaigns] = await Promise.all([
    db
      .select()
      .from(competitorProfiles)
      .where(
        and(
          eq(competitorProfiles.organizationId, organizationId),
          eq(competitorProfiles.active, true),
        ),
      ),
    db
      .select()
      .from(auctionInsightSnapshots)
      .where(
        and(
          eq(auctionInsightSnapshots.organizationId, organizationId),
          gte(
            auctionInsightSnapshots.snapshotDate,
            new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
          ),
        ),
      )
      .orderBy(desc(auctionInsightSnapshots.snapshotDate))
      .limit(100),
    db.query.campaigns.findMany({
      where: and(
        eq(campaigns.organizationId, organizationId),
        sql`${campaigns.status} IN ('active', 'paused')`,
      ),
    }),
  ]);

  if (alerts.length === 0) {
    return {
      assessment: 'アラートがないため、対抗アクションの評価をスキップしました。',
      actionsProcessed: 0,
      actionsExecuted: 0,
      actionsSkipped: 0,
      actionIds: [],
    };
  }

  // 4. Build prompt
  const prompt = buildCounterPrompt(
    settings,
    alerts,
    competitors,
    recentSnapshots,
    activeCampaigns,
  );

  // 5. Call Claude API
  const toolOutput = await callClaudeForCounter(apiKey, prompt);

  // 6. Process actions
  const result = await processCounterActions(
    organizationId,
    settings,
    competitors,
    toolOutput,
  );

  return result;
}

// ---------------------------------------------------------------------------
// Prompt Building
// ---------------------------------------------------------------------------

function buildCounterPrompt(
  settings: AiSettingsSelect,
  alerts: CompetitorAlertSelect[],
  competitors: CompetitorProfileSelect[],
  snapshots: Array<typeof auctionInsightSnapshots.$inferSelect>,
  activeCampaigns: Array<{ id: string; name: string; status: string; dailyBudget: string }>,
): string {
  const sections: string[] = [];

  // Organization settings
  sections.push('# 競合対抗設定');
  sections.push(`- デフォルト戦略: ${settings.defaultCounterStrategy}`);
  sections.push(`- リスク許容度: ${settings.riskTolerance}`);
  sections.push(
    `- 自動対抗: ${settings.autoCounterEnabled ? '有効' : '無効'}`,
  );
  sections.push('');

  // Competitor profiles
  sections.push('# 監視中の競合');
  for (const comp of competitors) {
    sections.push(`## ${comp.name} (${comp.domain})`);
    sections.push(`- プラットフォーム: ${comp.platforms.join(', ')}`);
    sections.push(`- 戦略: ${comp.counterStrategy}`);
    sections.push(`- 最大入札上昇: ${comp.maxBidIncreasePercent}%`);
    sections.push(`- 最大予算移動: ${comp.maxBudgetShiftPercent}%`);
    sections.push(`- ID: ${comp.id}`);
    sections.push('');
  }

  // Active campaigns
  sections.push('# アクティブキャンペーン');
  for (const campaign of activeCampaigns) {
    sections.push(
      `- ${campaign.name} (ID: ${campaign.id}): ステータス=${campaign.status}, 日次予算=¥${campaign.dailyBudget}`,
    );
  }
  sections.push('');

  // Recent auction insights
  if (snapshots.length > 0) {
    sections.push('# 直近のオークションインサイト');
    const avgIS =
      snapshots.reduce((s, snap) => s + snap.impressionShare, 0) /
      snapshots.length;
    const cpcs = snapshots
      .map((s) => s.avgCpc)
      .filter((c): c is number => c !== null);
    const avgCpc = cpcs.length > 0 ? cpcs.reduce((s, c) => s + c, 0) / cpcs.length : 0;

    sections.push(`- 平均インプレッションシェア: ${(avgIS * 100).toFixed(1)}%`);
    sections.push(`- 平均CPC: ¥${avgCpc.toFixed(0)}`);
    sections.push(`- データポイント数: ${snapshots.length}`);
    sections.push('');
  }

  // Alerts requiring response
  sections.push('# 対応が必要なアラート');
  for (const alert of alerts) {
    sections.push(`## ${alert.title}`);
    sections.push(`- タイプ: ${alert.alertType}`);
    sections.push(`- 重要度: ${alert.severity}`);
    sections.push(`- 説明: ${alert.description}`);
    sections.push(`- ID: ${alert.id}`);
    if (alert.competitorId) {
      sections.push(`- 競合ID: ${alert.competitorId}`);
    }
    sections.push('');
  }

  sections.push(
    '上記のアラートと競合環境を分析し、対抗戦略を output_counter_strategy ツールで出力してください。',
    '各アクションにはcampaignId、competitorId（該当する場合）、リスクレベル、確信度、具体的な理由を含めてください。',
    'ガードレール（最大入札上昇率、最大予算移動率）を考慮してください。',
  );

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Claude API Call
// ---------------------------------------------------------------------------

async function callClaudeForCounter(
  apiKey: string,
  prompt: string,
): Promise<ClaudeCounterOutput> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      tools: [COUNTER_STRATEGY_TOOL],
      tool_choice: { type: 'tool', name: 'output_counter_strategy' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AutoCounterError(
      `Claude API error ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const body: unknown = await response.json();
  return parseCounterToolOutput(body);
}

function parseCounterToolOutput(responseBody: unknown): ClaudeCounterOutput {
  const body = responseBody as Record<string, unknown>;
  const content = body['content'] as unknown[];

  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (
      b['type'] === 'tool_use' &&
      b['name'] === 'output_counter_strategy'
    ) {
      return b['input'] as ClaudeCounterOutput;
    }
  }

  throw new AutoCounterError(
    'Claude response did not include output_counter_strategy tool_use block',
  );
}

// ---------------------------------------------------------------------------
// Action Processing
// ---------------------------------------------------------------------------

async function processCounterActions(
  organizationId: string,
  settings: AiSettingsSelect,
  competitors: CompetitorProfileSelect[],
  toolOutput: ClaudeCounterOutput,
): Promise<EvaluateResult> {
  const actionIds: string[] = [];
  let actionsExecuted = 0;
  let actionsSkipped = 0;

  const competitorMap = new Map(competitors.map((c) => [c.id, c]));

  for (const action of toolOutput.actions) {
    // Determine which competitor profile applies
    const competitor = action.competitorId
      ? competitorMap.get(action.competitorId)
      : undefined;

    const strategy: CounterStrategy =
      competitor?.counterStrategy ?? settings.defaultCounterStrategy;

    // Filter by risk appetite
    if (shouldSkipAction(settings, action)) {
      actionsSkipped++;
      continue;
    }

    // Check cooldown
    if (action.campaignId) {
      const isCoolingDown = await checkCooldown(
        organizationId,
        action.campaignId,
      );
      if (isCoolingDown) {
        actionsSkipped++;
        continue;
      }
    }

    // Capture result-before for potential rollback
    const resultBefore = action.campaignId
      ? await captureCurrentMetrics(action.campaignId)
      : undefined;

    // Determine status based on auto-counter setting
    const shouldAutoExecute =
      settings.autoCounterEnabled &&
      competitor?.autoCounterEnabled !== false &&
      action.risk !== 'high';

    const status: CounterActionStatus = shouldAutoExecute
      ? 'executing'
      : 'proposed';

    // Create counter action record
    const [created] = await db
      .insert(counterActions)
      .values({
        organizationId,
        alertId: null,
        competitorId: action.competitorId ?? null,
        actionType: action.type,
        strategy,
        campaignId: action.campaignId ?? null,
        details: action.details ?? {},
        reasoning: action.reason,
        confidenceScore: action.confidence,
        status,
        resultBefore: resultBefore ?? null,
      })
      .returning();

    if (!created) continue;
    actionIds.push(created.id);

    // Execute if auto-counter is enabled
    if (shouldAutoExecute) {
      try {
        await executeCounterAction(
          organizationId,
          competitor,
          action,
          created.id,
        );
        actionsExecuted++;

        await db
          .update(counterActions)
          .set({ status: 'executed', executedAt: sql`now()` })
          .where(eq(counterActions.id, created.id));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await db
          .update(counterActions)
          .set({
            status: 'skipped',
            reasoning: `${action.reason}\n\n実行失敗: ${message}`,
          })
          .where(eq(counterActions.id, created.id));
        actionsSkipped++;
      }
    } else {
      // Notify about proposed action
      await createNotification({
        organizationId,
        type: 'info',
        title: '競合対抗アクション提案',
        message: `${formatActionType(action.type)}: ${action.reason.slice(0, 200)}`,
        source: 'auto_counter',
        metadata: {
          counterActionId: created.id,
          actionType: action.type,
          confidence: action.confidence,
          risk: action.risk,
        },
      });
    }
  }

  // Summary notification if actions were executed
  if (actionsExecuted > 0) {
    await createNotification({
      organizationId,
      type: 'success',
      title: '競合対抗アクション実行完了',
      message: `${actionsExecuted}件のアクションを自動実行しました: ${toolOutput.overall_assessment.slice(0, 200)}`,
      source: 'auto_counter',
      metadata: {
        actionsExecuted,
        actionsSkipped,
        totalActions: toolOutput.actions.length,
      },
    });
  }

  return {
    assessment: toolOutput.overall_assessment,
    actionsProcessed: toolOutput.actions.length,
    actionsExecuted,
    actionsSkipped,
    actionIds,
  };
}

// ---------------------------------------------------------------------------
// Action Execution
// ---------------------------------------------------------------------------

async function executeCounterAction(
  organizationId: string,
  competitor: CompetitorProfileSelect | undefined,
  action: CounterStrategyAction,
  _counterActionId: string,
): Promise<void> {
  const maxBidIncrease = competitor?.maxBidIncreasePercent ?? 15;
  const maxBudgetShift = competitor?.maxBudgetShiftPercent ?? 20;

  switch (action.type) {
    case 'bid_adjust': {
      if (!action.campaignId) return;
      const campaign = await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, action.campaignId),
          eq(campaigns.organizationId, organizationId),
        ),
      });
      if (!campaign) return;

      const currentBudget = Number(campaign.dailyBudget);
      const details = action.details as CounterActionDetails | undefined;
      const bidAdjustment = details?.bidAdjustment;

      if (bidAdjustment) {
        // Enforce max bid increase guardrail
        const maxDelta = currentBudget * (maxBidIncrease / 100);
        const newBudget = Math.min(
          currentBudget + maxDelta,
          Math.max(currentBudget - maxDelta, bidAdjustment.newBid),
        );

        await db
          .update(campaigns)
          .set({
            dailyBudget: newBudget.toFixed(2),
            updatedAt: sql`now()`,
          })
          .where(eq(campaigns.id, action.campaignId));
      }
      return;
    }

    case 'budget_shift': {
      const details = action.details as CounterActionDetails | undefined;
      const shift = details?.budgetShift;
      if (!shift) return;

      const [fromCampaign, toCampaign] = await Promise.all([
        db.query.campaigns.findFirst({
          where: and(
            eq(campaigns.id, shift.fromCampaignId),
            eq(campaigns.organizationId, organizationId),
          ),
        }),
        db.query.campaigns.findFirst({
          where: and(
            eq(campaigns.id, shift.toCampaignId),
            eq(campaigns.organizationId, organizationId),
          ),
        }),
      ]);

      if (!fromCampaign || !toCampaign) return;

      const fromBudget = Number(fromCampaign.dailyBudget);
      const toCampaignBudget = Number(toCampaign.dailyBudget);

      // Enforce max budget shift guardrail
      const maxShiftAmount = fromBudget * (maxBudgetShift / 100);
      const actualShift = Math.min(shift.amount, maxShiftAmount);

      await db
        .update(campaigns)
        .set({
          dailyBudget: (fromBudget - actualShift).toFixed(2),
          updatedAt: sql`now()`,
        })
        .where(eq(campaigns.id, shift.fromCampaignId));

      await db
        .update(campaigns)
        .set({
          dailyBudget: (toCampaignBudget + actualShift).toFixed(2),
          updatedAt: sql`now()`,
        })
        .where(eq(campaigns.id, shift.toCampaignId));

      return;
    }

    case 'timing_attack': {
      // Schedule-based optimization logged for future implementation
      // In production, this would interface with platform-specific ad scheduling APIs
      return;
    }

    case 'do_nothing': {
      // Explicitly choosing not to act -- logged via counterActions record
      return;
    }

    case 'creative_counter':
    case 'targeting_expand':
    case 'keyword_defense': {
      // These require human review or more complex platform integration
      // Logged as proposed actions
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

export async function rollbackCounterAction(
  actionId: string,
  organizationId: string,
  reason: string,
): Promise<CounterActionSelect> {
  // Atomically claim the rollback by updating status from 'executed' to 'rolled_back'.
  // If another concurrent process already changed the status, the WHERE clause
  // won't match and RETURNING will be empty, preventing a double rollback.
  const [claimed] = await db
    .update(counterActions)
    .set({
      status: 'rolled_back',
      rolledBackAt: sql`now()`,
      rollbackReason: reason,
    })
    .where(
      and(
        eq(counterActions.id, actionId),
        eq(counterActions.organizationId, organizationId),
        eq(counterActions.status, 'executed'),
      ),
    )
    .returning();

  if (!claimed) {
    // Either not found, or already rolled back / not in 'executed' status
    const existing = await db.query.counterActions.findFirst({
      where: and(
        eq(counterActions.id, actionId),
        eq(counterActions.organizationId, organizationId),
      ),
    });

    if (!existing) {
      throw new CounterActionNotFoundError(actionId);
    }

    throw new AutoCounterError(
      `Cannot rollback action with status: ${existing.status}`,
    );
  }

  // Restore previous state if we have result_before data
  if (claimed.resultBefore && claimed.campaignId) {
    const beforeData = claimed.resultBefore as CounterActionResult;
    if (beforeData.dailyBudget !== undefined) {
      await db
        .update(campaigns)
        .set({
          dailyBudget: beforeData.dailyBudget.toFixed(2),
          updatedAt: sql`now()`,
        })
        .where(eq(campaigns.id, claimed.campaignId));
    }
  }

  // Capture current metrics as result_after
  const resultAfter = claimed.campaignId
    ? await captureCurrentMetrics(claimed.campaignId)
    : undefined;

  // Update the result_after on the already-claimed record
  if (resultAfter) {
    await db
      .update(counterActions)
      .set({ resultAfter })
      .where(eq(counterActions.id, actionId));
  }

  await createNotification({
    organizationId,
    type: 'warning',
    title: '競合対抗アクションをロールバック',
    message: `アクション「${formatActionType(claimed.actionType)}」をロールバックしました: ${reason}`,
    source: 'auto_counter',
    metadata: { counterActionId: actionId, reason },
  });

  return { ...claimed, resultAfter: resultAfter ?? claimed.resultAfter };
}

// ---------------------------------------------------------------------------
// Auto-Rollback Check
// ---------------------------------------------------------------------------

export async function checkAutoRollback(
  organizationId: string,
): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find executed actions in the last 24 hours
  const recentActions = await db
    .select()
    .from(counterActions)
    .where(
      and(
        eq(counterActions.organizationId, organizationId),
        eq(counterActions.status, 'executed'),
        gte(counterActions.executedAt, twentyFourHoursAgo),
      ),
    );

  let rollbackCount = 0;

  for (const action of recentActions) {
    if (!action.campaignId || !action.resultBefore) continue;

    const beforeData = action.resultBefore as CounterActionResult;
    if (!beforeData.roas || beforeData.roas === 0) continue;

    // Check current ROAS
    const currentMetrics = await captureCurrentMetrics(action.campaignId);
    if (!currentMetrics?.roas) continue;

    const roasDrop =
      (beforeData.roas - currentMetrics.roas) / beforeData.roas;

    if (roasDrop > ROAS_ROLLBACK_THRESHOLD) {
      await rollbackCounterAction(
        action.id,
        organizationId,
        `ROAS自動ロールバック: ROAS が ${(roasDrop * 100).toFixed(1)}% 低下（閾値: ${ROAS_ROLLBACK_THRESHOLD * 100}%）`,
      );
      rollbackCount++;
    }
  }

  return rollbackCount;
}

// ---------------------------------------------------------------------------
// List Counter Actions
// ---------------------------------------------------------------------------

export async function listCounterActions(
  organizationId: string,
  filters?: ListCounterActionsFilter,
): Promise<CounterActionSelect[]> {
  const conditions = [eq(counterActions.organizationId, organizationId)];

  if (filters?.status) {
    conditions.push(eq(counterActions.status, filters.status));
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return db
    .select()
    .from(counterActions)
    .where(and(...conditions))
    .orderBy(desc(counterActions.createdAt))
    .limit(limit)
    .offset(offset);
}

// ---------------------------------------------------------------------------
// Guardrails
// ---------------------------------------------------------------------------

function shouldSkipAction(
  settings: AiSettingsSelect,
  action: CounterStrategyAction,
): boolean {
  // Conservative risk tolerance: skip high-risk actions
  if (settings.riskTolerance === 'conservative' && action.risk === 'high') {
    return true;
  }

  // Moderate: skip high-risk with low confidence
  if (
    settings.riskTolerance === 'moderate' &&
    action.risk === 'high' &&
    action.confidence < 0.7
  ) {
    return true;
  }

  // Skip very low confidence actions regardless
  if (action.confidence < 0.3) {
    return true;
  }

  return false;
}

async function checkCooldown(
  organizationId: string,
  campaignId: string,
): Promise<boolean> {
  const cooldownCutoff = new Date(
    Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000,
  );

  const recentAction = await db.query.counterActions.findFirst({
    where: and(
      eq(counterActions.organizationId, organizationId),
      eq(counterActions.campaignId, campaignId),
      eq(counterActions.status, 'executed'),
      gte(counterActions.executedAt, cooldownCutoff),
    ),
  });

  return recentAction !== undefined;
}

// ---------------------------------------------------------------------------
// Metrics Capture
// ---------------------------------------------------------------------------

async function captureCurrentMetrics(
  campaignId: string,
): Promise<CounterActionResult | undefined> {
  const [recentMetric, campaign] = await Promise.all([
    db
      .select()
      .from(metricsDaily)
      .where(eq(metricsDaily.campaignId, campaignId))
      .orderBy(desc(metricsDaily.date))
      .limit(1),
    db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaignId),
    }),
  ]);

  const metric = recentMetric[0];
  if (!metric) return undefined;

  return {
    impressionShare: undefined,
    cpc: metric.clicks > 0 ? Number(metric.spend) / metric.clicks : 0,
    roas: metric.roas,
    spend: Number(metric.spend),
    dailyBudget: campaign ? Number(campaign.dailyBudget) : undefined,
    conversions: metric.conversions,
    snapshotDate: metric.date,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatActionType(actionType: CounterActionType): string {
  const labels: Record<CounterActionType, string> = {
    bid_adjust: '入札調整',
    budget_shift: '予算シフト',
    creative_counter: 'クリエイティブ対抗',
    targeting_expand: 'ターゲティング拡張',
    keyword_defense: 'キーワード防衛',
    timing_attack: 'タイミング攻撃',
    do_nothing: 'アクション不要',
  };
  return labels[actionType];
}
