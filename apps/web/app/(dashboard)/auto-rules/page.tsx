'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Gauge,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { Button, EmptyState, PageHeader } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type ConditionType = 'metric_threshold' | 'budget_pacing' | 'creative_fatigue' | 'time_based';
type MetricName = 'cpa' | 'roas' | 'ctr' | 'spend' | 'impressions' | 'conversions';
type Operator = 'gt' | 'lt' | 'gte' | 'lte';
type Duration = 'hourly' | 'daily' | '3days' | '7days';
type ActionType = 'pause_campaign' | 'resume_campaign' | 'adjust_budget' | 'rotate_creative' | 'send_notification' | 'adjust_bid';
type NotificationChannel = 'dashboard' | 'slack' | 'line' | 'email';
type AdjustDirection = 'increase' | 'decrease';
type AdjustMethod = 'percent' | 'absolute';
type ExecutionStatus = 'success' | 'failed' | 'skipped';

interface MetricThresholdCondition {
  type: 'metric_threshold';
  metric: MetricName;
  operator: Operator;
  value: number;
  duration: Duration;
}

interface BudgetPacingCondition {
  type: 'budget_pacing';
  pace: 'over' | 'under';
  threshold: number;
}

interface CreativeFatigueCondition {
  type: 'creative_fatigue';
  ctrDeclinePercent: number;
  days: number;
}

interface TimeBasedCondition {
  type: 'time_based';
  dayOfWeek: number[];
  hourRange: [number, number];
}

type RuleCondition = MetricThresholdCondition | BudgetPacingCondition | CreativeFatigueCondition | TimeBasedCondition;

interface PauseCampaignAction {
  type: 'pause_campaign';
}

interface ResumeCampaignAction {
  type: 'resume_campaign';
}

interface AdjustBudgetAction {
  type: 'adjust_budget';
  adjustmentType: AdjustMethod;
  value: number;
  direction: AdjustDirection;
}

interface RotateCreativeAction {
  type: 'rotate_creative';
}

interface SendNotificationAction {
  type: 'send_notification';
  channels: NotificationChannel[];
  message: string;
}

interface AdjustBidAction {
  type: 'adjust_bid';
  adjustmentType: 'percent';
  value: number;
  direction: AdjustDirection;
}

type RuleAction = PauseCampaignAction | ResumeCampaignAction | AdjustBudgetAction | RotateCreativeAction | SendNotificationAction | AdjustBidAction;

interface AutoRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  triggerCount: number;
  lastTriggered: string | null;
  cooldownMinutes: number;
}

interface RuleExecution {
  id: string;
  datetime: string;
  ruleName: string;
  campaignName: string;
  conditionValue: string;
  executedAction: string;
  status: ExecutionStatus;
}

// ============================================================
// Constants
// ============================================================

const METRIC_LABEL_KEYS: Record<MetricName, string> = {
  cpa: 'CPA',
  roas: 'ROAS',
  ctr: 'CTR',
  spend: 'autoRules.metricSpend',
  impressions: 'autoRules.metricImpressions',
  conversions: 'autoRules.metricConversions',
};

const OPERATOR_LABELS: Record<Operator, string> = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
};

const DURATION_LABEL_KEYS: Record<Duration, string> = {
  hourly: 'autoRules.durationHourly',
  daily: 'autoRules.durationDaily',
  '3days': 'autoRules.duration3days',
  '7days': 'autoRules.duration7days',
};

const ACTION_TYPE_LABEL_KEYS: Record<ActionType, string> = {
  pause_campaign: 'autoRules.actionPauseCampaign',
  resume_campaign: 'autoRules.actionResumeCampaign',
  adjust_budget: 'autoRules.actionAdjustBudget',
  rotate_creative: 'autoRules.actionRotateCreative',
  send_notification: 'autoRules.actionSendNotification',
  adjust_bid: 'autoRules.actionAdjustBid',
};

const CONDITION_TYPE_LABEL_KEYS: Record<ConditionType, string> = {
  metric_threshold: 'autoRules.conditionMetricThreshold',
  budget_pacing: 'autoRules.conditionBudgetPacing',
  creative_fatigue: 'autoRules.conditionCreativeFatigue',
  time_based: 'autoRules.conditionTimeBased',
};

