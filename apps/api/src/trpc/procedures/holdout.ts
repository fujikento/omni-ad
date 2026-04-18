import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  computeHoldoutLift,
  createHoldoutGroup,
  getHoldoutGroup,
  listHoldoutGroups,
  setHoldoutActive,
} from '../../services/holdout.service.js';
import { organizationProcedure, rbacProcedure, router } from '../trpc.js';

function handleServiceError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

export const holdoutRouter = router({
  list: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await listHoldoutGroups(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  get: organizationProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getHoldoutGroup(input.groupId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  create: rbacProcedure('budgets:manage')
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        testCampaignIds: z.array(z.string().uuid()).min(1),
        controlCampaignIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createHoldoutGroup(ctx.organizationId, input);
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        handleServiceError(error);
      }
    }),

  setActive: rbacProcedure('budgets:manage')
    .input(
      z.object({
        groupId: z.string().uuid(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await setHoldoutActive(
          input.groupId,
          ctx.organizationId,
          input.active,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  lift: organizationProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        windowHours: z.number().int().min(1).max(168).default(24),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await computeHoldoutLift(
          input.groupId,
          ctx.organizationId,
          input.windowHours,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
