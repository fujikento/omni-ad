/**
 * Notification Service
 *
 * Multi-channel notification system supporting dashboard, Slack, LINE,
 * and email dispatch with user preference management.
 */

import { db } from '@omni-ad/db';
import {
  notifications,
  notificationPreferences,
} from '@omni-ad/db/schema';
import { and, desc, eq, sql, count } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationSelect = typeof notifications.$inferSelect;
type NotificationInsert = typeof notifications.$inferInsert;
type PreferenceSelect = typeof notificationPreferences.$inferSelect;

interface CreateNotificationInput {
  organizationId: string;
  userId?: string;
  type: NotificationInsert['type'];
  title: string;
  message: string;
  actionUrl?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

interface UpdatePreferencesInput {
  channel: PreferenceSelect['channel'];
  enabled: boolean;
  criticalOnly?: boolean;
  webhookUrl?: string | null;
}

interface SlackPayload {
  text: string;
  blocks?: SlackBlock[];
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
}

// ---------------------------------------------------------------------------
// Notification CRUD
// ---------------------------------------------------------------------------

export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationSelect> {
  const values: NotificationInsert = {
    organizationId: input.organizationId,
    userId: input.userId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl ?? null,
    source: input.source,
    metadata: input.metadata ?? null,
  };

  const [inserted] = await db
    .insert(notifications)
    .values(values)
    .returning();

  if (!inserted) {
    throw new Error('Failed to insert notification');
  }

  // Dispatch to external channels if user preferences exist
  if (input.userId) {
    await dispatchToChannels(input.userId, input).catch(() => {
      // External dispatch failures should not block notification creation
    });
  }

  return inserted;
}

export async function listNotifications(
  userId: string,
  organizationId: string,
  options: { unreadOnly?: boolean; limit?: number; offset?: number } = {},
): Promise<NotificationSelect[]> {
  const { unreadOnly = false, limit = 50, offset = 0 } = options;

  const conditions = [
    eq(notifications.organizationId, organizationId),
  ];

  // Include org-wide notifications (userId is null) and user-specific
  // Using SQL to handle the OR condition with nullable userId
  conditions.push(
    sql`(${notifications.userId} = ${userId} OR ${notifications.userId} IS NULL)`,
  );

  if (unreadOnly) {
    conditions.push(eq(notifications.read, false));
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<NotificationSelect | undefined> {
  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        sql`(${notifications.userId} = ${userId} OR ${notifications.userId} IS NULL)`,
      ),
    )
    .returning();

  return updated;
}

export async function markAllAsRead(
  userId: string,
  organizationId: string,
): Promise<number> {
  const result = await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.read, false),
        sql`(${notifications.userId} = ${userId} OR ${notifications.userId} IS NULL)`,
      ),
    )
    .returning({ id: notifications.id });

  return result.length;
}

export async function getUnreadCount(
  userId: string,
  organizationId: string,
): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.read, false),
        sql`(${notifications.userId} = ${userId} OR ${notifications.userId} IS NULL)`,
      ),
    );

  return result?.value ?? 0;
}

// ---------------------------------------------------------------------------
// External Channel Dispatch
// ---------------------------------------------------------------------------

export async function sendSlackNotification(
  webhookUrl: string,
  message: string,
): Promise<void> {
  if (!webhookUrl) return;

  const payload: SlackPayload = {
    text: message,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*OMNI-AD* :bell:\n${message}` },
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new NotificationDispatchError(
      `Slack webhook failed (${response.status}): ${text}`,
    );
  }
}

export async function sendLineNotification(
  accessToken: string,
  message: string,
): Promise<void> {
  if (!accessToken) return;

  const response = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Bearer ${accessToken}`,
    },
    body: new URLSearchParams({ message: `[OMNI-AD] ${message}` }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new NotificationDispatchError(
      `LINE Notify failed (${response.status}): ${text}`,
    );
  }
}

export async function sendEmailNotification(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  // Placeholder for email service integration (SendGrid, SES, etc.)
  // Log the intent for now
  process.stdout.write(
    `[notification] EMAIL: to=${to} subject=${subject} body=${body.slice(0, 100)}\n`,
  );
}

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------

export async function getPreferences(
  userId: string,
): Promise<PreferenceSelect[]> {
  return db.query.notificationPreferences.findMany({
    where: eq(notificationPreferences.userId, userId),
  });
}

export async function updatePreferences(
  userId: string,
  preferences: UpdatePreferencesInput[],
): Promise<PreferenceSelect[]> {
  const results: PreferenceSelect[] = [];

  for (const pref of preferences) {
    // Upsert: check if preference exists, then update or insert
    const existing = await db.query.notificationPreferences.findFirst({
      where: and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.channel, pref.channel),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(notificationPreferences)
        .set({
          enabled: pref.enabled,
          criticalOnly: pref.criticalOnly ?? existing.criticalOnly,
          webhookUrl:
            pref.webhookUrl !== undefined
              ? pref.webhookUrl
              : existing.webhookUrl,
        })
        .where(eq(notificationPreferences.id, existing.id))
        .returning();

      if (updated) results.push(updated);
    } else {
      const [inserted] = await db
        .insert(notificationPreferences)
        .values({
          userId,
          channel: pref.channel,
          enabled: pref.enabled,
          criticalOnly: pref.criticalOnly ?? false,
          webhookUrl: pref.webhookUrl ?? null,
        })
        .returning();

      if (inserted) results.push(inserted);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Internal Dispatch
// ---------------------------------------------------------------------------

async function dispatchToChannels(
  userId: string,
  input: CreateNotificationInput,
): Promise<void> {
  const prefs = await getPreferences(userId);

  for (const pref of prefs) {
    if (!pref.enabled) continue;

    // If criticalOnly is set, only dispatch alert-type notifications
    if (pref.criticalOnly && input.type !== 'alert') continue;

    switch (pref.channel) {
      case 'slack':
        if (pref.webhookUrl) {
          await sendSlackNotification(
            pref.webhookUrl,
            `${input.title}: ${input.message}`,
          );
        }
        break;

      case 'line':
        if (pref.webhookUrl) {
          await sendLineNotification(
            pref.webhookUrl,
            `${input.title}: ${input.message}`,
          );
        }
        break;

      case 'email':
        // Would need user email from users table
        break;

      case 'dashboard':
        // Already handled by createNotification
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class NotificationDispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationDispatchError';
  }
}
