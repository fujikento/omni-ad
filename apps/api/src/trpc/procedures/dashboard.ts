import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  getDashboardOverview,
  getCampaignHealthScores,
  getRecentActivity,
  getPendingDecisions,
  DashboardError,
} from '../../services/dashboard.service.js';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const ActivityInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof DashboardError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
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

export const dashboardRouter = router({
  overview: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getDashboardOverview(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  healthScores: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getCampaignHealthScores(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  activity: organizationProcedure
    .input(ActivityInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getRecentActivity(ctx.organizationId, input.limit);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  pendingDecisions: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getPendingDecisions(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),
});
