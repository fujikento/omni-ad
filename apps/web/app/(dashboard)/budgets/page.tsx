'use client';

import { useState } from 'react';
import {
  CalendarDays,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, PageHeader } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';
import { HoldoutGroupsPanel } from './_components/HoldoutGroupsPanel';
import { SpendOrchestratorPanel } from './_components/SpendOrchestratorPanel';

// -- Types --

interface PlatformAllocation {
  platform: string;
  current: number;
  recommended: number;
  color: string;
}

interface ForecastEntry {
  platform: string;
  predictedRoas: number;
  confidence: { low: number; high: number };
}

interface HistoricalEntry {
  date: string;
  google: number;
  meta: number;
  tiktok: number;
  line: number;
  x: number;
  yahoo: number;
}

type PacingStatus = 'normal' | 'caution' | 'danger';

interface MonthlyPacing {
  spent: number;
  total: number;
  daysRemaining: number;
  projectedSpend: number;
  projectedOverage: number;
  status: PacingStatus;
}

// -- Constants --

// Platform chart colors — resolved from CSS variables defined in globals.css
// so that light/dark themes and Figma tokens stay in sync (no hex drift).
const PLATFORM_COLORS = {
  Google: 'hsl(var(--platform-google))',
  Meta: 'hsl(var(--platform-meta))',
  TikTok: 'hsl(var(--platform-tiktok))',
  LINE: 'hsl(var(--platform-line))',
  X: 'hsl(var(--platform-x))',
  'Yahoo!': 'hsl(var(--platform-yahoo))',
} as const;

function getPlatformColor(key: string): string {
  return (PLATFORM_COLORS as Record<string, string | undefined>)[key] ?? 'hsl(var(--muted-foreground))';
}

