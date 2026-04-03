import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { campaigns } from './campaigns';
import {
  abTestEventTypeEnum,
  abTestMetricTypeEnum,
  abTestStatusEnum,
  abTestTypeEnum,
} from './enums';
import { organizations } from './organizations';

// ---------------------------------------------------------------------------
// JSONB types
// ---------------------------------------------------------------------------

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  creativeId?: string;
  config?: Record<string, unknown>;
}

export interface TrafficAllocation {
  method: 'equal' | 'thompson_sampling' | 'epsilon_greedy';
  explorationRate?: number;
}

export interface StatisticalConfig {
  mde: number;
  alpha: number;
  power: number;
  sequentialTesting: boolean;
}

export interface ABTestVariantResult {
  impressions: number;
  clicks: number;
  conversions: number;
  rate: number;
  pValue: number | null;
  ci: { lower: number; upper: number } | null;
}

export type ABTestResults = Record<string, ABTestVariantResult>;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const abTests = pgTable('ab_tests', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  campaignId: uuid('campaign_id').references(() => campaigns.id, {
    onDelete: 'set null',
  }),
  status: abTestStatusEnum('status').notNull().default('draft'),
  testType: abTestTypeEnum('test_type').notNull(),
  metricType: abTestMetricTypeEnum('metric_type').notNull(),
  variants: jsonb('variants').$type<ABTestVariant[]>().notNull(),
  trafficAllocation: jsonb('traffic_allocation')
    .$type<TrafficAllocation>()
    .notNull(),
  statisticalConfig: jsonb('statistical_config')
    .$type<StatisticalConfig>()
    .notNull(),
  requiredSampleSize: integer('required_sample_size').notNull(),
  currentSampleSize: integer('current_sample_size').notNull().default(0),
  winnerId: text('winner_id'),
  winnerDeclaredAt: timestamp('winner_declared_at', { withTimezone: true }),
  results: jsonb('results').$type<ABTestResults>(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const abTestEvents = pgTable(
  'ab_test_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    testId: uuid('test_id')
      .notNull()
      .references(() => abTests.id, { onDelete: 'cascade' }),
    variantId: text('variant_id').notNull(),
    eventType: abTestEventTypeEnum('event_type').notNull(),
    value: numeric('value', { precision: 14, scale: 2 }),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('ab_test_events_test_variant_idx').on(
      table.testId,
      table.variantId,
    ),
    index('ab_test_events_test_timestamp_idx').on(
      table.testId,
      table.timestamp,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const abTestsRelations = relations(abTests, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [abTests.organizationId],
    references: [organizations.id],
  }),
  campaign: one(campaigns, {
    fields: [abTests.campaignId],
    references: [campaigns.id],
  }),
  events: many(abTestEvents),
}));

export const abTestEventsRelations = relations(abTestEvents, ({ one }) => ({
  test: one(abTests, {
    fields: [abTestEvents.testId],
    references: [abTests.id],
  }),
}));
