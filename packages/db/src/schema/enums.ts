import { pgEnum } from 'drizzle-orm/pg-core';

export const platformEnum = pgEnum('platform', [
  'meta',
  'google',
  'x',
  'tiktok',
  'line_yahoo',
  'amazon',
  'microsoft',
]);

export const platformStatusEnum = pgEnum('platform_status', [
  'active',
  'expired',
  'revoked',
  'error',
]);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'error',
]);

export const campaignObjectiveEnum = pgEnum('campaign_objective', [
  'awareness',
  'traffic',
  'engagement',
  'leads',
  'conversion',
  'retargeting',
]);

export const creativeTypeEnum = pgEnum('creative_type', [
  'text',
  'image',
  'video',
  'carousel',
]);

export const planTierEnum = pgEnum('plan_tier', [
  'starter',
  'pro',
  'business',
  'enterprise',
]);

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'admin',
  'manager',
  'analyst',
  'creative',
]);

export const funnelStatusEnum = pgEnum('funnel_status', [
  'draft',
  'active',
  'paused',
]);

export const attributionModelEnum = pgEnum('attribution_model', [
  'markov',
  'shapley',
  'linear',
  'last_click',
  'first_click',
]);

export const touchpointTypeEnum = pgEnum('touchpoint_type', [
  'impression',
  'click',
  'view',
  'conversion',
]);

export const counterStrategyEnum = pgEnum('counter_strategy', [
  'aggressive',
  'defensive',
  'opportunistic',
]);

export const creativeBatchStatusEnum = pgEnum('creative_batch_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const abTestStatusEnum = pgEnum('ab_test_status', [
  'draft',
  'running',
  'paused',
  'completed',
  'cancelled',
]);

export const abTestTypeEnum = pgEnum('ab_test_type', [
  'creative',
  'headline',
  'cta',
  'targeting',
  'bid_strategy',
  'landing_page',
]);

export const abTestMetricTypeEnum = pgEnum('ab_test_metric_type', [
  'ctr',
  'cvr',
  'roas',
  'cpa',
]);

export const abTestEventTypeEnum = pgEnum('ab_test_event_type', [
  'impression',
  'click',
  'conversion',
]);
