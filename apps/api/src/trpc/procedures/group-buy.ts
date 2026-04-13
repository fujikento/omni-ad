import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  createGroup,
  createGroupCampaign,
  joinGroup,
  getGroupStatus,
  listGroups,
  getShareLink,
  GroupBuyNotFoundError,
  GroupBuyValidationError,
  GroupBuyStateError,
  GroupBuyCreationError,
} from '../../services/group-buy.service.js';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const platformSchema = z.enum([
  'meta',
  'google',
  'x',
  'tiktok',
  'line_yahoo',
  'amazon',
  'microsoft',
]);

const groupTierSchema = z.object({
  minParticipants: z.number().int().min(2),
  discount: z.number().min(0).max(100),
  label: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof GroupBuyNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof GroupBuyValidationError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    });
  }
  if (error instanceof GroupBuyStateError) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: error.message,
    });
  }
  if (error instanceof GroupBuyCreationError) {
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

export const groupBuyRouter = router({
  createCampaign: organizationProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        tiers: z.array(groupTierSchema).min(1).max(10),
        expiresInHours: z.number().int().min(1).max(720).default(48),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createGroupCampaign(ctx.organizationId, input);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  createGroup: organizationProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        initiatorId: z.string().min(1),
        tiers: z.array(groupTierSchema).min(1).max(10),
        expiresInHours: z.number().int().min(1).max(720).default(48),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createGroup(ctx.organizationId, input);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  joinGroup: organizationProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        userId: z.string().min(1),
        sourcePlatform: z.string().min(1),
        referralChain: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await joinGroup(ctx.organizationId, input);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getGroupStatus: organizationProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getGroupStatus(input.groupId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  listGroups: organizationProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listGroups(
          ctx.organizationId,
          input.campaignId,
          input.limit,
          input.offset,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getShareLink: organizationProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        sharerId: z.string().uuid(),
        platform: platformSchema,
        shareType: z.enum(['direct_link', 'story', 'message', 'post']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await getShareLink(
          input.groupId,
          ctx.organizationId,
          input.sharerId,
          input.platform,
          input.shareType,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
