import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getAllocationHistory,
  getCurrentAllocations,
  getForecast,
  triggerOptimization,
} from "../../services/budget.service.js";
import {
  getDailyPacing,
  getMonthlyPacing,
  autoAdjustMonthlyPacing,
} from "../../services/pacing.service.js";
import { organizationProcedure, rbacProcedure, router } from "../trpc.js";

const DbPlatform = z.enum([
  "meta",
  "google",
  "x",
  "tiktok",
  "line_yahoo",
  "amazon",
  "microsoft",
]);

const Objective = z.enum([
  "maximize_roas",
  "maximize_conversions",
  "maximize_reach",
]);

function handleServiceError(error: unknown): never {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: error,
  });
}

export const budgetsRouter = router({
  current: organizationProcedure
    .query(async ({ ctx }) => {
      try {
        const allocation = await getCurrentAllocations(ctx.organizationId);
        return allocation ?? null;
      } catch (error) {
        handleServiceError(error);
      }
    }),

  history: organizationProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getAllocationHistory(ctx.organizationId, input.limit);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  optimize: rbacProcedure("budgets:manage")
    .input(
      z.object({
        totalBudget: z.number().positive(),
        platforms: z.array(DbPlatform).min(1),
        objective: Objective.default("maximize_roas"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await triggerOptimization(
          ctx.organizationId,
          input.totalBudget,
          input.platforms,
          input.objective,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  forecast: organizationProcedure
    .input(
      z.object({
        proposedAllocations: z.record(DbPlatform, z.number().nonnegative()),
        forecastDays: z.number().int().min(1).max(90).default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getForecast(
          ctx.organizationId,
          input.proposedAllocations,
          input.forecastDays,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  pacing: organizationProcedure.query(async ({ ctx }) => {
    try {
      const [daily, monthly] = await Promise.all([
        getDailyPacing(ctx.organizationId),
        getMonthlyPacing(ctx.organizationId),
      ]);
      return { daily, monthly };
    } catch (error) {
      handleServiceError(error);
    }
  }),

  monthlyPacing: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getMonthlyPacing(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  autoAdjustMonthlyPacing: rbacProcedure("budgets:manage").mutation(
    async ({ ctx }) => {
      try {
        return await autoAdjustMonthlyPacing(ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    },
  ),
});
