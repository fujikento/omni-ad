'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Gauge,
  Loader2,
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
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

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

const METRIC_LABELS: Record<MetricName, string> = {
  cpa: 'CPA',
  roas: 'ROAS',
  ctr: 'CTR',
  spend: '費用',
  impressions: 'インプレッション',
  conversions: 'コンバージョン',
};

const OPERATOR_LABELS: Record<Operator, string> = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
};

const DURATION_LABELS: Record<Duration, string> = {
  hourly: '1時間',
  daily: '1日',
  '3days': '3日間',
  '7days': '7日間',
};

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  pause_campaign: 'キャンペーン停止',
  resume_campaign: 'キャンペーン再開',
  adjust_budget: '予算調整',
  rotate_creative: 'クリエイティブ変更',
  send_notification: '通知送信',
  adjust_bid: '入札調整',
};

const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  metric_threshold: '指標しきい値',
  budget_pacing: '予算ペーシング',
  creative_fatigue: 'クリエイティブ疲労',
  time_based: '時間帯',
};

const DAY_LABELS: Record<number, string> = {
  0: '日',
  1: '月',
  2: '火',
  3: '水',
  4: '木',
  5: '金',
  6: '土',
};

const EXECUTION_STATUS_CONFIG: Record<ExecutionStatus, { label: string; className: string }> = {
  success: { label: '成功', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  failed: { label: '失敗', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  skipped: { label: 'スキップ', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

const COOLDOWN_OPTIONS = [
  { value: 15, label: '15分' },
  { value: 30, label: '30分' },
  { value: 60, label: '1時間' },
  { value: 120, label: '2時間' },
  { value: 240, label: '4時間' },
  { value: 1440, label: '24時間' },
];

// ============================================================
// Mock Data
// ============================================================

const MOCK_RULES: AutoRule[] = [
  {
    id: 'r1',
    name: 'CPA上限で停止',
    enabled: true,
    conditions: [
      { type: 'metric_threshold', metric: 'cpa', operator: 'gt', value: 5000, duration: '3days' },
    ],
    actions: [
      { type: 'pause_campaign' },
    ],
    triggerCount: 8,
    lastTriggered: '3時間前',
    cooldownMinutes: 60,
  },
  {
    id: 'r2',
    name: 'ROAS目標維持',
    enabled: true,
    conditions: [
      { type: 'metric_threshold', metric: 'roas', operator: 'lt', value: 1.2, duration: 'daily' },
    ],
    actions: [
      { type: 'adjust_budget', adjustmentType: 'percent', value: 20, direction: 'decrease' },
      { type: 'send_notification', channels: ['slack'], message: 'ROASが目標値を下回りました。予算を20%削減しました。' },
    ],
    triggerCount: 15,
    lastTriggered: '1日前',
    cooldownMinutes: 240,
  },
  {
    id: 'r3',
    name: 'クリエイティブ自動ローテーション',
    enabled: true,
    conditions: [
      { type: 'creative_fatigue', ctrDeclinePercent: 15, days: 5 },
    ],
    actions: [
      { type: 'rotate_creative' },
    ],
    triggerCount: 6,
    lastTriggered: '2日前',
    cooldownMinutes: 1440,
  },
  {
    id: 'r4',
    name: '深夜配信停止',
    enabled: true,
    conditions: [
      { type: 'time_based', dayOfWeek: [1, 2, 3, 4, 5], hourRange: [0, 6] },
    ],
    actions: [
      { type: 'pause_campaign' },
    ],
    triggerCount: 42,
    lastTriggered: '6時間前',
    cooldownMinutes: 30,
  },
  {
    id: 'r5',
    name: '予算超過アラート',
    enabled: false,
    conditions: [
      { type: 'budget_pacing', pace: 'over', threshold: 20 },
    ],
    actions: [
      { type: 'send_notification', channels: ['dashboard', 'slack'], message: '予算ペーシングが超過しています。' },
    ],
    triggerCount: 0,
    lastTriggered: null,
    cooldownMinutes: 120,
  },
];

const MOCK_EXECUTIONS: RuleExecution[] = [
  { id: 'e1', datetime: '2026-04-02 09:15', ruleName: 'CPA上限で停止', campaignName: 'TikTok新規獲得', conditionValue: 'CPA: ¥5,420', executedAction: 'キャンペーン停止', status: 'success' },
  { id: 'e2', datetime: '2026-04-02 06:00', ruleName: '深夜配信停止', campaignName: '春のプロモーション2026', conditionValue: '時間帯: 0:00-6:00', executedAction: 'キャンペーン停止', status: 'success' },
  { id: 'e3', datetime: '2026-04-01 18:30', ruleName: 'ROAS目標維持', campaignName: 'LINE公式キャンペーン', conditionValue: 'ROAS: 0.95', executedAction: '予算20%削減 + Slack通知', status: 'success' },
  { id: 'e4', datetime: '2026-04-01 14:00', ruleName: 'クリエイティブ自動ローテーション', campaignName: 'ブランド認知拡大', conditionValue: 'CTR低下: 18%', executedAction: 'クリエイティブ変更', status: 'failed' },
  { id: 'e5', datetime: '2026-04-01 10:00', ruleName: 'CPA上限で停止', campaignName: 'GW特別セール', conditionValue: 'CPA: ¥4,800', executedAction: 'キャンペーン停止', status: 'skipped' },
  { id: 'e6', datetime: '2026-03-31 22:00', ruleName: 'ROAS目標維持', campaignName: 'TikTok新規獲得', conditionValue: 'ROAS: 1.1', executedAction: '予算20%削減 + Slack通知', status: 'success' },
  { id: 'e7', datetime: '2026-03-31 15:30', ruleName: '深夜配信停止', campaignName: 'LINE公式キャンペーン', conditionValue: '時間帯: 0:00-6:00', executedAction: 'キャンペーン停止', status: 'success' },
  { id: 'e8', datetime: '2026-03-31 09:00', ruleName: 'CPA上限で停止', campaignName: '春のプロモーション2026', conditionValue: 'CPA: ¥5,100', executedAction: 'キャンペーン停止', status: 'success' },
];

// ============================================================
// Helper Functions
// ============================================================

function describeCondition(condition: RuleCondition): string {
  switch (condition.type) {
    case 'metric_threshold':
      return `${METRIC_LABELS[condition.metric]} ${OPERATOR_LABELS[condition.operator]} ${formatConditionValue(condition.metric, condition.value)} が ${DURATION_LABELS[condition.duration]}`;
    case 'budget_pacing':
      return `予算ペーシング${condition.pace === 'over' ? '超過' : '不足'} ${condition.threshold}%`;
    case 'creative_fatigue':
      return `CTR ${condition.ctrDeclinePercent}%低下が ${condition.days}日間`;
    case 'time_based': {
      const days = condition.dayOfWeek.map((d) => DAY_LABELS[d] ?? String(d)).join('');
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

function describeAction(action: RuleAction): string {
  switch (action.type) {
    case 'pause_campaign':
      return 'キャンペーン停止';
    case 'resume_campaign':
      return 'キャンペーン再開';
    case 'adjust_budget':
      return `予算${action.value}${action.adjustmentType === 'percent' ? '%' : '円'}${action.direction === 'increase' ? '増額' : '減額'}`;
    case 'rotate_creative':
      return 'クリエイティブ変更';
    case 'send_notification':
      return `${action.channels.join('/')}に通知`;
    case 'adjust_bid':
      return `入札${action.value}%${action.direction === 'increase' ? '引き上げ' : '引き下げ'}`;
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
              クールダウン: {COOLDOWN_OPTIONS.find((o) => o.value === rule.cooldownMinutes)?.label ?? `${rule.cooldownMinutes}分`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(rule.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="編集"
            aria-label={`${rule.name}を編集`}
          >
            <Zap size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(rule.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="複製"
            aria-label={`${rule.name}を複製`}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(rule.id)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            title="削除"
            aria-label={`${rule.name}を削除`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Conditions */}
      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">条件 (IF)</p>
        {rule.conditions.map((condition, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5">
            <span className="flex-shrink-0 text-muted-foreground">{getConditionIcon(condition.type)}</span>
            <span className="text-xs text-foreground">{describeCondition(condition)}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">アクション (THEN)</p>
        {rule.actions.map((action, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-1.5">
            <ArrowRight size={12} className="flex-shrink-0 text-primary" />
            <span className="flex-shrink-0 text-primary">{getActionIcon(action.type)}</span>
            <span className="text-xs font-medium text-primary">{describeAction(action)}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>発動 <span className="font-semibold text-foreground">{rule.triggerCount}回</span></span>
        {rule.lastTriggered && (
          <span>最終発動: <span className="font-medium text-foreground">{rule.lastTriggered}</span></span>
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
        case 'metric_threshold':
          return `${METRIC_LABELS[c.metric]} が ${c.value || '?'} を${c.operator === 'gt' || c.operator === 'gte' ? '超えた' : '下回った'}状態が ${DURATION_LABELS[c.duration]} 続いた場合`;
        case 'budget_pacing':
          return `予算ペーシングが ${c.threshold || '?'}% ${c.pace === 'over' ? '超過' : '不足'}の場合`;
        case 'creative_fatigue':
          return `CTRが ${c.ctrDeclinePercent || '?'}% 低下した状態が ${c.days || '?'}日間 続いた場合`;
        case 'time_based': {
          const days = c.dayOfWeek.map((d) => DAY_LABELS[d] ?? '').join('');
          return `${days} ${c.hourStart}:00-${c.hourEnd}:00 の場合`;
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
          return 'キャンペーンを停止';
        case 'resume_campaign':
          return 'キャンペーンを再開';
        case 'adjust_budget':
          return `予算を${a.value || '?'}${a.adjustmentType === 'percent' ? '%' : '円'}${a.direction === 'increase' ? '増額' : '減額'}`;
        case 'rotate_creative':
          return 'クリエイティブをローテーション';
        case 'send_notification':
          return `${a.channels.join('/')}に通知を送信`;
        case 'adjust_bid':
          return `入札を${a.value || '?'}%${a.direction === 'increase' ? '引き上げ' : '引き下げ'}`;
        default:
          return '';
      }
    }).join('し、');
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
            <h2 className="text-lg font-semibold text-foreground">新規ルール作成</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn('rounded-full px-2 py-0.5 font-medium', step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                1. 基本情報
              </span>
              <ChevronRight size={12} />
              <span className={cn('rounded-full px-2 py-0.5 font-medium', step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                2. 条件設定
              </span>
              <ChevronRight size={12} />
              <span className={cn('rounded-full px-2 py-0.5 font-medium', step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                3. アクション
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Basic info */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="rule-name" className="mb-1 block text-sm font-medium text-foreground">
                  ルール名
                </label>
                <input
                  id="rule-name"
                  type="text"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="CPA上限で停止"
                  required
                />
              </div>
              <div>
                <label htmlFor="rule-cooldown" className="mb-1 block text-sm font-medium text-foreground">
                  クールダウン
                </label>
                <div className="relative">
                  <select
                    id="rule-cooldown"
                    value={cooldown}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCooldown(Number(e.target.value))}
                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {COOLDOWN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
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
              <p className="text-sm font-medium text-foreground">条件設定 (IF)</p>
              <div className="space-y-4">
                {conditions.map((cond, idx) => (
                  <div key={idx} className="rounded-md border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">条件 {idx + 1}</span>
                      {conditions.length > 1 && (
                        <button type="button" onClick={() => removeCondition(idx)} className="rounded p-0.5 text-muted-foreground hover:text-red-600" aria-label="条件を削除">
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
                        aria-label="条件タイプ"
                      >
                        {(Object.entries(CONDITION_TYPE_LABELS) as [ConditionType, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
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
                            aria-label="指標"
                          >
                            {(Object.entries(METRIC_LABELS) as [MetricName, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <div className="relative">
                          <select
                            value={cond.operator}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(idx, 'operator', e.target.value as Operator)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label="演算子"
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
                          placeholder="値"
                          aria-label="しきい値"
                        />
                        <div className="relative">
                          <select
                            value={cond.duration}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(idx, 'duration', e.target.value as Duration)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label="期間"
                          >
                            {(Object.entries(DURATION_LABELS) as [Duration, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
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
                            aria-label="ペース"
                          >
                            <option value="over">超過</option>
                            <option value="under">不足</option>
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
                            aria-label="しきい値パーセント"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}

                    {/* Creative fatigue fields */}
                    {cond.type === 'creative_fatigue' && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">CTR低下率</span>
                          <input
                            type="number"
                            value={cond.ctrDeclinePercent}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'ctrDeclinePercent', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="15"
                            aria-label="CTR低下率"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">期間</span>
                          <input
                            type="number"
                            value={cond.days}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'days', e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="5"
                            aria-label="日数"
                          />
                          <span className="text-xs text-muted-foreground">日</span>
                        </div>
                      </div>
                    )}

                    {/* Time-based fields */}
                    {cond.type === 'time_based' && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <span className="text-xs text-muted-foreground">曜日</span>
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
                                {DAY_LABELS[day]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">時間帯</span>
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={cond.hourStart}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'hourStart', Number(e.target.value))}
                            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label="開始時間"
                          />
                          <span className="text-xs text-muted-foreground">:00 -</span>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={cond.hourEnd}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCondition(idx, 'hourEnd', Number(e.target.value))}
                            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label="終了時間"
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
                条件を追加
              </button>

              {/* Preview */}
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">プレビュー</p>
                <p className="mt-1 text-xs text-foreground">{buildConditionPreview() || '条件を設定してください'}</p>
              </div>
            </div>
          )}

          {/* Step 3: Actions */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm font-medium text-foreground">アクション設定 (THEN)</p>
              <div className="space-y-4">
                {actions.map((act, idx) => (
                  <div key={idx} className="rounded-md border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">アクション {idx + 1}</span>
                      {actions.length > 1 && (
                        <button type="button" onClick={() => removeAction(idx)} className="rounded p-0.5 text-muted-foreground hover:text-red-600" aria-label="アクションを削除">
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
                        aria-label="アクションタイプ"
                      >
                        {(Object.entries(ACTION_TYPE_LABELS) as [ActionType, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
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
                            aria-label="調整方法"
                          >
                            <option value="percent">パーセント</option>
                            <option value="absolute">固定金額</option>
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <input
                          type="number"
                          value={act.value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAction(idx, 'value', e.target.value)}
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="20"
                          aria-label="調整値"
                        />
                        <div className="relative">
                          <select
                            value={act.direction}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateAction(idx, 'direction', e.target.value as AdjustDirection)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label="方向"
                          >
                            <option value="increase">増額</option>
                            <option value="decrease">減額</option>
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
                            aria-label="調整率"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        <div className="relative">
                          <select
                            value={act.direction}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateAction(idx, 'direction', e.target.value as AdjustDirection)}
                            className="w-full appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-6 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label="方向"
                          >
                            <option value="increase">引き上げ</option>
                            <option value="decrease">引き下げ</option>
                          </select>
                          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Notification fields */}
                    {act.type === 'send_notification' && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <span className="text-xs text-muted-foreground">チャネル</span>
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
                                {ch === 'dashboard' ? 'ダッシュボード' : ch === 'slack' ? 'Slack' : ch === 'line' ? 'LINE' : 'メール'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`notif-msg-${idx}`} className="text-xs text-muted-foreground">
                            メッセージテンプレート
                          </label>
                          <textarea
                            id={`notif-msg-${idx}`}
                            value={act.message}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateAction(idx, 'message', e.target.value)}
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            rows={2}
                            placeholder="ルールが発動しました: {{rule_name}}"
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
                アクションを追加
              </button>

              {/* Preview */}
              <div className="rounded-md bg-primary/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">プレビュー</p>
                <p className="mt-1 text-xs text-foreground">
                  <ArrowRight size={12} className="mr-1 inline text-primary" />
                  {buildActionPreview() || 'アクションを設定してください'}
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
                戻る
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              キャンセル
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                disabled={step === 1 && !name}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                次へ
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Check size={14} />
                ルールを作成
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
  const config = EXECUTION_STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

function ExecutionHistorySection({ executions }: { executions: RuleExecution[] }): React.ReactElement {
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
          <h3 className="text-sm font-semibold text-foreground">実行履歴</h3>
          <span className="text-xs text-muted-foreground">({executions.length}件)</span>
        </div>
        <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">日時</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">ルール名</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">キャンペーン</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">条件値</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">実行アクション</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">ステータス</th>
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
                {page * pageSize + 1}-{Math.min((page + 1) * pageSize, executions.length)} / {executions.length}件
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  前へ
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  次へ
                </button>
              </div>
            </div>
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [rules, setRules] = useState<AutoRule[]>(MOCK_RULES);
  const [evaluating, setEvaluating] = useState(false);

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
      name: `${source.name} (コピー)`,
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
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            自動ルール管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            条件ベースの自動化ルールでキャンペーン運用を自動最適化します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleEvaluateAll}
            disabled={evaluating}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {evaluating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            全ルール評価
          </button>
          <button
            type="button"
            onClick={() => { setEditingRuleId(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Plus size={16} />
            新規ルール作成
          </button>
        </div>
      </div>

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
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-16">
          <Workflow size={48} className="text-muted-foreground/30" />
          <p className="text-muted-foreground">自動ルールがまだありません</p>
          <p className="text-sm text-muted-foreground/70">
            「新規ルール作成」ボタンから最初のルールを作成しましょう
          </p>
        </div>
      )}

      {/* Execution history */}
      <ExecutionHistorySection executions={MOCK_EXECUTIONS} />

      {/* Create rule modal */}
      <CreateRuleModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRuleId(null); }}
        editingRule={editingRuleId ? rules.find((r) => r.id === editingRuleId) ?? null : null}
      />
    </div>
  );
}
