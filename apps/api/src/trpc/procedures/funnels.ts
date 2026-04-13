import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createFunnel,
  FunnelNotFoundError,
  getFunnel,
  listFunnels,
  updateFunnel,
} from "../../services/funnel.service.js";
import { organizationProcedure, rbacProcedure, router } from "../trpc.js";

const FunnelStageType = z.enum([
  "awareness",
  "interest",
  "consideration",
  "intent",
  "conversion",
  "retention",
]);

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
  if (error instanceof FunnelNotFoundError) {
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

export const funnelsRouter = router({
  list: organizationProcedure
    .query(async ({ ctx }) => {
      try {
        return await listFunnels(ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  get: organizationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const funnel = await getFunnel(input.id, ctx.organizationId);
        if (!funnel) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Funnel not found: ${input.id}`,
          });
        }
        return funnel;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleServiceError(error);
      }
    }),

  create: rbacProcedure("funnels:manage")
    .input(
      z.object({
        name: z.string().min(1).max(200),
        stages: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              type: FunnelStageType,
              platforms: z.array(DbPlatform).min(1),
              campaignIds: z.array(z.string().uuid()).optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Extract campaign assignments from stages
        const campaignAssignments = input.stages.flatMap((stage, index) =>
          (stage.campaignIds ?? []).map((campaignId) => ({
            stageIndex: index,
            campaignId,
          }))
        );

        return await createFunnel(
          { name: input.name, stages: input.stages },
          ctx.organizationId,
          ctx.userId,
          campaignAssignments.length > 0 ? campaignAssignments : undefined,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  update: rbacProcedure("funnels:manage")
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        stages: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              type: FunnelStageType,
              platforms: z.array(DbPlatform).min(1),
            })
          )
          .min(1)
          .max(10)
          .optional(),
        status: z.enum(["draft", "active", "paused"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...fields } = input;
        return await updateFunnel(id, fields, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
