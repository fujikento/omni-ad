import type {
  ActionType,
  AdjustDirection,
  AdjustMethod,
  ConditionType,
  Duration,
  MetricName,
  NotificationChannel,
  Operator,
} from '../_types';
import {
  DAY_LABEL_KEYS,
  DURATION_LABEL_KEYS,
  METRIC_LABEL_KEYS,
} from '../_types';

export interface FormCondition {
  type: ConditionType;
  metric: MetricName;
  operator: Operator;
  value: string;
  duration: Duration;
  pace: 'over' | 'under';
  threshold: string;
  ctrDeclinePercent: string;
  days: string;
  dayOfWeek: number[];
  hourStart: number;
  hourEnd: number;
}

export interface FormAction {
  type: ActionType;
  adjustmentType: AdjustMethod;
  value: string;
  direction: AdjustDirection;
  channels: NotificationChannel[];
  message: string;
}

export function createEmptyCondition(): FormCondition {
  return {
    type: 'metric_threshold',
    metric: 'cpa',
    operator: 'gt',
    value: '',
    duration: 'daily',
    pace: 'over',
    threshold: '',
    ctrDeclinePercent: '',
    days: '',
    dayOfWeek: [1, 2, 3, 4, 5],
    hourStart: 0,
    hourEnd: 6,
  };
}

export function createEmptyAction(): FormAction {
  return {
    type: 'pause_campaign',
    adjustmentType: 'percent',
    value: '',
    direction: 'decrease',
    channels: ['dashboard'],
    message: '',
  };
}

type Translator = (key: string, params?: Record<string, string | number>) => string;

export function buildConditionPreview(conditions: FormCondition[], t: Translator): string {
  return conditions.map((c) => {
    switch (c.type) {
      case 'metric_threshold': {
        const metricKey = METRIC_LABEL_KEYS[c.metric];
        const metricLabel = metricKey.startsWith('autoRules.') ? t(metricKey) : metricKey;
        return `${metricLabel} ${c.value || '?'} ${t(DURATION_LABEL_KEYS[c.duration])}`;
      }
      case 'budget_pacing':
        return `${t('autoRules.conditionBudgetPacing')} ${c.threshold || '?'}% ${c.pace === 'over' ? t('autoRules.paceOver') : t('autoRules.paceUnder')}`;
      case 'creative_fatigue':
        return `CTR ${c.ctrDeclinePercent || '?'}% ${c.days || '?'}${t('autoRules.dayUnit')}`;
      case 'time_based': {
        const days = c.dayOfWeek.map((d) => t(DAY_LABEL_KEYS[d] ?? '') || '').join('');
        return `${days} ${c.hourStart}:00-${c.hourEnd}:00`;
      }
      default:
        return '';
    }
  }).join(' AND ');
}

export function buildActionPreview(actions: FormAction[], t: Translator): string {
  return actions.map((a) => {
    switch (a.type) {
      case 'pause_campaign':
        return t('autoRules.actionPauseCampaign');
      case 'resume_campaign':
        return t('autoRules.actionResumeCampaign');
      case 'adjust_budget':
        return `${t('autoRules.actionAdjustBudget')} ${a.value || '?'}${a.adjustmentType === 'percent' ? '%' : ''}${a.direction === 'increase' ? t('autoRules.increase') : t('autoRules.decrease')}`;
      case 'rotate_creative':
        return t('autoRules.actionRotateCreative');
      case 'send_notification':
        return `${a.channels.join('/')} ${t('autoRules.actionSendNotification')}`;
      case 'adjust_bid':
        return `${t('autoRules.actionAdjustBid')} ${a.value || '?'}% ${a.direction === 'increase' ? t('autoRules.bidIncrease') : t('autoRules.bidDecrease')}`;
      default:
        return '';
    }
  }).join(', ');
}
