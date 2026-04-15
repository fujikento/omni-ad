import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { creativeTypeEnum, platformEnum } from './enums';
import { organizations } from './organizations';

export const creatives = pgTable('creatives', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  type: creativeTypeEnum('type').notNull(),
  baseContent: jsonb('base_content').notNull(),
  aiGenerated: boolean('ai_generated').notNull().default(false),
  promptUsed: text('prompt_used'),
  modelUsed: text('model_used'),
  performanceScore: real('performance_score'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  orgCreatedAtIdx: index('creatives_org_created_at_idx').on(table.organizationId, table.createdAt),
}));

export const creativeVariants = pgTable('creative_variants', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  creativeId: uuid('creative_id')
    .notNull()
    .references(() => creatives.id, { onDelete: 'cascade' }),
  platform: platformEnum('platform').notNull(),
  adaptedContent: jsonb('adapted_content').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  format: text('format').notNull(),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const creativeEmbeddings = pgTable('creative_embeddings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  creativeId: uuid('creative_id')
    .notNull()
    .references(() => creatives.id, { onDelete: 'cascade' })
    .unique(),
  // Placeholder for pgvector: will be vector(1536) when extension is enabled
  embedding: text('embedding').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// Relations

export const creativesRelations = relations(creatives, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [creatives.organizationId],
    references: [organizations.id],
  }),
  variants: many(creativeVariants),
  embedding: one(creativeEmbeddings),
}));

export const creativeVariantsRelations = relations(
  creativeVariants,
  ({ one }) => ({
    creative: one(creatives, {
      fields: [creativeVariants.creativeId],
      references: [creatives.id],
    }),
  }),
);

export const creativeEmbeddingsRelations = relations(
  creativeEmbeddings,
  ({ one }) => ({
    creative: one(creatives, {
      fields: [creativeEmbeddings.creativeId],
      references: [creatives.id],
    }),
  }),
);
