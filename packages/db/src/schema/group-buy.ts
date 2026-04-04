import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { platformEnum } from './enums';
import { campaigns } from './campaigns';
import { organizations } from './organizations';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const purchaseGroupStatusEnum = pgEnum('purchase_group_status', [
  'open',
  'threshold_met',
  'expired',
  'completed',
]);

export const groupShareTypeEnum = pgEnum('group_share_type', [
  'direct_link',
  'story',
  'message',
  'post',
]);

// ---------------------------------------------------------------------------
// JSONB types
// ---------------------------------------------------------------------------

export interface GroupParticipant {
  userId: string;
  joinedAt: string;
  sourcePlatform: string;
  referralChain: string[];
}

export interface GroupTier {
  minParticipants: number;
  discount: number;
  label: string;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const purchaseGroups = pgTable(
  'purchase_groups',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    initiatorId: text('initiator_id').notNull(),
    referralCode: text('referral_code').notNull().unique(),
    currentTier: integer('current_tier').notNull().default(0),
    participantCount: integer('participant_count').notNull().default(1),
    participants: jsonb('participants')
      .$type<GroupParticipant[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    tiers: jsonb('tiers')
      .$type<GroupTier[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: purchaseGroupStatusEnum('status').notNull().default('open'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('purchase_groups_org_idx').on(table.organizationId),
    index('purchase_groups_campaign_idx').on(table.campaignId),
    index('purchase_groups_referral_idx').on(table.referralCode),
    index('purchase_groups_status_idx').on(table.status),
  ],
);

export const groupShareEvents = pgTable(
  'group_share_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    groupId: uuid('group_id')
      .notNull()
      .references(() => purchaseGroups.id, { onDelete: 'cascade' }),
    sharerId: text('sharer_id').notNull(),
    platform: platformEnum('platform').notNull(),
    shareType: groupShareTypeEnum('share_type').notNull(),
    clicks: integer('clicks').notNull().default(0),
    conversions: integer('conversions').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('group_share_events_group_idx').on(table.groupId),
    index('group_share_events_sharer_idx').on(table.sharerId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const purchaseGroupsRelations = relations(
  purchaseGroups,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [purchaseGroups.organizationId],
      references: [organizations.id],
    }),
    campaign: one(campaigns, {
      fields: [purchaseGroups.campaignId],
      references: [campaigns.id],
    }),
    shareEvents: many(groupShareEvents),
  }),
);

export const groupShareEventsRelations = relations(
  groupShareEvents,
  ({ one }) => ({
    group: one(purchaseGroups, {
      fields: [groupShareEvents.groupId],
      references: [purchaseGroups.id],
    }),
  }),
);
