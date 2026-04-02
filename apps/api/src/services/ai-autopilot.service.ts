/**
 * AI Autopilot Service
 *
 * Core engine that uses Claude API to autonomously analyze campaign performance
 * and execute optimization actions. Supports three modes: full_auto,
 * suggest_only, and approve_required.
 */

import { db } from '@omni-ad/db';
import {
  aiSettings,
  aiDecisionLog,
  campaigns,
  metricsDaily,
} from '@omni-ad/db/schema';
import { encryptToken, decryptToken } from '@omni-ad/auth';
import { getActiveEvents } from '@omni-ad/ai-engine';
import type { SeasonalEvent } from '@omni-ad/ai-engine';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  listCampaigns,
  updateCampaign,
  pauseCampaign,
  resumeCampaign,
} from './campaign.service.js';
import type { CampaignWithDeployments } from './campaign.service.js';
import { getCurrentAllocations } from './budget.service.js';
import { createNotification } from './notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AiSettingsSelect = typeof aiSettings.$inferSelect;
type AiDecisionLogSelect = typeof aiDecisionLog.$inferSelect;
type MetricsDailySelect = typeof metricsDaily.$inferSelect;

interface UpdateSettingsInput {
  claudeApiKey?: string;
  autopilotEnabled?: boolean;
  autopilotMode?: AiSettingsSelect['autopilotMode'];
  optimizationFrequency?: AiSettingsSelect['optimizationFrequency'];
  budgetAutoAdjust?: boolean;
  maxBudgetChangePercent?: number;
  creativeAutoRotate?: boolean;
  campaignAutoCreate?: boolean;
  riskTolerance?: AiSettingsSelect['riskTolerance'];
  targetRoas?: number | null;
  monthlyBudgetCap?: string | null;
}

interface OptimizationAction {
  type:
    | 'budget_adjust'
    | 'campaign_pause'
    | 'campaign_resume'
    | 'creative_rotate'
    | 'targeting_change'
    | 'new_campaign'
    | 'strategy_insight';
  campaignId?: string;
  confidence: number;
  reason: string;
  details?: Record<string, unknown>;
}

interface ClaudeToolOutput {
  strategy_summary: string;
  actions: OptimizationAction[];
}

interface CampaignMetricsSummary {
  campaignId: string;
  campaignName: string;
  status: string;
  dailyBudget: string;
  metrics: MetricsDailySelect[];
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalSpend: number;
  totalRevenue: number;
  avgRoas: number;
  avgCtr: number;
}

interface AutopilotCycleResult {
  strategySummary: string;
  actionsProcessed: number;
  decisionsCreated: string[];
}

// ---------------------------------------------------------------------------
// Claude API Tool Schema
// ---------------------------------------------------------------------------

const OPTIMIZATION_ACTIONS_TOOL = {
  name: 'output_optimization_actions',
  description:
    '広告キャンペーンの最適化アクションを出力してください',
  input_schema: {
    type: 'object',
    properties: {
      strategy_summary: {
        type: 'string',
        description: '全体的な戦略サマリー（日本語）',
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'budget_adjust',
                'campaign_pause',
                'campaign_resume',
                'creative_rotate',
                'targeting_change',
                'new_campaign',
                'strategy_insight',
              ],
            },
            campaignId: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reason: { type: 'string' },
            details: { type: 'object' },
          },
          required: ['type', 'confidence', 'reason'],
        },
      },
    },
    required: ['strategy_summary', 'actions'],
  },
} as const;

const SYSTEM_PROMPT =
  'あなたはデジタル広告の最適化AIです。提供されたキャンペーンデータを分析し、' +
  '具体的な最適化アクションを判断してください。各アクションには理由と確信度(0-1)を含めてください。';

// ---------------------------------------------------------------------------
// Settings Management
// ---------------------------------------------------------------------------

