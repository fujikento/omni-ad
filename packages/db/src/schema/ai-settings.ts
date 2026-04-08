import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { campaigns } from './campaigns';
import { counterStrategyEnum } from './enums';
import { organizations } from './organizations';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const autopilotModeEnum = pgEnum('autopilot_mode', [
  'full_auto',
  'suggest_only',
  'approve_required',
]);

export const optimizationFrequencyEnum = pgEnum('optimization_frequency', [
  'hourly',
  'every_4h',
  'daily',
]);

export const riskToleranceEnum = pgEnum('risk_tolerance', [
  'conservative',
  'moderate',
  'aggressive',
]);

export const decisionTypeEnum = pgEnum('decision_type', [
  'budget_adjust',
  'campaign_pause',
  'campaign_resume',
  'creative_rotate',
  'campaign_create',
  'targeting_change',
  'strategy_insight',
]);

export const decisionStatusEnum = pgEnum('decision_status', [
  'executed',
  'pending_approval',
  'approved',
  'rejected',
  'skipped',
]);

export const competitorScanFrequencyEnum = pgEnum('competitor_scan_frequency', [
  'every_30min',
  'hourly',
  'every_4h',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const aiSettings = pgTable('ai_settings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  claudeApiKeyEncrypted: text('claude_api_key_encrypted'),
  openaiApiKeyEncrypted: text('openai_api_key_encrypted'),
  runwayApiKeyEncrypted: text('runway_api_key_encrypted'),
  elevenLabsApiKeyEncrypted: text('elevenlabs_api_key_encrypted'),
  autopilotEnabled: boolean('autopilot_enabled').notNull().default(false),
  autopilotMode: autopilotModeEnum('autopilot_mode')
    .notNull()
    .default('suggest_only'),
  optimizationFrequency: optimizationFrequencyEnum('optimization_frequency')
    .notNull()
    .default('daily'),
  budgetAutoAdjust: boolean('budget_auto_adjust').notNull().default(true),
  maxBudgetChangePercent: integer('max_budget_change_percent')
    .notNull()
    .default(20),
  creativeAutoRotate: boolean('creative_auto_rotate').notNull().default(true),
  campaignAutoCreate: boolean('campaign_auto_create').notNull().default(false),
  riskTolerance: riskToleranceEnum('risk_tolerance')
    .notNull()
    .default('moderate'),
  targetRoas: real('target_roas'),
  monthlyBudgetCap: numeric('monthly_budget_cap', {
    precision: 14,
    scale: 2,
  }),
  competitiveMonitorEnabled: boolean('competitive_monitor_enabled')
    .notNull()
    .default(false),
  autoCounterEnabled: boolean('auto_counter_enabled')
    .notNull()
    .default(false),
  defaultCounterStrategy: counterStrategyEnum('default_counter_strategy')
    .notNull()
    .default('defensive'),
  competitorScanFrequency: competitorScanFrequencyEnum(
    'competitor_scan_frequency',
  )
    .notNull()
    .default('hourly'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const aiDecisionLog = pgTable(
  'ai_decision_log',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    decisionType: decisionTypeEnum('decision_type').notNull(),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    reasoning: text('reasoning').notNull(),
    recommendation: jsonb('recommendation').notNull(),
    action: jsonb('action'),
    status: decisionStatusEnum('status').notNull(),
    confidenceScore: real('confidence_score').notNull(),
    resultBefore: jsonb('result_before'),
    resultAfter: jsonb('result_after'),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('ai_decision_log_org_idx').on(table.organizationId),
    index('ai_decision_log_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
    index('ai_decision_log_campaign_idx').on(table.campaignId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const aiSettingsRelations = relations(aiSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiSettings.organizationId],
    references: [organizations.id],
  }),
}));

export const aiDecisionLogRelations = relations(aiDecisionLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiDecisionLog.organizationId],
    references: [organizations.id],
  }),
  campaign: one(campaigns, {
    fields: [aiDecisionLog.campaignId],
    references: [campaigns.id],
  }),
}));
