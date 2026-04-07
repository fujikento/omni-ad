import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { campaigns } from './campaigns';
import { counterStrategyEnum, platformEnum } from './enums';
import { organizations } from './organizations';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const alertTypeEnum = pgEnum('alert_type', [
  'impression_share_drop',
  'new_competitor',
  'creative_surge',
  'bid_war',
  'competitor_pause',
  'seasonal_attack',
  'market_shift',
]);

export const alertSeverityEnum = pgEnum('alert_severity', [
  'critical',
  'high',
  'medium',
  'low',
]);

export const counterActionTypeEnum = pgEnum('counter_action_type', [
  'bid_adjust',
  'budget_shift',
  'creative_counter',
  'targeting_expand',
  'keyword_defense',
  'timing_attack',
  'do_nothing',
]);

export const counterActionStatusEnum = pgEnum('counter_action_status', [
  'proposed',
  'executing',
  'executed',
  'rolled_back',
  'skipped',
]);

// ---------------------------------------------------------------------------
// JSONB Type Helpers
// ---------------------------------------------------------------------------

export interface AlertData {
  previousValue?: number;
  currentValue?: number;
  threshold?: number;
  competitorDomain?: string;
  competitorName?: string;
  affectedCampaigns?: string[];
  details?: Record<string, unknown>;
}

export interface CounterActionDetails {
  bidAdjustment?: { campaignId: string; previousBid: number; newBid: number };
  budgetShift?: { fromCampaignId: string; toCampaignId: string; amount: number };
  targetingExpansion?: { keywords: string[]; audiences: string[] };
  timingAttack?: { dayOfWeek: number[]; hourStart: number; hourEnd: number };
  metadata?: Record<string, unknown>;
}

export interface CounterActionExpectedImpact {
  impressionShareChange?: number;
  cpcChange?: number;
  budgetImpact?: number;
  roasImpact?: number;
}

export interface CounterActionResult {
  impressionShare?: number;
  cpc?: number;
  roas?: number;
  spend?: number;
  dailyBudget?: number;
  conversions?: number;
  snapshotDate?: string;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const competitorProfiles = pgTable(
  'competitor_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domain: text('domain').notNull(),
    platforms: text('platforms')
      .array()
      .notNull()
      .default(sql`ARRAY['google','meta']::text[]`),
    keywords: text('keywords').array().notNull().default(sql`'{}'::text[]`),
    metaPageIds: text('meta_page_ids').array(),
    autoCounterEnabled: boolean('auto_counter_enabled').notNull().default(true),
    counterStrategy: counterStrategyEnum('counter_strategy')
      .notNull()
      .default('defensive'),
    maxBidIncreasePercent: integer('max_bid_increase_percent')
      .notNull()
      .default(15),
    maxBudgetShiftPercent: integer('max_budget_shift_percent')
      .notNull()
      .default(20),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('competitor_profiles_org_idx').on(table.organizationId),
    index('competitor_profiles_org_active_idx').on(
      table.organizationId,
      table.active,
    ),
  ],
);

export const auctionInsightSnapshots = pgTable(
  'auction_insight_snapshots',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    platform: platformEnum('platform').notNull(),
    snapshotDate: date('snapshot_date').notNull(),
    impressionShare: real('impression_share').notNull(),
    topOfPageRate: real('top_of_page_rate'),
    overlapRate: real('overlap_rate'),
    positionAboveRate: real('position_above_rate'),
    outrankingShare: real('outranking_share'),
    avgCpc: real('avg_cpc'),
    competitorDomain: text('competitor_domain'),
    rawData: jsonb('raw_data').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('auction_snapshots_org_idx').on(table.organizationId),
    index('auction_snapshots_org_date_idx').on(
      table.organizationId,
      table.snapshotDate,
    ),
    index('auction_snapshots_campaign_idx').on(table.campaignId),
    uniqueIndex('auction_snapshots_dedup_idx').on(
      table.organizationId,
      table.campaignId,
      table.platform,
      table.snapshotDate,
      table.competitorDomain,
    ),
  ],
);

