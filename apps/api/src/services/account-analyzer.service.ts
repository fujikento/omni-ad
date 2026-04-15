/**
 * Account Analyzer Service
 *
 * Analyzes a connected ad platform account using real campaign/metrics data
 * from the platform adapter, then sends everything to Claude for structured
 * diagnosis (improvements, risks, overall health score, Japanese summary).
 */

import { db } from '@omni-ad/db';
import {
  accountAnalyses,
  aiSettings,
  platformConnections,
} from '@omni-ad/db/schema';
import type {
  AccountSummary,
  ExistingCampaignEntry,
  SpendingPattern,
  PerformanceDiagnosis,
  ImprovementEntry,
  RiskEntry,
} from '@omni-ad/db/schema';
import { decryptToken, encryptToken, isTokenExpiringSoon } from '@omni-ad/auth';
import { adapterRegistry } from '@omni-ad/platform-adapters';
import type {
  NormalizedCampaign,
  NormalizedMetrics,
} from '@omni-ad/platform-adapters';
import { Platform as PlatformEnum } from '@omni-ad/shared';
import { and, desc, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlatformConnectionSelect = typeof platformConnections.$inferSelect;
type AccountAnalysisSelect = typeof accountAnalyses.$inferSelect;
type Platform = PlatformConnectionSelect['platform'];

interface ClaudeAnalysisOutput {
  overallScore: number;
  aiSummary: string;
  improvements: ImprovementEntry[];
  risks: RiskEntry[];
  performanceDiagnosis: PerformanceDiagnosis;
}

// ---------------------------------------------------------------------------
// Platform string -> enum mapper (mirrors platform-executor.service.ts)
// ---------------------------------------------------------------------------

const PLATFORM_STRING_TO_ENUM: Record<string, PlatformEnum> = {
  meta: PlatformEnum.META,
  google: PlatformEnum.GOOGLE,
  x: PlatformEnum.X,
  tiktok: PlatformEnum.TIKTOK,
  line_yahoo: PlatformEnum.LINE_YAHOO,
  amazon: PlatformEnum.AMAZON,
  microsoft: PlatformEnum.MICROSOFT,
};

function toPlatformEnum(platform: Platform): PlatformEnum {
  const mapped = PLATFORM_STRING_TO_ENUM[platform];
  if (!mapped) throw new AccountAnalyzerError(`Unknown platform: ${platform}`);
  return mapped;
}

// ---------------------------------------------------------------------------
// Claude tool schema
// ---------------------------------------------------------------------------

const ACCOUNT_ANALYSIS_TOOL = {
  name: 'output_account_analysis',
  description:
    '広告アカウントの分析結果を構造化して出力してください',
  input_schema: {
    type: 'object',
    properties: {
      overallScore: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'アカウント健全性スコア (0-100)',
      },
      aiSummary: {
        type: 'string',
        description: '日本語で2-3段落のアカウント分析サマリー',
      },
      improvements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
            },
            title: { type: 'string' },
            description: { type: 'string' },
            estimatedImpact: { type: 'string' },
            actionType: { type: 'string' },
          },
          required: ['priority', 'title', 'description'],
        },
      },
      risks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['critical', 'warning', 'info'],
            },
            title: { type: 'string' },
            description: { type: 'string' },
            affectedCampaigns: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['severity', 'title', 'description'],
        },
      },
      performanceDiagnosis: {
        type: 'object',
        properties: {
          topPerformers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                roas: { type: 'number' },
                reason: { type: 'string' },
              },
              required: ['name', 'roas', 'reason'],
            },
          },
          underPerformers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                roas: { type: 'number' },
                issue: { type: 'string' },
              },
              required: ['name', 'roas', 'issue'],
            },
          },
          opportunities: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['topPerformers', 'underPerformers', 'opportunities'],
      },
    },
    required: [
      'overallScore',
      'aiSummary',
      'improvements',
      'risks',
      'performanceDiagnosis',
    ],
  },
} as const;

const SYSTEM_PROMPT =
  'あなたは広告アカウントの診断専門家です。提供されたキャンペーンデータとメトリクスを分析し、' +
  'アカウントの健全性、改善提案、リスクを日本語で評価してください。';

