'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Check,
  Clock,
  FlaskConical,
  Inbox,
  Lightbulb,
  RefreshCw,
  ShieldAlert,
  Trophy,
  X,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';
import { BenchmarkPanel } from './_components/BenchmarkPanel';
import { TodaysMoveCard } from './_components/TodaysMoveCard';

// ============================================================
// Types
// ============================================================

type AlertSeverity = 'critical' | 'warning';
type InsightType = 'opportunity' | 'warning' | 'achievement';
type CampaignHealthStatus = 'active' | 'paused' | 'error';
type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';
type BudgetPaceStatus = 'on-pace' | 'under-delivery' | 'overspend-risk';

interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  action: string;
}

interface KpiCardData {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ReactNode;
}

interface CampaignHealth {
  id: string;
  name: string;
  healthScore: number;
  platforms: Platform[];
  dailySpend: number;
  roas: number;
  status: CampaignHealthStatus;
}

interface BudgetPacing {
  spent: number;
  total: number;
  time: string;
  status: BudgetPaceStatus;
  statusLabel: string;
}

interface AiInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
}

interface AbTest {
  id: string;
  name: string;
  variants: string[];
  currentWinner: string;
  significance: number;
  sampleProgress: number;
}

interface ActivityItem {
  id: string;
  message: string;
  time: string;
  type: 'user' | 'ai' | 'alert';
}

// ============================================================
// Empty State
// ============================================================

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
      <Inbox size={32} className="text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: 'Meta',
  google: 'Google',
  x: 'X',
  tiktok: 'TikTok',
  line_yahoo: 'LINE/Yahoo',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
};

const PLATFORM_COLORS: Record<Platform, string> = {
  meta: 'bg-indigo-500',
  google: 'bg-blue-500',
  x: 'bg-gray-700',
  tiktok: 'bg-pink-500',
  line_yahoo: 'bg-green-500',
  amazon: 'bg-orange-500',
  microsoft: 'bg-teal-500',
};

const STATUS_LABEL_KEYS: Record<CampaignHealthStatus, string> = {
  active: 'dashboard.statusActive',
  paused: 'dashboard.statusPaused',
  error: 'dashboard.statusError',
};

const STATUS_CLASSES: Record<CampaignHealthStatus, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ============================================================
// Subcomponents
// ============================================================

function KpiCard({ card }: { card: KpiCardData }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
        {card.icon}
      </div>
      <p className="mt-3 text-3xl font-bold text-foreground">{card.value}</p>
      {card.subLabel && (
        <p className="mt-1 text-xs text-muted-foreground">{card.subLabel}</p>
      )}
    </div>
  );
}

