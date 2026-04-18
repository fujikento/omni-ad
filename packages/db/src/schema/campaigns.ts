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

import { conversionEndpoints } from './conversions';
import { creatives } from './creatives';
import {
  campaignObjectiveEnum,
  campaignStatusEnum,
  platformEnum,
} from './enums';
import { funnels } from './funnels';
import { organizations, users } from './organizations';

// ---------------------------------------------------------------------------
// JSONB types for campaign targeting and KPI alerts
// ---------------------------------------------------------------------------

export interface CampaignTargetingConfig {
  ageMin?: number;
  ageMax?: number;
  genders?: string[];
  locations?: string[];
  interests?: string[];
  devices?: string[];
  placements?: string[];
  excludedAudiences?: string[];
  languages?: string[];
  /**
   * Links a campaign to a unified_segments row. When set, platform adapters
   * may resolve the segment's platformIds via identity-graph to constrain
   * targeting; the spend orchestrator may use it to adjust shift magnitude
   * based on cross-platform audience overlap.
   */
  unifiedSegmentId?: string;
}

export interface CampaignKpiAlerts {
  cpaThreshold?: number;
  roasThreshold?: number;
  ctrThreshold?: number;
}

export type BidStrategy =
  | 'auto_maximize_conversions'
  | 'auto_target_cpa'
  | 'auto_target_roas'
  | 'manual_cpc';

export const campaigns = pgTable('campaigns', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  objective: campaignObjectiveEnum('objective').notNull(),
  status: campaignStatusEnum('status').notNull().default('draft'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  totalBudget: numeric('total_budget', { precision: 14, scale: 2 }).notNull(),
  dailyBudget: numeric('daily_budget', { precision: 14, scale: 2 }).notNull(),
  funnelId: uuid('funnel_id').references(() => funnels.id, {
    onDelete: 'set null',
  }),
  targetRoas: real('target_roas'),
  targetCpa: numeric('target_cpa', { precision: 14, scale: 2 }),
  bidStrategy: text('bid_strategy').$type<BidStrategy>(),
  landingPageUrl: text('landing_page_url'),
  conversionEndpointId: uuid('conversion_endpoint_id').references(
    () => conversionEndpoints.id,
    { onDelete: 'set null' },
  ),
  targetingConfig: jsonb('targeting_config').$type<CampaignTargetingConfig>(),
  kpiAlerts: jsonb('kpi_alerts').$type<CampaignKpiAlerts>(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => ({
  orgStatusIdx: index('campaigns_org_status_idx').on(table.organizationId, table.status),
  orgCreatedAtIdx: index('campaigns_org_created_at_idx').on(table.organizationId, table.createdAt),
}));

export const campaignPlatformDeployments = pgTable(
  'campaign_platform_deployments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform').notNull(),
    externalCampaignId: text('external_campaign_id'),
    platformStatus: text('platform_status').notNull(),
    platformBudget: numeric('platform_budget', {
      precision: 14,
      scale: 2,
    }).notNull(),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    platformSpecificConfig: jsonb('platform_specific_config'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
);

export const adGroups = pgTable('ad_groups', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  platform: platformEnum('platform').notNull(),
  externalAdGroupId: text('external_ad_group_id'),
  targetingConfig: jsonb('targeting_config'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const ads = pgTable('ads', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  adGroupId: uuid('ad_group_id')
    .notNull()
    .references(() => adGroups.id, { onDelete: 'cascade' }),
  creativeId: uuid('creative_id').references(() => creatives.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  platform: platformEnum('platform').notNull(),
  externalAdId: text('external_ad_id'),
  status: campaignStatusEnum('status').notNull(),
  platformSpecificConfig: jsonb('platform_specific_config'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// Relations

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [campaigns.organizationId],
    references: [organizations.id],
  }),
  funnel: one(funnels, {
    fields: [campaigns.funnelId],
    references: [funnels.id],
  }),
  conversionEndpoint: one(conversionEndpoints, {
    fields: [campaigns.conversionEndpointId],
    references: [conversionEndpoints.id],
  }),
  creator: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id],
  }),
  platformDeployments: many(campaignPlatformDeployments),
  adGroups: many(adGroups),
}));

export const campaignPlatformDeploymentsRelations = relations(
  campaignPlatformDeployments,
  ({ one }) => ({
    campaign: one(campaigns, {
      fields: [campaignPlatformDeployments.campaignId],
      references: [campaigns.id],
    }),
  }),
);

export const adGroupsRelations = relations(adGroups, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [adGroups.campaignId],
    references: [campaigns.id],
  }),
  ads: many(ads),
}));

export const adsRelations = relations(ads, ({ one }) => ({
  adGroup: one(adGroups, {
    fields: [ads.adGroupId],
    references: [adGroups.id],
  }),
  creative: one(creatives, {
    fields: [ads.creativeId],
    references: [creatives.id],
  }),
}));