const DAY_LABEL_KEYS: Record<number, string> = {
  0: 'autoRules.daySun',
  1: 'autoRules.dayMon',
  2: 'autoRules.dayTue',
  3: 'autoRules.dayWed',
  4: 'autoRules.dayThu',
  5: 'autoRules.dayFri',
  6: 'autoRules.daySat',
};

const EXECUTION_STATUS_KEYS: Record<ExecutionStatus, { labelKey: string; className: string }> = {
  success: { labelKey: 'autoRules.statusSuccess', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  failed: { labelKey: 'autoRules.statusFailed', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  skipped: { labelKey: 'autoRules.statusSkipped', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

const COOLDOWN_OPTIONS = [
  { value: 15, labelKey: 'autoRules.cooldown15m' },
  { value: 30, labelKey: 'autoRules.cooldown30m' },
  { value: 60, labelKey: 'autoRules.cooldown1h' },
  { value: 120, labelKey: 'autoRules.cooldown2h' },
  { value: 240, labelKey: 'autoRules.cooldown4h' },
  { value: 1440, labelKey: 'autoRules.cooldown24h' },
];

// ============================================================
// Helper Functions
// ============================================================

function describeCondition(condition: RuleCondition, t: (key: string, params?: Record<string, string | number>) => string): string {
  switch (condition.type) {
    case 'metric_threshold': {
      const metricKey = METRIC_LABEL_KEYS[condition.metric];
      const metricLabel = metricKey.startsWith('autoRules.') ? t(metricKey) : metricKey;
      return t('autoRules.conditionSummary', { metric: metricLabel, operator: OPERATOR_LABELS[condition.operator], value: formatConditionValue(condition.metric, condition.value), duration: t(DURATION_LABEL_KEYS[condition.duration]) });
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

function formatConditionValue(metric: MetricName, value: number): string {
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

function describeAction(action: RuleAction, t: (key: string) => string): string {
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

function getConditionIcon(type: ConditionType): React.ReactNode {
  switch (type) {
    case 'metric_threshold':
      return <TrendingDown size={12} />;
    case 'budget_pacing':
      return <Gauge size={12} />;
    case 'creative_fatigue':
      return <RefreshCw size={12} />;
    case 'time_based':
      return <Clock size={12} />;
    default:
      return null;
  }
}

function getActionIcon(type: ActionType): React.ReactNode {
  switch (type) {
    case 'pause_campaign':
      return <Pause size={12} />;
    case 'resume_campaign':
      return <Play size={12} />;
    case 'adjust_budget':
      return <Gauge size={12} />;
    case 'rotate_creative':
      return <RefreshCw size={12} />;
    case 'send_notification':
      return <Bell size={12} />;
    case 'adjust_bid':
      return <TrendingDown size={12} />;
    default:
      return null;
  }
}

// ============================================================
// Subcomponents
// ============================================================

function ToggleSwitch({ enabled, onChange }: {
  enabled: boolean;
  onChange: (value: boolean) => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        enabled ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

interface RuleCardProps {
  rule: AutoRule;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function RuleCard({ rule, onToggle, onEdit, onDuplicate, onDelete }: RuleCardProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className={cn(
      'rounded-lg border bg-card p-5 transition-colors',
      rule.enabled ? 'border-border' : 'border-border opacity-60',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ToggleSwitch enabled={rule.enabled} onChange={(val) => onToggle(rule.id, val)} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{rule.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('autoRules.cooldown')}: {COOLDOWN_OPTIONS.find((o) => o.value === rule.cooldownMinutes) ? t(COOLDOWN_OPTIONS.find((o) => o.value === rule.cooldownMinutes)!.labelKey) : `${rule.cooldownMinutes}${t('autoRules.minuteUnit')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(rule.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t('common.edit')}
            aria-label={`${rule.name}${t('common.edit')}`}
          >
            <Zap size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(rule.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t('autoRules.duplicate')}
            aria-label={`${rule.name}${t('autoRules.duplicate')}`}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(rule.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            title={t('common.delete')}
            aria-label={`${rule.name}${t('common.delete')}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Conditions */}
      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('autoRules.conditionIf')}</p>
        {rule.conditions.map((condition, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5">
            <span className="flex-shrink-0 text-muted-foreground">{getConditionIcon(condition.type)}</span>
            <span className="text-xs text-foreground">{describeCondition(condition, t)}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('autoRules.actionThen')}</p>
        {rule.actions.map((action, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-1.5">
            <ArrowRight size={12} className="flex-shrink-0 text-primary" />
            <span className="flex-shrink-0 text-primary">{getActionIcon(action.type)}</span>
            <span className="text-xs font-medium text-primary">{describeAction(action, t)}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{t('autoRules.triggerCount')} <span className="font-semibold text-foreground">{t('autoRules.triggerUnit', { count: rule.triggerCount })}</span></span>
        {rule.lastTriggered && (
          <span>{t('autoRules.lastTriggered')}: <span className="font-medium text-foreground">{rule.lastTriggered}</span></span>
        )}
      </div>
    </div>
  );
}

// -- Create/Edit Rule Modal --

interface CreateRuleModalProps {
  open: boolean;
  onClose: () => void;
  editingRule?: AutoRule | null;
}

interface FormCondition {
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

interface FormAction {
  type: ActionType;
  adjustmentType: AdjustMethod;
  value: string;
  direction: AdjustDirection;
  channels: NotificationChannel[];
  message: string;
}

function createEmptyCondition(): FormCondition {
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

function createEmptyAction(): FormAction {
  return {
    type: 'pause_campaign',
    adjustmentType: 'percent',
    value: '',
    direction: 'decrease',
    channels: ['dashboard'],
    message: '',
  };
}

function CreateRuleModal({ open, onClose, editingRule }: CreateRuleModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(editingRule?.name ?? '');
  const [cooldown, setCooldown] = useState(editingRule?.cooldownMinutes ?? 60);
  const [conditions, setConditions] = useState<FormCondition[]>([createEmptyCondition()]);
  const [actions, setActions] = useState<FormAction[]>([createEmptyAction()]);

  if (!open) return null;

  function addCondition(): void {
    setConditions((prev) => [...prev, createEmptyCondition()]);
  }

  function removeCondition(index: number): void {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCondition<K extends keyof FormCondition>(index: number, field: K, value: FormCondition[K]): void {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  }

  function addAction(): void {
    setActions((prev) => [...prev, createEmptyAction()]);
  }

  function removeAction(index: number): void {
    if (actions.length <= 1) return;
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAction<K extends keyof FormAction>(index: number, field: K, value: FormAction[K]): void {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  }

  function toggleDay(condIdx: number, day: number): void {
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== condIdx) return c;
        const days = c.dayOfWeek.includes(day)
          ? c.dayOfWeek.filter((d) => d !== day)
          : [...c.dayOfWeek, day];
        return { ...c, dayOfWeek: days };
      }),
    );
  }

  function toggleChannel(actIdx: number, channel: NotificationChannel): void {
    setActions((prev) =>
      prev.map((a, i) => {
        if (i !== actIdx) return a;
        const channels = a.channels.includes(channel)
          ? a.channels.filter((c) => c !== channel)
          : [...a.channels, channel];
        return { ...a, channels };
      }),
    );
  }

  function buildConditionPreview(): string {
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

  function buildActionPreview(): string {
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

  function handleSubmit(): void {
    // In production, build the proper typed arrays from form state and call createMutation
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('autoRules.modalTitle')}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn('rounded-full px-2 py-0.5 font-medium', step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {t('autoRules.step1')}
              </span>
              <ChevronRight size={12} />
              <span className={cn('rounded-full px-2 py-0.5 font-medium', step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {t('autoRules.step2')}
              </span>
              <ChevronRight size={12} />
              <span className={cn('rounded-full px-2 py-0.5 font-medium', step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {t('autoRules.step3')}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Basic info */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="rule-name" className="mb-1 block text-sm font-medium text-foreground">
                  {t('autoRules.ruleName')}
                </label>
                <input
                  id="rule-name"
                  type="text"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t('autoRules.ruleNamePlaceholder')}
                  required
                />
              </div>
              <div>
                <label htmlFor="rule-cooldown" className="mb-1 block text-sm font-medium text-foreground">
                  {t('autoRules.cooldown')}
                </label>
                <div className="relative">
                  <select
                    id="rule-cooldown"
                    value={cooldown}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCooldown(Number(e.target.value))}
                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {COOLDOWN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Conditions */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm font-medium text-foreground">{t('autoRules.conditionSettings')}</p>
              <div className="space-y-4">
                {conditions.map((cond, idx) => (
                  <div key={idx} className="rounded-md border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">{t('autoRules.conditionN', { n: idx + 1 })}</span>
                      {conditions.length > 1 && (
                        <button type="button" onClick={() => removeCondition(idx)} className="rounded p-0.5 text-muted-foreground hover:text-red-600" aria-label={t('autoRules.removeCondition')}>
                          <Minus size={14} />
                        </button>
                      )}
                    </div>

                    {/* Condition type */}
                    <div className="relative mt-2">
                      <select
                        value={cond.type}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(idx, 'type', e.target.value as ConditionType)}
                        className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label={t('autoRules.conditionType')}
                      >
                        {(Object.entries(CONDITION_TYPE_LABEL_KEYS) as [ConditionType, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{t(v)}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>

                    {/* Metric threshold fields */}
                    {cond.type === 'metric_threshold' && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="relative">
                          <select
                            value={cond.metric}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(idx, 'metric', e.target.value as MetricName)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={t('autoRules.metricLabel')}
                          >
                            {(Object.entries(METRIC_LABEL_KEYS) as [MetricName, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v.startsWith('autoRules.') ? t(v) : v}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <div className="relative">
                          <select
                            value={cond.operator}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(idx, 'operator', e.target.value as Operator)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={t('autoRules.operatorLabel')}
                          >
                            {(Object.entries(OPERATOR_LABELS) as [Operator, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <input
                          type="number"
                          value={cond.value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'value', e.target.value)}
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder={t('autoRules.valueLabel')}
                          aria-label={t('autoRules.thresholdLabel')}
                        />
                        <div className="relative">
                          <select
                            value={cond.duration}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(idx, 'duration', e.target.value as Duration)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={t('autoRules.durationLabel')}
                          >
                            {(Object.entries(DURATION_LABEL_KEYS) as [Duration, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{t(v)}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Budget pacing fields */}
                    {cond.type === 'budget_pacing' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="relative">
                          <select
                            value={cond.pace}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(idx, 'pace', e.target.value as 'over' | 'under')}
                            className="w-full appearance-none rounded-md border border-input bg-background px-3 py-1.5 pr-8 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={t('autoRules.paceLabel')}
                          >
                            <option value="over">{t('autoRules.paceOver')}</option>
                            <option value="under">{t('autoRules.paceUnder')}</option>
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={cond.threshold}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'threshold', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="20"
                            aria-label={t('autoRules.thresholdPercent')}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}

                    {/* Creative fatigue fields */}
                    {cond.type === 'creative_fatigue' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{t('autoRules.ctrDeclineRate')}</span>
                          <input
                            type="number"
                            value={cond.ctrDeclinePercent}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'ctrDeclinePercent', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="15"
                            aria-label={t('autoRules.ctrDeclineRate')}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{t('autoRules.periodDays')}</span>
                          <input
                            type="number"
                            value={cond.days}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'days', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="5"
                            aria-label={t('autoRules.periodDays')}
                          />
                          <span className="text-xs text-muted-foreground">{t('autoRules.dayUnit')}</span>
                        </div>
                      </div>
                    )}

                    {/* Time-based fields */}
                    {cond.type === 'time_based' && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <span className="text-xs text-muted-foreground">{t('autoRules.dayOfWeek')}</span>
                          <div className="mt-1 flex gap-1">
                            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(idx, day)}
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors',
                                  cond.dayOfWeek.includes(day)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'border border-border text-muted-foreground hover:border-primary/50',
                                )}
                              >
                                {t(DAY_LABEL_KEYS[day] ?? '')}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t('autoRules.timeRange')}</span>
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={cond.hourStart}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'hourStart', Number(e.target.value))}
                            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={t('autoRules.startTime')}
                          />
                          <span className="text-xs text-muted-foreground">:00 -</span>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={cond.hourEnd}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'hourEnd', Number(e.target.value))}
                            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={t('autoRules.endTime')}
                          />
                          <span className="text-xs text-muted-foreground">:00</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addCondition}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                <Plus size={14} />
                {t('autoRules.addCondition')}
              </button>

              {/* Preview */}
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('autoRules.preview')}</p>
                <p className="mt-1 text-xs text-foreground">{buildConditionPreview() || t('autoRules.noCondition')}</p>
              </div>
            </div>
          )}

          {/* Step 3: Actions */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm font-medium text-foreground">{t('autoRules.actionSettings')}</p>
              <div className="space-y-4">
                {actions.map((act, idx) => (
                  <div key={idx} className="rounded-md border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">{t('autoRules.actionN', { n: idx + 1 })}</span>
                      {actions.length > 1 && (
                        <button type="button" onClick={() => removeAction(idx)} className="rounded p-0.5 text-muted-foreground hover:text-red-600" aria-label={t('autoRules.removeAction')}>
                          <Minus size={14} />
                        </button>
                      )}
                    </div>

                    {/* Action type */}
                    <div className="relative mt-2">
                      <select
                        value={act.type}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateAction(idx, 'type', e.target.value as ActionType)}
                        className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label={t('autoRules.actionType')}
                      >
                        {(Object.entries(ACTION_TYPE_LABEL_KEYS) as [ActionType, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{t(v)}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>

                    {/* Budget adjustment fields */}
                    {act.type === 'adjust_budget' && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="relative">
                          <select
                            value={act.adjustmentType}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateAction(idx, 'adjustmentType', e.target.value as AdjustMethod)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={t('autoRules.adjustMethod')}
                          >
                            <option value="percent">{t('autoRules.adjustPercent')}</option>
                            <option value="absolute">{t('autoRules.adjustAbsolute')}</option>
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <input
                          type="number"
                          value={act.value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAction(idx, 'value', e.target.value)}
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="20"
                          aria-label={t('autoRules.adjustValue')}
                        />
                        <div className="relative">
                          <select
                            value={act.direction}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateAction(idx, 'direction', e.target.value as AdjustDirection)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={t('autoRules.adjustDirection')}
                          >
                            <option value="increase">{t('autoRules.increase')}</option>
                            <option value="decrease">{t('autoRules.decrease')}</option>
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Bid adjustment fields */}
                    {act.type === 'adjust_bid' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={act.value}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAction(idx, 'value', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="10"
                            aria-label={t('autoRules.adjustRate')}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        <div className="relative">
                          <select
                            value={act.direction}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateAction(idx, 'direction', e.target.value as AdjustDirection)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={t('autoRules.adjustDirection')}
                          >
                            <option value="increase">{t('autoRules.bidIncrease')}</option>
                            <option value="decrease">{t('autoRules.bidDecrease')}</option>
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Notification fields */}
                    {act.type === 'send_notification' && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <span className="text-xs text-muted-foreground">{t('autoRules.channel')}</span>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {(['dashboard', 'slack', 'line', 'email'] as const).map((ch) => (
                              <button
                                key={ch}
                                type="button"
                                onClick={() => toggleChannel(idx, ch)}
                                className={cn(
                                  'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                                  act.channels.includes(ch)
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:border-primary/50',
                                )}
                              >
                                {ch === 'dashboard' ? t('autoRules.channelDashboard') : ch === 'slack' ? 'Slack' : ch === 'line' ? 'LINE' : t('autoRules.channelEmail')}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`notif-msg-${idx}`} className="text-xs text-muted-foreground">
                            {t('autoRules.messageTemplate')}
                          </label>
                          <textarea
                            id={`notif-msg-${idx}`}
                            value={act.message}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateAction(idx, 'message', e.target.value)}
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            rows={2}
                            placeholder={t('autoRules.messagePlaceholder')}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addAction}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                <Plus size={14} />
                {t('autoRules.addAction')}
              </button>

              {/* Preview */}
              <div className="rounded-md bg-primary/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('autoRules.preview')}</p>
                <p className="mt-1 text-xs text-foreground">
                  <ArrowRight size={12} className="mr-1 inline text-primary" />
                  {buildActionPreview() || t('autoRules.noAction')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-card px-6 py-4">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {t('common.back')}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t('common.cancel')}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                disabled={step === 1 && !name}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {t('common.next')}
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Check size={14} />
                {t('autoRules.submitRule')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Execution History --

function ExecutionStatusBadge({ status }: { status: ExecutionStatus }): React.ReactElement {
  const { t } = useI18n();
  const config = EXECUTION_STATUS_KEYS[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {t(config.labelKey)}
    </span>
  );
}

function ExecutionHistorySection({ executions }: { executions: RuleExecution[] }): React.ReactElement {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 5;
  const totalPages = Math.ceil(executions.length / pageSize);
  const paged = executions.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{t('autoRules.executionHistory')}</h3>
          <span className="text-xs text-muted-foreground">{t('autoRules.executionCount', { count: executions.length })}</span>
        </div>
        <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t border-border">
          {executions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Clock size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            </div>
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execDatetime')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execRuleName')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execCampaign')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execConditionValue')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execAction')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('autoRules.execStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((exec) => (
                  <tr key={exec.id} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{exec.datetime}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{exec.ruleName}</td>
                    <td className="px-4 py-3 text-foreground">{exec.campaignName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{exec.conditionValue}</td>
                    <td className="px-4 py-3 text-foreground">{exec.executedAction}</td>
                    <td className="px-4 py-3">
                      <ExecutionStatusBadge status={exec.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {t('autoRules.paginationOf', { from: String(page * pageSize + 1), to: String(Math.min((page + 1) * pageSize, executions.length)), total: String(executions.length) })}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {t('autoRules.paginationPrev')}
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {t('autoRules.paginationNext')}
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function AutoRulesPage(): React.ReactElement {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const rulesQuery = trpc.rules.list.useQuery(undefined, { retry: false });
  const executionsQuery = trpc.rules.executions.useQuery({}, { retry: false });

  useEffect(() => {
    const data = rulesQuery.data as AutoRule[] | undefined;
    if (data) setRules(data);
  }, [rulesQuery.data]);

  const executions: RuleExecution[] =
    (executionsQuery.data as RuleExecution[] | undefined) ?? [];

  const evaluateMutation = trpc.rules.evaluate.useMutation({
    onSettled: () => setEvaluating(false),
  });

  function handleToggle(id: string, enabled: boolean): void {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled } : r)),
    );
  }

  function handleEdit(id: string): void {
    setEditingRuleId(id);
    setModalOpen(true);
  }

  function handleDuplicate(id: string): void {
    const source = rules.find((r) => r.id === id);
    if (!source) return;
    const newRule: AutoRule = {
      ...source,
      id: `r${Date.now()}`,
      name: `${source.name} ${t('autoRules.copyLabel')}`,
      triggerCount: 0,
      lastTriggered: null,
    };
    setRules((prev) => [...prev, newRule]);
  }

  function handleDelete(id: string): void {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function handleEvaluateAll(): void {
    setEvaluating(true);
    evaluateMutation.mutate();
    // Fallback: reset loading after timeout if tRPC call fails
    setTimeout(() => setEvaluating(false), 3000);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Ops"
        title={t('autoRules.title')}
        description={t('autoRules.description')}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEvaluateAll}
              loading={evaluating}
              leadingIcon={!evaluating ? <RefreshCw size={14} /> : undefined}
            >
              {t('autoRules.evaluateAll')}
            </Button>
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={() => { setEditingRuleId(null); setModalOpen(true); }}
            >
              {t('autoRules.createRule')}
            </Button>
          </>
        }
      />

      {/* Rules list */}
      {rules.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Workflow size={18} />}
          title={t('autoRules.empty')}
          description={t('autoRules.emptyHint')}
          className="py-16"
        />
      )}

      {/* Execution history */}
      <ExecutionHistorySection executions={executions} />

      {/* Create rule modal */}
      <CreateRuleModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRuleId(null); }}
        editingRule={editingRuleId ? rules.find((r) => r.id === editingRuleId) ?? null : null}
      />
    </div>
  );
}
