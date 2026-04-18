import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

/**
 * holdout_groups pair a treatment cohort of campaigns with a control
 * cohort so the orchestrator can compute true causal lift:
 * treatment receives budget shifts, control is excluded. Comparing
 * their ROAS over a window is a randomised-assignment lift estimate,
 * not a biased observational delta.
 */
export const holdoutGroups = pgTable(
  'holdout_groups',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    testCampaignIds: jsonb('test_campaign_ids')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    controlCampaignIds: jsonb('control_campaign_ids')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('holdout_groups_org_idx').on(table.organizationId),
    index('holdout_groups_org_active_idx').on(
      table.organizationId,
      table.active,
    ),
  ],
);

export const holdoutGroupsRelations = relations(holdoutGroups, ({ one }) => ({
  organization: one(organizations, {
    fields: [holdoutGroups.organizationId],
    references: [organizations.id],
  }),
}));
