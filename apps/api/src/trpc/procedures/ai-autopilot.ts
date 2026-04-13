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
import {
  getKeyStatus,
  maskApiKey as maskKey,
  testApiKey,
  type ApiProvider,
} from '../../services/api-keys.service.js';
import { decryptToken } from '@omni-ad/auth';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { AutopilotCycleJob } from '@omni-ad/queue';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const UpdateSettingsInput = z.object({
  claudeApiKey: z.string().min(1).optional(),
  openaiApiKey: z.string().min(1).optional(),
  runwayApiKey: z.string().min(1).optional(),
  elevenLabsApiKey: z.string().min(1).optional(),
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

const TestKeyInput = z.object({
  provider: z.enum(['anthropic', 'openai', 'runway', 'elevenlabs']),
  apiKey: z.string().min(1),
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

function decryptAndMask(encryptedKey: string | null): string | null {
  if (!encryptedKey) return null;
  try {
    const plaintext = decryptToken(encryptedKey);
    return maskKey(plaintext);
  } catch {
    return '****';
  }
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
// testKey rate limiter
//
// testKey takes an arbitrary apiKey and validates it against a third-party
// provider. Without a limit, an attacker with any authenticated org account
// can turn the server into a credential-validation oracle (stolen-key test).
// Simple token bucket keyed by organizationId: 10 attempts / minute.
// ---------------------------------------------------------------------------

const TEST_KEY_WINDOW_MS = 60_000;
const TEST_KEY_MAX_PER_WINDOW = 10;
const testKeyBuckets = new Map<string, { count: number; resetAt: number }>();

function assertTestKeyQuota(organizationId: string): void {
  const now = Date.now();
  const bucket = testKeyBuckets.get(organizationId);
  if (!bucket || bucket.resetAt <= now) {
    testKeyBuckets.set(organizationId, {
      count: 1,
      resetAt: now + TEST_KEY_WINDOW_MS,
    });
    return;
  }
  if (bucket.count >= TEST_KEY_MAX_PER_WINDOW) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'testKey rate limit exceeded. Try again in a minute.',
    });
  }
  bucket.count += 1;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

// Mask every field whose name ends with "Encrypted" so any future encrypted
// column added to the schema is masked by default, not accidentally returned
// as ciphertext (which accelerates compromise if the encryption key leaks).
function maskAllKeys<T extends Record<string, unknown>>(settings: T): T {
  const out: Record<string, unknown> = { ...settings };
  for (const key of Object.keys(out)) {
    if (key.endsWith('Encrypted')) {
      out[key] = decryptAndMask(out[key] as string | null);
    }
  }
  return out as T;
}

const settingsRouter = router({
  get: organizationProcedure.query(async ({ ctx }) => {
    try {
      const settings = await getSettings(ctx.organizationId);
      return maskAllKeys(settings);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  update: organizationProcedure
    .input(UpdateSettingsInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await updateSettings(ctx.organizationId, input);
        return maskAllKeys(updated);
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

  testKey: organizationProcedure
    .input(TestKeyInput)
    .mutation(async ({ ctx, input }) => {
      try {
        assertTestKeyQuota(ctx.organizationId);
        return await testApiKey(input.provider as ApiProvider, input.apiKey);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getKeyStatus: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getKeyStatus(ctx.organizationId);
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
