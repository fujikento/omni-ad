import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  generateMassCreatives,
  getBatchStatus,
  listBatches,
  cancelBatch,
  BatchNotFoundError,
  BatchCreationError,
} from '../../services/creative-mass-production.service.js';
import { organizationProcedure, rbacProcedure, router } from '../trpc.js';

const DbPlatform = z.enum([
  'meta',
  'google',
  'x',
  'tiktok',
  'line_yahoo',
  'amazon',
  'microsoft',
]);

function handleServiceError(error: unknown): never {
  if (error instanceof BatchNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof BatchCreationError) {
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

export const creativeMassRouter = router({
  generate: rbacProcedure("creatives:create")
    .input(
      z.object({
        name: z.string().min(1).max(200),
        productInfo: z.object({
          name: z.string().min(1),
          description: z.string().min(1),
          usp: z.string().min(1),
          targetAudience: z.string().min(1),
          price: z.string().optional(),
        }),
        platforms: z.array(DbPlatform).min(1),
        language: z.enum(['ja', 'en']).default('ja'),
        keigoLevel: z.enum(['casual', 'polite', 'formal']).default('polite'),
        headlineAngles: z
          .array(z.string().min(1))
          .min(1)
          .max(20),
        bodyApproaches: z
          .array(z.string().min(1))
          .min(1)
          .max(10),
        ctaVariations: z
          .array(z.string().min(1))
          .min(1)
          .max(10),
        imageStyles: z.array(z.string().min(1)).default([]),
        targetCount: z.number().int().min(1).max(2000).default(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await generateMassCreatives(
          ctx.organizationId,
          ctx.userId,
          input,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  batchStatus: organizationProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getBatchStatus(input.batchId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  listBatches: organizationProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listBatches(
          ctx.organizationId,
          input.limit,
          input.offset,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  cancelBatch: rbacProcedure("creatives:create")
    .input(z.object({ batchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await cancelBatch(input.batchId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