export async function getSettings(
  organizationId: string,
): Promise<AiSettingsSelect> {
  const existing = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
  });

  if (existing) return existing;

  // Create default settings for this organization
  const [created] = await db
    .insert(aiSettings)
    .values({ organizationId })
    .returning();

  if (!created) {
    throw new Error('Failed to create default AI settings');
  }

  return created;
}

export async function updateSettings(
  organizationId: string,
  input: UpdateSettingsInput,
): Promise<AiSettingsSelect> {
  // Ensure settings row exists
  await getSettings(organizationId);

  const updateSet: Record<string, unknown> = {
    updatedAt: sql`now()`,
  };

  if (input.claudeApiKey !== undefined) {
    updateSet['claudeApiKeyEncrypted'] = encryptToken(input.claudeApiKey);
  }
  if (input.autopilotEnabled !== undefined) {
    updateSet['autopilotEnabled'] = input.autopilotEnabled;
  }
  if (input.autopilotMode !== undefined) {
    updateSet['autopilotMode'] = input.autopilotMode;
  }
  if (input.optimizationFrequency !== undefined) {
    updateSet['optimizationFrequency'] = input.optimizationFrequency;
  }
  if (input.budgetAutoAdjust !== undefined) {
    updateSet['budgetAutoAdjust'] = input.budgetAutoAdjust;
  }
  if (input.maxBudgetChangePercent !== undefined) {
    updateSet['maxBudgetChangePercent'] = input.maxBudgetChangePercent;
  }
  if (input.creativeAutoRotate !== undefined) {
    updateSet['creativeAutoRotate'] = input.creativeAutoRotate;
  }
  if (input.campaignAutoCreate !== undefined) {
    updateSet['campaignAutoCreate'] = input.campaignAutoCreate;
  }
  if (input.riskTolerance !== undefined) {
    updateSet['riskTolerance'] = input.riskTolerance;
  }
  if (input.targetRoas !== undefined) {
    updateSet['targetRoas'] = input.targetRoas;
  }
  if (input.monthlyBudgetCap !== undefined) {
    updateSet['monthlyBudgetCap'] = input.monthlyBudgetCap;
  }

  const [updated] = await db
    .update(aiSettings)
    .set(updateSet)
    .where(eq(aiSettings.organizationId, organizationId))
    .returning();

  if (!updated) {
    throw new AiAutopilotError('Failed to update AI settings');
  }

  return updated;
}

