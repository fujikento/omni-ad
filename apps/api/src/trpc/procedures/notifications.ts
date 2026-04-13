import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  getPreferences,
  getUnreadCount,
  listNotifications,
  markAllAsRead,
  markAsRead,
  updatePreferences,
} from '../../services/notification.service.js';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const NotificationChannel = z.enum(['dashboard', 'email', 'slack', 'line']);

const UpdatePreferenceInput = z.object({
  channel: NotificationChannel,
  enabled: z.boolean(),
  criticalOnly: z.boolean().optional(),
  webhookUrl: z.string().url().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Error Handler
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const notificationsRouter = router({
  list: organizationProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listNotifications(ctx.userId, ctx.organizationId, {
          unreadOnly: input.unreadOnly,
          limit: input.limit,
          offset: input.offset,
        });
      } catch (error) {
        handleServiceError(error);
      }
    }),

  unreadCount: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getUnreadCount(ctx.userId, ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  markRead: organizationProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const notification = await markAsRead(
          input.id,
          ctx.userId,
          ctx.organizationId,
        );
        if (!notification) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Notification not found: ${input.id}`,
          });
        }
        return notification;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleServiceError(error);
      }
    }),

  markAllRead: organizationProcedure.mutation(async ({ ctx }) => {
    try {
      const count = await markAllAsRead(ctx.userId, ctx.organizationId);
      return { markedCount: count };
    } catch (error) {
      handleServiceError(error);
    }
  }),

  preferences: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getPreferences(ctx.userId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  updatePreferences: organizationProcedure
    .input(z.object({ preferences: z.array(UpdatePreferenceInput).min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await updatePreferences(ctx.userId, input.preferences);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
