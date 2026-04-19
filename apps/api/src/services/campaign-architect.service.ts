/**
 * AI Campaign Architect Service
 *
 * Takes a natural language business goal and generates a complete
 * multi-platform campaign plan using Claude API with structured output.
 */

import type { CampaignWithDeployments } from './campaign.service.js';
import { createCampaign, deployCampaign } from './campaign.service.js';
import { generateMassCreatives } from './creative-mass-production.service.js';
import { createNotification } from './notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArchitectInput {
  organizationId: string;
  businessGoal: string;
  monthlyBudget: number;
  targetAudience?: string;
  productUrl?: string;
}

export interface CampaignPlan {
  summary: string;
  recommendedPlatforms: PlatformRecommendation[];
  campaigns: PlannedCampaign[];
  funnelStrategy: FunnelStage[];
  estimatedResults: EstimatedResults;
  creativeDirection: CreativeDirection;
}

interface PlatformRecommendation {
  platform: string;
  budgetShare: number;
  reason: string;
}

export interface PlannedCampaign {
  name: string;
  platform: string;
  objective: string;
  dailyBudget: number;
  targeting: CampaignTargeting;
  creativeRecommendations: string[];
}

interface CampaignTargeting {
  ageMin: number;
  ageMax: number;
  genders: string[];
  interests: string[];
  locations: string[];
}

interface FunnelStage {
  stage: string;
  platforms: string[];
  objective: string;
}

interface EstimatedResults {
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
}

interface CreativeDirection {
  themes: string[];
  toneGuide: string;
  keigoLevel: string;
}

type SupportedPlatform =
  | 'meta'
  | 'google'
  | 'x'
  | 'tiktok'
  | 'line_yahoo'
  | 'amazon'
  | 'microsoft';

type CampaignObjective =
  | 'awareness'
  | 'traffic'
  | 'engagement'
  | 'leads'
  | 'conversion'
  | 'retargeting';

// ---------------------------------------------------------------------------
// Claude API Tool Schema
// ---------------------------------------------------------------------------

