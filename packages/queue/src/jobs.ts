import { z } from 'zod';

const platformSchema = z.enum([
  'meta',
  'google',
  'x',
  'tiktok',
  'line_yahoo',
  'amazon',
  'microsoft',
]);

// Ad Sync Jobs
export const syncCampaignJobSchema = z.object({
  organizationId: z.string().uuid(),
  platformConnectionId: z.string().uuid(),
  platform: platformSchema,
  direction: z.enum(['push', 'pull']),
});

export const syncAdGroupJobSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  platform: platformSchema,
  direction: z.enum(['push', 'pull']),
});

export const pullMetricsJobSchema = z.object({
  organizationId: z.string().uuid(),
  platform: platformSchema,
  campaignId: z.string().uuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// Creative Generation Jobs
export const generateTextJobSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  productInfo: z.object({
    name: z.string(),
    description: z.string(),
    price: z.number().optional(),
    targetAudience: z.string(),
    usp: z.string(),
  }),
  platforms: z.array(platformSchema),
  variantCount: z.number().int().min(1).max(20).default(5),
  language: z.enum(['ja', 'en']).default('ja'),
  keigoLevel: z.enum(['casual', 'polite', 'formal']).default('polite'),
});

export const generateImageJobSchema = z.object({
  organizationId: z.string().uuid(),
  creativeId: z.string().uuid(),
  prompt: z.string(),
  style: z.string().optional(),
  platforms: z.array(platformSchema),
  dimensions: z.array(
    z.object({ width: z.number().int(), height: z.number().int() })
  ),
});

export const generateVideoJobSchema = z.object({
  organizationId: z.string().uuid(),
  creativeId: z.string().uuid(),
  prompt: z.string(),
  durationSeconds: z.enum(['6', '15', '30']),
  platforms: z.array(platformSchema),
  imageFrameUrls: z.array(z.string().url()).optional(),
});

export const adaptToPlatformJobSchema = z.object({
  organizationId: z.string().uuid(),
  creativeId: z.string().uuid(),
  targetPlatform: platformSchema,
  sourceContent: z.object({
    headline: z.string(),
    body: z.string(),
    cta: z.string(),
    imageUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
  }),
});

// Budget Optimization Jobs
export const computeAllocationJobSchema = z.object({
  organizationId: z.string().uuid(),
  totalBudget: z.number().positive(),
  platforms: z.array(platformSchema),
  objective: z.enum(['maximize_roas', 'maximize_conversions', 'maximize_reach']),
});

export const executeBudgetReallocationJobSchema = z.object({
  organizationId: z.string().uuid(),
  allocationId: z.string().uuid(),
  allocations: z.record(platformSchema, z.number().nonnegative()),
});

export const computeForecastJobSchema = z.object({
  organizationId: z.string().uuid(),
  proposedAllocations: z.record(platformSchema, z.number().nonnegative()),
  forecastDays: z.number().int().min(1).max(90).default(7),
});

// Reporting Jobs
export const generateReportJobSchema = z.object({
  organizationId: z.string().uuid(),
  reportType: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  platforms: z.array(platformSchema).optional(),
  includeInsights: z.boolean().default(true),
});

export const computeAttributionJobSchema = z.object({
  organizationId: z.string().uuid(),
  modelType: z.enum(['markov', 'shapley', 'linear', 'last_click', 'first_click']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// Audience Sync Jobs
export const syncAudienceJobSchema = z.object({
  organizationId: z.string().uuid(),
  audienceId: z.string().uuid(),
  platform: platformSchema,
  direction: z.enum(['push', 'pull']),
});

export const computeOverlapJobSchema = z.object({
  organizationId: z.string().uuid(),
  audienceAId: z.string().uuid(),
  audienceBId: z.string().uuid(),
});

// Webhook Jobs
export const processWebhookJobSchema = z.object({
  platform: platformSchema,
  eventType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  receivedAt: z.string().datetime(),
  signature: z.string().optional(),
});

// Anomaly Detection Jobs
export const anomalyDetectionJobSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  checkTypes: z.array(
    z.enum([
      'spend_spike',
      'ctr_drop',
      'conversion_tracking',
      'bot_traffic',
      'budget_pacing',
      'creative_fatigue',
    ])
  ),
});

// Rules Evaluation Jobs
export const evaluateRulesJobSchema = z.object({
  organizationId: z.string().uuid(),
});

// AI Autopilot Jobs
export const autopilotCycleJobSchema = z.object({
  organizationId: z.string().uuid(),
});

// Competitor Monitor Jobs
export const competitorMonitorJobSchema = z.object({
  organizationId: z.string().uuid(),
});

// Creative Mass Production Jobs
export const massProductionChunkJobSchema = z.object({
  organizationId: z.string().uuid(),
  batchId: z.string().uuid(),
  chunkIndex: z.number().int().min(0),
  productInfo: z.object({
    name: z.string(),
    description: z.string(),
    usp: z.string(),
    targetAudience: z.string(),
    price: z.string().optional(),
  }),
  platform: z.string(),
  language: z.enum(['ja', 'en']),
  keigoLevel: z.enum(['casual', 'polite', 'formal']),
  combinations: z.array(
    z.object({
      headlineAngle: z.string(),
      bodyApproach: z.string(),
      ctaVariation: z.string(),
      imageStyle: z.string().optional(),
    }),
  ),
});

// A/B Test Evaluation Jobs
export const abTestEvaluationJobSchema = z.object({
  organizationId: z.string().uuid(),
  testId: z.string().uuid().optional(),
});

// Creative Optimization Jobs
export const creativeOptimizationJobSchema = z.object({
  organizationId: z.string().uuid(),
});

// Job type union
export type SyncCampaignJob = z.infer<typeof syncCampaignJobSchema>;
export type SyncAdGroupJob = z.infer<typeof syncAdGroupJobSchema>;
export type PullMetricsJob = z.infer<typeof pullMetricsJobSchema>;
export type GenerateTextJob = z.infer<typeof generateTextJobSchema>;
export type GenerateImageJob = z.infer<typeof generateImageJobSchema>;
export type GenerateVideoJob = z.infer<typeof generateVideoJobSchema>;
export type AdaptToPlatformJob = z.infer<typeof adaptToPlatformJobSchema>;
export type ComputeAllocationJob = z.infer<typeof computeAllocationJobSchema>;
export type ExecuteBudgetReallocationJob = z.infer<typeof executeBudgetReallocationJobSchema>;
export type ComputeForecastJob = z.infer<typeof computeForecastJobSchema>;
export type GenerateReportJob = z.infer<typeof generateReportJobSchema>;
export type ComputeAttributionJob = z.infer<typeof computeAttributionJobSchema>;
export type SyncAudienceJob = z.infer<typeof syncAudienceJobSchema>;
export type ComputeOverlapJob = z.infer<typeof computeOverlapJobSchema>;
export type ProcessWebhookJob = z.infer<typeof processWebhookJobSchema>;
export type AnomalyDetectionJob = z.infer<typeof anomalyDetectionJobSchema>;
export type EvaluateRulesJob = z.infer<typeof evaluateRulesJobSchema>;
export type AutopilotCycleJob = z.infer<typeof autopilotCycleJobSchema>;
export type CompetitorMonitorJob = z.infer<typeof competitorMonitorJobSchema>;
export type MassProductionChunkJob = z.infer<typeof massProductionChunkJobSchema>;
export type ABTestEvaluationJob = z.infer<typeof abTestEvaluationJobSchema>;
export type CreativeOptimizationJob = z.infer<typeof creativeOptimizationJobSchema>;
