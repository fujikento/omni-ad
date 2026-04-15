'use client';

import { useState } from 'react';
import {
  ArrowRight,
  BadgeJapaneseYen,
  Check,
  Clock,
  Filter,
  Inbox,
  Lightbulb,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
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
import {
  Badge,
  Button,
  EmptyState,
  KbdHint,
  NavyHero,
  PageHeader,
} from '@omni-ad/ui';
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
// Static UI enumerations
// ============================================================

const GUARDRAIL_RULES = ['Min ROAS > 3.0', 'Daily Cap: ¥50,000', 'No PMax Mod'] as const;

const CHART_COLORS = {
  before: 'hsl(220, 14%, 70%)',
  after: 'hsl(217, 91%, 60%)',
};

// ============================================================
// Subcomponents
// ============================================================

const CONFIDENCE_TOKEN_COUNT = 10;

type ConfidenceTone = 'primary' | 'success' | 'warning' | 'destructive';

function getConfidenceTone(confidence: number, status: DecisionStatus): ConfidenceTone {
  if (status === 'rejected') return 'destructive';
  if (confidence >= 95) return 'primary';
  if (confidence >= 80) return 'success';
  if (confidence >= 60) return 'warning';
  return 'destructive';
}

function SegmentedConfidence({
  value,
  tone,
}: {
  value: number;
  tone: ConfidenceTone;
}): React.ReactElement {
  const filled = Math.round((value / 100) * CONFIDENCE_TOKEN_COUNT);
  const toneBg =
    tone === 'primary'
      ? 'bg-primary'
      : tone === 'success'
        ? 'bg-success'
        : tone === 'warning'
          ? 'bg-warning'
          : 'bg-destructive';
  return (
    <div
      className="flex gap-[2px]"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: CONFIDENCE_TOKEN_COUNT }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-3 w-1 rounded-sm',
            i < filled ? toneBg : 'bg-muted',
          )}
          aria-hidden="true"
        />
      ))}
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
  const tone = getConfidenceTone(decision.confidence, decision.status);
  const accentClass =
    tone === 'primary'
      ? 'bg-primary'
      : tone === 'success'
        ? 'bg-success'
        : tone === 'warning'
          ? 'bg-warning'
          : 'bg-destructive';

  return (
    <article className="relative overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors hover:border-border/60">
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', accentClass)} />
      <div className="p-5 pl-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-md border',
                typeConfig.badgeClass,
              )}
            >
              {typeConfig.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(typeConfig.labelKey)}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {decision.campaignName ?? '—'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('aiPilot.confidence')}
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {decision.confidence}%
              </span>
            </div>
            <SegmentedConfidence value={decision.confidence} tone={tone} />
          </div>
        </div>

        {/* Reasoning — mono voice */}
        <div className="mt-4 rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-2">
          <p className="font-mono text-[13px] leading-relaxed text-muted-foreground">
            {decision.reasoning}
          </p>
        </div>

        {/* Action summary */}
        <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">
          <span className="mr-1.5 font-semibold text-foreground/70">
            {t('aiPilot.actionLabel')}:
          </span>
          {decision.actionSummary}
        </p>

        {/* Footer: status + time + impact + actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                statusConfig.badgeClass,
              )}
            >
              {t(statusConfig.labelKey)}
            </span>
            <span className="tabular-nums text-muted-foreground">{decision.timeAgo}</span>
            {decision.result && (
              <span className="inline-flex items-center gap-1 font-mono text-success">
                <TrendingUp size={12} />
                {decision.result}
              </span>
            )}
          </div>
          {isPending && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onReject(decision.id)}
                leadingIcon={<X size={12} />}
              >
                <span>{t('aiPilot.reject')}</span>
                <KbdHint className="ml-1">R</KbdHint>
              </Button>
              <Button
                size="sm"
                onClick={() => onApprove(decision.id)}
                leadingIcon={<Check size={12} strokeWidth={3} />}
              >
                <span>{t('aiPilot.approve')}</span>
                <KbdHint className="ml-1" tone="inverse">A</KbdHint>
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
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

  if (metrics.length === 0 && chartData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('aiPilot.performanceImpactTitle')}</h3>
        </div>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      </div>
    );
  }

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

  const rawDecisions: AiDecision[] =
    (decisionsQuery.data as unknown as AiDecision[] | undefined) ?? [];

  // Apply local optimistic overrides
  const decisions = rawDecisions.map((d) => {
    const override = localDecisionOverrides[d.id];
    return override ? { ...d, status: override } : d;
  });

  const isActive =
    (settingsQuery.data as { isActive?: boolean } | undefined)?.isActive ?? true;

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

      {/* Navy hero — system state */}
      <NavyHero ambientGlow gridOverlay>
        <div className="flex flex-wrap items-center justify-between gap-6 p-6">
          <div className="flex flex-wrap items-center gap-8">
            {/* State */}
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isActive ? 'bg-success animate-pulse' : 'bg-destructive',
                  )}
                />
                System State
              </span>
              <span className="flex items-center gap-2 text-lg font-medium text-white">
                {isActive ? t('aiPilot.running') : t('aiPilot.stopped')}
                <span className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
                  承認モード
                </span>
              </span>
            </div>

            <span className="h-10 w-px bg-white/10" />

            {/* Live decision count */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                本日の判断件数
              </span>
              <span className="font-mono text-2xl font-medium tabular-nums tracking-tight text-white">
                {decisions.length}
              </span>
            </div>

            {/* Pending */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                承認待ち
              </span>
              <span
                className={cn(
                  'font-mono text-2xl font-medium tabular-nums tracking-tight',
                  pendingCount > 0 ? 'text-warning' : 'text-white',
                )}
              >
                {pendingCount}
              </span>
            </div>

          </div>

          {/* Master controls */}
          <div className="flex items-center gap-2">
            <a
              href="/settings/ai"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Settings size={14} />
              {t('aiPilot.settings')}
            </a>
            <Button
              size="md"
              onClick={handleManualTrigger}
              disabled={triggering}
              loading={triggering}
              leadingIcon={!triggering ? <Zap size={14} /> : undefined}
              className="shadow-[0_0_20px_rgba(37,99,235,0.3)]"
            >
              {t('aiPilot.manualRun')}
            </Button>
          </div>
        </div>
      </NavyHero>

      {/* Guardrails ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-primary/5 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Shield size={12} className="text-primary" />
            Active Guardrails
          </span>
          <div className="flex flex-wrap gap-1.5">
            {GUARDRAIL_RULES.map((rule) => (
              <span
                key={rule}
                className="rounded border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground shadow-xs"
              >
                {rule}
              </span>
            ))}
          </div>
        </div>
        <a
          href="/settings/ai"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          ルールを編集
          <ArrowRight size={12} />
        </a>
      </div>

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
        metrics={[]}
        chartData={[]}
      />
    </div>
  );
}
