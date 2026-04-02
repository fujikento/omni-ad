import { relations, sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { ads, adGroups, campaigns } from './campaigns';
import { platformEnum } from './enums';

export const metricsHourly = pgTable(
  'metrics_hourly',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    adGroupId: uuid('ad_group_id').references(() => adGroups.id, {
      onDelete: 'set null',
    }),
    adId: uuid('ad_id').references(() => ads.id, { onDelete: 'set null' }),
    platform: platformEnum('platform').notNull(),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    conversions: integer('conversions').notNull().default(0),
    spend: numeric('spend', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    revenue: numeric('revenue', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    ctr: real('ctr').notNull().default(0),
    cpc: real('cpc').notNull().default(0),
    cpa: real('cpa').notNull().default(0),
    roas: real('roas').notNull().default(0),
  },
  (table) => [
    index('metrics_hourly_campaign_timestamp_idx').on(
      table.campaignId,
      table.timestamp,
    ),
    index('metrics_hourly_platform_timestamp_idx').on(
      table.platform,
      table.timestamp,
    ),
    uniqueIndex('metrics_hourly_campaign_timestamp_platform_uniq').on(
      table.campaignId,
      table.timestamp,
      table.platform,
    ),
  ],
);

export const metricsDaily = pgTable(
  'metrics_daily',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    date: date('date').notNull(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    adGroupId: uuid('ad_group_id').references(() => adGroups.id, {
      onDelete: 'set null',
    }),
    adId: uuid('ad_id').references(() => ads.id, { onDelete: 'set null' }),
    platform: platformEnum('platform').notNull(),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    conversions: integer('conversions').notNull().default(0),
    spend: numeric('spend', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    revenue: numeric('revenue', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    ctr: real('ctr').notNull().default(0),
    cpc: real('cpc').notNull().default(0),
    cpa: real('cpa').notNull().default(0),
    roas: real('roas').notNull().default(0),
  },
  (table) => [
    index('metrics_daily_campaign_date_idx').on(table.campaignId, table.date),
    index('metrics_daily_platform_date_idx').on(table.platform, table.date),
    uniqueIndex('metrics_daily_campaign_date_platform_uniq').on(
      table.campaignId,
      table.date,
      table.platform,
    ),
  ],
);

// Relations

export const metricsHourlyRelations = relations(metricsHourly, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [metricsHourly.campaignId],
    references: [campaigns.id],
  }),
  adGroup: one(adGroups, {
    fields: [metricsHourly.adGroupId],
    references: [adGroups.id],
  }),
  ad: one(ads, {
    fields: [metricsHourly.adId],
    references: [ads.id],
  }),
}));

export const metricsDailyRelations = relations(metricsDaily, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [metricsDaily.campaignId],
    references: [campaigns.id],
  }),
  adGroup: one(adGroups, {
    fields: [metricsDaily.adGroupId],
    references: [adGroups.id],
  }),
  ad: one(ads, {
    fields: [metricsDaily.adId],
    references: [ads.id],
  }),
}));