export const competitorCreatives = pgTable(
  'competitor_creatives',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    competitorId: uuid('competitor_id')
      .notNull()
      .references(() => competitorProfiles.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform').notNull(),
    externalAdId: text('external_ad_id'),
    headline: text('headline'),
    bodyText: text('body_text'),
    imageUrl: text('image_url'),
    videoUrl: text('video_url'),
    startDate: date('start_date'),
    isActive: boolean('is_active').notNull().default(true),
    themes: text('themes').array(),
    sentiment: text('sentiment'),
    estimatedSpend: text('estimated_spend'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('competitor_creatives_org_idx').on(table.organizationId),
    index('competitor_creatives_competitor_idx').on(table.competitorId),
    index('competitor_creatives_external_idx').on(table.externalAdId),
  ],
);

export const competitorAlerts = pgTable(
  'competitor_alerts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    competitorId: uuid('competitor_id').references(
      () => competitorProfiles.id,
      { onDelete: 'set null' },
    ),
    alertType: alertTypeEnum('alert_type').notNull(),
    severity: alertSeverityEnum('severity').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    data: jsonb('data').$type<AlertData>().notNull(),
    counterActionId: uuid('counter_action_id'),
    acknowledged: boolean('acknowledged').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('competitor_alerts_org_idx').on(table.organizationId),
    index('competitor_alerts_org_type_idx').on(
      table.organizationId,
      table.alertType,
    ),
    index('competitor_alerts_org_ack_idx').on(
      table.organizationId,
      table.acknowledged,
    ),
  ],
);

export const counterActions = pgTable(
  'counter_actions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    alertId: uuid('alert_id').references(() => competitorAlerts.id, {
      onDelete: 'set null',
    }),
    competitorId: uuid('competitor_id').references(
      () => competitorProfiles.id,
      { onDelete: 'set null' },
    ),
    actionType: counterActionTypeEnum('action_type').notNull(),
    strategy: counterStrategyEnum('strategy').notNull(),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    details: jsonb('details').$type<CounterActionDetails>().notNull(),
    reasoning: text('reasoning').notNull(),
    confidenceScore: real('confidence_score').notNull(),
    status: counterActionStatusEnum('status').notNull().default('proposed'),
    resultBefore: jsonb('result_before').$type<CounterActionResult>(),
    resultAfter: jsonb('result_after').$type<CounterActionResult>(),
    rolledBackAt: timestamp('rolled_back_at', { withTimezone: true }),
    rollbackReason: text('rollback_reason'),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('counter_actions_org_idx').on(table.organizationId),
    index('counter_actions_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
    index('counter_actions_alert_idx').on(table.alertId),
    index('counter_actions_campaign_idx').on(table.campaignId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const competitorProfilesRelations = relations(
  competitorProfiles,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [competitorProfiles.organizationId],
      references: [organizations.id],
    }),
    creatives: many(competitorCreatives),
    alerts: many(competitorAlerts),
    counterActions: many(counterActions),
  }),
);

export const auctionInsightSnapshotsRelations = relations(
  auctionInsightSnapshots,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [auctionInsightSnapshots.organizationId],
      references: [organizations.id],
    }),
    campaign: one(campaigns, {
      fields: [auctionInsightSnapshots.campaignId],
      references: [campaigns.id],
    }),
  }),
);

export const competitorCreativesRelations = relations(
  competitorCreatives,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [competitorCreatives.organizationId],
      references: [organizations.id],
    }),
    competitor: one(competitorProfiles, {
      fields: [competitorCreatives.competitorId],
      references: [competitorProfiles.id],
    }),
  }),
);

export const competitorAlertsRelations = relations(
  competitorAlerts,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [competitorAlerts.organizationId],
      references: [organizations.id],
    }),
    competitor: one(competitorProfiles, {
      fields: [competitorAlerts.competitorId],
      references: [competitorProfiles.id],
    }),
    counterAction: one(counterActions, {
      fields: [competitorAlerts.counterActionId],
      references: [counterActions.id],
    }),
  }),
);

export const counterActionsRelations = relations(
  counterActions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [counterActions.organizationId],
      references: [organizations.id],
    }),
    alert: one(competitorAlerts, {
      fields: [counterActions.alertId],
      references: [competitorAlerts.id],
    }),
    competitor: one(competitorProfiles, {
      fields: [counterActions.competitorId],
      references: [competitorProfiles.id],
    }),
    campaign: one(campaigns, {
      fields: [counterActions.campaignId],
      references: [campaigns.id],
    }),
  }),
);
