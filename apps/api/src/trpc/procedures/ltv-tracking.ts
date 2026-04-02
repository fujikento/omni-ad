import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  recordCustomerConversion,
  computeCohortAnalysis,
  getLtvOverview,
  getCohortTrend,
  getTopCustomers,
  LtvTrackingError,
} from "../../services/ltv-tracking.service.js";
import { organizationProcedure, router } from "../trpc.js";

const DbPlatform = z.enum([
  "meta",
  "google",
  "x",
  "tiktok",
  "line_yahoo",
  "amazon",
  "microsoft",
]);

function handleServiceError(error: unknown): never {
  if (error instanceof LtvTrackingError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: error,
  });
}

export const ltvTrackingRouter = router({
  recordConversion: organizationProcedure
    .input(
      z.object({
        hashedId: z.string().min(1),
        revenue: z.number().nonnegative(),
        campaignId: z.string().uuid().optional(),
        platform: DbPlatform.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await recordCustomerConversion({
          organizationId: ctx.organizationId,
          hashedId: input.hashedId,
          revenue: input.revenue,
          campaignId: input.campaignId,
          platform: input.platform,
        });
      } catch (error) {
        handleServiceError(error);
      }
    }),

  computeCohort: organizationProcedure
    .input(
      z.object({
        cohortMonth: z.string().regex(/^\d{4}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await computeCohortAnalysis(
          ctx.organizationId,
          input.cohortMonth,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  overview: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getLtvOverview(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  cohortTrend: organizationProcedure
    .input(
      z.object({
        months: z.number().int().min(1).max(24).default(12),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getCohortTrend(ctx.organizationId, input.months);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  topCustomers: organizationProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getTopCustomers(ctx.organizationId, input.limit);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
