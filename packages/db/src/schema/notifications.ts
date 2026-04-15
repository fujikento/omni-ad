import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations, users } from './organizations';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const notificationTypeEnum = pgEnum('notification_type', [
  'alert',
  'info',
  'success',
  'warning',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'dashboard',
  'email',
  'slack',
  'line',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    actionUrl: text('action_url'),
    read: boolean('read').notNull().default(false),
    source: text('source').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('notifications_user_org_idx').on(
      table.userId,
      table.organizationId,
    ),
    index('notifications_unread_idx').on(
      table.userId,
      table.organizationId,
      table.read,
    ),
    index('notifications_created_at_idx').on(table.createdAt),
  ],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: notificationChannelEnum('channel').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    criticalOnly: boolean('critical_only').notNull().default(false),
    webhookUrl: text('webhook_url'),
  },
  (table) => [
    index('notification_prefs_user_idx').on(table.userId),
    uniqueIndex('notification_prefs_user_channel_uniq').on(
      table.userId,
      table.channel,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  }),
);
