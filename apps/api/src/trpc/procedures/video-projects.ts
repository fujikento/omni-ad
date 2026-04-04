import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  createVideoProject,
  getScript,
  getVideoProject,
  listVideoProjects,
  updateProjectScript,
  VideoProjectNotFoundError,
  VideoProjectCreationError,
} from '../../services/video-project.service.js';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const platformSchema = z.enum([
  'meta',
  'google',
  'x',
  'tiktok',
  'line_yahoo',
  'amazon',
  'microsoft',
]);

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof VideoProjectNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof VideoProjectCreationError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
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

export const videoProjectsRouter = router({
  create: organizationProcedure
    .input(
      z.object({
        productName: z.string().min(1).max(200),
        productDescription: z.string().min(1),
        targetAudience: z.string().min(1),
        campaignGoal: z.string().min(1),
        platform: platformSchema.nullable().default(null),
        duration: z.number().int().min(6).max(60),
        language: z.enum(['ja', 'en']).default('ja'),
        keigoLevel: z.enum(['casual', 'polite', 'formal']).default('polite'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createVideoProject(ctx.organizationId, input);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getScript: organizationProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getScript(input.projectId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  regenerateScript: organizationProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        productName: z.string().min(1).max(200),
        productDescription: z.string().min(1),
        targetAudience: z.string().min(1),
        campaignGoal: z.string().min(1),
        platform: platformSchema.nullable().default(null),
        duration: z.number().int().min(6).max(60),
        language: z.enum(['ja', 'en']).default('ja'),
        keigoLevel: z.enum(['casual', 'polite', 'formal']).default('polite'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify project exists
        await getVideoProject(input.projectId, ctx.organizationId);

        // Import script generator lazily to avoid tight coupling
        const { generateVideoScript } = await import('@omni-ad/ai-engine');

        const durationNormalized = input.duration <= 6
          ? 6
          : input.duration <= 15
            ? 15
            : 30;

        const script = await generateVideoScript({
          productName: input.productName,
          productDescription: input.productDescription,
          targetAudience: input.targetAudience,
          campaignGoal: input.campaignGoal,
          platform: input.platform ?? 'META',
          duration: durationNormalized as 6 | 15 | 30,
          language: input.language,
          keigoLevel: input.keigoLevel,
        });

        return await updateProjectScript(
          input.projectId,
          ctx.organizationId,
          script,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getStatus: organizationProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const project = await getVideoProject(
          input.projectId,
          ctx.organizationId,
        );
        return {
          id: project.id,
          status: project.status,
          hasScript: project.script !== null,
          hasScenes: project.scenes !== null,
          hasVoiceover: project.voiceoverUrl !== null,
          hasFinalVideo: project.finalVideoUrl !== null,
          duration: project.duration,
          platform: project.platform,
          generationCostCents: project.generationCostCents,
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  list: organizationProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listVideoProjects(
          ctx.organizationId,
          input.limit,
          input.offset,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
