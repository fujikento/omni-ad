import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  createRule,
  deleteRule,
  evaluateRules,
  listExecutions,
  listRules,
  RuleNotFoundError,
  updateRule,
} from '../../services/rules-engine.service.js';
import { organizationProcedure, rbacProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Zod Schemas for Condition & Action Types
// ---------------------------------------------------------------------------

const MetricThresholdCondition = z.object({
  type: z.literal('metric_threshold'),
  metric: z.enum([
    'cpa',
    'roas',
    'ctr',
    'spend',
    'impressions',
    'conversions',
  ]),
  operator: z.enum(['gt', 'lt', 'gte', 'lte']),
  value: z.number(),
  duration: z.enum(['hourly', 'daily', '3days', '7days']),
});

const FrequencyThresholdCondition = z.object({
  type: z.literal('frequency_threshold'),
  operator: z.literal('gt'),
  value: z.number(),
});

const BudgetPacingCondition = z.object({
  type: z.literal('budget_pacing'),
  pace: z.enum(['over', 'under']),
  threshold: z.number(),
});

const CreativeFatigueCondition = z.object({
  type: z.literal('creative_fatigue'),
  ctrDeclinePercent: z.number(),
  days: z.number().int().min(2).max(30),
});

const TimeBasedCondition = z.object({
  type: z.literal('time_based'),
  dayOfWeek: z.array(z.number().int().min(0).max(6)),
  hourRange: z.tuple([z.number().int().min(0).max(23), z.number().int().min(1).max(24)]),
});

const PlatformSpecificCondition = z.object({
  type: z.literal('platform_specific'),
  platform: z.string(),
  condition: z.string(),
});

const RuleConditionSchema = z.discriminatedUnion('type', [
  MetricThresholdCondition,
  FrequencyThresholdCondition,
  BudgetPacingCondition,
  CreativeFatigueCondition,
  TimeBasedCondition,
  PlatformSpecificCondition,
]);

const PauseCampaignAction = z.object({ type: z.literal('pause_campaign') });
const ResumeCampaignAction = z.object({ type: z.literal('resume_campaign') });
const AdjustBudgetAction = z.object({
  type: z.literal('adjust_budget'),
  adjustmentType: z.enum(['percent', 'absolute']),
  value: z.number().positive(),
  direction: z.enum(['increase', 'decrease']),
});
const RotateCreativeAction = z.object({ type: z.literal('rotate_creative') });
const SendNotificationAction = z.object({
  type: z.literal('send_notification'),
  channels: z.array(z.enum(['slack', 'line', 'email', 'dashboard'])).min(1),
  message: z.string().min(1),
});
const AdjustBidAction = z.object({
  type: z.literal('adjust_bid'),
  adjustmentType: z.literal('percent'),
  value: z.number().positive(),
  direction: z.enum(['increase', 'decrease']),
});

const RuleActionSchema = z.discriminatedUnion('type', [
  PauseCampaignAction,
  ResumeCampaignAction,
  AdjustBudgetAction,
  RotateCreativeAction,
  SendNotificationAction,
  AdjustBidAction,
]);

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const CreateRuleInput = z.object({
  name: z.string().min(1).max(200),
  conditions: z.array(RuleConditionSchema).min(1),
  actions: z.array(RuleActionSchema).min(1),
  cooldownMinutes: z.number().int().min(1).max(10080).default(60),
  enabled: z.boolean().default(true),
});

const UpdateRuleInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  conditions: z.array(RuleConditionSchema).min(1).optional(),
  actions: z.array(RuleActionSchema).min(1).optional(),
  cooldownMinutes: z.number().int().min(1).max(10080).optional(),
  enabled: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Error Handler
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof RuleNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const rulesRouter = router({
  list: organizationProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(500).default(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listRules(ctx.organizationId, input?.limit ?? 100);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  create: rbacProcedure("settings:manage")
    .input(CreateRuleInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createRule(ctx.organizationId, ctx.userId, {
          name: input.name,
          conditions: input.conditions,
          actions: input.actions,
          cooldownMinutes: input.cooldownMinutes,
          enabled: input.enabled,
        });
      } catch (error) {
        handleServiceError(error);
      }
    }),

  update: rbacProcedure("settings:manage")
    .input(UpdateRuleInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...fields } = input;
        return await updateRule(id, ctx.organizationId, fields);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  delete: rbacProcedure("settings:manage")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteRule(input.id, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  evaluate: rbacProcedure("settings:manage").mutation(async ({ ctx }) => {
    try {
      return await evaluateRules(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  executions: organizationProcedure
    .input(
      z.object({
        ruleId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listExecutions(
          ctx.organizationId,
          input.ruleId,
          input.limit,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
