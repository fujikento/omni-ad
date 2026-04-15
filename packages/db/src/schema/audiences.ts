import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { platformEnum } from './enums';
import { organizations } from './organizations';

export const audiences = pgTable('audiences', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  platform: platformEnum('platform').notNull(),
  externalAudienceId: text('external_audience_id'),
  size: integer('size').notNull(),
  segmentDefinition: jsonb('segment_definition').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  orgCreatedAtIdx: index('audiences_org_created_at_idx').on(table.organizationId, table.createdAt),
}));

export const audienceOverlaps = pgTable('audience_overlaps', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  audienceAId: uuid('audience_a_id')
    .notNull()
    .references(() => audiences.id, { onDelete: 'cascade' }),
  audienceBId: uuid('audience_b_id')
    .notNull()
    .references(() => audiences.id, { onDelete: 'cascade' }),
  overlapPercentage: real('overlap_percentage').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
});

// Relations

export const audiencesRelations = relations(audiences, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [audiences.organizationId],
    references: [organizations.id],
  }),
  overlapsAsA: many(audienceOverlaps, { relationName: 'audienceA' }),
  overlapsAsB: many(audienceOverlaps, { relationName: 'audienceB' }),
}));

export const audienceOverlapsRelations = relations(
  audienceOverlaps,
  ({ one }) => ({
    audienceA: one(audiences, {
      fields: [audienceOverlaps.audienceAId],
      references: [audiences.id],
      relationName: 'audienceA',
    }),
    audienceB: one(audiences, {
      fields: [audienceOverlaps.audienceBId],
      references: [audiences.id],
      relationName: 'audienceB',
    }),
  }),
);