const CAMPAIGN_PLAN_TOOL_SCHEMA = {
  name: 'output_campaign_plan',
  description:
    'ビジネス目標に基づいた広告キャンペーン計画をJSON形式で出力してください',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '計画の概要（日本語）' },
      recommendedPlatforms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              enum: [
                'meta',
                'google',
                'x',
                'tiktok',
                'line_yahoo',
                'amazon',
                'microsoft',
              ],
            },
            budgetShare: {
              type: 'number',
              description: '0-1の割合',
            },
            reason: { type: 'string' },
          },
          required: ['platform', 'budgetShare', 'reason'],
        },
      },
      campaigns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            platform: {
              type: 'string',
              enum: [
                'meta',
                'google',
                'x',
                'tiktok',
                'line_yahoo',
                'amazon',
                'microsoft',
              ],
            },
            objective: {
              type: 'string',
              enum: [
                'awareness',
                'traffic',
                'engagement',
                'leads',
                'conversion',
                'retargeting',
              ],
            },
            dailyBudget: { type: 'number' },
            targeting: {
              type: 'object',
              properties: {
                ageMin: { type: 'number' },
                ageMax: { type: 'number' },
                genders: {
                  type: 'array',
                  items: { type: 'string' },
                },
                interests: {
                  type: 'array',
                  items: { type: 'string' },
                },
                locations: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: [
                'ageMin',
                'ageMax',
                'genders',
                'interests',
                'locations',
              ],
            },
            creativeRecommendations: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [
            'name',
            'platform',
            'objective',
            'dailyBudget',
            'targeting',
            'creativeRecommendations',
          ],
        },
      },
      funnelStrategy: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            stage: { type: 'string' },
            platforms: {
              type: 'array',
              items: { type: 'string' },
            },
            objective: { type: 'string' },
          },
          required: ['stage', 'platforms', 'objective'],
        },
      },
      estimatedResults: {
        type: 'object',
        properties: {
          impressions: { type: 'number' },
          clicks: { type: 'number' },
          conversions: { type: 'number' },
          roas: { type: 'number' },
        },
        required: ['impressions', 'clicks', 'conversions', 'roas'],
      },
      creativeDirection: {
        type: 'object',
        properties: {
          themes: { type: 'array', items: { type: 'string' } },
          toneGuide: { type: 'string' },
          keigoLevel: {
            type: 'string',
            enum: ['casual', 'polite', 'formal'],
          },
        },
        required: ['themes', 'toneGuide', 'keigoLevel'],
      },
    },
    required: [
      'summary',
      'recommendedPlatforms',
      'campaigns',
      'funnelStrategy',
      'estimatedResults',
      'creativeDirection',
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Plan Generation
// ---------------------------------------------------------------------------

export async function generateCampaignPlan(
  input: ArchitectInput,
): Promise<CampaignPlan> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const prompt = buildArchitectPrompt(input);

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
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
      tools: [CAMPAIGN_PLAN_TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'output_campaign_plan' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  return parseCampaignPlan(body);
}

// ---------------------------------------------------------------------------
// Plan Deployment
// ---------------------------------------------------------------------------

export async function deployCampaignPlan(
  organizationId: string,
  plan: CampaignPlan,
  userId: string,
  productUrl?: string,
): Promise<CampaignWithDeployments[]> {
  const createdCampaigns: CampaignWithDeployments[] = [];
  const creativeBatchIds: Array<{ campaignId: string; batchId: string }> = [];

  // Calculate a 30-day flight window starting tomorrow
  const startDate = new Date(Date.now() + 86_400_000)
    .toISOString()
    .slice(0, 10);
  const endDate = new Date(Date.now() + 31 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  for (const planned of plan.campaigns) {
    const platform = normalizePlatform(planned.platform);
    const objective = normalizeObjective(planned.objective);

    if (!platform || !objective) continue;

    // Calculate total budget from daily over 30 days
    const totalBudget = (planned.dailyBudget * 30).toFixed(2);

    // Map AI targeting to campaign targetingConfig
    const targetingConfig = {
      ageMin: planned.targeting.ageMin,
      ageMax: planned.targeting.ageMax,
      genders: planned.targeting.genders,
      interests: planned.targeting.interests,
      locations: planned.targeting.locations,
    };

    // Default bid strategy based on campaign objective
    const bidStrategy = objective === 'conversion' || objective === 'retargeting'
      ? 'auto_maximize_conversions' as const
      : undefined;

    const campaign = await createCampaign(
      {
        name: planned.name,
        objective,
        startDate,
        endDate,
        totalBudget,
        dailyBudget: planned.dailyBudget.toFixed(2),
        targetingConfig,
        bidStrategy,
        landingPageUrl: productUrl,
      },
      organizationId,
      userId,
    );

    // Auto-generate creatives from AI recommendations (best-effort).
    // Creative generation failure must not block campaign deployment — the
    // campaign is already created and deployed downstream; creative pipeline
    // runs async via mass-production workers.
    if (planned.creativeRecommendations.length > 0) {
      try {
        const batchResult = await generateMassCreatives(
          organizationId,
          userId,
          buildMassProductionInput(planned, plan, platform),
        );
        creativeBatchIds.push({
          campaignId: campaign.id,
          batchId: batchResult.batchId,
        });
      } catch (err) {
        console.warn(
          'campaign-architect: auto creative generation failed',
          {
            campaignId: campaign.id,
            error: err instanceof Error ? err.message : String(err),
          },
        );
      }
    }

    // Deploy to the specified platform
    const deployments = await deployCampaign(
      campaign.id,
      [platform],
      organizationId,
    );

    createdCampaigns.push({
      ...campaign,
      platformDeployments: deployments,
    });
  }

  // Notify the user
  await createNotification({
    organizationId,
    type: 'success',
    title: 'AIキャンペーン計画をデプロイしました',
    message: `${createdCampaigns.length}件のキャンペーンが作成されました: ${plan.summary.slice(0, 100)}`,
    source: 'campaign_architect',
    metadata: {
      campaignCount: createdCampaigns.length,
      platforms: plan.recommendedPlatforms.map((p) => p.platform),
      creativeBatchIds,
    },
  });

  return createdCampaigns;
}

// ---------------------------------------------------------------------------
// Creative Auto-Generation Helpers
// ---------------------------------------------------------------------------

function buildMassProductionInput(
  planned: PlannedCampaign,
  plan: CampaignPlan,
  platform: SupportedPlatform,
): import('./creative-mass-production.service.js').MassProductionInput {
  const keigoRaw = plan.creativeDirection.keigoLevel;
  const keigoLevel: 'casual' | 'polite' | 'formal' =
    keigoRaw === 'casual' || keigoRaw === 'formal' ? keigoRaw : 'polite';

  const audienceTokens = [
    ...planned.targeting.interests,
    ...planned.targeting.locations,
  ]
    .filter(Boolean)
    .join(', ');

  const headlineAngles = planned.creativeRecommendations
    .slice(0, 8)
    .filter((s) => s && s.trim().length > 0);

  return {
    name: `${planned.name} – auto`,
    productInfo: {
      name: planned.name,
      description: plan.summary.slice(0, 500),
      usp: plan.creativeDirection.themes.join(' / ').slice(0, 200),
      targetAudience: audienceTokens || plan.creativeDirection.toneGuide,
    },
    platforms: [platform],
    language: 'ja',
    keigoLevel,
    headlineAngles,
    bodyApproaches: ['benefit', 'story', 'question'],
    ctaVariations: ['start-now', 'free-trial', 'details'],
    imageStyles: ['professional', 'minimal'],
    targetCount: Math.min(Math.max(headlineAngles.length * 3, 6), 30),
  };
}

// ---------------------------------------------------------------------------
// Prompt Building
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return [
    'あなたは日本のデジタル広告の専門コンサルタントです。',
    '提供されたビジネス目標、予算、ターゲットオーディエンスを分析し、',
    '最適なマルチプラットフォーム広告キャンペーン計画を立案してください。',
    '',
    '以下の広告プラットフォームから選択可能です:',
    '- meta (Facebook/Instagram広告)',
    '- google (Google検索/ディスプレイ/YouTube広告)',
    '- x (X/旧Twitter広告)',
    '- tiktok (TikTok広告)',
    '- line_yahoo (LINE/Yahoo! JAPAN広告)',
    '- amazon (Amazon広告)',
    '- microsoft (Microsoft/Bing広告)',
    '',
    '日本市場の特性を考慮し、以下を最適化してください:',
    '- プラットフォーム選定（ターゲット層の利用率に基づく）',
    '- ファネル戦略（認知→興味→検討→購入）',
    '- 予算配分（ROAS最大化を基本として）',
    '- クリエイティブ方向性（日本語の敬語レベル含む）',
    '- 推定成果（業界ベンチマークに基づく現実的な数値）',
    '',
    '予算は日本円(JPY)で提供されます。',
    '各キャンペーンの日次予算の合計が月次予算/30以下になるようにしてください。',
  ].join('\n');
}

function buildArchitectPrompt(input: ArchitectInput): string {
  const sections = [
    '# キャンペーン計画リクエスト',
    '',
    `## ビジネス目標`,
    input.businessGoal,
    '',
    `## 月次予算`,
    `¥${input.monthlyBudget.toLocaleString('ja-JP')}`,
    '',
  ];

  if (input.targetAudience) {
    sections.push(`## ターゲットオーディエンス`, input.targetAudience, '');
  }

  if (input.productUrl) {
    sections.push(`## プロダクトURL`, input.productUrl, '');
  }

  sections.push(
    '上記の情報に基づき、最適なキャンペーン計画を立案してください。',
    '各キャンペーンには具体的なターゲティング設定とクリエイティブ推奨を含めてください。',
  );

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Response Parsing
// ---------------------------------------------------------------------------

function parseCampaignPlan(responseBody: unknown): CampaignPlan {
  const body = responseBody as Record<string, unknown>;
  const content = body['content'] as unknown[];

  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (
      b['type'] === 'tool_use' &&
      b['name'] === 'output_campaign_plan'
    ) {
      const toolInput = b['input'] as CampaignPlan;
      return toolInput;
    }
  }

  throw new Error(
    'Claude response did not include output_campaign_plan tool_use block',
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PLATFORMS: SupportedPlatform[] = [
  'meta',
  'google',
  'x',
  'tiktok',
  'line_yahoo',
  'amazon',
  'microsoft',
];

const VALID_OBJECTIVES: CampaignObjective[] = [
  'awareness',
  'traffic',
  'engagement',
  'leads',
  'conversion',
  'retargeting',
];

function normalizePlatform(
  platform: string,
): SupportedPlatform | undefined {
  const lower = platform.toLowerCase();
  return VALID_PLATFORMS.find((p) => p === lower);
}

function normalizeObjective(
  objective: string,
): CampaignObjective | undefined {
  const lower = objective.toLowerCase();
  return VALID_OBJECTIVES.find((o) => o === lower);
}
