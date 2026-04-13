import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adaptCreative,
  CreativeNotFoundError,
  generateCreative,
  getCreative,
  listCreatives,
} from "../../services/creative.service.js";
import { organizationProcedure, rbacProcedure, router } from "../trpc.js";

const CreativeType = z.enum(["text", "image", "video", "carousel"]);

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
  if (error instanceof CreativeNotFoundError) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: error,
  });
}

export const creativesRouter = router({
  list: organizationProcedure
    .query(async ({ ctx }) => {
      try {
        return await listCreatives(ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  get: organizationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const creative = await getCreative(input.id, ctx.organizationId);
        if (!creative) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Creative not found: ${input.id}`,
          });
        }
        return creative;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleServiceError(error);
      }
    }),

  generate: rbacProcedure("creatives:create")
    .input(
      z.object({
        prompt: z.string().min(1).max(2000),
        type: CreativeType,
        platforms: z.array(DbPlatform).min(1),
        baseContent: z.record(z.string(), z.unknown()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await generateCreative(
          {
            prompt: input.prompt,
            type: input.type,
            platforms: input.platforms,
            baseContent: input.baseContent,
          },
          ctx.organizationId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  adapt: rbacProcedure("creatives:edit")
    .input(
      z.object({
        creativeId: z.string().uuid(),
        targetPlatform: DbPlatform,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await adaptCreative(
          input.creativeId,
          input.targetPlatform,
          ctx.organizationId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
