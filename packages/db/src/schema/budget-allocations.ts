import { relations, sql } from 'drizzle-orm';
import {
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

export const budgetAllocations = pgTable('budget_allocations', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  allocations: jsonb('allocations').notNull(),
  totalBudget: numeric('total_budget', { precision: 14, scale: 2 }).notNull(),
  predictedRoas: real('predicted_roas'),
  actualRoas: real('actual_roas'),
  algorithmVersion: text('algorithm_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  orgCreatedAtIdx: index('budget_allocations_org_created_at_idx').on(table.organizationId, table.createdAt),
}));

// Relations

export const budgetAllocationsRelations = relations(
  budgetAllocations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [budgetAllocations.organizationId],
      references: [organizations.id],
    }),
  }),
);
