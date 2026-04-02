import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  createEndpoint,
  deleteEndpoint,
  EndpointNotFoundError,
  generateTrackingSnippet,
  getConversionStats,
  listEndpoints,
  updateEndpoint,
} from '../../services/conversion.service.js';
import type { PlatformMappings } from '@omni-ad/db/schema';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const MetaMappingSchema = z.object({
  pixelId: z.string().min(1),
  accessToken: z.string().min(1),
});

const GoogleMappingSchema = z.object({
  conversionId: z.string().min(1),
  label: z.string().min(1),
});

const TikTokMappingSchema = z.object({
  pixelCode: z.string().min(1),
  accessToken: z.string().min(1),
});

const LineYahooMappingSchema = z.object({
  tagId: z.string().min(1),
  accessToken: z.string().min(1),
});

const PlatformMappingsSchema = z
  .object({
    meta: MetaMappingSchema.optional(),
    google: GoogleMappingSchema.optional(),
    tiktok: TikTokMappingSchema.optional(),
    line_yahoo: LineYahooMappingSchema.optional(),
  })
  .optional();

const CreateEndpointInput = z.object({
  name: z.string().min(1).max(200),
  allowedDomains: z.array(z.string().min(1)).default([]),
  eventTypes: z.array(z.string().min(1)).default([]),
  platformMappings: PlatformMappingsSchema,
});

const UpdateEndpointInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  allowedDomains: z.array(z.string().min(1)).optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  platformMappings: PlatformMappingsSchema,
  active: z.boolean().optional(),
});

const StatsInput = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof EndpointNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
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

const API_BASE_URL = process.env['API_BASE_URL'] ?? 'https://api.omni-ad.jp';

export const conversionsRouter = router({
  endpoints: router({
    list: organizationProcedure.query(async ({ ctx }) => {
      try {
        return await listEndpoints(ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

    create: organizationProcedure
      .input(CreateEndpointInput)
      .mutation(async ({ ctx, input }) => {
        try {
          const endpoint = await createEndpoint(ctx.organizationId, {
            name: input.name,
            allowedDomains: input.allowedDomains,
            eventTypes: input.eventTypes,
            platformMappings: input.platformMappings as PlatformMappings | undefined,
          });

          const snippet = generateTrackingSnippet(
            endpoint.pixelId,
            API_BASE_URL,
          );

          return { endpoint, snippet };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    update: organizationProcedure
      .input(UpdateEndpointInput)
      .mutation(async ({ ctx, input }) => {
        try {
          const { id, ...fields } = input;
          return await updateEndpoint(id, ctx.organizationId, {
            ...fields,
            platformMappings: fields.platformMappings as PlatformMappings | undefined,
          });
        } catch (error) {
          handleServiceError(error);
        }
      }),

    delete: organizationProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await deleteEndpoint(input.id, ctx.organizationId);
        } catch (error) {
          handleServiceError(error);
        }
      }),
  }),

  stats: organizationProcedure
    .input(StatsInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getConversionStats(
          ctx.organizationId,
          input.startDate,
          input.endDate,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
