import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  emergencyStopAll,
  emergencyStopCampaign,
  emergencyResume,
  getEmergencyStatus,
  EmergencyStopError,
} from "../../services/emergency.service.js";
import { organizationProcedure, router } from "../trpc.js";

function handleServiceError(error: unknown): never {
  if (error instanceof EmergencyStopError) {
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

export const emergencyRouter = router({
  stopAll: organizationProcedure
    .input(
      z.object({
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await emergencyStopAll(
          ctx.organizationId,
          ctx.userId,
          input.reason,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  stopCampaign: organizationProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await emergencyStopCampaign(
          input.campaignId,
          ctx.organizationId,
          ctx.userId,
          input.reason,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  resume: organizationProcedure.mutation(async ({ ctx }) => {
    try {
      return await emergencyResume(ctx.organizationId, ctx.userId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  status: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getEmergencyStatus(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),
});
