'use client';

import { useState } from 'react';
import {
  ArrowRight,
  BadgeJapaneseYen,
  Check,
  Clock,
  Filter,
  Lightbulb,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, Button, EmptyState, PageHeader } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type DecisionType =
  | 'budget_adjustment'
  | 'campaign_pause'
  | 'campaign_resume'
  | 'creative_rotation'
  | 'campaign_creation'
  | 'strategy_insight';

type DecisionStatus = 'executed' | 'pending_approval' | 'rejected' | 'skipped';

type StatusFilter = 'all' | DecisionStatus;
type TypeFilter = 'all' | DecisionType;

interface AiDecision {
  id: string;
  type: DecisionType;
  status: DecisionStatus;
  campaignName: string | null;
  reasoning: string;
  confidence: number;
  actionSummary: string;
  result: string | null;
  timestamp: string;
  timeAgo: string;
}

interface StatusCardData {
  label: string;
  value: string;
  subLabel?: string;
}

interface PerformanceMetric {
  label: string;
  before: number;
  after: number;
  format: 'roas' | 'currency' | 'percent';
}

interface BeforeAfterChartData {
  metric: string;
  before: number;
  after: number;
}

// ============================================================
// Constants
// ============================================================

const DECISION_TYPE_CONFIG: Record<
  DecisionType,
  { icon: React.ReactNode; labelKey: string; badgeClass: string }
