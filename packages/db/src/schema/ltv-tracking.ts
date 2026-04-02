import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { campaigns } from './campaigns';
import { platformEnum } from './enums';
import { organizations } from './organizations';

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const customerProfiles = pgTable(
  'customer_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    hashedIdentifier: text('hashed_identifier').notNull(),
    firstConversionAt: timestamp('first_conversion_at', {
      withTimezone: true,
    }).notNull(),
    lastConversionAt: timestamp('last_conversion_at', {
      withTimezone: true,
    }).notNull(),
    totalConversions: integer('total_conversions').notNull().default(1),
    totalRevenue: numeric('total_revenue', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0'),
    acquisitionCampaignId: uuid('acquisition_campaign_id').references(
      () => campaigns.id,
      { onDelete: 'set null' },
    ),
    acquisitionPlatform: platformEnum('acquisition_platform'),
    acquisitionCost: numeric('acquisition_cost', {
      precision: 14,
      scale: 2,
    }),
    ltv: numeric('ltv', { precision: 14, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('customer_profiles_org_idx').on(table.organizationId),
    index('customer_profiles_hashed_id_idx').on(
      table.organizationId,
      table.hashedIdentifier,
    ),
    index('customer_profiles_acquisition_campaign_idx').on(
      table.acquisitionCampaignId,
    ),
    index('customer_profiles_ltv_idx').on(
      table.organizationId,
      table.ltv,
    ),
  ],
);

export const cohortAnalysis = pgTable(
  'cohort_analysis',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    cohortMonth: text('cohort_month').notNull(),
    platform: platformEnum('platform'),
    customersAcquired: integer('customers_acquired').notNull().default(0),
    totalAcquisitionCost: numeric('total_acquisition_cost', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0'),
    cac: numeric('cac', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    avgLtv: numeric('avg_ltv', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    ltvCacRatio: real('ltv_cac_ratio').notNull().default(0),
    retentionRates: jsonb('retention_rates')
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('cohort_analysis_org_idx').on(table.organizationId),
    index('cohort_analysis_org_month_idx').on(
      table.organizationId,
      table.cohortMonth,
    ),
    index('cohort_analysis_org_platform_idx').on(
      table.organizationId,
      table.platform,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const customerProfilesRelations = relations(
  customerProfiles,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [customerProfiles.organizationId],
      references: [organizations.id],
    }),
    acquisitionCampaign: one(campaigns, {
      fields: [customerProfiles.acquisitionCampaignId],
      references: [campaigns.id],
    }),
  }),
);

export const cohortAnalysisRelations = relations(
  cohortAnalysis,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [cohortAnalysis.organizationId],
      references: [organizations.id],
    }),
  }),
);
