'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  BadgeJapaneseYen,
  BarChart3,
  Globe,
  Loader2,
  Palette,
  Pause,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, Button, PageHeader } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/show-toast';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type CompetitorStrategy = 'aggressive' | 'defensive' | 'opportunistic';
type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';

type AlertType =
  | 'new_creative'
  | 'budget_increase'
  | 'new_keyword'
  | 'position_change'
  | 'new_campaign';

type CounterActionType =
  | 'bid_adjustment'
  | 'budget_shift'
  | 'creative_counter'
  | 'targeting_expansion'
  | 'keyword_defense'
  | 'timing_attack'
  | 'skip';

type CounterActionStatus = 'executed' | 'proposed' | 'rolled_back';

interface CompetitorAlert {
  id: string;
  type: AlertType;
  competitorName: string;
  messageKey: string;
  messageParams: Record<string, string | number>;
  timestamp: string;
  acknowledged: boolean;
}

interface Competitor {
  id: string;
  name: string;
  domain: string;
  active: boolean;
  strategy: CompetitorStrategy;
  platforms: Platform[];
  adCount: number;
  estimatedMonthlyBudget: number;
  overlapRate: number;
  latestActivity: string;
  latestActivityTime: string;
}

interface ImpressionShareDataPoint {
  date: string;
  ours: number;
  competitorA: number;
  competitorB: number;
  competitorC: number;
}

interface CounterAction {
  id: string;
  type: CounterActionType;
  status: CounterActionStatus;
  competitorName: string;
  campaignName: string;
  reasoning: string;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  actionDetail: string;
  result: string | null;
  timestamp: string;
  timeAgo: string;
}

interface WeakWindowCell {
  day: number;
  hour: number;
  competitorCpc: number;
  avgCpc: number;
  impressionShare: number;
}

// ============================================================
// Constants
// ============================================================

const STRATEGY_CONFIG: Record<
  CompetitorStrategy,
  { labelKey: string; badgeClass: string }
