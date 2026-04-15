import {
  Bell,
  Clock,
  Gauge,
  Pause,
  Play,
  RefreshCw,
  TrendingDown,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

export type ConditionType = 'metric_threshold' | 'budget_pacing' | 'creative_fatigue' | 'time_based';
export type MetricName = 'cpa' | 'roas' | 'ctr' | 'spend' | 'impressions' | 'conversions';
export type Operator = 'gt' | 'lt' | 'gte' | 'lte';
export type Duration = 'hourly' | 'daily' | '3days' | '7days';
export type ActionType = 'pause_campaign' | 'resume_campaign' | 'adjust_budget' | 'rotate_creative' | 'send_notification' | 'adjust_bid';
export type NotificationChannel = 'dashboard' | 'slack' | 'line' | 'email';
export type AdjustDirection = 'increase' | 'decrease';
export type AdjustMethod = 'percent' | 'absolute';
export type ExecutionStatus = 'success' | 'failed' | 'skipped';

export interface MetricThresholdCondition {
  type: 'metric_threshold';
  metric: MetricName;
  operator: Operator;
  value: number;
  duration: Duration;
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

export type RuleCondition = MetricThresholdCondition | BudgetPacingCondition | CreativeFatigueCondition | TimeBasedCondition;

export interface PauseCampaignAction { type: 'pause_campaign' }
export interface ResumeCampaignAction { type: 'resume_campaign' }
export interface AdjustBudgetAction {
  type: 'adjust_budget';
  adjustmentType: AdjustMethod;
  value: number;
  direction: AdjustDirection;
}
export interface RotateCreativeAction { type: 'rotate_creative' }
export interface SendNotificationAction {
  type: 'send_notification';
  channels: NotificationChannel[];
  message: string;
}
export interface AdjustBidAction {
  type: 'adjust_bid';
  adjustmentType: 'percent';
  value: number;
  direction: AdjustDirection;
}

export type RuleAction =
  | PauseCampaignAction
  | ResumeCampaignAction
  | AdjustBudgetAction
  | RotateCreativeAction
  | SendNotificationAction
  | AdjustBidAction;

export interface AutoRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  triggerCount: number;
  lastTriggered: string | null;
  cooldownMinutes: number;
}

export interface RuleExecution {
  id: string;
  datetime: string;
  ruleName: string;
  campaignName: string;
  conditionValue: string;
  executedAction: string;
  status: ExecutionStatus;
}

export const METRIC_LABEL_KEYS: Record<MetricName, string> = {
  cpa: 'CPA',
  roas: 'ROAS',
  ctr: 'CTR',
  spend: 'autoRules.metricSpend',
  impressions: 'autoRules.metricImpressions',
  conversions: 'autoRules.metricConversions',
};

export const OPERATOR_LABELS: Record<Operator, string> = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
};

export const DURATION_LABEL_KEYS: Record<Duration, string> = {
  hourly: 'autoRules.durationHourly',
  daily: 'autoRules.durationDaily',
  '3days': 'autoRules.duration3days',
  '7days': 'autoRules.duration7days',
};

export const ACTION_TYPE_LABEL_KEYS: Record<ActionType, string> = {
  pause_campaign: 'autoRules.actionPauseCampaign',
  resume_campaign: 'autoRules.actionResumeCampaign',
  adjust_budget: 'autoRules.actionAdjustBudget',
  rotate_creative: 'autoRules.actionRotateCreative',
  send_notification: 'autoRules.actionSendNotification',
  adjust_bid: 'autoRules.actionAdjustBid',
};

export const CONDITION_TYPE_LABEL_KEYS: Record<ConditionType, string> = {
  metric_threshold: 'autoRules.conditionMetricThreshold',
  budget_pacing: 'autoRules.conditionBudgetPacing',
  creative_fatigue: 'autoRules.conditionCreativeFatigue',
  time_based: 'autoRules.conditionTimeBased',
};

export const DAY_LABEL_KEYS: Record<number, string> = {
  0: 'autoRules.daySun',
  1: 'autoRules.dayMon',
  2: 'autoRules.dayTue',
  3: 'autoRules.dayWed',
  4: 'autoRules.dayThu',
  5: 'autoRules.dayFri',
  6: 'autoRules.daySat',
};

