import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  AccountAnalyzerError,
  ConnectionNotFoundError,
  analyzeAccount,
  getLatestAnalysis,
  listAnalyses,
  triggerReanalysis,
} from '../../services/account-analyzer.service.js';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const ConnectionIdInput = z.object({
  connectionId: z.string().uuid(),
});

const AnalyzeInput = z.object({
  connectionId: z.string().uuid(),
  /** When true, indicates this is triggered right after connecting a platform */
  analyzeOnConnect: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Error Handler
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof ConnectionNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof AccountAnalyzerError) {
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

export const accountAnalysisRouter = router({
  /** Trigger a full analysis for a platform connection */
  analyze: organizationProcedure
    .input(AnalyzeInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await analyzeAccount(ctx.organizationId, input.connectionId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /** Get the most recent analysis for a connection */
  latest: organizationProcedure
    .input(ConnectionIdInput)
    .query(async ({ ctx, input }) => {
      try {
        const analysis = await getLatestAnalysis(
          ctx.organizationId,
          input.connectionId,
        );

        if (!analysis) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No analysis found for this connection',
          });
        }

        return analysis;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleServiceError(error);
      }
    }),

  /** List all analyses for the organization */
  list: organizationProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(500).default(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listAnalyses(ctx.organizationId, input?.limit ?? 100);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /** Re-run analysis for a connection */
  reanalyze: organizationProcedure
    .input(ConnectionIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await triggerReanalysis(ctx.organizationId, input.connectionId);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
