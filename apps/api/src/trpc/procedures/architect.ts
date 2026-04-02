import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  deployCampaignPlan,
  generateCampaignPlan,
} from '../../services/campaign-architect.service.js';
import type { CampaignPlan } from '../../services/campaign-architect.service.js';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const GeneratePlanInput = z.object({
  businessGoal: z.string().min(10).max(2000),
  monthlyBudget: z.number().positive(),
  targetAudience: z.string().max(1000).optional(),
  productUrl: z.string().url().optional(),
});

const CampaignTargetingSchema = z.object({
  ageMin: z.number().int().min(13).max(99),
  ageMax: z.number().int().min(13).max(99),
  genders: z.array(z.string()),
  interests: z.array(z.string()),
  locations: z.array(z.string()),
});

const PlannedCampaignSchema = z.object({
  name: z.string(),
  platform: z.string(),
  objective: z.string(),
  dailyBudget: z.number(),
  targeting: CampaignTargetingSchema,
  creativeRecommendations: z.array(z.string()),
});

const PlatformRecommendationSchema = z.object({
  platform: z.string(),
  budgetShare: z.number(),
  reason: z.string(),
});

const FunnelStageSchema = z.object({
  stage: z.string(),
  platforms: z.array(z.string()),
  objective: z.string(),
});

const EstimatedResultsSchema = z.object({
  impressions: z.number(),
  clicks: z.number(),
  conversions: z.number(),
  roas: z.number(),
});

const CreativeDirectionSchema = z.object({
  themes: z.array(z.string()),
  toneGuide: z.string(),
  keigoLevel: z.string(),
});

const CampaignPlanSchema = z.object({
  summary: z.string(),
  recommendedPlatforms: z.array(PlatformRecommendationSchema),
  campaigns: z.array(PlannedCampaignSchema),
  funnelStrategy: z.array(FunnelStageSchema),
  estimatedResults: EstimatedResultsSchema,
  creativeDirection: CreativeDirectionSchema,
});

const DeployPlanInput = z.object({
  plan: CampaignPlanSchema,
  productUrl: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// Error Handler
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const architectRouter = router({
  generatePlan: organizationProcedure
    .input(GeneratePlanInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await generateCampaignPlan({
          organizationId: ctx.organizationId,
          businessGoal: input.businessGoal,
          monthlyBudget: input.monthlyBudget,
          targetAudience: input.targetAudience,
          productUrl: input.productUrl,
        });
      } catch (error) {
        handleServiceError(error);
      }
    }),

  deployPlan: organizationProcedure
    .input(DeployPlanInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deployCampaignPlan(
          ctx.organizationId,
          input.plan as CampaignPlan,
          ctx.userId,
          input.productUrl,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
