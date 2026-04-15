import { relations, sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations, users } from './organizations';

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * Persisted report artifacts produced by the worker `reporting` processor.
 *
 * `type` values are free-form strings (e.g. `weekly_summary`, `monthly_pacing`)
 * so new report kinds can be added without a migration. `format` captures the
 * representation of `data` — default `json` matches the in-memory payload.
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    format: text('format').notNull().default('json'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('reports_org_generated_at_idx').on(
      table.organizationId,
      table.generatedAt,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const reportsRelations = relations(reports, ({ one }) => ({
  organization: one(organizations, {
    fields: [reports.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [reports.createdBy],
    references: [users.id],
  }),
}));