function AlertBanner({ alerts, onViewDetail }: {
  alerts: Alert[];
  onViewDetail: (alert: Alert) => void;
}): React.ReactElement | null {
  const { t } = useI18n();
  const criticals = alerts.filter((a) => a.severity === 'critical');
  const warnings = alerts.filter((a) => a.severity === 'warning');

  if (criticals.length === 0 && warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {criticals.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                {t('dashboard.criticalAlertCount', { count: criticals.length })}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {criticals.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => onViewDetail(alert)}
                    className="rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/70"
                  >
                    {alert.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                {t('dashboard.warningAlertCount', { count: warnings.length })}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {warnings.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => onViewDetail(alert)}
                    className="rounded-md bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900/70"
                  >
                    {alert.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
  onStopCampaign: (alert: Alert) => void;
  onDismiss: (alert: Alert) => void;
}

function AlertDetailModal({ alert, onClose, onStopCampaign, onDismiss }: AlertDetailModalProps): React.ReactElement {
  const { t } = useI18n();
  const isCritical = alert.severity === 'critical';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full',
              isCritical ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30',
            )}>
              <AlertTriangle
                size={16}
                className={isCritical ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}
              />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{alert.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-foreground">{alert.description}</p>
        <div className="mt-4 rounded-md bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary">{t('dashboard.recommendedAction')}</p>
          <p className="mt-1 text-sm text-foreground">{alert.action}</p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onStopCampaign(alert);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            <ShieldAlert size={14} />
            {t('dashboard.stopCampaign')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onDismiss(alert);
                onClose();
              }}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Check size={14} />
                {t('dashboard.acknowledged')}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthScoreRing({ score }: { score: number }): React.ReactElement {
  const color = score > 70 ? 'hsl(142, 71%, 45%)' : score > 40 ? 'hsl(45, 93%, 47%)' : 'hsl(0, 84%, 60%)';
  const bgColor = 'hsl(var(--muted))';

  const data = [
    { name: 'score', value: score },
    { name: 'remaining', value: 100 - score },
  ];

  return (
    <div className="relative h-16 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={22}
            outerRadius={30}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill={bgColor} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground">{score}</span>
      </div>
    </div>
  );
}

function CampaignHealthCard({ campaign }: { campaign: CampaignHealth }): React.ReactElement {
  const { t } = useI18n();
  return (
    <a
      href={`/campaigns/${campaign.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between">
        <HealthScoreRing score={campaign.healthScore} />
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
          STATUS_CLASSES[campaign.status] ?? STATUS_CLASSES.active,
        )}>
          {t(STATUS_LABEL_KEYS[campaign.status] ?? STATUS_LABEL_KEYS.active)}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground line-clamp-1">{campaign.name}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {(campaign.platforms ?? []).map((p) => (
            <span
              key={p}
              className={cn(
                'inline-flex h-5 items-center rounded px-1 text-[9px] font-medium text-white',
                PLATFORM_COLORS[p],
              )}
            >
              {PLATFORM_LABELS[p]}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(campaign.dailySpend ?? 0)}{t('dashboard.perDay')}
        </span>
        <span className={cn(
          'font-semibold',
          (campaign.roas ?? 0) >= 3 ? 'text-green-600' : (campaign.roas ?? 0) >= 1 ? 'text-yellow-600' : 'text-red-600',
        )}>
          ROAS {(campaign.roas ?? 0).toFixed(1)}x
        </span>
      </div>
    </a>
  );
}

function BudgetPacingBar({ pacing }: { pacing: BudgetPacing }): React.ReactElement {
  const { t } = useI18n();
  const percentage = Math.round((pacing.spent / pacing.total) * 100);
  const barColor: Record<BudgetPaceStatus, string> = {
    'on-pace': 'bg-green-500',
    'under-delivery': 'bg-yellow-500',
    'overspend-risk': 'bg-red-500',
  };
  const textColor: Record<BudgetPaceStatus, string> = {
    'on-pace': 'text-green-600',
    'under-delivery': 'text-yellow-600',
    'overspend-risk': 'text-red-600',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t('dashboard.todayBudgetSpend')}</h3>
        <span className={cn('text-xs font-semibold', textColor[pacing.status])}>
          {t('dashboard.pace')}: {pacing.statusLabel}
        </span>
      </div>
      <div className="mt-3">
        <div className="flex items-end justify-between">
          <p className="text-lg font-bold text-foreground">
            {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(pacing.spent)}
            <span className="text-sm font-normal text-muted-foreground">
              {' '}/ {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(pacing.total)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.asOf', { time: pacing.time })}
          </p>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', barColor[pacing.status])}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">{percentage}% {t('dashboard.consumed')}</p>
      </div>
    </div>
  );
}

const INSIGHT_TYPE_HREF: Record<InsightType, string> = {
  opportunity: '/budgets',
  warning: '/analytics',
  achievement: '/reports',
};

function AiInsightsPanel({ insights }: { insights: AiInsight[] }): React.ReactElement {
  const { t } = useI18n();
  const typeConfig: Record<InsightType, { icon: React.ReactNode; className: string }> = {
    opportunity: { icon: <Lightbulb size={16} />, className: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
    warning: { icon: <AlertTriangle size={16} />, className: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
    achievement: { icon: <Trophy size={16} />, className: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <BrainCircuit size={18} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{t('dashboard.aiInsights')}</h3>
      </div>
      {insights.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {insights.map((insight) => {
            const cfg = typeConfig[insight.type];
            return (
              <div key={insight.id} className="rounded-md border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className={cn('mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full', cfg.className)}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{insight.description}</p>
                    <a
                      href={INSIGHT_TYPE_HREF[insight.type]}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                    >
                      {t('dashboard.action')}
                      <ArrowRight size={12} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AbTestCard({ test }: { test: AbTest }): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <FlaskConical size={16} className="text-purple-500" />
        <p className="text-sm font-semibold text-foreground">{test.name}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {test.variants.map((v) => (
          <span
            key={v}
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
              v === test.currentWinner
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {v === test.currentWinner && <Trophy size={10} className="mr-0.5" />}
            {v}
          </span>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('dashboard.statisticalSignificance')}</span>
            <span className={cn(
              'font-semibold',
              test.significance >= 95 ? 'text-green-600' : test.significance >= 80 ? 'text-yellow-600' : 'text-muted-foreground',
            )}>
              {test.significance}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                test.significance >= 95 ? 'bg-green-500' : test.significance >= 80 ? 'bg-yellow-500' : 'bg-muted-foreground',
              )}
              style={{ width: `${test.significance}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('dashboard.sampleProgress')}</span>
            <span className="font-medium text-foreground">{test.sampleProgress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${test.sampleProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityFeed({ activities }: { activities: ActivityItem[] }): React.ReactElement {
  const { t } = useI18n();
  const typeConfig: Record<ActivityItem['type'], { icon: React.ReactNode; className: string }> = {
    user: { icon: <Clock size={14} />, className: 'text-muted-foreground' },
    ai: { icon: <BrainCircuit size={14} />, className: 'text-primary' },
    alert: { icon: <AlertTriangle size={14} />, className: 'text-yellow-600' },
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">{t('dashboard.recentActivity')}</h3>
      </div>
      {activities.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activities.map((item) => {
            const cfg = typeConfig[item.type];
            return (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                <div className={cn('mt-0.5 flex-shrink-0', cfg.className)}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{item.message}</p>
                </div>
                <span className="flex-shrink-0 text-xs text-muted-foreground">{item.time}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Dashboard Page
// ============================================================

function formatTimeAgo(date: Date, t: (key: string, params?: Record<string, string | number>) => string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t('dashboard.secondsAgo', { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('dashboard.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('dashboard.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('dashboard.daysAgo', { count: days });
}

export function DashboardClient(): React.ReactElement {
  const { t } = useI18n();
  const [alertDetail, setAlertDetail] = useState<Alert | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [stoppedAlerts, setStoppedAlerts] = useState<Set<string>>(new Set());

  // tRPC queries -- show real data or empty state
  const overviewQuery = trpc.dashboard.overview.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const healthQuery = trpc.dashboard.healthScores.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const activityQuery = trpc.dashboard.activity.useQuery({}, { retry: false, refetchOnWindowFocus: false });

  // Determine last update time from the most recently fetched query
  const lastFetchedAt = overviewQuery.dataUpdatedAt || healthQuery.dataUpdatedAt || activityQuery.dataUpdatedAt;
  const lastUpdatedLabel = lastFetchedAt > 0
    ? formatTimeAgo(new Date(lastFetchedAt), t)
    : null;

  // Adapt dashboard.overview object → KpiCardData[] for the grid.
  // API returns { todaySpend, todayRevenue, todayRoas, activeCampaignCount,
  // alerts, budgetPacing } — we flatten the top numbers into cards.
  const kpiData: KpiCardData[] = (() => {
    const raw = overviewQuery.data as
      | {
          todaySpend?: number;
          todayRevenue?: number;
          todayRoas?: number;
          activeCampaignCount?: number;
        }
      | undefined;
    if (!raw) return [];
    const yen = (n: number) =>
      new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
      }).format(n);
    return [
      { label: '本日の広告費', value: yen(raw.todaySpend ?? 0), icon: null },
      { label: '本日の売上', value: yen(raw.todayRevenue ?? 0), icon: null },
      { label: 'ROAS', value: `${(raw.todayRoas ?? 0).toFixed(2)}x`, icon: null },
      { label: 'アクティブ施策', value: String(raw.activeCampaignCount ?? 0), icon: null },
    ];
  })();
  const campaignHealth: CampaignHealth[] = (healthQuery.data as CampaignHealth[] | undefined) ?? [];
  const activityData: ActivityItem[] = (activityQuery.data as unknown as ActivityItem[] | undefined) ?? [];
  const budgetPacing: BudgetPacing | null = null;
  const abTests: AbTest[] = [];

  // Alerts come from the API overview -- extract if present, otherwise empty
  const alerts: Alert[] = [];
  const visibleAlerts = alerts.filter(
    (a) => !dismissedAlerts.has(a.id) && !stoppedAlerts.has(a.id),
  );

  function handleRefresh(): void {
    void overviewQuery.refetch();
    void healthQuery.refetch();
    void activityQuery.refetch();
  }

  function handleStopCampaign(alert: Alert): void {
    setStoppedAlerts((prev) => new Set([...prev, alert.id]));
  }

  function handleDismissAlert(alert: Alert): void {
    setDismissedAlerts((prev) => new Set([...prev, alert.id]));
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('dashboard.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdatedLabel && (
            <span className="text-xs text-muted-foreground">
              {t('dashboard.lastUpdated')}: {lastUpdatedLabel}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={overviewQuery.isFetching || healthQuery.isFetching || activityQuery.isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label={t('dashboard.refreshData')}
          >
            <RefreshCw
              size={12}
              className={cn(
                (overviewQuery.isFetching || healthQuery.isFetching || activityQuery.isFetching) && 'animate-spin',
              )}
            />
            {t('dashboard.refresh')}
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      <AlertBanner alerts={visibleAlerts} onViewDetail={setAlertDetail} />

      {/* Today's One Move — highest-impact orchestrator shift as hero CTA */}
      <TodaysMoveCard />

      {/* Industry benchmark comparison — agency network effect in one glance */}
      <BenchmarkPanel />

      {/* KPI Cards */}
      {kpiData.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiData.map((card) => (
            <KpiCard key={card.label} card={card} />
          ))}
        </div>
      )}

      {/* Main content: Campaign Health + AI Insights */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left: Campaign Health Grid */}
        <div className="xl:col-span-2 space-y-6">
          {/* Campaign Health Grid */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">{t('dashboard.campaignHealth')}</h2>
            {campaignHealth.length === 0 ? (
              <EmptyState message={t('common.noData')} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campaignHealth.map((campaign, index) => (
                  <CampaignHealthCard
                    key={campaign.id ?? `health-${index}`}
                    campaign={campaign}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Budget Pacing -- rendered when API provides data */}
          {budgetPacing && <BudgetPacingBar pacing={budgetPacing} />}

          {/* Active A/B Tests */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <FlaskConical size={18} className="text-purple-500" />
              <h2 className="text-lg font-semibold text-foreground">{t('dashboard.activeAbTests')}</h2>
            </div>
            {abTests.length === 0 ? (
              <EmptyState message={t('common.noData')} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {abTests.map((test) => (
                  <AbTestCard key={test.id} test={test} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Insights */}
        <div>
          <AiInsightsPanel insights={[]} />
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed activities={activityData} />

      {/* Alert detail modal */}
      {alertDetail && (
        <AlertDetailModal
          alert={alertDetail}
          onClose={() => setAlertDetail(null)}
          onStopCampaign={handleStopCampaign}
          onDismiss={handleDismissAlert}
        />
      )}
    </div>
  );
}