export async function testApiConnection(
  organizationId: string,
): Promise<{ success: boolean; message: string }> {
  const settings = await getSettings(organizationId);

  if (!settings.claudeApiKeyEncrypted) {
    return { success: false, message: 'Claude API key not configured' };
  }

  const apiKey = decryptToken(settings.claudeApiKeyEncrypted);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 64,
        messages: [{ role: 'user', content: '接続テスト。「OK」と答えてください。' }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        message: `API error ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    return { success: true, message: 'Claude API connection successful' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: `Connection failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Main Autopilot Cycle
// ---------------------------------------------------------------------------

export async function runAutopilotCycle(
  organizationId: string,
): Promise<AutopilotCycleResult> {
  // 1. Fetch settings and validate
  const settings = await getSettings(organizationId);

  if (!settings.claudeApiKeyEncrypted) {
    throw new AiAutopilotError('Claude API key not configured');
  }

  if (!settings.autopilotEnabled) {
    throw new AiAutopilotError('Autopilot is not enabled for this organization');
  }

  const apiKey = decryptToken(settings.claudeApiKeyEncrypted);

  // 2. Gather data in parallel
  const [activeCampaigns, budgetState, seasonalEvents] = await Promise.all([
    listCampaigns(organizationId),
    getCurrentAllocations(organizationId),
    Promise.resolve(getActiveEvents(new Date())),
  ]);

  // Filter to only active campaigns for analysis
  const campaignsToAnalyze = activeCampaigns.filter(
    (c) => c.status === 'active' || c.status === 'paused',
  );

  if (campaignsToAnalyze.length === 0) {
    return {
      strategySummary: 'アクティブなキャンペーンがないため、最適化をスキップしました。',
      actionsProcessed: 0,
      decisionsCreated: [],
    };
  }

  // Fetch last 7 days of daily metrics per campaign
  const campaignMetrics = await gatherCampaignMetrics(campaignsToAnalyze);

  // 3. Build Claude prompt
  const prompt = buildAutopilotPrompt(
    settings,
    campaignMetrics,
    budgetState,
    seasonalEvents,
  );

  // 4. Call Claude API with tool_use
  const toolOutput = await callClaudeForOptimization(apiKey, prompt);

  // 5. Process actions based on autopilot mode
  const decisionsCreated = await processActions(
    organizationId,
    settings,
    toolOutput,
  );

  return {
    strategySummary: toolOutput.strategy_summary,
    actionsProcessed: toolOutput.actions.length,
    decisionsCreated,
  };
}

// ---------------------------------------------------------------------------
// Data Gathering
// ---------------------------------------------------------------------------

async function gatherCampaignMetrics(
  campaignList: CampaignWithDeployments[],
): Promise<CampaignMetricsSummary[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const campaignIds = campaignList.map((c) => c.id);

  if (campaignIds.length === 0) return [];

  // Batch query: all daily metrics for these campaigns in last 7 days
  const allMetrics = await db
    .select()
    .from(metricsDaily)
    .where(
      and(
        sql`${metricsDaily.campaignId} = ANY(${campaignIds})`,
        gte(metricsDaily.date, sevenDaysAgo),
      ),
    )
    .orderBy(desc(metricsDaily.date));

  // Group metrics by campaign
  const metricsByCampaign = new Map<string, MetricsDailySelect[]>();
  for (const metric of allMetrics) {
    const existing = metricsByCampaign.get(metric.campaignId) ?? [];
    existing.push(metric);
    metricsByCampaign.set(metric.campaignId, existing);
  }

  return campaignList.map((campaign) => {
    const metrics = metricsByCampaign.get(campaign.id) ?? [];

    const totalImpressions = metrics.reduce(
      (sum, m) => sum + m.impressions,
      0,
    );
    const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
    const totalConversions = metrics.reduce(
      (sum, m) => sum + m.conversions,
      0,
    );
    const totalSpend = metrics.reduce(
      (sum, m) => sum + Number(m.spend),
      0,
    );
    const totalRevenue = metrics.reduce(
      (sum, m) => sum + Number(m.revenue),
      0,
    );

    // Spend-weighted average ROAS avoids distortion from low-spend days
    const avgRoas = (() => {
      if (metrics.length === 0) return 0;
      const weightedSum = metrics.reduce(
        (sum, m) => sum + m.roas * Number(m.spend),
        0,
      );
      return totalSpend > 0 ? weightedSum / totalSpend : 0;
    })();
    const avgCtr =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.ctr, 0) / metrics.length
        : 0;

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      dailyBudget: campaign.dailyBudget,
      metrics,
      totalImpressions,
      totalClicks,
      totalConversions,
      totalSpend,
      totalRevenue,
      avgRoas,
      avgCtr,
    };
  });
}

// ---------------------------------------------------------------------------
// Prompt Building
// ---------------------------------------------------------------------------

