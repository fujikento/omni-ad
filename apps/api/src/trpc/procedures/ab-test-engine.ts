import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  createTest,
  bulkCreateTests,
  startTest,
  pauseTest,
  resumeTest,
  cancelTest,
  manualDeclareWinner,
  getTestResults,
  listTests,
  getActiveTestCount,
  recordEvent,
  autoCreateTestsFromBatch,
  ABTestNotFoundError,
  ABTestValidationError,
  ABTestStateError,
  ABTestCreationError,
} from '../../services/ab-test-engine.service.js';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Shared input schemas
// ---------------------------------------------------------------------------

const abTestVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  creativeId: z.string().uuid().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const trafficAllocationSchema = z.object({
  method: z.enum(['equal', 'thompson_sampling', 'epsilon_greedy']),
  explorationRate: z.number().min(0).max(1).optional(),
});

const statisticalConfigSchema = z.object({
  mde: z.number().positive(),
  alpha: z.number().positive().max(0.5),
  power: z.number().positive().max(1),
  sequentialTesting: z.boolean(),
});

const testTypeSchema = z.enum([
  'creative',
  'headline',
  'cta',
  'targeting',
  'bid_strategy',
  'landing_page',
]);

const metricTypeSchema = z.enum(['ctr', 'cvr', 'roas', 'cpa']);

const abTestStatusSchema = z.enum([
  'draft',
  'running',
  'paused',
  'completed',
  'cancelled',
]);

const createTestInputSchema = z.object({
  name: z.string().min(1).max(200),
  campaignId: z.string().uuid().optional(),
  testType: testTypeSchema,
  metricType: metricTypeSchema,
  variants: z.array(abTestVariantSchema).min(2).max(50),
  trafficAllocation: trafficAllocationSchema,
  statisticalConfig: statisticalConfigSchema,
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof ABTestNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof ABTestValidationError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    });
  }
  if (error instanceof ABTestStateError) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: error.message,
    });
  }
  if (error instanceof ABTestCreationError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
    });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const abTestEngineRouter = router({
  create: organizationProcedure
    .input(createTestInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createTest(ctx.organizationId, input);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  bulkCreate: organizationProcedure
    .input(
      z.object({
        tests: z.array(createTestInputSchema).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await bulkCreateTests(ctx.organizationId, input.tests);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  start: organizationProcedure
    .input(z.object({ testId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await startTest(input.testId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  pause: organizationProcedure
    .input(z.object({ testId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await pauseTest(input.testId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  resume: organizationProcedure
    .input(z.object({ testId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await resumeTest(input.testId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  cancel: organizationProcedure
    .input(z.object({ testId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await cancelTest(input.testId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  declareWinner: organizationProcedure
    .input(
      z.object({
        testId: z.string().uuid(),
        winnerId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await manualDeclareWinner(
          input.testId,
          ctx.organizationId,
          input.winnerId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getResults: organizationProcedure
    .input(z.object({ testId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getTestResults(input.testId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  list: organizationProcedure
    .input(
      z
        .object({
          status: abTestStatusSchema.optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listTests(
          ctx.organizationId,
          input.status,
          input.limit,
          input.offset,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  activeCount: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getActiveTestCount(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  recordEvent: organizationProcedure
    .input(
      z.object({
        testId: z.string().uuid(),
        variantId: z.string().min(1),
        eventType: z.enum(['impression', 'click', 'conversion']),
        value: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await recordEvent(
          input.testId,
          input.variantId,
          input.eventType,
          ctx.organizationId,
          input.value,
        );
        return { success: true };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  autoCreateFromBatch: organizationProcedure
    .input(
      z.object({
        batchId: z.string().uuid(),
        campaignId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await autoCreateTestsFromBatch(
          ctx.organizationId,
          input.batchId,
          input.campaignId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
