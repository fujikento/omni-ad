import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  connectPlatform,
  disconnectPlatform,
  getConnectionStatus,
  listConnections,
  PlatformConnectionNotFoundError,
  PlatformNotConfiguredError,
  syncNow,
} from "../../services/platform.service.js";
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
  if (error instanceof PlatformConnectionNotFoundError) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
    });
  }
  if (error instanceof PlatformNotConfiguredError) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: error.message,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: error,
  });
}

export const platformsRouter = router({
  list: organizationProcedure
    .query(async ({ ctx }) => {
      try {
        return await listConnections(ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  connect: rbacProcedure("platforms:connect")
    .input(
      z.object({
        platform: DbPlatform,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await connectPlatform(
          input.platform,
          ctx.organizationId,
          ctx.userId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  disconnect: rbacProcedure("platforms:disconnect")
    .input(
      z.object({
        connectionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await disconnectPlatform(input.connectionId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  status: organizationProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getConnectionStatus(input.connectionId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  syncNow: organizationProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await syncNow(input.connectionId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
