import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  AiAutopilotError,
  DecisionNotFoundError,
  approveDecision,
  getSettings,
  listDecisions,
  rejectDecision,
  testApiConnection,
  updateSettings,
} from '../../services/ai-autopilot.service.js';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { AutopilotCycleJob } from '@omni-ad/queue';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const UpdateSettingsInput = z.object({
  claudeApiKey: z.string().min(1).optional(),
  autopilotEnabled: z.boolean().optional(),
  autopilotMode: z
    .enum(['full_auto', 'suggest_only', 'approve_required'])
    .optional(),
  optimizationFrequency: z
    .enum(['hourly', 'every_4h', 'daily'])
    .optional(),
  budgetAutoAdjust: z.boolean().optional(),
  maxBudgetChangePercent: z.number().int().min(1).max(100).optional(),
  creativeAutoRotate: z.boolean().optional(),
  campaignAutoCreate: z.boolean().optional(),
  riskTolerance: z
    .enum(['conservative', 'moderate', 'aggressive'])
    .optional(),
  targetRoas: z.number().positive().nullable().optional(),
  monthlyBudgetCap: z.string().nullable().optional(),
});

const ListDecisionsInput = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  status: z
    .enum([
      'executed',
      'pending_approval',
      'approved',
      'rejected',
      'skipped',
    ])
    .optional(),
});

const DecisionIdInput = z.object({
  decisionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskApiKey(encryptedKey: string | null): string | null {
  if (!encryptedKey) return null;
  return 'sk-...****';
}

function handleServiceError(error: unknown): never {
  if (error instanceof DecisionNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof AiAutopilotError) {
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

const settingsRouter = router({
  get: organizationProcedure.query(async ({ ctx }) => {
    try {
      const settings = await getSettings(ctx.organizationId);
      return {
        ...settings,
        claudeApiKeyEncrypted: maskApiKey(settings.claudeApiKeyEncrypted),
      };
    } catch (error) {
      handleServiceError(error);
    }
  }),

  update: organizationProcedure
    .input(UpdateSettingsInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await updateSettings(ctx.organizationId, input);
        return {
          ...updated,
          claudeApiKeyEncrypted: maskApiKey(updated.claudeApiKeyEncrypted),
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  testConnection: organizationProcedure.mutation(async ({ ctx }) => {
    try {
      return await testApiConnection(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),
});

const decisionsRouter = router({
  list: organizationProcedure
    .input(ListDecisionsInput)
    .query(async ({ ctx, input }) => {
      try {
        return await listDecisions(
          ctx.organizationId,
          input.limit,
          input.status,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  approve: organizationProcedure
    .input(DecisionIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await approveDecision(input.decisionId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  reject: organizationProcedure
    .input(DecisionIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await rejectDecision(input.decisionId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});

export const aiAutopilotRouter = router({
  settings: settingsRouter,
  decisions: decisionsRouter,

  trigger: organizationProcedure.mutation(async ({ ctx }) => {
    try {
      const settings = await getSettings(ctx.organizationId);

      if (!settings.claudeApiKeyEncrypted) {
        throw new AiAutopilotError('Claude API key not configured');
      }

      if (!settings.autopilotEnabled) {
        throw new AiAutopilotError(
          'Autopilot is not enabled for this organization',
        );
      }

      const queue = getQueue(QUEUE_NAMES.AI_AUTOPILOT);
      const jobData: AutopilotCycleJob = {
        organizationId: ctx.organizationId,
      };

      const job = await queue.add(
        `autopilot-cycle-${ctx.organizationId}-${Date.now()}`,
        jobData,
      );

      return {
        queued: true,
        jobId: job.id ?? ctx.organizationId,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      handleServiceError(error);
    }
  }),
});
