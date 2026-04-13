import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  AudienceAccessError,
  AudienceNotFoundError,
  getOverlaps,
  listAudiences,
  syncAudience,
} from "../../services/audience.service.js";
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

function handleServiceError(error: unknown): never {
  if (error instanceof AudienceNotFoundError) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
    });
  }
  if (error instanceof AudienceAccessError) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: error.message,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: error,
  });
}

export const audiencesRouter = router({
  list: organizationProcedure
    .input(
      z
        .object({
          platform: DbPlatform.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listAudiences(ctx.organizationId, input?.platform);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  overlaps: organizationProcedure
    .input(
      z.object({
        audienceIds: z.array(z.string().uuid()).min(2).max(5),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getOverlaps(input.audienceIds, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  sync: rbacProcedure("audiences:manage")
    .input(
      z.object({
        audienceId: z.string().uuid(),
        targetPlatform: DbPlatform,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await syncAudience(
          input.audienceId,
          input.targetPlatform,
          ctx.organizationId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
