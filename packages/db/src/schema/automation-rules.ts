import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations, users } from './organizations';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ruleExecutionStatusEnum = pgEnum('rule_execution_status', [
  'success',
  'failed',
  'skipped',
]);

// ---------------------------------------------------------------------------
// Condition & Action Types
// ---------------------------------------------------------------------------

export interface MetricThresholdCondition {
  type: 'metric_threshold';
  metric: 'cpa' | 'roas' | 'ctr' | 'spend' | 'impressions' | 'conversions';
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  value: number;
  duration: 'hourly' | 'daily' | '3days' | '7days';
}

export interface FrequencyThresholdCondition {
  type: 'frequency_threshold';
  operator: 'gt';
  value: number;
}

export interface BudgetPacingCondition {
  type: 'budget_pacing';
  pace: 'over' | 'under';
  threshold: number;
}

export interface CreativeFatigueCondition {
  type: 'creative_fatigue';
  ctrDeclinePercent: number;
  days: number;
}

export interface TimeBasedCondition {
  type: 'time_based';
  dayOfWeek: number[];
  hourRange: [number, number];
}

export interface PlatformSpecificCondition {
  type: 'platform_specific';
  platform: string;
  condition: string;
}

export type RuleCondition =
  | MetricThresholdCondition
  | FrequencyThresholdCondition
  | BudgetPacingCondition
  | CreativeFatigueCondition
  | TimeBasedCondition
  | PlatformSpecificCondition;

export interface PauseCampaignAction {
  type: 'pause_campaign';
}

export interface ResumeCampaignAction {
  type: 'resume_campaign';
}

export interface AdjustBudgetAction {
  type: 'adjust_budget';
  adjustmentType: 'percent' | 'absolute';
  value: number;
  direction: 'increase' | 'decrease';
}

export interface RotateCreativeAction {
  type: 'rotate_creative';
}

export interface SendNotificationAction {
  type: 'send_notification';
  channels: ('slack' | 'line' | 'email' | 'dashboard')[];
  message: string;
}

export interface AdjustBidAction {
  type: 'adjust_bid';
  adjustmentType: 'percent';
  value: number;
  direction: 'increase' | 'decrease';
}

export type RuleAction =
  | PauseCampaignAction
  | ResumeCampaignAction
  | AdjustBudgetAction
  | RotateCreativeAction
  | SendNotificationAction
  | AdjustBidAction;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    conditions: jsonb('conditions').$type<RuleCondition[]>().notNull(),
    actions: jsonb('actions').$type<RuleAction[]>().notNull(),
    cooldownMinutes: integer('cooldown_minutes').notNull().default(60),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    triggerCount: integer('trigger_count').notNull().default(0),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('automation_rules_org_idx').on(table.organizationId),
    index('automation_rules_enabled_idx').on(
      table.organizationId,
      table.enabled,
    ),
  ],
);

export const automationRuleExecutions = pgTable(
  'automation_rule_executions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => automationRules.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id'),
    conditionSnapshot: jsonb('condition_snapshot')
      .$type<Record<string, unknown>>()
      .notNull(),
    actionsExecuted: jsonb('actions_executed')
      .$type<Record<string, unknown>[]>()
      .notNull(),
    status: ruleExecutionStatusEnum('status').notNull(),
    errorMessage: text('error_message'),
    executedAt: timestamp('executed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('rule_executions_rule_idx').on(table.ruleId),
    index('rule_executions_org_idx').on(table.organizationId),
    index('rule_executions_executed_at_idx').on(table.executedAt),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const automationRulesRelations = relations(
  automationRules,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [automationRules.organizationId],
      references: [organizations.id],
    }),
    creator: one(users, {
      fields: [automationRules.createdBy],
      references: [users.id],
    }),
    executions: many(automationRuleExecutions),
  }),
);

export const automationRuleExecutionsRelations = relations(
  automationRuleExecutions,
  ({ one }) => ({
    rule: one(automationRules, {
      fields: [automationRuleExecutions.ruleId],
      references: [automationRules.id],
    }),
    organization: one(organizations, {
      fields: [automationRuleExecutions.organizationId],
      references: [organizations.id],
    }),
  }),
);
