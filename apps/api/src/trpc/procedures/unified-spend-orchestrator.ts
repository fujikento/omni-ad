import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  applyReallocationPlan,
  backfillActualRoas,
  computeActualRoasForAllocation,
  computeIncrementalLift,
  generateReallocationPlan,
  getAccuracySummary,
  projectCampaignBudgets,
} from '../../services/unified-spend-orchestrator.service.js';
import { organizationProcedure, rbacProcedure, router } from '../trpc.js';

function handleServiceError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

const OptionsSchema = z.object({
  lookbackHours: z.number().int().min(1).max(168).default(24),
  targetRoas: z.number().positive().max(20).optional(),
  maxShiftPercent: z.number().min(0.01).max(0.5).optional(),
  minRoasDelta: z.number().min(0).max(5).optional(),
  minDataPoints: z.number().int().min(1).max(100).optional(),
});

const PlanSchema = z.object({
  generatedAt: z.string(),
  lookbackHours: z.number(),
  totalBudget: z.number(),
  currentAllocations: z.record(z.number()),
  proposedAllocations: z.record(z.number()),
  shifts: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      amount: z.number(),
      reason: z.string(),
      overlapPercent: z.number().optional(),
    }),
  ),
  platformROAS: z.array(
    z.object({
      platform: z.string(),
      spend: z.number(),
      revenue: z.number(),
      conversions: z.number(),
      impressions: z.number(),
      clicks: z.number(),
      roas: z.number(),
      cpa: z.number(),
      ctr: z.number(),
      dataPoints: z.number(),
    }),
  ),
  predictedRoasImprovement: z.number(),
  confidence: z.enum(['low', 'medium', 'high']),
  reasoning: z.string(),
  creativePoolWarnings: z
    .array(
      z.object({
        platform: z.string(),
        creativeCount: z.number(),
        recommendedMinimum: z.number(),
        message: z.string(),
      }),
    )
    .optional(),
});

export const unifiedSpendOrchestratorRouter = router({
  preview: organizationProcedure
    .input(OptionsSchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        return await generateReallocationPlan(
          ctx.organizationId,
          input ?? {},
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  apply: rbacProcedure('budgets:manage')
    .input(z.object({ plan: PlanSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const plan = input.plan as Parameters<
          typeof applyReallocationPlan
        >[1];
        return await applyReallocationPlan(
          ctx.organizationId,
          plan,
          ctx.userId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  computeActual: rbacProcedure('budgets:manage')
    .input(z.object({ allocationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await computeActualRoasForAllocation(
          input.allocationId,
          ctx.organizationId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  backfillActual: rbacProcedure('budgets:manage')
    .input(
      z
        .object({
          minAgeHours: z.number().int().min(1).max(168).optional(),
          maxAgeHours: z.number().int().min(1).max(24 * 90).optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await backfillActualRoas(ctx.organizationId, input ?? {});
      } catch (error) {
        handleServiceError(error);
      }
    }),

  accuracy: organizationProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(20) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getAccuracySummary(
          ctx.organizationId,
          input?.limit ?? 20,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  projectCampaignBudgets: organizationProcedure
    .input(z.object({ allocationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await projectCampaignBudgets(
          input.allocationId,
          ctx.organizationId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  incrementalLift: organizationProcedure
    .input(
      z.object({
        allocationId: z.string().uuid(),
        windowHours: z.number().int().min(1).max(168).default(24),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await computeIncrementalLift(
          input.allocationId,
          ctx.organizationId,
          input.windowHours,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