> = {
  budget_adjustment: {
    icon: <BadgeJapaneseYen size={16} />,
    labelKey: 'aiPilot.budgetAdjustment',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  campaign_pause: {
    icon: <Pause size={16} />,
    labelKey: 'aiPilot.campaignPause',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  campaign_resume: {
    icon: <Play size={16} />,
    labelKey: 'aiPilot.campaignResume',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  creative_rotation: {
    icon: <RefreshCw size={16} />,
    labelKey: 'aiPilot.creativeRotation',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  campaign_creation: {
    icon: <Plus size={16} />,
    labelKey: 'aiPilot.campaignCreation',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  strategy_insight: {
    icon: <Lightbulb size={16} />,
    labelKey: 'aiPilot.strategyInsight',
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
};

const STATUS_CONFIG: Record<
  DecisionStatus,
  { labelKey: string; badgeClass: string }
> = {
  executed: {
    labelKey: 'aiPilot.executed',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  pending_approval: {
    labelKey: 'aiPilot.pendingApproval',
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  rejected: {
    labelKey: 'aiPilot.rejected',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  skipped: {
    labelKey: 'aiPilot.skipped',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
};

// ============================================================
// Mock Data
// ============================================================

function getMockStrategySummary(t: (key: string, params?: Record<string, string | number>) => string): string {
  return t('aipilot.hac9d00');
}

interface MockStatusCardDef {
  labelKey: string;
  value: string;
  subLabelKey?: string;
  subLabelLiteral?: string;
}

function getMockStatusCardDefs(t: (key: string, params?: Record<string, string | number>) => string): MockStatusCardDef[] {
  return [
  { labelKey: 'aiPilot.status', value: 'ON', subLabelKey: 'aiPilot.approvalMode' },
  { labelKey: 'aiPilot.lastRun', value: t('aipilot.h2012e9'), subLabelLiteral: '2026-04-02 12:00 JST' },
  { labelKey: 'aiPilot.nextRun', value: t('aipilot.he5a0b1'), subLabelLiteral: '14:00 JST' },
  { labelKey: 'aiPilot.todayDecisions', value: t('aipilot.hcc1d8b'), subLabelLiteral: t('aipilot.hc39f70') },
];
}

function getMockDecisions(t: (key: string, params?: Record<string, string | number>) => string): AiDecision[] {
  return [
  {
    id: 'd1',
    type: 'budget_adjustment',
    status: 'executed',
    campaignName: t('aipilot.hb2cb88'),
    reasoning:
      t('aipilot.h45b75a'),
    confidence: 92,
    actionSummary: t('aipilot.h2f14dd'),
    result: 'ROAS: 2.8 → 3.5 (+25%)',
    timestamp: '2026-04-02T12:00:00Z',
    timeAgo: t('aipilot.h2012e9'),
  },
  {
    id: 'd2',
    type: 'budget_adjustment',
    status: 'executed',
    campaignName: t('aipilot.h3f3a1a'),
    reasoning:
      t('aipilot.hc62dbe'),
    confidence: 87,
    actionSummary: t('aipilot.h492de4'),
    result: 'CPC: ¥320 → ¥285 (-11%)',
    timestamp: '2026-04-02T10:00:00Z',
    timeAgo: t('aipilot.hcf7356'),
  },
  {
    id: 'd3',
    type: 'budget_adjustment',
    status: 'pending_approval',
    campaignName: t('aipilot.haaff51'),
    reasoning:
      t('aipilot.h8bc06b'),
    confidence: 78,
    actionSummary: t('aipilot.he2b3a3'),
    result: null,
    timestamp: '2026-04-02T13:00:00Z',
    timeAgo: t('aipilot.h6ff847'),
  },
  {
    id: 'd4',
    type: 'campaign_pause',
    status: 'executed',
    campaignName: t('aipilot.h645cb3'),
    reasoning:
      t('aipilot.h0a5d03'),
    confidence: 95,
    actionSummary: t('aipilot.he0df9c'),
    result: t('aipilot.h9a12bf'),
    timestamp: '2026-04-02T09:00:00Z',
    timeAgo: t('aipilot.h00bb20'),
  },
  {
    id: 'd5',
    type: 'campaign_pause',
    status: 'executed',
    campaignName: t('aipilot.h2c49b9'),
    reasoning:
      t('aipilot.h2d5da4'),
    confidence: 99,
    actionSummary: t('aipilot.heb52db'),
    result: t('aipilot.h6aefeb'),
    timestamp: '2026-04-02T08:00:00Z',
    timeAgo: t('aipilot.ha45695'),
  },
  {
    id: 'd6',
    type: 'campaign_resume',
    status: 'executed',
    campaignName: t('aipilot.h890fdc'),
    reasoning:
      t('aipilot.h051bda'),
    confidence: 85,
    actionSummary: t('aipilot.h3dea2b'),
    result: 'CTR: 2.1% → 3.4% (+62%)',
    timestamp: '2026-04-02T07:00:00Z',
    timeAgo: t('aipilot.hc00d00'),
  },
  {
    id: 'd7',
    type: 'creative_rotation',
    status: 'executed',
    campaignName: t('aipilot.hbf5fb2'),
    reasoning:
      t('aipilot.hf445f3'),
    confidence: 91,
    actionSummary: t('aipilot.h3a55ac'),
    result: 'CTR: 1.8% → 2.5% (+39%)',
    timestamp: '2026-04-02T11:00:00Z',
    timeAgo: t('aipilot.h5bf96a'),
  },
  {
    id: 'd8',
    type: 'creative_rotation',
    status: 'pending_approval',
    campaignName: t('aipilot.h3f3a1a'),
    reasoning:
      t('aipilot.hbdfe36'),
    confidence: 73,
    actionSummary: t('aipilot.h9cd77a'),
    result: null,
    timestamp: '2026-04-02T13:30:00Z',
    timeAgo: t('aipilot.h98a92c'),
  },
  {
    id: 'd9',
    type: 'campaign_creation',
    status: 'pending_approval',
    campaignName: null,
    reasoning:
      t('aipilot.h8d3201'),
    confidence: 81,
    actionSummary:
      t('aipilot.h0041c3'),
    result: null,
    timestamp: '2026-04-02T12:30:00Z',
    timeAgo: t('aipilot.h3a2bc0'),
  },
  {
    id: 'd10',
    type: 'strategy_insight',
    status: 'executed',
    campaignName: null,
    reasoning:
      t('aipilot.h2fecae'),
    confidence: 88,
    actionSummary: t('aipilot.h5d6a00'),
    result: t('aipilot.hbd6191'),
    timestamp: '2026-04-02T06:00:00Z',
    timeAgo: t('aipilot.hc8d38c'),
  },
  {
    id: 'd11',
    type: 'strategy_insight',
    status: 'executed',
    campaignName: null,
    reasoning:
      t('aipilot.h0a65a9'),
    confidence: 84,
    actionSummary: t('aipilot.hace6d1'),
    result: 'CVR: 2.4% → 2.8% (+17%)',
    timestamp: '2026-04-01T18:00:00Z',
    timeAgo: t('aipilot.h930405'),
  },
  {
    id: 'd12',
    type: 'strategy_insight',
    status: 'executed',
    campaignName: null,
    reasoning:
      t('aipilot.h18fbd8'),
    confidence: 76,
    actionSummary: t('aipilot.h143936'),
    result: t('aipilot.h71cf6d'),
    timestamp: '2026-04-01T14:00:00Z',
    timeAgo: t('aipilot.h23c9bc'),
  },
];
}

const MOCK_PERFORMANCE_METRICS: PerformanceMetric[] = [
  { label: 'ROAS', before: 2.3, after: 3.24, format: 'roas' },
  { label: 'CPA', before: 4200, after: 2850, format: 'currency' },
  { label: 'CTR', before: 1.8, after: 2.6, format: 'percent' },
  { label: 'CVR', before: 2.1, after: 2.8, format: 'percent' },
];

const BEFORE_AFTER_CHART_DATA: BeforeAfterChartData[] = [
  { metric: 'ROAS', before: 2.3, after: 3.24 },
  { metric: 'CTR(%)', before: 1.8, after: 2.6 },
  { metric: 'CVR(%)', before: 2.1, after: 2.8 },
];

const CHART_COLORS = {
  before: 'hsl(220, 14%, 70%)',
  after: 'hsl(217, 91%, 60%)',
};

// ============================================================
// Subcomponents
// ============================================================

function StatusPanel({
  cards,
  isActive,
}: {
  cards: StatusCardData[];
  isActive: boolean;
  statusLabel?: string;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card, idx) => (
        <div key={card.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {idx === 0 ? (
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-block h-3 w-3 rounded-full',
                    isActive ? 'bg-green-500' : 'bg-red-500',
                  )}
                />
                {card.value}
              </span>
            ) : (
              card.value
            )}
          </p>
          {card.subLabel && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{card.subLabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function StrategySummaryCard({
  summary,
  updatedAt,
}: {
  summary: string;
  updatedAt: string;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{t('aiPilot.aiPolicy')}</h3>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{summary}</p>
      <p className="mt-3 text-xs text-muted-foreground">{t('aiPilot.lastUpdated')}: {updatedAt}</p>
    </div>
  );
}

function DecisionCard({
  decision,
  onApprove,
  onReject,
}: {
  decision: AiDecision;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const typeConfig = DECISION_TYPE_CONFIG[decision.type];
  const statusConfig = STATUS_CONFIG[decision.status];
  const isPending = decision.status === 'pending_approval';

  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-border/80">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label={t(typeConfig.labelKey)}>
            {typeConfig.icon}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
              typeConfig.badgeClass,
            )}
          >
            {t(typeConfig.labelKey)}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
              statusConfig.badgeClass,
            )}
          >
            {t(statusConfig.labelKey)}
          </span>
        </div>
        <span className="flex-shrink-0 text-xs text-muted-foreground">
          {decision.timeAgo}
        </span>
      </div>

      {/* Campaign name */}
      {decision.campaignName && (
        <p className="mt-2 text-sm font-semibold text-foreground">
          {decision.campaignName}
        </p>
      )}

      {/* Reasoning */}
      <div className="mt-3 rounded-md border-l-4 border-primary/30 bg-muted/50 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">{t('aiPilot.aiReasoning')}</p>
        <p className="text-sm leading-relaxed text-foreground">{decision.reasoning}</p>
      </div>

      {/* Confidence */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{t('aiPilot.confidence')}</span>
        <div className="flex-1 h-2 rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              decision.confidence >= 90
                ? 'bg-green-500'
                : decision.confidence >= 70
                  ? 'bg-blue-500'
                  : 'bg-yellow-500',
            )}
            style={{ width: `${decision.confidence}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-foreground">{decision.confidence}%</span>
      </div>

      {/* Action summary */}
      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">{t('aiPilot.actionLabel')}</p>
        <p className="text-sm text-foreground whitespace-pre-line">{decision.actionSummary}</p>
      </div>

      {/* Result */}
      {decision.result && (
        <div className="mt-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            {decision.result}
          </span>
        </div>
      )}

      {/* Action buttons for pending */}
      {isPending && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => onApprove(decision.id)}
            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Check size={14} />
            {t('aiPilot.approve')}
          </button>
          <button
            type="button"
            onClick={() => onReject(decision.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <X size={14} />
            {t('aiPilot.reject')}
          </button>
        </div>
      )}
    </div>
  );
}

function FilterBar({
  statusFilter,
  typeFilter,
  onStatusFilterChange,
  onTypeFilterChange,
}: {
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onTypeFilterChange: (filter: TypeFilter) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const statusOptions: { value: StatusFilter; labelKey: string }[] = [
    { value: 'all', labelKey: 'aiPilot.all' },
    { value: 'executed', labelKey: 'aiPilot.executed' },
    { value: 'pending_approval', labelKey: 'aiPilot.pendingApproval' },
    { value: 'rejected', labelKey: 'aiPilot.rejected' },
  ];

  const typeOptions: { value: TypeFilter; labelKey: string }[] = [
    { value: 'all', labelKey: 'aiPilot.all' },
    { value: 'budget_adjustment', labelKey: 'aiPilot.budgetAdjustment' },
    { value: 'campaign_pause', labelKey: 'aiPilot.filterPause' },
    { value: 'campaign_resume', labelKey: 'aiPilot.filterResume' },
    { value: 'creative_rotation', labelKey: 'aiPilot.filterCreative' },
    { value: 'campaign_creation', labelKey: 'aiPilot.filterCreation' },
    { value: 'strategy_insight', labelKey: 'aiPilot.filterInsight' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Filter size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{t('aiPilot.filterStatus')}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onStatusFilterChange(opt.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t('aiPilot.filterType')}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onTypeFilterChange(opt.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              typeFilter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

function PerformanceImpactSection({
  metrics,
  chartData,
}: {
  metrics: PerformanceMetric[];
  chartData: BeforeAfterChartData[];
}): React.ReactElement {
  const { t } = useI18n();
  function formatValue(value: number, format: PerformanceMetric['format']): string {
    switch (format) {
      case 'roas':
        return `${value.toFixed(2)}x`;
      case 'currency':
        return new Intl.NumberFormat('ja-JP', {
          style: 'currency',
          currency: 'JPY',
        }).format(value);
      case 'percent':
        return `${value.toFixed(1)}%`;
    }
  }

  function calculateDelta(before: number, after: number): {
    text: string;
    isPositive: boolean;
  } {
    const pctChange = ((after - before) / before) * 100;
    const isPositive = pctChange > 0;
    return {
      text: `${isPositive ? '+' : ''}${pctChange.toFixed(0)}%`,
      isPositive,
    };
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{t('aiPilot.performanceImpactTitle')}</h3>
      </div>

      {/* Metric comparison cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((metric) => {
          const delta = calculateDelta(metric.before, metric.after);
          return (
            <div key={metric.label} className="rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold text-foreground">
                  {formatValue(metric.after, metric.format)}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    delta.isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {delta.text}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>{t('aiPilot.beforeLabel')}: {formatValue(metric.before, metric.format)}</span>
                <ArrowRight size={8} />
                <span>{t('aiPilot.afterLabel')}: {formatValue(metric.after, metric.format)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bar chart */}
      <div className="mt-4">
        <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-gray-400" />
            {t('aiPilot.beforeAi7days')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-blue-500" />
            {t('aiPilot.afterAi7days')}
          </span>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="metric"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="before" name={t('aiPilot.before')} fill={CHART_COLORS.before} radius={[4, 4, 0, 0]} />
              <Bar dataKey="after" name={t('aiPilot.after')} fill={CHART_COLORS.after} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function AiPilotPage(): React.ReactElement {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [localDecisionOverrides, setLocalDecisionOverrides] = useState<
    Record<string, DecisionStatus>
  >({});

  // tRPC queries with fallback to mock
  const decisionsQuery = trpc.aiAutopilot.decisions.list.useQuery({}, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const settingsQuery = trpc.aiAutopilot.settings.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const triggerMutation = trpc.aiAutopilot.trigger.useMutation();
  const approveMutation = trpc.aiAutopilot.decisions.approve.useMutation();
  const rejectMutation = trpc.aiAutopilot.decisions.reject.useMutation();

  // Resolve data with fallback
  const rawDecisions: AiDecision[] = decisionsQuery.error
    ? getMockDecisions(t)
    : (decisionsQuery.data as unknown as AiDecision[] | undefined) ?? getMockDecisions(t);

  // Apply local optimistic overrides
  const decisions = rawDecisions.map((d) => {
    const override = localDecisionOverrides[d.id];
    return override ? { ...d, status: override } : d;
  });

  const isActive = settingsQuery.error
    ? true
    : (settingsQuery.data as { isActive?: boolean } | undefined)?.isActive ?? true;

  const triggering = triggerMutation.isPending;

  const filteredDecisions = decisions.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    return true;
  });

  function handleApprove(id: string): void {
    // Optimistic update
    setLocalDecisionOverrides((prev) => ({ ...prev, [id]: 'executed' as DecisionStatus }));
    approveMutation.mutate(
      { decisionId: id },
      {
        onSuccess: () => {
          decisionsQuery.refetch().catch(() => { /* fallback */ });
        },
        onError: () => {
          // Revert optimistic update on error
          setLocalDecisionOverrides((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        },
      },
    );
  }

  function handleReject(id: string): void {
    setLocalDecisionOverrides((prev) => ({ ...prev, [id]: 'rejected' as DecisionStatus }));
    rejectMutation.mutate(
      { decisionId: id },
      {
        onSuccess: () => {
          decisionsQuery.refetch().catch(() => { /* fallback */ });
        },
        onError: () => {
          setLocalDecisionOverrides((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        },
      },
    );
  }

  function handleManualTrigger(): void {
    triggerMutation.mutate(undefined, {
      onSuccess: () => {
        decisionsQuery.refetch().catch(() => { /* fallback */ });
      },
    });
  }

  const pendingCount = decisions.filter(
    (d) => d.status === 'pending_approval',
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={12} className="text-primary" />
            AI Autopilot
          </span>
        }
        title={
          <span className="inline-flex items-center gap-3">
            {t('aiPilot.title')}
            <Badge
              variant={isActive ? 'success' : 'destructive'}
              dot
              dotClassName={cn(isActive && 'animate-pulse')}
            >
              {isActive ? t('aiPilot.running') : t('aiPilot.stopped')}
            </Badge>
          </span>
        }
        description="Claude がキャンペーンを監視し、予算・一時停止・最適化判断を自律実行します。"
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleManualTrigger}
              disabled={triggering}
              loading={triggering}
              leadingIcon={!triggering ? <Zap size={14} /> : undefined}
            >
              {t('aiPilot.manualRun')}
            </Button>
            <a
              href="/settings/ai"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
            >
              <Settings size={14} />
              {t('aiPilot.settings')}
            </a>
          </>
        }
      />

      {/* Pending approval banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning/20 text-warning">
            <Clock size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {t('aiPilot.pendingApprovalBanner', { count: pendingCount })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatusFilter('pending_approval')}
            trailingIcon={<ArrowRight size={12} />}
            className="text-warning hover:bg-warning/10 hover:text-warning"
          >
            {t('aiPilot.reviewPending')}
          </Button>
        </div>
      )}

      {/* Status panel */}
      <StatusPanel
        cards={getMockStatusCardDefs(t).map((def) => ({
          label: t(def.labelKey),
          value: def.value,
          subLabel: def.subLabelKey ? t(def.subLabelKey) : def.subLabelLiteral,
        }))}
        isActive={isActive}
        statusLabel={t('aiPilot.status')}
      />

      {/* Strategy summary */}
      <StrategySummaryCard summary={getMockStrategySummary(t)} updatedAt={t('aipilot.h2012e9')} />

      {/* Filter bar */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">{t('aiPilot.decisionTimeline')}</h2>
        <FilterBar
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStatusFilterChange={setStatusFilter}
          onTypeFilterChange={setTypeFilter}
        />
      </div>

      {/* Decision timeline */}
      <div className="space-y-3">
        {filteredDecisions.length === 0 ? (
          <EmptyState
            icon={<Lightbulb size={18} />}
            title={t('aiPilot.noDecisions')}
            description="条件にマッチする AI 判断はありません。フィルタを変更するか Autopilot を手動実行してください。"
          />
        ) : (
          filteredDecisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))
        )}
      </div>

      {/* Performance impact */}
      <PerformanceImpactSection
        metrics={MOCK_PERFORMANCE_METRICS}
        chartData={BEFORE_AFTER_CHART_DATA}
      />
    </div>
  );
}
