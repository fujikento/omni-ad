import { relations, sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { creativeBatchStatusEnum } from './enums';
import { organizations, users } from './organizations';

// ---------------------------------------------------------------------------
// JSONB type for batch configuration
// ---------------------------------------------------------------------------

export interface MassProductionConfig {
  productInfo: {
    name: string;
    description: string;
    usp: string;
    targetAudience: string;
    price?: string;
  };
  platforms: string[];
  language: 'ja' | 'en';
  keigoLevel: 'casual' | 'polite' | 'formal';
  themes: string[];
  angles: string[];
  ctaVariations: string[];
  imageStyles: string[];
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const creativeBatches = pgTable('creative_batches', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: creativeBatchStatusEnum('status').notNull().default('pending'),
  totalRequested: integer('total_requested').notNull(),
  totalCompleted: integer('total_completed').notNull().default(0),
  totalFailed: integer('total_failed').notNull().default(0),
  config: jsonb('config').$type<MassProductionConfig>().notNull(),
  creativeIds: text('creative_ids')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const creativeBatchesRelations = relations(
  creativeBatches,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [creativeBatches.organizationId],
      references: [organizations.id],
    }),
    creator: one(users, {
      fields: [creativeBatches.createdBy],
      references: [users.id],
    }),
  }),
);