// ---------------------------------------------------------------------------
// Main: analyzeAccount
// ---------------------------------------------------------------------------

export async function analyzeAccount(
  organizationId: string,
  connectionId: string,
): Promise<AccountAnalysisSelect> {
  // 1. Fetch connection
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.id, connectionId),
      eq(platformConnections.organizationId, organizationId),
    ),
  });

  if (!connection) {
    throw new ConnectionNotFoundError(connectionId);
  }

  if (connection.status !== 'active') {
    throw new AccountAnalyzerError(
      `Connection ${connectionId} is not active (current: ${connection.status})`,
    );
  }

  // 2. Decrypt tokens and get adapter
  const accessToken = await getValidAccessToken(connection);
  const adapter = adapterRegistry.get(toPlatformEnum(connection.platform));

  // 3. Fetch campaigns and metrics from the platform
  const [campaigns, metrics] = await Promise.all([
    adapter.getCampaigns(connection.platformAccountId, accessToken),
    adapter.getMetrics(
      connection.platformAccountId,
      {
        startDate: new Date(Date.now() - 30 * 86_400_000),
        endDate: new Date(),
        granularity: 'daily',
      },
      accessToken,
    ),
  ]);

  // 4. Compute derived data
  const summary = computeSummary(campaigns, metrics);
  const existingCampaigns = buildExistingCampaigns(campaigns, metrics);
  const spendingPattern = computeSpendingPattern(metrics);
  const performanceDiagnosis = computePerformanceDiagnosis(
    existingCampaigns,
  );

  // 5. Call Claude for AI-generated analysis
  const apiKey = await resolveClaudeApiKey(organizationId);
  const claudeOutput = await callClaudeForAnalysis(apiKey, {
    connection,
    campaigns,
    metrics,
    summary,
    existingCampaigns,
    spendingPattern,
    performanceDiagnosis,
  });

  // 6. Store and return the analysis
  const [analysis] = await db
    .insert(accountAnalyses)
    .values({
      organizationId,
      platformConnectionId: connectionId,
      platform: connection.platform,
      accountId: connection.platformAccountId,
      accountName: connection.platformAccountName,
      summary,
      existingCampaigns,
      spendingPattern,
      performanceDiagnosis: claudeOutput.performanceDiagnosis,
      improvements: claudeOutput.improvements,
      risks: claudeOutput.risks,
      overallScore: claudeOutput.overallScore,
      aiSummary: claudeOutput.aiSummary,
      analyzedAt: sql`now()`,
    })
    .returning();

  if (!analysis) {
    throw new AccountAnalyzerError('Failed to insert account analysis');
  }

  return analysis;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getLatestAnalysis(
  organizationId: string,
  connectionId: string,
): Promise<AccountAnalysisSelect | undefined> {
  return db.query.accountAnalyses.findFirst({
    where: and(
      eq(accountAnalyses.organizationId, organizationId),
      eq(accountAnalyses.platformConnectionId, connectionId),
    ),
    orderBy: [desc(accountAnalyses.analyzedAt)],
  });
}

export async function listAnalyses(
  organizationId: string,
  limit = 100,
): Promise<AccountAnalysisSelect[]> {
  return db.query.accountAnalyses.findMany({
    where: eq(accountAnalyses.organizationId, organizationId),
    orderBy: [desc(accountAnalyses.analyzedAt)],
    limit,
  });
}

export async function triggerReanalysis(
  organizationId: string,
  connectionId: string,
): Promise<AccountAnalysisSelect> {
  return analyzeAccount(organizationId, connectionId);
}

// ---------------------------------------------------------------------------
// Token Management
// ---------------------------------------------------------------------------

async function getValidAccessToken(
  connection: PlatformConnectionSelect,
): Promise<string> {
  const accessToken = decryptToken(connection.accessTokenEncrypted);

  if (isTokenExpiringSoon(connection.tokenExpiresAt)) {
    const adapter = adapterRegistry.get(toPlatformEnum(connection.platform));
    const refreshToken = decryptToken(connection.refreshTokenEncrypted);
    const newTokens = await adapter.refreshToken(refreshToken);

    await db
      .update(platformConnections)
      .set({
        accessTokenEncrypted: encryptToken(newTokens.accessToken),
        refreshTokenEncrypted: encryptToken(newTokens.refreshToken),
        tokenExpiresAt: newTokens.expiresAt,
        status: 'active',
        updatedAt: sql`now()`,
      })
      .where(eq(platformConnections.id, connection.id));

    return newTokens.accessToken;
  }

  return accessToken;
}

