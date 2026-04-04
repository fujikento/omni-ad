import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

// ---------------------------------------------------------------------------
// JSONB types
// ---------------------------------------------------------------------------

export interface PlatformIds {
  meta?: string;
  google?: string;
  tiktok?: string;
  x?: string;
  line_yahoo?: string;
  amazon?: string;
  microsoft?: string;
  [key: string]: string | undefined;
}

export interface SegmentCriteria {
  platforms?: string[];
  minTouchpoints?: number;
  audiences?: string[];
  firstSeenAfter?: string;
  lastSeenAfter?: string;
  customRules?: Array<{
    field: string;
    operator: 'eq' | 'gt' | 'lt' | 'contains' | 'in';
    value: string | number | string[];
  }>;
}

export interface PlatformDistribution {
  [platform: string]: number;
}

export interface SyncStatus {
  [platform: string]: {
    lastSyncAt: string | null;
    status: 'synced' | 'pending' | 'error';
    error?: string;
  };
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const identityGraph = pgTable(
  'identity_graph',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    emailHash: text('email_hash'),
    phoneHash: text('phone_hash'),
    compositeHash: text('composite_hash'),
    platformIds: jsonb('platform_ids')
      .$type<PlatformIds>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    audiences: text('audiences')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    touchpointCount: integer('touchpoint_count').notNull().default(0),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    unique('identity_graph_org_composite_idx').on(
      table.organizationId,
      table.compositeHash,
    ),
    index('identity_graph_org_idx').on(table.organizationId),
    index('identity_graph_email_idx').on(table.emailHash),
    index('identity_graph_phone_idx').on(table.phoneHash),
  ],
);

export const unifiedSegments = pgTable(
  'unified_segments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    criteria: jsonb('criteria').$type<SegmentCriteria>().notNull(),
    identityCount: integer('identity_count').notNull().default(0),
    platformDistribution: jsonb('platform_distribution')
      .$type<PlatformDistribution>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    syncStatus: jsonb('sync_status')
      .$type<SyncStatus>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('unified_segments_org_idx').on(table.organizationId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const identityGraphRelations = relations(
  identityGraph,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [identityGraph.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const unifiedSegmentsRelations = relations(
  unifiedSegments,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [unifiedSegments.organizationId],
      references: [organizations.id],
    }),
  }),
);