export const EXECUTION_STATUS_KEYS: Record<ExecutionStatus, { labelKey: string; className: string }> = {
  success: { labelKey: 'autoRules.statusSuccess', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  failed: { labelKey: 'autoRules.statusFailed', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  skipped: { labelKey: 'autoRules.statusSkipped', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

export const COOLDOWN_OPTIONS = [
  { value: 15, labelKey: 'autoRules.cooldown15m' },
  { value: 30, labelKey: 'autoRules.cooldown30m' },
  { value: 60, labelKey: 'autoRules.cooldown1h' },
  { value: 120, labelKey: 'autoRules.cooldown2h' },
  { value: 240, labelKey: 'autoRules.cooldown4h' },
  { value: 1440, labelKey: 'autoRules.cooldown24h' },
];

type Translator = (key: string, params?: Record<string, string | number>) => string;

export function formatConditionValue(metric: MetricName, value: number): string {
  switch (metric) {
    case 'cpa':
    case 'spend':
      return `¥${value.toLocaleString()}`;
    case 'ctr':
      return `${value}%`;
    case 'roas':
      return `${value}x`;
    default:
      return String(value);
  }
}

export function describeCondition(condition: RuleCondition, t: Translator): string {
  switch (condition.type) {
    case 'metric_threshold': {
      const metricKey = METRIC_LABEL_KEYS[condition.metric];
      const metricLabel = metricKey.startsWith('autoRules.') ? t(metricKey) : metricKey;
      return t('autoRules.conditionSummary', {
        metric: metricLabel,
        operator: OPERATOR_LABELS[condition.operator],
        value: formatConditionValue(condition.metric, condition.value),
        duration: t(DURATION_LABEL_KEYS[condition.duration]),
      });
    }
    case 'budget_pacing':
      return `${t('autoRules.conditionBudgetPacing')}${condition.pace === 'over' ? t('autoRules.paceOver') : t('autoRules.paceUnder')} ${condition.threshold}%`;
    case 'creative_fatigue':
      return `CTR ${condition.ctrDeclinePercent}%${t('autoRules.ctrDeclineRate')} ${condition.days}${t('autoRules.dayUnit')}`;
    case 'time_based': {
      const days = condition.dayOfWeek.map((d) => t(DAY_LABEL_KEYS[d] ?? '') || String(d)).join('');
      return `${days} ${condition.hourRange[0]}:00-${condition.hourRange[1]}:00`;
    }
    default:
      return '';
  }
}

export function describeAction(action: RuleAction, t: (key: string) => string): string {
  switch (action.type) {
    case 'pause_campaign':
      return t('autoRules.actionPauseCampaign');
    case 'resume_campaign':
      return t('autoRules.actionResumeCampaign');
    case 'adjust_budget':
      return `${t('autoRules.actionAdjustBudget')}${action.value}${action.adjustmentType === 'percent' ? '%' : t('autorules.ha6de4c')}${action.direction === 'increase' ? t('autoRules.increase') : t('autoRules.decrease')}`;
    case 'rotate_creative':
      return t('autoRules.actionRotateCreative');
    case 'send_notification':
      return `${action.channels.join('/')}`;
    case 'adjust_bid':
      return `${t('autoRules.actionAdjustBid')}${action.value}%${action.direction === 'increase' ? t('autoRules.bidIncrease') : t('autoRules.bidDecrease')}`;
    default:
      return '';
  }
}

export function getConditionIcon(type: ConditionType): ReactNode {
  switch (type) {
    case 'metric_threshold':
      return createElement(TrendingDown, { size: 12 });
    case 'budget_pacing':
      return createElement(Gauge, { size: 12 });
    case 'creative_fatigue':
      return createElement(RefreshCw, { size: 12 });
    case 'time_based':
      return createElement(Clock, { size: 12 });
    default:
      return null;
  }
}

export function getActionIcon(type: ActionType): ReactNode {
  switch (type) {
    case 'pause_campaign':
      return createElement(Pause, { size: 12 });
    case 'resume_campaign':
      return createElement(Play, { size: 12 });
    case 'adjust_budget':
      return createElement(Gauge, { size: 12 });
    case 'rotate_creative':
      return createElement(RefreshCw, { size: 12 });
    case 'send_notification':
      return createElement(Bell, { size: 12 });
    case 'adjust_bid':
      return createElement(TrendingDown, { size: 12 });
    default:
      return null;
  }
}
