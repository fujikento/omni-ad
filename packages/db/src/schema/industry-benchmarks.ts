import { relations, sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { platformEnum } from './enums';
import { organizations } from './organizations';

/**
 * Industry taxonomy. Kept intentionally small — benchmarks are only
 * meaningful when each bucket has enough orgs to preserve anonymity.
 * Extensions require checking that every bucket has N >= 5 contributing
 * orgs before surfacing aggregates.
 */
export const industryEnum = pgEnum('industry', [
  'ecommerce_retail',
  'd2c_consumer',
  'saas_b2b',
  'saas_b2c',
  'finance_insurance',
  'health_wellness',
  'education',
  'travel_hospitality',
  'real_estate',
  'auto',
  'entertainment_media',
  'food_beverage',
  'other',
]);

/**
 * Per-org industry tag (for cross-org benchmarking). Normalized into
 * its own table so the core organizations row stays stable and orgs
 * can change industry without a schema migration.
 */
export const organizationIndustry = pgTable(
  'organization_industry',
  {
    organizationId: uuid('organization_id')
      .primaryKey()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    industry: industryEnum('industry').notNull(),
    /** Agency flag — agencies contribute to multiple client industries. */
    isAgency: text('is_agency'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
);

/**
 * Cross-org industry benchmarks — the agency network effect.
 *
 * Aggregated anonymously across all organizations in an industry for a
 * given platform and date. Computed periodically by a worker job.
 * Never includes per-org breakdowns — only p25 / p50 / p75 / sample
 * size. Sample size < 5 rows are excluded by the aggregation step.
 */
export const industryBenchmarks = pgTable(
  'industry_benchmarks',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    industry: industryEnum('industry').notNull(),
    platform: platformEnum('platform').notNull(),
    date: date('date').notNull(),
    /** Number of contributing organizations. Must be >= 5 for surface. */
    sampleSize: integer('sample_size').notNull(),
    roasP25: real('roas_p25'),
    roasP50: real('roas_p50'),
    roasP75: real('roas_p75'),
    ctrP50: real('ctr_p50'),
    cpaP50: real('cpa_p50'),
    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('industry_benchmarks_industry_platform_date_idx').on(
      table.industry,
      table.platform,
      table.date,
    ),
    uniqueIndex('industry_benchmarks_uniq').on(
      table.industry,
      table.platform,
      table.date,
    ),
  ],
);

export const organizationIndustryRelations = relations(
  organizationIndustry,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationIndustry.organizationId],
      references: [organizations.id],
    }),
  }),
);
