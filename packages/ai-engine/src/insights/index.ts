/**
 * AI Insights Generator
 *
 * Uses Claude API to generate actionable insights
 * from cross-channel marketing data.
 */

export interface InsightInput {
  organizationId: string;
  metricsLast7Days: PlatformMetrics[];
  budgetHistory: BudgetSnapshot[];
  topCreatives: CreativePerformance[];
  attributionData: ChannelAttribution[];
}

export interface PlatformMetrics {
  platform: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  roas: number;
  trend: 'up' | 'down' | 'stable';
}

export interface BudgetSnapshot {
  date: string;
  allocations: Record<string, number>;
  totalRoas: number;
}

export interface CreativePerformance {
  creativeId: string;
  platform: string;
  ctr: number;
  cvr: number;
  roas: number;
}

export interface ChannelAttribution {
  channel: string;
  credit: number;
  touchpoints: number;
}

export type InsightType = 'opportunity' | 'warning' | 'achievement';
export type InsightSeverity = 'high' | 'medium' | 'low';

export interface Insight {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  explanation: string;
  recommendation: string;
  estimatedImpact: {
    roasChange: number;
    revenueChange: number;
  } | null;
  actionType: string | null;
}

const INSIGHTS_TOOL_SCHEMA = {
  name: 'output_insights',
  description: '広告パフォーマンスデータに基づくインサイトをJSON配列で出力してください',
  input_schema: {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        minItems: 3,
        maxItems: 10,
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['opportunity', 'warning', 'achievement'] },
            severity: { type: 'string', enum: ['high', 'medium', 'low'] },
            title: { type: 'string' },
            explanation: { type: 'string' },
            recommendation: { type: 'string' },
            estimatedImpact: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    roasChange: { type: 'number' },
                    revenueChange: { type: 'number' },
                  },
                  required: ['roasChange', 'revenueChange'],
                },
                { type: 'null' },
              ],
            },
            actionType: {
              oneOf: [{ type: 'string' }, { type: 'null' }],
            },
          },
          required: [
            'type',
            'severity',
            'title',
            'explanation',
            'recommendation',
            'estimatedImpact',
            'actionType',
          ],
        },
      },
    },
    required: ['insights'],
  },
};

function buildInsightPrompt(input: InsightInput): string {
  const metricsText = input.metricsLast7Days
    .map(
      (m) =>
        `${m.platform}: インプレッション=${m.impressions.toLocaleString()}, ` +
        `クリック=${m.clicks.toLocaleString()}, コンバージョン=${m.conversions}, ` +
        `費用=¥${m.spend.toLocaleString()}, 収益=¥${m.revenue.toLocaleString()}, ` +
        `ROAS=${m.roas.toFixed(2)}, トレンド=${m.trend}`,
    )
    .join('\n');

  const attributionText = input.attributionData
    .map(
      (a) =>
        `${a.channel}: クレジット=${a.credit.toFixed(2)}, タッチポイント数=${a.touchpoints}`,
    )
    .join('\n');

  const topCreativeText = input.topCreatives
    .slice(0, 5)
    .map(
      (c) =>
        `クリエイティブID=${c.creativeId} (${c.platform}): CTR=${(c.ctr * 100).toFixed(2)}%, ` +
        `CVR=${(c.cvr * 100).toFixed(2)}%, ROAS=${c.roas.toFixed(2)}`,
    )
    .join('\n');

  const roasTrend =
    input.budgetHistory.length >= 2
      ? (() => {
          const first = input.budgetHistory[0]?.totalRoas ?? 0;
          const last = input.budgetHistory[input.budgetHistory.length - 1]?.totalRoas ?? 0;
          const change = ((last - first) / Math.max(first, 0.01)) * 100;
          return `週間ROAS推移: ${first.toFixed(2)} → ${last.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(1)}%)`;
        })()
      : 'ROAS履歴データ不足';

  return [
    `# 広告パフォーマンスレポート（過去7日間）`,
    ``,
    `## プラットフォーム別指標`,
    metricsText,
    ``,
    `## アトリビューション（チャネル貢献度）`,
    attributionText,
    ``,
    `## トップクリエイティブ`,
    topCreativeText,
    ``,
    `## 予算推移`,
    roasTrend,
    ``,
    `以上のデータを分析し、3〜10件の日本語インサイトを生成してください。`,
    `各インサイトには具体的な改善提案と、可能であれば推定インパクト（ROAS変化・収益変化）を含めてください。`,
  ].join('\n');
}

function parseClaudeInsights(responseBody: unknown): Insight[] {
  const body = responseBody as Record<string, unknown>;
  const content = body['content'] as unknown[];
  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (b['type'] === 'tool_use' && b['name'] === 'output_insights') {
      const toolInput = b['input'] as Record<string, unknown>;
      return toolInput['insights'] as Insight[];
    }
  }
  throw new Error('Claude response did not include output_insights tool_use block');
}

export interface InsightOptions {
  anthropicApiKey?: string;
}

export async function generateInsights(
  input: InsightInput,
  options?: InsightOptions,
): Promise<Insight[]> {
  const apiKey = options?.anthropicApiKey ?? process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const userPrompt = buildInsightPrompt(input);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system:
        'あなたはデジタル広告の専門アナリストです。提供されたデータを分析し、具体的で実行可能なインサイトを日本語で生成してください。',
      messages: [{ role: 'user', content: userPrompt }],
      tools: [INSIGHTS_TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'output_insights' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  return parseClaudeInsights(body);
}