// ---------------------------------------------------------------------------
// Claude API Key Resolution
// ---------------------------------------------------------------------------

async function resolveClaudeApiKey(organizationId: string): Promise<string> {
  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
  });

  if (settings?.claudeApiKeyEncrypted) {
    return decryptToken(settings.claudeApiKeyEncrypted);
  }

  const envKey = process.env['CLAUDE_API_KEY'] ?? process.env['ANTHROPIC_API_KEY'];
  if (envKey) return envKey;

  throw new AccountAnalyzerError(
    'No Claude API key configured. Set one in AI settings or provide CLAUDE_API_KEY env var.',
  );
}

// ---------------------------------------------------------------------------
// Computation: Summary
// ---------------------------------------------------------------------------

function computeSummary(
  campaigns: NormalizedCampaign[],
  metrics: NormalizedMetrics[],
): AccountSummary {
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const pausedCampaigns = campaigns.filter((c) => c.status === 'paused').length;

  const totalSpend30d = metrics.reduce((sum, m) => sum + m.spend, 0);
  const avgDailySpend = totalSpend30d / 30;

  const totalRevenue = metrics.reduce((sum, m) => sum + m.revenue, 0);
  const avgRoas = totalSpend30d > 0 ? totalRevenue / totalSpend30d : 0;

  const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
  const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgCpc = totalClicks > 0 ? totalSpend30d / totalClicks : 0;

  const objectiveCounts = new Map<string, number>();
  for (const c of campaigns) {
    objectiveCounts.set(c.objective, (objectiveCounts.get(c.objective) ?? 0) + 1);
  }
  let topObjective = 'none';
  let maxCount = 0;
  for (const [objective, count] of objectiveCounts) {
    if (count > maxCount) {
      topObjective = objective;
      maxCount = count;
    }
  }

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns,
    pausedCampaigns,
    totalSpend30d,
    avgDailySpend,
    avgRoas,
    avgCtr,
    avgCpc,
    topObjective,
  };
}

// ---------------------------------------------------------------------------
// Computation: Existing Campaigns
// ---------------------------------------------------------------------------

function buildExistingCampaigns(
  campaigns: NormalizedCampaign[],
  metrics: NormalizedMetrics[],
): ExistingCampaignEntry[] {
  const metricsByCampaign = groupMetricsByCampaign(metrics);

  return campaigns.map((c) => {
    const campaignMetrics = metricsByCampaign.get(c.id) ?? [];
    const spend30d = campaignMetrics.reduce((s, m) => s + m.spend, 0);
    const revenue = campaignMetrics.reduce((s, m) => s + m.revenue, 0);
    const impressions = campaignMetrics.reduce((s, m) => s + m.impressions, 0);
    const clicks = campaignMetrics.reduce((s, m) => s + m.clicks, 0);
    const roas = spend30d > 0 ? revenue / spend30d : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      dailyBudget: c.dailyBudget,
      spend30d,
      roas,
      ctr,
      impressions,
    };
  });
}

// ---------------------------------------------------------------------------
// Computation: Spending Pattern
// ---------------------------------------------------------------------------