> = {
  aggressive: {
    labelKey: 'competitors.strategyAggressive',
    badgeClass:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  defensive: {
    labelKey: 'competitors.strategyDefensive',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  opportunistic: {
    labelKey: 'competitors.strategyOpportunistic',
    badgeClass:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
};

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string }> = {
  meta: { label: 'Meta', color: 'bg-indigo-500' },
  google: { label: 'Google', color: 'bg-blue-500' },
  x: { label: 'X', color: 'bg-gray-700' },
  tiktok: { label: 'TikTok', color: 'bg-pink-500' },
  line_yahoo: { label: 'LINE/Yahoo', color: 'bg-green-500' },
  amazon: { label: 'Amazon', color: 'bg-orange-500' },
  microsoft: { label: 'Microsoft', color: 'bg-teal-500' },
};

const ALERT_TYPE_ICONS: Record<AlertType, ReactNode> = {
  new_creative: <Palette size={16} className="text-purple-500" />,
  budget_increase: <BadgeJapaneseYen size={16} className="text-yellow-600" />,
  new_keyword: <Search size={16} className="text-blue-500" />,
  position_change: <TrendingUp size={16} className="text-green-500" />,
  new_campaign: <Rocket size={16} className="text-orange-500" />,
};

const COUNTER_ACTION_CONFIG: Record<
  CounterActionType,
  { icon: ReactNode; labelKey: string; badgeClass: string }
> = {
  bid_adjustment: {
    icon: <BadgeJapaneseYen size={16} />,
    labelKey: 'competitors.counterBidAdjustment',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  budget_shift: {
    icon: <BarChart3 size={16} />,
    labelKey: 'competitors.counterBudgetShift',
    badgeClass:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  creative_counter: {
    icon: <Palette size={16} />,
    labelKey: 'competitors.counterCreativeCounter',
    badgeClass:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  targeting_expansion: {
    icon: <Target size={16} />,
    labelKey: 'competitors.counterTargetingExpansion',
    badgeClass:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  keyword_defense: {
    icon: <Shield size={16} />,
    labelKey: 'competitors.counterKeywordDefense',
    badgeClass:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  timing_attack: {
    icon: <Clock size={16} />,
    labelKey: 'competitors.counterTimingAttack',
    badgeClass:
      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  },
  skip: {
    icon: <Pause size={16} />,
    labelKey: 'competitors.counterSkip',
    badgeClass:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
};

const COUNTER_STATUS_CONFIG: Record<
  CounterActionStatus,
  { labelKey: string; badgeClass: string }
> = {
  executed: {
    labelKey: 'competitors.statusExecuted',
    badgeClass:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  proposed: {
    labelKey: 'competitors.statusProposed',
    badgeClass:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  rolled_back: {
    labelKey: 'competitors.statusRolledBack',
    badgeClass:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
};

function getDayLabels(t: (key: string, params?: Record<string, string | number>) => string) {
  return [t('competitors.he42b99'), t('competitors.hdf3bbd'), t('competitors.heab619'), t('competitors.he0a5e0'), t('competitors.h9c4189'), t('competitors.h06da77'), t('competitors.h3edddd')] as const;
}

const STRATEGY_RADIO_OPTIONS: {
  value: CompetitorStrategy;
  labelKey: string;
  descriptionKey: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}[] = [
  {
    value: 'aggressive',
    labelKey: 'competitors.strategyAggressive',
    descriptionKey: 'competitors.strategyAggressiveDesc',
    borderColor: 'border-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-600 dark:text-red-400',
  },
  {
    value: 'defensive',
    labelKey: 'competitors.strategyDefensive',
    descriptionKey: 'competitors.strategyDefensiveDesc',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'opportunistic',
    labelKey: 'competitors.strategyOpportunisticLabel',
    descriptionKey: 'competitors.strategyOpportunisticDesc',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  },
];

// ============================================================
// ============================================================

// ============================================================
// Subcomponents
// ============================================================

function AlertBanner({
  alerts,
  onAcknowledge,
}: {
  alerts: CompetitorAlert[];
  onAcknowledge: (id: string) => void;
}): React.ReactElement | null {
  const { t } = useI18n();
  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  if (unacknowledged.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950/30"
      role="alert"
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle
          size={16}
          className="text-yellow-600 dark:text-yellow-400"
        />
        <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
          {t('competitors.alertCount', { count: unacknowledged.length })}
        </span>
      </div>
      <div className="space-y-2">
        {unacknowledged.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between rounded-md bg-white/60 px-3 py-2 dark:bg-black/20"
          >
            <div className="flex items-center gap-2">
              <span>{ALERT_TYPE_ICONS[alert.type]}</span>
              <span className="text-sm text-yellow-900 dark:text-yellow-200">
                {t(alert.messageKey, alert.messageParams)}
              </span>
              <span className="text-xs text-yellow-600 dark:text-yellow-500">
                {t(`competitors.time.${alert.timestamp}`)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onAcknowledge(alert.id)}
              className="rounded-md bg-yellow-200 px-2.5 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-300 dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700"
            >
              {t('competitors.acknowledge')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface KpiCardInput {
  labelKey: string;
  value: string;
  valueKey?: string;
  trend: string;
  trendKey?: string;
  trendPositive: boolean;
}

function KpiCardRow({
  cards,
}: {
  cards: KpiCardInput[];
}): React.ReactElement {
  const { t } = useI18n();

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BarChart3 size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.labelKey}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {t(card.labelKey)}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {card.value}{card.valueKey ? t(card.valueKey) : ''}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                card.trendPositive
                  ? 'text-green-600'
                  : 'text-red-600'
              )}
            >
              {card.trendPositive ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}
              {card.trendKey ? t(card.trendKey, { count: card.trend }) : card.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StrategyBadge({
  strategy,
}: {
  strategy: CompetitorStrategy;
}): React.ReactElement {
  const { t } = useI18n();
  const config = STRATEGY_CONFIG[strategy];
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        config.badgeClass
      )}
    >
      {t(config.labelKey)}
    </span>
  );
}

function PlatformIcons({
  platforms,
}: {
  platforms: Platform[];
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          className={cn(
            'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-white',
            PLATFORM_CONFIG[p].color
          )}
          title={PLATFORM_CONFIG[p].label}
        >
          {PLATFORM_CONFIG[p].label}
        </span>
      ))}
    </div>
  );
}

function ImpressionShareChart({
  data,
}: {
  data: ImpressionShareDataPoint[];
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        {t('competitors.impressionShareTrend')}
      </h2>
      {data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <BarChart3 size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={350}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border"
          />
          <XAxis
            dataKey="date"
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
            }}
          />
          <YAxis
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
            }}
            domain={[0, 60]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--foreground))',
            }}
            formatter={(value: number, name: string) => [
              `${value}%`,
              name,
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="ours"
            name={t('competitors.ownCompany')}
            stroke="hsl(var(--chart-1))"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="competitorA"
            name="CompetitorA"
            stroke="hsl(var(--chart-2))"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="competitorB"
            name="CompetitorB"
            stroke="hsl(var(--chart-3))"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="competitorC"
            name="CompetitorC"
            stroke="hsl(var(--chart-4))"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}

function CompetitorMapCard({
  competitor,
  onSettings,
  onDelete,
}: {
  competitor: Competitor;
  onSettings: (id: string) => void;
  onDelete: (id: string) => void;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {competitor.name}
            </h3>
            {competitor.active && (
              <span
                className="inline-flex h-2 w-2 rounded-full bg-green-500"
                title={t('competitors.active')}
              />
            )}
          </div>
          <a
            href={`https://${competitor.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <Globe size={10} />
            {competitor.domain}
            <ExternalLink size={10} />
          </a>
        </div>
        <StrategyBadge strategy={competitor.strategy} />
      </div>

      <div className="mt-3">
        <PlatformIcons platforms={competitor.platforms} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground">{t('competitors.adCount')}</p>
          <p className="text-lg font-bold text-foreground">
            {competitor.adCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{t('competitors.estimatedBudget')}</p>
          <p className="text-lg font-bold text-foreground">
            {(competitor.estimatedMonthlyBudget / 10000).toFixed(0)}{t('competitors.tenThousandUnit')}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">
            {t('competitors.overlapRate')}
          </p>
          <p className="text-lg font-bold text-foreground">
            {competitor.overlapRate}%
          </p>
        </div>
      </div>

      <div className="mt-3 rounded bg-muted/50 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          <Clock size={10} className="mr-1 inline" />
          {competitor.latestActivityTime}: {competitor.latestActivity}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={`/competitors/${competitor.id}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t('competitors.detail')}
        </a>
        <button
          type="button"
          onClick={() => onSettings(competitor.id)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label={`${competitor.name} ${t('competitors.settings')}`}
        >
          <Settings size={12} className="mr-1 inline" />
          {t('competitors.settings')}
        </button>
        <button
          type="button"
          onClick={() => onDelete(competitor.id)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
          aria-label={`${competitor.name} ${t('common.delete')}`}
        >
          <Trash2 size={12} className="mr-1 inline" />
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

function CounterActionCard({
  action,
}: {
  action: CounterAction;
}): React.ReactElement {
  const { t } = useI18n();
  const typeConfig = COUNTER_ACTION_CONFIG[action.type];
  const statusConfig = COUNTER_STATUS_CONFIG[action.status];

  const riskColorMap: Record<CounterAction['risk'], string> = {
    high: 'text-red-600 dark:text-red-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-green-600 dark:text-green-400',
  };
  const riskLabelKeyMap: Record<CounterAction['risk'], string> = {
    high: 'competitors.riskHigh',
    medium: 'competitors.riskMedium',
    low: 'competitors.riskLow',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base">{typeConfig.icon}</span>
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            typeConfig.badgeClass
          )}
        >
          {t(typeConfig.labelKey)}
        </span>
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            statusConfig.badgeClass
          )}
        >
          {t(statusConfig.labelKey)}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {action.timeAgo}
        </span>
      </div>

      {/* Competitor + Campaign */}
      <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
        <span className="font-medium">{action.competitorName}</span>
        <span className="text-muted-foreground">/</span>
        <span>{action.campaignName}</span>
      </div>

      {/* Reasoning */}
      <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
        {action.reasoning}
      </blockquote>

      {/* Confidence + Risk */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1 text-xs">
          <Target size={10} className="text-primary" />
          {t('competitors.confidence')}: {action.confidence}%
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            riskColorMap[action.risk]
          )}
        >
          <Shield size={10} />
          {t('competitors.risk')}: {t(riskLabelKeyMap[action.risk])}
        </span>
      </div>

      {/* Action detail */}
      <div className="mt-2 rounded bg-muted/50 px-3 py-2 text-xs text-foreground">
        {action.actionDetail}
      </div>

      {/* Result */}
      {action.result !== null && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
          <TrendingUp size={12} />
          {t('competitors.result')}: {action.result}
        </div>
      )}

      {/* Rollback button */}
      {action.status === 'executed' && (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={10} />
          {t('competitors.rollback')}
        </button>
      )}
    </div>
  );
}

function CounterActionTimeline({
  actions,
  expanded,
  onToggle,
}: {
  actions: CounterAction[];
  expanded: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-6"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            {t('competitors.counterLog')}
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {t('competitors.counterLogCount', { count: actions.length })}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={20} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={20} className="text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 px-6 pb-6">
          {actions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Zap size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            </div>
          ) : (
            actions.map((action) => (
              <CounterActionCard key={action.id} action={action} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function WeakWindowsHeatmap({
  data,
}: {
  data: WeakWindowCell[];
}): React.ReactElement {
  const { t } = useI18n();
  const [hoveredCell, setHoveredCell] =
    useState<WeakWindowCell | null>(null);

  function getCellColor(cell: WeakWindowCell): string {
    const ratio = cell.competitorCpc / cell.avgCpc;
    if (ratio < 0.7) return 'bg-green-500/80';
    if (ratio < 0.85) return 'bg-green-400/60';
    if (ratio < 0.95) return 'bg-green-300/40';
    if (ratio < 1.05) return 'bg-yellow-300/40';
    if (ratio < 1.15) return 'bg-orange-400/60';
    return 'bg-red-500/80';
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          {t('competitors.weakWindowMap')}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {t('competitors.weakWindowDesc')}
        </p>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Clock size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        {t('competitors.weakWindowMap')}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {t('competitors.weakWindowDesc')}
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]" role="grid" aria-label={t('competitors.weakWindowLabel')}>
          {/* Hour labels */}
          <div className="mb-1 flex" role="row">
            <div className="w-10 flex-shrink-0" role="columnheader" />
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="flex-1 text-center text-[9px] text-muted-foreground"
                role="columnheader"
              >
                {h}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {Array.from({ length: 7 }, (_, dayIdx) => (
            <div
              key={dayIdx}
              className="flex items-center gap-0.5"
              role="row"
            >
              <div
                className="w-10 flex-shrink-0 pr-2 text-right text-xs font-medium text-muted-foreground"
                role="rowheader"
              >
                {getDayLabels(t)[dayIdx]}
              </div>
              {Array.from({ length: 24 }, (_, hourIdx) => {
                const cell = data.find(
                  (c) => c.day === dayIdx && c.hour === hourIdx
                );
                if (!cell) return null;
                const isHovered =
                  hoveredCell?.day === dayIdx &&
                  hoveredCell?.hour === hourIdx;
                return (
                  <div
                    key={hourIdx}
                    className={cn(
                      'aspect-square flex-1 cursor-pointer rounded-sm transition-opacity',
                      getCellColor(cell),
                      isHovered ? 'ring-2 ring-foreground' : ''
                    )}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    role="gridcell"
                    aria-label={t('competitors.heatmapCellAria', { day: getDayLabels(t)[dayIdx] ?? '', hour: String(hourIdx), cpc: String(cell.competitorCpc) })}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell !== null && (
        <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-foreground">
          {(getDayLabels(t)[hoveredCell.day] ?? '')}{t('competitors.dayOfWeekSuffix')} {hoveredCell.hour}:00 - CPC
          ¥{hoveredCell.competitorCpc} ({t('competitors.vsAvg')}
          {Math.round(
            ((hoveredCell.competitorCpc - hoveredCell.avgCpc) /
              hoveredCell.avgCpc) *
              100
          )}
          %), {t('competitors.impressionShareLabel')} {hoveredCell.impressionShare}%
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-sm bg-green-500/80" />
          <span className="text-[10px] text-muted-foreground">
            {t('competitors.legendWeak')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-sm bg-yellow-300/40" />
          <span className="text-[10px] text-muted-foreground">{t('competitors.legendEven')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-sm bg-red-500/80" />
          <span className="text-[10px] text-muted-foreground">
            {t('competitors.legendStrong')}
          </span>
        </div>
      </div>
    </div>
  );
}

interface AddCompetitorModalProps {
  open: boolean;
  onClose: () => void;
}

function AddCompetitorModal({
  open,
  onClose,
}: AddCompetitorModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(
    []
  );
  const [keywords, setKeywords] = useState('');
  const [strategy, setStrategy] =
    useState<CompetitorStrategy>('defensive');
  const [maxBidIncrease, setMaxBidIncrease] = useState(15);
  const [maxBudgetShift, setMaxBudgetShift] = useState(20);
  const [isAdding, setIsAdding] = useState(false);

  if (!open) return null;

  function handleTogglePlatform(platform: Platform): void {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    const { t } = useI18n();
    e.preventDefault();
    if (!name || !domain) return;
    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
      showToast(t('competitors.addedToast', { name }));
      onClose();
    }, 1500);
  }

  const allPlatforms: Platform[] = [
    'google',
    'meta',
    'tiktok',
    'line_yahoo',
    'amazon',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t('competitors.modalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={t('competitors.h5dce86')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Brand name */}
          <div>
            <label
              htmlFor="comp-name"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('competitors.brandName')}
            </label>
            <input
              id="comp-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="CompetitorX"
              required
            />
          </div>

          {/* Domain */}
          <div>
            <label
              htmlFor="comp-domain"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('competitors.domain')}
            </label>
            <input
              id="comp-domain"
              type="text"
              value={domain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDomain(e.target.value)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="competitor-x.co.jp"
              required
            />
          </div>

          {/* Platforms */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              {t('competitors.monitorPlatforms')}
            </p>
            <div className="flex flex-wrap gap-2">
              {allPlatforms.map((p) => {
                const checked = selectedPlatforms.includes(p);
                return (
                  <label
                    key={p}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => handleTogglePlatform(p)}
                    />
                    {PLATFORM_CONFIG[p].label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label
              htmlFor="comp-keywords"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('competitors.keywords')}
            </label>
            <input
              id="comp-keywords"
              type="text"
              value={keywords}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setKeywords(e.target.value)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('competitors.keywordsPlaceholder')}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('competitors.keywordsHint')}
            </p>
          </div>

          {/* Strategy */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              {t('competitors.counterStrategy')}
            </p>
            <div className="space-y-2">
              {STRATEGY_RADIO_OPTIONS.map((opt) => {
                const selected = strategy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStrategy(opt.value)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left transition-all',
                      selected
                        ? `${opt.borderColor} ${opt.bgColor}`
                        : 'border-border hover:border-border/80 hover:bg-muted/30'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2',
                        selected
                          ? 'border-transparent bg-primary'
                          : 'border-muted-foreground/40'
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          selected
                            ? opt.textColor
                            : 'text-foreground'
                        )}
                      >
                        {t(opt.labelKey)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(opt.descriptionKey)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guardrails */}
          <div className="space-y-4 rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">
              {t('competitors.guardrails')}
            </h3>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('competitors.maxBidIncrease')}</span>
                <span className="font-medium text-foreground">
                  {maxBidIncrease}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={maxBidIncrease}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>
                ) => setMaxBidIncrease(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label={t('competitors.h1fe820')}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5%</span>
                <span>30%</span>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('competitors.maxBudgetShift')}</span>
                <span className="font-medium text-foreground">
                  {maxBudgetShift}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={maxBudgetShift}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>
                ) => setMaxBudgetShift(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label={t('competitors.h8accf1')}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5%</span>
                <span>50%</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              {t('competitors.h6ef349')}
            </button>
            <button
              type="submit"
              disabled={isAdding || !name || !domain}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isAdding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {t('competitors.addBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function CompetitorsPage(): React.ReactElement {
  const { t } = useI18n();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [counterLogExpanded, setCounterLogExpanded] = useState(true);
  const [alertOverrides, setAlertOverrides] = useState<Record<string, true>>({});
  const [scanning, setScanning] = useState(false);

  const competitorsQuery = trpc.competitiveIntel.competitors.list.useQuery(
    undefined,
    { retry: false },
  );
  const alertsQuery = trpc.competitiveIntel.alerts.list.useQuery(
    {},
    { retry: false },
  );
  const trendQuery = trpc.competitiveIntel.auctionInsights.trend.useQuery(
    {},
    { retry: false },
  );
  const counterActionsQuery = trpc.competitiveIntel.counterActions.list.useQuery(
    {},
    { retry: false },
  );

  const competitors: Competitor[] =
    (competitorsQuery.data as Competitor[] | undefined) ?? [];
  const alertsData: CompetitorAlert[] =
    (alertsQuery.data as CompetitorAlert[] | undefined) ?? [];
  const trendData: ImpressionShareDataPoint[] =
    (trendQuery.data as ImpressionShareDataPoint[] | undefined) ?? [];
  const counterActions: CounterAction[] =
    (counterActionsQuery.data as CounterAction[] | undefined) ?? [];

  // Apply local acknowledgement overrides on top of API data.
  const alerts: CompetitorAlert[] = alertsData.map((a) =>
    alertOverrides[a.id] ? { ...a, acknowledged: true } : a,
  );

  // KPI cards: empty until backend provides aggregated stats.
  const kpiCards: KpiCardInput[] = [];
  // Weak window heatmap: empty until backend provides data.
  const weakWindows: WeakWindowCell[] = [];

  const monitoringEnabled = true;

  function handleAcknowledgeAlert(id: string): void {
    setAlertOverrides((prev) => ({ ...prev, [id]: true }));
  }

  function handleScan(): void {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      showToast(t('competitors.scanComplete'));
    }, 3000);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Ops"
        title={t('competitors.title')}
        description={t('competitors.description')}
        actions={
          <>
            <Badge
              variant={monitoringEnabled ? 'success' : 'neutral'}
              size="md"
              dot={monitoringEnabled}
              dotClassName={monitoringEnabled ? 'animate-pulse' : undefined}
            >
              {t('competitors.autoMonitoring')}: {monitoringEnabled ? t('competitors.monitoringOn') : t('competitors.monitoringOff')}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleScan}
              disabled={scanning}
              leadingIcon={
                <RefreshCw size={14} className={cn(scanning && 'animate-spin')} />
              }
            >
              {t('competitors.scan')}
            </Button>
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={() => setAddModalOpen(true)}
            >
              {t('competitors.addCompetitor')}
            </Button>
          </>
        }
      />

      {/* Alert banner */}
      <AlertBanner
        alerts={alerts}
        onAcknowledge={handleAcknowledgeAlert}
      />

      {/* KPI cards */}
      <KpiCardRow cards={kpiCards} />

      {/* Impression share chart */}
      <ImpressionShareChart data={trendData} />

      {/* Competitor map */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('competitors.competitorMap')}
        </h2>
        {competitors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12 text-center">
            <Shield size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {competitors.map((competitor) => (
              <CompetitorMapCard
                key={competitor.id}
                competitor={competitor}
                onSettings={() => {
                  showToast(t('competitors.settingsToast', { name: competitor.name }));
                }}
                onDelete={() => {
                  if (window.confirm(t('competitors.deleteConfirm', { name: competitor.name }))) {
                    showToast(t('competitors.deleteToast', { name: competitor.name }));
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Weak windows heatmap */}
      <WeakWindowsHeatmap data={weakWindows} />

      {/* Counter-action timeline */}
      <CounterActionTimeline
        actions={counterActions}
        expanded={counterLogExpanded}
        onToggle={() => setCounterLogExpanded((prev) => !prev)}
      />

      {/* Add competitor modal */}
      <AddCompetitorModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </div>
  );
}