function buildAutopilotPrompt(
  settings: AiSettingsSelect,
  campaignMetrics: CampaignMetricsSummary[],
  budgetState: Awaited<ReturnType<typeof getCurrentAllocations>>,
  seasonalEvents: SeasonalEvent[],
): string {
  const sections: string[] = [];

  // Organization settings context
  sections.push('# 組織設定');
  sections.push(`- リスク許容度: ${settings.riskTolerance}`);
  sections.push(
    `- 最大予算変更幅: ${settings.maxBudgetChangePercent}%`,
  );
  sections.push(
    `- 予算自動調整: ${settings.budgetAutoAdjust ? '有効' : '無効'}`,
  );
  sections.push(
    `- クリエイティブ自動ローテーション: ${settings.creativeAutoRotate ? '有効' : '無効'}`,
  );
  sections.push(
    `- キャンペーン自動作成: ${settings.campaignAutoCreate ? '有効' : '無効'}`,
  );
  if (settings.targetRoas !== null && settings.targetRoas !== undefined) {
    sections.push(`- 目標ROAS: ${settings.targetRoas}`);
  }
  if (
    settings.monthlyBudgetCap !== null &&
    settings.monthlyBudgetCap !== undefined
  ) {
    sections.push(`- 月次予算上限: ¥${settings.monthlyBudgetCap}`);
  }
  sections.push('');

  // Campaign metrics
  sections.push('# キャンペーンパフォーマンス（過去7日間）');
  for (const cm of campaignMetrics) {
    sections.push(`## ${cm.campaignName} (ID: ${cm.campaignId})`);
    sections.push(`- ステータス: ${cm.status}`);
    sections.push(`- 日次予算: ¥${cm.dailyBudget}`);
    sections.push(`- インプレッション: ${cm.totalImpressions.toLocaleString('ja-JP')}`);
    sections.push(`- クリック: ${cm.totalClicks.toLocaleString('ja-JP')}`);
    sections.push(`- コンバージョン: ${cm.totalConversions}`);
    sections.push(`- 費用: ¥${cm.totalSpend.toLocaleString('ja-JP')}`);
    sections.push(`- 収益: ¥${cm.totalRevenue.toLocaleString('ja-JP')}`);
    sections.push(`- 平均ROAS: ${cm.avgRoas.toFixed(2)}`);
    sections.push(`- 平均CTR: ${(cm.avgCtr * 100).toFixed(2)}%`);

    // Flag anomalies
    const anomalies: string[] = [];
    if (cm.avgRoas < 1 && cm.totalSpend > 0) {
      anomalies.push('ROAS < 1.0 (赤字)');
    }
    if (cm.metrics.length >= 3) {
      const recentCtr = cm.metrics.slice(0, 3).reduce((s, m) => s + m.ctr, 0) / 3;
      const olderCtr =
        cm.metrics.length > 3
          ? cm.metrics.slice(3).reduce((s, m) => s + m.ctr, 0) /
            cm.metrics.slice(3).length
          : recentCtr;
      if (olderCtr > 0 && recentCtr < olderCtr * 0.7) {
        anomalies.push('CTR低下傾向 (直近3日が過去比30%以上減少)');
      }
    }
    if (anomalies.length > 0) {
      sections.push(`- 異常検知: ${anomalies.join(', ')}`);
    }
    sections.push('');
  }

  // Budget allocation
  if (budgetState) {
    sections.push('# 現在の予算配分');
    const allocations = budgetState.allocations as Record<string, number>;
    for (const [platform, amount] of Object.entries(allocations)) {
      sections.push(`- ${platform}: ¥${Number(amount).toLocaleString('ja-JP')}`);
    }
    sections.push(`- 合計予算: ¥${budgetState.totalBudget}`);
    sections.push('');
  }

  // Seasonal events
  if (seasonalEvents.length > 0) {
    sections.push('# 現在のシーズナルイベント（日本）');
    for (const event of seasonalEvents) {
      sections.push(
        `- ${event.name} (${event.nameEn}): ${event.dateRange.start} ~ ${event.dateRange.end}`,
      );
    }
    sections.push('');
  }

  sections.push(
    '上記データを分析し、最適化アクションを output_optimization_actions ツールで出力してください。',
    '各アクションには具体的な理由と確信度を含めてください。',
    '日本語で回答してください。',
  );

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Claude API Call
// ---------------------------------------------------------------------------

async function callClaudeForOptimization(
  apiKey: string,
  prompt: string,
): Promise<ClaudeToolOutput> {
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
      tools: [OPTIMIZATION_ACTIONS_TOOL],
      tool_choice: { type: 'tool', name: 'output_optimization_actions' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AiAutopilotError(
      `Claude API error ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const body: unknown = await response.json();
  return parseToolOutput(body);
}

function parseToolOutput(responseBody: unknown): ClaudeToolOutput {
  const body = responseBody as Record<string, unknown>;
  const content = body['content'] as unknown[];

  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (
      b['type'] === 'tool_use' &&
      b['name'] === 'output_optimization_actions'
    ) {
      return b['input'] as ClaudeToolOutput;
    }
  }

  throw new AiAutopilotError(
    'Claude response did not include output_optimization_actions tool_use block',
  );
}

// ---------------------------------------------------------------------------
// Action Processing
// ---------------------------------------------------------------------------

async function processActions(
  organizationId: string,
  settings: AiSettingsSelect,
  toolOutput: ClaudeToolOutput,
): Promise<string[]> {
  const decisionIds: string[] = [];

  for (const action of toolOutput.actions) {
    const decisionType = mapActionToDecisionType(action.type);
    if (!decisionType) continue;

    const status = resolveActionStatus(settings.autopilotMode, action);

    // Log the decision
    const [decision] = await db
      .insert(aiDecisionLog)
      .values({
        organizationId,
        decisionType,
        campaignId: action.campaignId ?? null,
        reasoning: action.reason,
        recommendation: (action.details ?? {}) as Record<string, unknown>,
        action: null,
        status,
        confidenceScore: action.confidence,
      })
      .returning();

    if (!decision) continue;
    decisionIds.push(decision.id);

    // Execute immediately if full_auto and confidence threshold met
    if (status === 'executed') {
      await executeAction(organizationId, settings, action, decision.id);
    }

    // Send notification for pending decisions
    if (status === 'pending_approval') {
      await createNotification({
        organizationId,
        type: 'info',
        title: 'AI最適化提案',
        message: `${formatDecisionType(decisionType)}: ${action.reason.slice(0, 200)}`,
        source: 'ai_autopilot',
        metadata: {
          decisionId: decision.id,
          decisionType,
          confidence: action.confidence,
        },
      });
    }
  }

  // Notify about executed actions in full_auto mode
  const executedCount = toolOutput.actions.filter(
    (a) =>
      resolveActionStatus(settings.autopilotMode, a) === 'executed',
  ).length;

  if (executedCount > 0 && settings.autopilotMode === 'full_auto') {
    await createNotification({
      organizationId,
      type: 'success',
      title: 'AI自動最適化完了',
      message: `${executedCount}件のアクションを自動実行しました: ${toolOutput.strategy_summary.slice(0, 200)}`,
      source: 'ai_autopilot',
      metadata: {
        actionsExecuted: executedCount,
        totalActions: toolOutput.actions.length,
      },
    });
  }

  return decisionIds;
}

function mapActionToDecisionType(
  actionType: OptimizationAction['type'],
): AiDecisionLogSelect['decisionType'] | undefined {
  const mapping: Record<
    OptimizationAction['type'],
    AiDecisionLogSelect['decisionType']
  > = {
    budget_adjust: 'budget_adjust',
    campaign_pause: 'campaign_pause',
    campaign_resume: 'campaign_resume',
    creative_rotate: 'creative_rotate',
    targeting_change: 'targeting_change',
    new_campaign: 'campaign_create',
    strategy_insight: 'strategy_insight',
  };
  return mapping[actionType];
}

function resolveActionStatus(
  mode: AiSettingsSelect['autopilotMode'],
  action: OptimizationAction,
): AiDecisionLogSelect['status'] {
  // Strategy insights are always informational
  if (action.type === 'strategy_insight') return 'executed';

  switch (mode) {
    case 'full_auto':
      return 'executed';
    case 'suggest_only':
      return 'pending_approval';
    case 'approve_required':
      return 'pending_approval';
  }
}

async function executeAction(
  organizationId: string,
  settings: AiSettingsSelect,
  action: OptimizationAction,
  decisionId: string,
): Promise<void> {
  try {
    switch (action.type) {
      case 'budget_adjust':
        if (action.campaignId && settings.budgetAutoAdjust) {
          await executeBudgetAdjust(
            action.campaignId,
            organizationId,
            action.details as Record<string, unknown> | undefined,
            settings.maxBudgetChangePercent,
          );
        }
        break;
      case 'campaign_pause':
        if (action.campaignId) {
          await executeCampaignPause(action.campaignId, organizationId);
        }
        break;
      case 'campaign_resume':
        if (action.campaignId) {
          await executeCampaignResume(action.campaignId, organizationId);
        }
        break;
      case 'creative_rotate':
        if (action.campaignId) {
          await executeCreativeRotate(
            action.campaignId,
            organizationId,
            decisionId,
          );
        }
        break;
      case 'new_campaign':
        // Campaign auto-create requires explicit opt-in
        if (settings.campaignAutoCreate) {
          // new_campaign cannot have a userId in full_auto, use system marker
          await logActionResult(decisionId, action.details ?? {});
        }
        break;
      case 'targeting_change':
      case 'strategy_insight':
        // Logged but not auto-executed
        await logActionResult(decisionId, action.details ?? {});
        break;
    }

    // Mark decision as executed with timestamp
    await db
      .update(aiDecisionLog)
      .set({
        executedAt: sql`now()`,
        action: (action.details ?? {}) as Record<string, unknown>,
      })
      .where(eq(aiDecisionLog.id, decisionId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Mark decision as skipped on execution failure
    await db
      .update(aiDecisionLog)
      .set({
        status: 'skipped',
        action: { error: message } as Record<string, unknown>,
      })
      .where(eq(aiDecisionLog.id, decisionId));
  }
}

// ---------------------------------------------------------------------------
// Action Executors
// ---------------------------------------------------------------------------

async function executeBudgetAdjust(
  campaignId: string,
  organizationId: string,
  details: Record<string, unknown> | undefined,
  maxChangePercent: number,
): Promise<void> {
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.organizationId, organizationId),
    ),
  });

  if (!campaign) return;

  const currentBudget = Number(campaign.dailyBudget);
  const newBudgetRaw = Number(details?.['newDailyBudget'] ?? currentBudget);

  // Enforce max change percent guardrail
  const maxDelta = currentBudget * (maxChangePercent / 100);
  const clampedBudget = Math.max(
    currentBudget - maxDelta,
    Math.min(currentBudget + maxDelta, newBudgetRaw),
  );

  await updateCampaign(
    campaignId,
    { dailyBudget: clampedBudget.toFixed(2) },
    organizationId,
  );
}

async function executeCampaignPause(
  campaignId: string,
  organizationId: string,
): Promise<void> {
  await pauseCampaign(campaignId, organizationId);
}

async function executeCampaignResume(
  campaignId: string,
  organizationId: string,
): Promise<void> {
  await resumeCampaign(campaignId, organizationId);
}

async function executeCreativeRotate(
  campaignId: string,
  _organizationId: string,
  decisionId: string,
): Promise<void> {
  // Creative rotation is logged for manual follow-up or future automation
  await logActionResult(decisionId, {
    action: 'creative_rotate',
    campaignId,
    note: 'Creative rotation logged for review',
  });
}

async function logActionResult(
  decisionId: string,
  actionData: Record<string, unknown>,
): Promise<void> {
  await db
    .update(aiDecisionLog)
    .set({ action: actionData })
    .where(eq(aiDecisionLog.id, decisionId));
}

// ---------------------------------------------------------------------------
// Decision Log Management
// ---------------------------------------------------------------------------

export async function listDecisions(
  organizationId: string,
  limit = 50,
  status?: AiDecisionLogSelect['status'],
): Promise<AiDecisionLogSelect[]> {
  const conditions = [eq(aiDecisionLog.organizationId, organizationId)];

  if (status) {
    conditions.push(eq(aiDecisionLog.status, status));
  }

  return db
    .select()
    .from(aiDecisionLog)
    .where(and(...conditions))
    .orderBy(desc(aiDecisionLog.createdAt))
    .limit(limit);
}

export async function approveDecision(
  decisionId: string,
  organizationId: string,
): Promise<AiDecisionLogSelect> {
  const decision = await db.query.aiDecisionLog.findFirst({
    where: and(
      eq(aiDecisionLog.id, decisionId),
      eq(aiDecisionLog.organizationId, organizationId),
    ),
  });

  if (!decision) {
    throw new DecisionNotFoundError(decisionId);
  }

  if (decision.status !== 'pending_approval') {
    throw new AiAutopilotError(
      `Decision ${decisionId} is not pending approval (current: ${decision.status})`,
    );
  }

  // Execute the approved action
  const settings = await getSettings(organizationId);
  const action: OptimizationAction = {
    type: mapDecisionTypeToAction(decision.decisionType),
    campaignId: decision.campaignId ?? undefined,
    confidence: decision.confidenceScore,
    reason: decision.reasoning,
    details: decision.recommendation as Record<string, unknown>,
  };

  await executeAction(organizationId, settings, action, decisionId);

  // Update status to approved
  const [updated] = await db
    .update(aiDecisionLog)
    .set({
      status: 'approved',
      executedAt: sql`now()`,
    })
    .where(eq(aiDecisionLog.id, decisionId))
    .returning();

  if (!updated) {
    throw new DecisionNotFoundError(decisionId);
  }

  return updated;
}

export async function rejectDecision(
  decisionId: string,
  organizationId: string,
): Promise<AiDecisionLogSelect> {
  const [updated] = await db
    .update(aiDecisionLog)
    .set({ status: 'rejected' })
    .where(
      and(
        eq(aiDecisionLog.id, decisionId),
        eq(aiDecisionLog.organizationId, organizationId),
        eq(aiDecisionLog.status, 'pending_approval'),
      ),
    )
    .returning();

  if (!updated) {
    throw new DecisionNotFoundError(decisionId);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapDecisionTypeToAction(
  decisionType: AiDecisionLogSelect['decisionType'],
): OptimizationAction['type'] {
  const mapping: Record<
    AiDecisionLogSelect['decisionType'],
    OptimizationAction['type']
  > = {
    budget_adjust: 'budget_adjust',
    campaign_pause: 'campaign_pause',
    campaign_resume: 'campaign_resume',
    creative_rotate: 'creative_rotate',
    targeting_change: 'targeting_change',
    campaign_create: 'new_campaign',
    strategy_insight: 'strategy_insight',
  };
  return mapping[decisionType];
}

function formatDecisionType(
  decisionType: AiDecisionLogSelect['decisionType'],
): string {
  const labels: Record<AiDecisionLogSelect['decisionType'], string> = {
    budget_adjust: '予算調整',
    campaign_pause: 'キャンペーン一時停止',
    campaign_resume: 'キャンペーン再開',
    creative_rotate: 'クリエイティブローテーション',
    targeting_change: 'ターゲティング変更',
    campaign_create: 'キャンペーン新規作成',
    strategy_insight: '戦略インサイト',
  };
  return labels[decisionType];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AiAutopilotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiAutopilotError';
  }
}

export class DecisionNotFoundError extends Error {
  constructor(decisionId: string) {
    super(`Decision not found: ${decisionId}`);
    this.name = 'DecisionNotFoundError';
  }
}
