import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  CampaignNotFoundError,
  createCampaign,
  deleteCampaign,
  deployCampaign,
  getCampaign,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  updateCampaign,
} from "../../services/campaign.service.js";
import { organizationProcedure, router } from "../trpc.js";

const CampaignObjective = z.enum([
  "awareness",
  "traffic",
  "engagement",
  "leads",
  "conversion",
  "retargeting",
]);

const DbPlatform = z.enum([
  "meta",
  "google",
  "x",
  "tiktok",
  "line_yahoo",
  "amazon",
  "microsoft",
]);

const BidStrategySchema = z.enum([
  "auto_maximize_conversions",
  "auto_target_cpa",
  "auto_target_roas",
  "manual_cpc",
]);

const TargetingConfigSchema = z.object({
  ageMin: z.number().int().min(13).max(100).optional(),
  ageMax: z.number().int().min(13).max(100).optional(),
  genders: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  devices: z.array(z.string()).optional(),
  placements: z.array(z.string()).optional(),
  excludedAudiences: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
});

const KpiAlertsSchema = z.object({
  cpaThreshold: z.number().positive().optional(),
  roasThreshold: z.number().positive().optional(),
  ctrThreshold: z.number().positive().optional(),
});

const CreateCampaignInput = z.object({
  name: z.string().min(1).max(200),
  objective: CampaignObjective,
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  totalBudget: z.string().min(1),
  dailyBudget: z.string().min(1),
  funnelId: z.string().uuid().optional(),
  targetRoas: z.number().positive().optional(),
  targetCpa: z.string().optional(),
  bidStrategy: BidStrategySchema.optional(),
  landingPageUrl: z.string().url().optional(),
  conversionEndpointId: z.string().uuid().optional(),
  targetingConfig: TargetingConfigSchema.optional(),
  kpiAlerts: KpiAlertsSchema.optional(),
});

const UpdateCampaignInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  objective: CampaignObjective.optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  totalBudget: z.string().optional(),
  dailyBudget: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "completed", "error"]).optional(),
  funnelId: z.string().uuid().nullable().optional(),
  targetRoas: z.number().positive().nullable().optional(),
  targetCpa: z.string().nullable().optional(),
  bidStrategy: BidStrategySchema.nullable().optional(),
  landingPageUrl: z.string().url().nullable().optional(),
  conversionEndpointId: z.string().uuid().nullable().optional(),
  targetingConfig: TargetingConfigSchema.nullable().optional(),
  kpiAlerts: KpiAlertsSchema.nullable().optional(),
});

const DeployCampaignInput = z.object({
  id: z.string().uuid(),
  platforms: z.array(DbPlatform).min(1),
});

function handleServiceError(error: unknown): never {
  if (error instanceof CampaignNotFoundError) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: error,
  });
}

export const campaignsRouter = router({
  list: organizationProcedure
    .query(async ({ ctx }) => {
      try {
        return await listCampaigns(ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  get: organizationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const campaign = await getCampaign(input.id, ctx.organizationId);
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Campaign not found: ${input.id}`,
          });
        }
        return campaign;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleServiceError(error);
      }
    }),

  create: organizationProcedure
    .input(CreateCampaignInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createCampaign(input, ctx.organizationId, ctx.userId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  update: organizationProcedure
    .input(UpdateCampaignInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...fields } = input;
        return await updateCampaign(id, fields, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  deploy: organizationProcedure
    .input(DeployCampaignInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deployCampaign(
          input.id,
          input.platforms,
          ctx.organizationId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  pause: organizationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await pauseCampaign(input.id, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  resume: organizationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await resumeCampaign(input.id, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  delete: organizationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteCampaign(input.id, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
