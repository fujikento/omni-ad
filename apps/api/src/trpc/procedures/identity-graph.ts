import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  importCustomers,
  resolveIdentity,
  getProfile,
  createSegment,
  listSegments,
  getOverlap,
  getOverlapMatrix,
  IdentityNotFoundError,
  SegmentCreationError,
} from '../../services/identity-graph.service.js';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const platformIdsSchema = z.record(z.string(), z.string()).default({});

const customerRecordSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  platformIds: platformIdsSchema.optional(),
  audiences: z.array(z.string()).optional(),
});

const segmentCriteriaSchema = z.object({
  platforms: z.array(z.string()).optional(),
  minTouchpoints: z.number().int().min(1).optional(),
  audiences: z.array(z.string()).optional(),
  firstSeenAfter: z.string().datetime().optional(),
  lastSeenAfter: z.string().datetime().optional(),
  customRules: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(['eq', 'gt', 'lt', 'contains', 'in']),
        value: z.union([
          z.string(),
          z.number(),
          z.array(z.string()),
        ]),
      }),
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof IdentityNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof SegmentCreationError) {
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

export const identityGraphRouter = router({
  importCustomers: organizationProcedure
    .input(
      z.object({
        records: z.array(customerRecordSchema).min(1).max(10000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await importCustomers(ctx.organizationId, input.records);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  resolve: organizationProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
        platformId: z
          .object({
            platform: z.string(),
            id: z.string(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await resolveIdentity(ctx.organizationId, input);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getProfile: organizationProcedure
    .input(z.object({ identityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getProfile(input.identityId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  createSegment: organizationProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        criteria: segmentCriteriaSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createSegment(ctx.organizationId, input);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  listSegments: organizationProcedure
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
        return await listSegments(
          ctx.organizationId,
          input.limit,
          input.offset,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getOverlap: organizationProcedure
    .input(
      z.object({
        platformA: z.string().min(1),
        platformB: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getOverlap(
          ctx.organizationId,
          input.platformA,
          input.platformB,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getOverlapMatrix: organizationProcedure
    .input(
      z
        .object({
          platforms: z.array(z.string().min(1)).min(2).max(10).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const platforms = input?.platforms ?? [
          'meta',
          'google',
          'tiktok',
          'line_yahoo',
          'x',
          'amazon',
          'microsoft',
        ];
        return await getOverlapMatrix(ctx.organizationId, platforms);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