function computeSpendingPattern(metrics: NormalizedMetrics[]): SpendingPattern {
  // Daily spend aggregation
  const dailySpendMap = new Map<string, number>();
  for (const m of metrics) {
    const dateKey = m.timestamp.toISOString().slice(0, 10);
    dailySpendMap.set(dateKey, (dailySpendMap.get(dateKey) ?? 0) + m.spend);
  }

  const sortedDates = [...dailySpendMap.keys()].sort();
  const dailyTrend = sortedDates.map((d) => dailySpendMap.get(d) ?? 0);

  // Weekday averages
  const weekdayTotals = new Map<string, number[]>();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const dateStr of sortedDates) {
    const dayOfWeek = dayNames[new Date(dateStr).getDay()] ?? 'Unknown';
    const existing = weekdayTotals.get(dayOfWeek) ?? [];
    existing.push(dailySpendMap.get(dateStr) ?? 0);
    weekdayTotals.set(dayOfWeek, existing);
  }

  const weekdayAvg: Record<string, number> = {};
  let peakDay = '';
  let peakAvg = 0;
  let lowDay = '';
  let lowAvg = Infinity;

  for (const [day, spends] of weekdayTotals) {
    const avg = spends.reduce((a, b) => a + b, 0) / spends.length;
    weekdayAvg[day] = avg;
    if (avg > peakAvg) {
      peakAvg = avg;
      peakDay = day;
    }
    if (avg < lowAvg) {
      lowAvg = avg;
      lowDay = day;
    }
  }

  // Spend consistency: coefficient of variation (lower = more consistent)
  const mean = dailyTrend.length > 0
    ? dailyTrend.reduce((a, b) => a + b, 0) / dailyTrend.length
    : 0;
  const variance = dailyTrend.length > 0
    ? dailyTrend.reduce((sum, v) => sum + (v - mean) ** 2, 0) / dailyTrend.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const spendConsistency = mean > 0
    ? Math.max(0, 1 - stdDev / mean)
    : 0;

  return {
    dailyTrend,
    weekdayAvg,
    peakDay: peakDay || 'N/A',
    lowDay: lowDay || 'N/A',
    spendConsistency,
  };
}

// ---------------------------------------------------------------------------
// Computation: Performance Diagnosis
// ---------------------------------------------------------------------------

function computePerformanceDiagnosis(
  campaignEntries: ExistingCampaignEntry[],
): PerformanceDiagnosis {
  const activeCampaigns = campaignEntries.filter(
    (c) => c.status === 'active' || c.status === 'paused',
  );

  const sorted = [...activeCampaigns].sort((a, b) => b.roas - a.roas);

  const topPerformers = sorted.slice(0, 3).map((c) => ({
    name: c.name,
    roas: c.roas,
    reason: c.roas >= 2
      ? 'ROAS 2.0+: 高パフォーマンス'
      : 'アカウント内で相対的に高パフォーマンス',
  }));

  const underPerformers = sorted
    .slice(-3)
    .reverse()
    .map((c) => ({
      name: c.name,
      roas: c.roas,
      issue: c.roas < 1
        ? 'ROAS < 1.0: 赤字キャンペーン'
        : '改善の余地あり',
    }));

  return {
    topPerformers,
    underPerformers,
    opportunities: [],
  };
}

// ---------------------------------------------------------------------------
// Claude API Call
// ---------------------------------------------------------------------------

interface AnalysisPromptData {
  connection: PlatformConnectionSelect;
  campaigns: NormalizedCampaign[];
  metrics: NormalizedMetrics[];
  summary: AccountSummary;
  existingCampaigns: ExistingCampaignEntry[];
  spendingPattern: SpendingPattern;
  performanceDiagnosis: PerformanceDiagnosis;
}