const PACING_STATUS_CONFIG: Record<PacingStatus, { labelKey: string; className: string; badgeClass: string }> = {
  normal: {
    labelKey: 'budgets.pacingNormal',
    className: 'bg-green-500',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  caution: {
    labelKey: 'budgets.pacingCaution',
    className: 'bg-yellow-500',
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  danger: {
    labelKey: 'budgets.pacingDanger',
    className: 'bg-red-500',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

// -- Subcomponents --

function MonthlyPacingSection({ pacing }: { pacing: MonthlyPacing }): React.ReactElement {
  const { t } = useI18n();
  const [adjusting, setAdjusting] = useState(false);
  const percentage = Math.round((pacing.spent / pacing.total) * 100);
  const statusConfig = PACING_STATUS_CONFIG[pacing.status];
  const formatYen = (v: number): string =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(v);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('budgets.monthlyPacing')}</h2>
        </div>
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusConfig.badgeClass)}>
          {t(statusConfig.labelKey)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-end justify-between">
          <p className="text-lg font-bold text-foreground">
            {formatYen(pacing.spent)}
            <span className="text-sm font-normal text-muted-foreground">
              {' '}/ {formatYen(pacing.total)} {t('budgets.spent')} ({percentage}%)
            </span>
          </p>
        </div>
        <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', statusConfig.className)}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </div>

      {/* Info row */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays size={12} />
            {t('budgets.daysRemaining')}
          </div>
          <p className="mt-1 text-lg font-bold text-foreground">{t('budgets.daysRemainingValue', { count: pacing.daysRemaining })}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp size={12} />
            {t('budgets.projectedMonthEnd')}
          </div>
          <p className="mt-1 text-lg font-bold text-foreground">{formatYen(pacing.projectedSpend)}</p>
          {pacing.projectedOverage > 0 && (
            <p className="mt-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
              {t('budgets.overageProjection', { percent: pacing.projectedOverage })}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center rounded-md bg-muted/50 p-3">
          <button
            type="button"
            disabled={adjusting}
            onClick={() => {
              setAdjusting(true);
              setTimeout(() => {
                setAdjusting(false);
                showToast(t('budgets.autoAdjustComplete'));
              }, 1500);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {adjusting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {t('budgets.autoAdjust')}
          </button>
        </div>
      </div>
    </div>
  );
}

function AllocationPieChart({ allocations }: { allocations: PlatformAllocation[] }): React.ReactElement {
  const data = allocations.map((a) => ({
    name: a.platform,
    value: a.current,
    color: a.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            color: 'hsl(var(--foreground))',
          }}
          formatter={(value: number) => `${(value / 1000).toFixed(0)}K`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  color: string;
  onChange: (value: number) => void;
}

function BudgetSlider({ label, value, min, max, color, onChange }: SliderProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className="text-sm font-semibold text-foreground">
          {(value / 1000).toFixed(0)}K
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={5000}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label={t('budgets.budgetForLabel', { label })}
      />
    </div>
  );
}

// -- Main Page --

export default function BudgetsPage(): React.ReactElement {
  const { t } = useI18n();
  const [isOptimizing, setIsOptimizing] = useState(false);

  // What-If simulator state
  const [simBudgets, setSimBudgets] = useState<Record<string, number>>({
    Google: 180000,
    Meta: 150000,
    TikTok: 80000,
    LINE: 60000,
    X: 25000,
    'Yahoo!': 15000,
  });

  const budgetQuery = trpc.budgets.current.useQuery(undefined, { retry: false });
  const historyQuery = trpc.budgets.history.useQuery({ limit: 14 }, { retry: false });
  const monthlyPacingQuery = trpc.budgets.monthlyPacing.useQuery(undefined, { retry: false });
  const orchestratorQuery = trpc.unifiedSpendOrchestrator.preview.useQuery(
    { lookbackHours: 24 },
    { retry: false, refetchOnWindowFocus: false },
  );

  // budgets.current returns a budgetAllocations row {allocations: Record<string,number>}.
  // Transform to PlatformAllocation[] for the pie chart.
  const allocations: PlatformAllocation[] = (() => {
    const raw = budgetQuery.data as
      | { allocations?: Record<string, number> }
      | PlatformAllocation[]
      | null
      | undefined;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    const map = raw.allocations ?? {};
    const LABELS: Record<string, keyof typeof PLATFORM_COLORS> = {
      meta: 'Meta',
      google: 'Google',
      tiktok: 'TikTok',
      line_yahoo: 'LINE',
      x: 'X',
      amazon: 'Yahoo!',
      microsoft: 'Yahoo!',
    };
    return Object.entries(map).map(([platform, amount]) => {
      const labelKey = LABELS[platform] ?? 'Meta';
      return {
        platform: labelKey,
        current: Number(amount) || 0,
        recommended: Number(amount) || 0,
        color: PLATFORM_COLORS[labelKey] ?? 'hsl(var(--muted-foreground))',
      };
    });
  })();
  const forecasts: ForecastEntry[] = [];
  const history = (historyQuery.data as HistoricalEntry[] | undefined) ?? [];
  // Adapt API shape { summary: { totalMonthlyBudget, totalSpentThisMonth,
  // projectedMonthEnd, overUnderProjection }, ... } → UI MonthlyPacing.
  const monthlyPacing: MonthlyPacing | null = (() => {
    const raw = monthlyPacingQuery.data as
      | {
          summary?: {
            totalMonthlyBudget?: number;
            totalSpentThisMonth?: number;
            projectedMonthEnd?: number;
            overUnderProjection?: number;
          };
        }
      | MonthlyPacing
      | undefined;
    if (!raw) return null;
    // Already in UI shape (has status)
    if ('status' in raw && typeof raw.status === 'string') {
      return raw as MonthlyPacing;
    }
    const s = (raw as { summary?: Record<string, number> }).summary;
    if (!s) return null;
    const total = Number(s.totalMonthlyBudget ?? 0);
    const spent = Number(s.totalSpentThisMonth ?? 0);
    const projected = Number(s.projectedMonthEnd ?? 0);
    const overUnder = Number(s.overUnderProjection ?? 0);
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysRemaining = Math.max(0, endOfMonth.getDate() - today.getDate());
    const projectedOverage = total > 0 ? (overUnder / total) * 100 : 0;
    const status: PacingStatus =
      projectedOverage > 10
        ? 'danger'
        : projectedOverage > 0
          ? 'caution'
          : 'normal';
    return {
      spent,
      total: total || 1,
      daysRemaining,
      projectedSpend: projected,
      projectedOverage: Math.round(Math.max(0, projectedOverage)),
      status,
    };
  })();
  const isLoading = budgetQuery.isLoading;

  const utils = trpc.useUtils();

  async function handleOptimize(): Promise<void> {
    setIsOptimizing(true);
    try {
      await utils.unifiedSpendOrchestrator.preview.invalidate();
    } finally {
      setIsOptimizing(false);
    }
  }

  function updateSimBudget(platform: string, value: number): void {
    setSimBudgets((prev) => ({ ...prev, [platform]: value }));
  }

  const totalSimBudget = Object.values(simBudgets).reduce((sum, v) => sum + v, 0);

  // Map platform key (UI label) → measured ROAS from orchestrator preview.
  // Keys used in simBudgets (Google / Meta / LINE / X / Yahoo!) don't match
  // the DB platform enum (google / meta / line_yahoo / x), so we normalize.
  const platformRoasMap: Record<string, number> = (() => {
    const map: Record<string, number> = {};
    const roasByDbKey: Record<string, number> = {};
    for (const p of orchestratorQuery.data?.platformROAS ?? []) {
      roasByDbKey[p.platform] = p.roas;
    }
    map['Google'] = roasByDbKey['google'] ?? 0;
    map['Meta'] = roasByDbKey['meta'] ?? 0;
    map['TikTok'] = roasByDbKey['tiktok'] ?? 0;
    map['LINE'] = roasByDbKey['line_yahoo'] ?? 0;
    map['X'] = roasByDbKey['x'] ?? 0;
    map['Yahoo!'] = roasByDbKey['line_yahoo'] ?? 0;
    return map;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analysis & Optimization"
        title={t('budgets.title')}
        description={t('budgets.description')}
        actions={
          <Button
            size="sm"
            onClick={handleOptimize}
            loading={isOptimizing}
            leadingIcon={!isOptimizing ? <Sparkles size={14} /> : undefined}
          >
            {t('budgets.runOptimization')}
          </Button>
        }
      />

      {/* Monthly pacing */}
      {monthlyPacing ? (
        <MonthlyPacingSection pacing={monthlyPacing} />
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      )}

      {/* Unified Spend Orchestrator — sole AI recommendation surface.
          The legacy "AI recommendation" panel was removed; SpendOrchestratorPanel
          is now the canonical source for proposed reallocations. */}
      <SpendOrchestratorPanel />

      {/* Causal lift experiments via holdout groups */}
      <HoldoutGroupsPanel />

      {/* Current allocation donut — read-only snapshot of the active split */}
      <div className="rounded-lg border border-border bg-card shadow-xs p-6">
        <h2 className="text-lg font-semibold text-foreground">{t('budgets.currentAllocation')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('budgets.channelAllocationStatus')}</p>
        {isLoading ? (
          <div className="mt-6 flex h-64 animate-pulse items-center justify-center rounded-md bg-muted/30">
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
        ) : (
          <div className="mt-4">
            <AllocationPieChart allocations={allocations} />
          </div>
        )}
      </div>

      {/* ROAS forecast */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-green-500" />
          <h2 className="text-lg font-semibold text-foreground">{t('budgets.roasForecast')}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('budgets.roasForecastDesc')}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">{t('campaigns.platform')}</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">{t('budgets.predictedRoas')}</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">{t('budgets.confidenceLow')}</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">{t('budgets.confidenceHigh')}</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">{t('budgets.confidenceLevel')}</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => {
                const spread = f.confidence.high - f.confidence.low;
                const confidenceWidth = Math.max(20, Math.min(100, (1 - spread / f.predictedRoas) * 100));
                return (
                  <tr key={f.platform} className="border-b border-border">
                    <td className="px-4 py-2 font-medium text-foreground">{f.platform}</td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">
                      {f.predictedRoas.toFixed(1)}x
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {f.confidence.low.toFixed(1)}x
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {f.confidence.high.toFixed(1)}x
                    </td>
                    <td className="px-4 py-2">
                      <div className="h-2 w-24 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-green-500"
                          style={{ width: `${confidenceWidth}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* What-If Simulator */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{t('budgets.whatIfSimulator')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('budgets.whatIfDescription')}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {Object.entries(simBudgets).map(([platform, value]) => (
              <BudgetSlider
                key={platform}
                label={platform}
                value={value}
                min={0}
                max={300000}
                color={getPlatformColor(platform)}
                onChange={(v) => updateSimBudget(platform, v)}
              />
            ))}
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t('budgets.totalBudget')}</span>
                <span className="text-lg font-bold text-foreground">
                  {(totalSimBudget / 1000).toFixed(0)}K
                </span>
              </div>
            </div>
          </div>

          <div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={Object.entries(simBudgets).map(([platform, value]) => ({
                  platform,
                  budget: value,
                  measuredRoas: platformRoasMap[platform] ?? 0,
                }))}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="platform" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis
                  yAxisId="budget"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis
                  yAxisId="roas"
                  orientation="right"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(v: number) => `${v.toFixed(1)}x`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: number, name: string) =>
                    name === 'budget' || name === t('budgets.budgetJpy')
                      ? `${(value / 1000).toFixed(0)}K`
                      : `${value.toFixed(2)}x`
                  }
                />
                <Legend />
                <Bar
                  yAxisId="budget"
                  dataKey="budget"
                  name={t('budgets.budgetJpy')}
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="roas"
                  type="monotone"
                  dataKey="measuredRoas"
                  name="ROAS (直近24h)"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Historical allocation timeline */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('budgets.allocationTrend')}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={history} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
              formatter={(value: number) => `${(value / 1000).toFixed(0)}K`}
            />
            <Legend />
            <Line type="monotone" dataKey="google" name="Google" stroke={PLATFORM_COLORS.Google} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="meta" name="Meta" stroke={PLATFORM_COLORS.Meta} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="tiktok" name="TikTok" stroke={PLATFORM_COLORS.TikTok} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="line" name="LINE" stroke={PLATFORM_COLORS.LINE} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="x" name="X" stroke={PLATFORM_COLORS.X} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="yahoo" name="Yahoo!" stroke={PLATFORM_COLORS['Yahoo!']} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
