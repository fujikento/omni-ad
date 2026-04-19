import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  compareOrgToIndustry,
  getOrgIndustry,
  getRecentBenchmarks,
  setOrgIndustry,
} from '../../services/industry-benchmarks.service.js';
import { ALL_INDUSTRIES } from '../../services/industry-types.js';
import { organizationProcedure, rbacProcedure, router } from '../trpc.js';

function handleServiceError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

const IndustrySchema = z.enum([
  ALL_INDUSTRIES[0],
  ...ALL_INDUSTRIES.slice(1),
] as unknown as [string, ...string[]]);

const PlatformSchema = z.enum([
  'meta',
  'google',
  'x',
  'tiktok',
  'line_yahoo',
  'amazon',
  'microsoft',
] as const);

export const industryBenchmarksRouter = router({
  myIndustry: organizationProcedure.query(async ({ ctx }) => {
    try {
      const industry = await getOrgIndustry(ctx.organizationId);
      return { industry };
    } catch (error) {
      handleServiceError(error);
    }
  }),

  setIndustry: rbacProcedure('settings:manage')
    .input(z.object({ industry: IndustrySchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await setOrgIndustry(
          ctx.organizationId,
          input.industry as Parameters<typeof setOrgIndustry>[1],
        );
        return { ok: true };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  recent: organizationProcedure
    .input(
      z.object({
        industry: IndustrySchema,
        platforms: z.array(PlatformSchema).min(1).max(10),
        daysBack: z.number().int().min(1).max(90).default(7),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await getRecentBenchmarks(
          input.industry as Parameters<typeof getRecentBenchmarks>[0],
          input.platforms,
          input.daysBack,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  compareToIndustry: organizationProcedure
    .input(
      z
        .object({
          platforms: z.array(PlatformSchema).min(1).max(10).optional(),
          windowDays: z.number().int().min(1).max(30).default(7),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        const platforms = input?.platforms ?? [
          'meta',
          'google',
          'tiktok',
          'line_yahoo',
          'x',
          'amazon',
          'microsoft',
        ];
        return await compareOrgToIndustry(
          ctx.organizationId,
          platforms,
          input?.windowDays ?? 7,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