async function callClaudeForAnalysis(
  apiKey: string,
  data: AnalysisPromptData,
): Promise<ClaudeAnalysisOutput> {
  const prompt = buildAnalysisPrompt(data);

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
      tools: [ACCOUNT_ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'output_account_analysis' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AccountAnalyzerError(
      `Claude API error ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const body: unknown = await response.json();
  return parseToolOutput(body);
}

function parseToolOutput(responseBody: unknown): ClaudeAnalysisOutput {
  const body = responseBody as Record<string, unknown>;
  const content = body['content'] as unknown[];

  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (
      b['type'] === 'tool_use' &&
      b['name'] === 'output_account_analysis'
    ) {
      return b['input'] as ClaudeAnalysisOutput;
    }
  }

  throw new AccountAnalyzerError(
    'Claude response did not include output_account_analysis tool_use block',
  );
}

// ---------------------------------------------------------------------------
// Prompt Building
// ---------------------------------------------------------------------------

function buildAnalysisPrompt(data: AnalysisPromptData): string {
  const { connection, summary, existingCampaigns, spendingPattern, performanceDiagnosis } = data;
  const sections: string[] = [];

  sections.push(`# 広告アカウント分析: ${connection.platformAccountName}`);
  sections.push(`プラットフォーム: ${connection.platform}`);
  sections.push(`アカウントID: ${connection.platformAccountId}`);
  sections.push('');

  // Summary
  sections.push('## アカウントサマリー（過去30日間）');
  sections.push(`- 総キャンペーン数: ${summary.totalCampaigns}`);
  sections.push(`- アクティブ: ${summary.activeCampaigns}`);
  sections.push(`- 一時停止: ${summary.pausedCampaigns}`);
  sections.push(`- 総費用: ¥${summary.totalSpend30d.toLocaleString('ja-JP')}`);
  sections.push(`- 平均日次費用: ¥${summary.avgDailySpend.toLocaleString('ja-JP')}`);
  sections.push(`- 平均ROAS: ${summary.avgRoas.toFixed(2)}`);
  sections.push(`- 平均CTR: ${(summary.avgCtr * 100).toFixed(2)}%`);
  sections.push(`- 平均CPC: ¥${summary.avgCpc.toFixed(0)}`);
  sections.push(`- 最多目的: ${summary.topObjective}`);
  sections.push('');

  // Campaign details
  sections.push('## キャンペーン一覧');
  for (const c of existingCampaigns) {
    sections.push(`### ${c.name} (ID: ${c.id})`);
    sections.push(`- ステータス: ${c.status}`);
    sections.push(`- 目的: ${c.objective}`);
    sections.push(`- 日次予算: ¥${c.dailyBudget.toLocaleString('ja-JP')}`);
    sections.push(`- 30日間費用: ¥${c.spend30d.toLocaleString('ja-JP')}`);
    sections.push(`- ROAS: ${c.roas.toFixed(2)}`);
    sections.push(`- CTR: ${(c.ctr * 100).toFixed(2)}%`);
    sections.push(`- インプレッション: ${c.impressions.toLocaleString('ja-JP')}`);
    sections.push('');
  }

  // Spending pattern
  sections.push('## 支出パターン');
  sections.push(`- ピーク日: ${spendingPattern.peakDay}`);
  sections.push(`- 低支出日: ${spendingPattern.lowDay}`);
  sections.push(`- 支出一貫性スコア: ${(spendingPattern.spendConsistency * 100).toFixed(1)}%`);
  sections.push('- 曜日別平均:');
  for (const [day, avg] of Object.entries(spendingPattern.weekdayAvg)) {
    sections.push(`  - ${day}: ¥${avg.toLocaleString('ja-JP')}`);
  }
  sections.push('');

  // Performance diagnosis
  sections.push('## パフォーマンス診断');
  sections.push('### トップパフォーマー');
  for (const p of performanceDiagnosis.topPerformers) {
    sections.push(`- ${p.name}: ROAS ${p.roas.toFixed(2)} — ${p.reason}`);
  }
  sections.push('### 低パフォーマー');
  for (const p of performanceDiagnosis.underPerformers) {
    sections.push(`- ${p.name}: ROAS ${p.roas.toFixed(2)} — ${p.issue}`);
  }
  sections.push('');

  sections.push(
    '上記データを分析し、output_account_analysis ツールで以下を出力してください：',
    '1. overallScore: 0-100のアカウント健全性スコア',
    '2. aiSummary: 日本語で2-3段落の分析サマリー',
    '3. improvements: 優先度付き改善提案',
    '4. risks: リスク評価',
    '5. performanceDiagnosis: 詳細なパフォーマンス診断（opportunities含む）',
  );

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupMetricsByCampaign(
  metrics: NormalizedMetrics[],
): Map<string, NormalizedMetrics[]> {
  const map = new Map<string, NormalizedMetrics[]>();
  for (const m of metrics) {
    const existing = map.get(m.campaignId) ?? [];
    existing.push(m);
    map.set(m.campaignId, existing);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AccountAnalyzerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountAnalyzerError';
  }
}

export class ConnectionNotFoundError extends AccountAnalyzerError {
  constructor(connectionId: string) {
    super(`Platform connection not found: ${connectionId}`);
    this.name = 'ConnectionNotFoundError';
  }
}
