import { autopilotCycleJobSchema, type AutopilotCycleJob } from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import {
  aiSettings,
  aiDecisionLog,
  campaigns,
  metricsDaily,
  notifications,
} from '@omni-ad/db/schema';
import { decryptToken } from '@omni-ad/auth';
import { getActiveEvents } from '@omni-ad/ai-engine';
import type { SeasonalEvent } from '@omni-ad/ai-engine';
import { and, desc, eq, gte, sql } from 'drizzle-orm';

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
      `[ai-autopilot] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  warn(message, meta) {
    process.stdout.write(
      `[ai-autopilot] WARN: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  error(message, meta) {
    process.stderr.write(
      `[ai-autopilot] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AiSettingsSelect = typeof aiSettings.$inferSelect;
type MetricsDailySelect = typeof metricsDaily.$inferSelect;

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

// ---------------------------------------------------------------------------
// Claude Tool Schema
// ---------------------------------------------------------------------------

const OPTIMIZATION_ACTIONS_TOOL = {
  name: 'output_optimization_actions',
  description: '広告キャンペーンの最適化アクションを出力してください',
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
// Main Processor
// ---------------------------------------------------------------------------

export async function processAiAutopilot(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = autopilotCycleJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: AutopilotCycleJob = parsed.data;
  const { organizationId } = data;

  logger.info('Starting AI autopilot cycle', { organizationId });

  try {
    const result = await runAutopilotCycle(organizationId);

    logger.info('AI autopilot cycle completed', {
      organizationId,
      strategySummary: result.strategySummary.slice(0, 200),
      actionsProcessed: result.actionsProcessed,
      decisionsCreated: result.decisionsCreated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('AI autopilot cycle failed', {
      organizationId,
      error: message,
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Autopilot Cycle (self-contained for worker context)
// ---------------------------------------------------------------------------

async function runAutopilotCycle(
  organizationId: string,
): Promise<{
  strategySummary: string;
  actionsProcessed: number;
  decisionsCreated: number;
}> {
  // 1. Fetch settings
  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
  });

  if (!settings) {
    throw new Error('AI settings not found for organization');
  }

  if (!settings.claudeApiKeyEncrypted) {
    throw new Error('Claude API key not configured');
  }

  if (!settings.autopilotEnabled) {
    throw new Error('Autopilot is not enabled');
  }

  const apiKey = decryptToken(settings.claudeApiKeyEncrypted);

  // 2. Gather data
  const activeCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.organizationId, organizationId),
      sql`${campaigns.status} IN ('active', 'paused')`,
    ),
    with: { platformDeployments: true },
  });

  if (activeCampaigns.length === 0) {
    logger.info('No active campaigns to optimize', { organizationId });
    return {
      strategySummary: 'アクティブなキャンペーンがないため、最適化をスキップしました。',
      actionsProcessed: 0,
      decisionsCreated: 0,
    };
  }

  const campaignMetrics = await gatherCampaignMetrics(activeCampaigns);
  const seasonalEvents = getActiveEvents(new Date());

  // 3. Build prompt and call Claude
  const prompt = buildPrompt(settings, campaignMetrics, seasonalEvents);
  const toolOutput = await callClaude(apiKey, prompt);

  // 4. Process actions
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
  campaignList: Array<{
    id: string;
    name: string;
    status: string;
    dailyBudget: string;
  }>,
): Promise<CampaignMetricsSummary[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const campaignIds = campaignList.map((c) => c.id);
  if (campaignIds.length === 0) return [];

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

  const metricsByCampaign = new Map<string, MetricsDailySelect[]>();
  for (const metric of allMetrics) {
    const existing = metricsByCampaign.get(metric.campaignId) ?? [];
    existing.push(metric);
    metricsByCampaign.set(metric.campaignId, existing);
  }

  return campaignList.map((campaign) => {
    const metrics = metricsByCampaign.get(campaign.id) ?? [];

    const totalImpressions = metrics.reduce((s, m) => s + m.impressions, 0);
    const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0);
    const totalConversions = metrics.reduce((s, m) => s + m.conversions, 0);
    const totalSpend = metrics.reduce((s, m) => s + Number(m.spend), 0);
    const totalRevenue = metrics.reduce((s, m) => s + Number(m.revenue), 0);
    const avgRoas =
      metrics.length > 0
        ? metrics.reduce((s, m) => s + m.roas, 0) / metrics.length
        : 0;
    const avgCtr =
      metrics.length > 0
        ? metrics.reduce((s, m) => s + m.ctr, 0) / metrics.length
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

function buildPrompt(
  settings: AiSettingsSelect,
  campaignMetrics: CampaignMetricsSummary[],
  seasonalEvents: SeasonalEvent[],
): string {
  const sections: string[] = [];

  sections.push('# 組織設定');
  sections.push(`- リスク許容度: ${settings.riskTolerance}`);
  sections.push(`- 最大予算変更幅: ${settings.maxBudgetChangePercent}%`);
  sections.push(`- 予算自動調整: ${settings.budgetAutoAdjust ? '有効' : '無効'}`);
  sections.push(`- クリエイティブ自動ローテーション: ${settings.creativeAutoRotate ? '有効' : '無効'}`);
  sections.push(`- キャンペーン自動作成: ${settings.campaignAutoCreate ? '有効' : '無効'}`);
  if (settings.targetRoas !== null && settings.targetRoas !== undefined) {
    sections.push(`- 目標ROAS: ${settings.targetRoas}`);
  }
  if (settings.monthlyBudgetCap !== null && settings.monthlyBudgetCap !== undefined) {
    sections.push(`- 月次予算上限: ¥${settings.monthlyBudgetCap}`);
  }
  sections.push('');

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

    const anomalies: string[] = [];
    if (cm.avgRoas < 1 && cm.totalSpend > 0) {
      anomalies.push('ROAS < 1.0 (赤字)');
    }
    if (cm.metrics.length >= 3) {
      const recentCtr = cm.metrics.slice(0, 3).reduce((s, m) => s + m.ctr, 0) / 3;
      const olderCtr =
        cm.metrics.length > 3
          ? cm.metrics.slice(3).reduce((s, m) => s + m.ctr, 0) / cm.metrics.slice(3).length
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
// Claude API
// ---------------------------------------------------------------------------

async function callClaude(
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
    throw new Error(`Claude API error ${response.status}: ${text.slice(0, 500)}`);
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

  throw new Error(
    'Claude response did not include output_optimization_actions tool_use block',
  );
}

// ---------------------------------------------------------------------------
// Action Processing
// ---------------------------------------------------------------------------

type DecisionType = typeof aiDecisionLog.$inferSelect['decisionType'];
type DecisionStatus = typeof aiDecisionLog.$inferSelect['status'];

function mapActionToDecisionType(
  actionType: OptimizationAction['type'],
): DecisionType {
  const mapping: Record<OptimizationAction['type'], DecisionType> = {
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

function resolveStatus(
  mode: AiSettingsSelect['autopilotMode'],
  action: OptimizationAction,
): DecisionStatus {
  if (action.type === 'strategy_insight') return 'executed';
  return mode === 'full_auto' ? 'executed' : 'pending_approval';
}

async function processActions(
  organizationId: string,
  settings: AiSettingsSelect,
  toolOutput: ClaudeToolOutput,
): Promise<number> {
  let createdCount = 0;

  for (const action of toolOutput.actions) {
    const decisionType = mapActionToDecisionType(action.type);
    const status = resolveStatus(settings.autopilotMode, action);

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
    createdCount++;

    // Execute immediately in full_auto mode
    if (status === 'executed' && action.type !== 'strategy_insight') {
      try {
        await executeAction(
          organizationId,
          settings,
          action,
          decision.id,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Action execution failed', {
          decisionId: decision.id,
          error: message,
        });
        await db
          .update(aiDecisionLog)
          .set({
            status: 'skipped',
            action: { error: message } as Record<string, unknown>,
          })
          .where(eq(aiDecisionLog.id, decision.id));
      }
    }

    // Notify for pending approvals
    if (status === 'pending_approval') {
      await db.insert(notifications).values({
        organizationId,
        type: 'info',
        title: 'AI最適化提案',
        message: `${action.type}: ${action.reason.slice(0, 200)}`,
        source: 'ai_autopilot',
        metadata: {
          decisionId: decision.id,
          decisionType,
          confidence: action.confidence,
        },
      });
    }
  }

  // Summary notification for full_auto executions
  if (settings.autopilotMode === 'full_auto' && createdCount > 0) {
    await db.insert(notifications).values({
      organizationId,
      type: 'success',
      title: 'AI自動最適化完了',
      message: `${createdCount}件のアクションを処理しました: ${toolOutput.strategy_summary.slice(0, 200)}`,
      source: 'ai_autopilot',
      metadata: {
        actionsProcessed: toolOutput.actions.length,
      },
    });
  }

  return createdCount;
}

async function executeAction(
  organizationId: string,
  settings: AiSettingsSelect,
  action: OptimizationAction,
  decisionId: string,
): Promise<void> {
  switch (action.type) {
    case 'budget_adjust': {
      if (!action.campaignId || !settings.budgetAutoAdjust) return;
      const campaign = await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, action.campaignId),
          eq(campaigns.organizationId, organizationId),
        ),
      });
      if (!campaign) return;

      const currentBudget = Number(campaign.dailyBudget);
      const details = action.details as Record<string, unknown> | undefined;
      const newBudgetRaw = Number(details?.['newDailyBudget'] ?? currentBudget);
      const maxDelta = currentBudget * (settings.maxBudgetChangePercent / 100);
      const clampedBudget = Math.max(
        currentBudget - maxDelta,
        Math.min(currentBudget + maxDelta, newBudgetRaw),
      );

      await db
        .update(campaigns)
        .set({ dailyBudget: clampedBudget.toFixed(2), updatedAt: sql`now()` })
        .where(eq(campaigns.id, action.campaignId));

      await db
        .update(aiDecisionLog)
        .set({
          executedAt: sql`now()`,
          action: {
            previousBudget: currentBudget,
            newBudget: clampedBudget,
          } as Record<string, unknown>,
        })
        .where(eq(aiDecisionLog.id, decisionId));
      return;
    }

    case 'campaign_pause': {
      if (!action.campaignId) return;
      await db
        .update(campaigns)
        .set({ status: 'paused', updatedAt: sql`now()` })
        .where(
          and(
            eq(campaigns.id, action.campaignId),
            eq(campaigns.organizationId, organizationId),
          ),
        );
      await db
        .update(aiDecisionLog)
        .set({ executedAt: sql`now()`, action: { paused: true } as Record<string, unknown> })
        .where(eq(aiDecisionLog.id, decisionId));
      return;
    }

    case 'campaign_resume': {
      if (!action.campaignId) return;
      await db
        .update(campaigns)
        .set({ status: 'active', updatedAt: sql`now()` })
        .where(
          and(
            eq(campaigns.id, action.campaignId),
            eq(campaigns.organizationId, organizationId),
          ),
        );
      await db
        .update(aiDecisionLog)
        .set({ executedAt: sql`now()`, action: { resumed: true } as Record<string, unknown> })
        .where(eq(aiDecisionLog.id, decisionId));
      return;
    }

    case 'creative_rotate':
    case 'targeting_change':
    case 'new_campaign':
      // Logged for review, not auto-executed beyond recording
      await db
        .update(aiDecisionLog)
        .set({
          executedAt: sql`now()`,
          action: (action.details ?? { note: 'logged' }) as Record<string, unknown>,
        })
        .where(eq(aiDecisionLog.id, decisionId));
      return;

    case 'strategy_insight':
      return;
  }
}
