'use client';

import { useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Gauge,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';

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

const PLATFORM_COLORS = {
  Google: '#4285F4',
  Meta: '#6366F1',
  TikTok: '#EC4899',
  LINE: '#06C755',
  X: '#374151',
  'Yahoo!': '#EF4444',
} as const;

function getPlatformColor(key: string): string {
  return (PLATFORM_COLORS as Record<string, string | undefined>)[key] ?? '#6B7280';
}

const MOCK_ALLOCATIONS: PlatformAllocation[] = [
  { platform: 'Google', current: 180000, recommended: 210000, color: PLATFORM_COLORS['Google'] },
  { platform: 'Meta', current: 150000, recommended: 170000, color: PLATFORM_COLORS['Meta'] },
  { platform: 'TikTok', current: 80000, recommended: 60000, color: PLATFORM_COLORS['TikTok'] },
  { platform: 'LINE', current: 60000, recommended: 45000, color: PLATFORM_COLORS['LINE'] },
  { platform: 'X', current: 25000, recommended: 15000, color: PLATFORM_COLORS['X'] },
  { platform: 'Yahoo!', current: 15000, recommended: 10000, color: PLATFORM_COLORS['Yahoo!'] },
];

const MOCK_FORECASTS: ForecastEntry[] = [
  { platform: 'Google', predictedRoas: 4.2, confidence: { low: 3.6, high: 4.8 } },
  { platform: 'Meta', predictedRoas: 3.8, confidence: { low: 3.1, high: 4.5 } },
  { platform: 'TikTok', predictedRoas: 2.5, confidence: { low: 1.8, high: 3.2 } },
  { platform: 'LINE', predictedRoas: 2.1, confidence: { low: 1.5, high: 2.7 } },
  { platform: 'X', predictedRoas: 1.6, confidence: { low: 1.0, high: 2.2 } },
  { platform: 'Yahoo!', predictedRoas: 1.9, confidence: { low: 1.3, high: 2.5 } },
];

const MOCK_HISTORY: HistoricalEntry[] = Array.from({ length: 14 }, (_, i) => {
  const date = new Date(2026, 2, 19 + i);
  return {
    date: `${date.getMonth() + 1}/${date.getDate()}`,
    google: 170000 + Math.random() * 20000,
    meta: 140000 + Math.random() * 20000,
    tiktok: 70000 + Math.random() * 20000,
    line: 55000 + Math.random() * 10000,
    x: 20000 + Math.random() * 10000,
    yahoo: 12000 + Math.random() * 6000,
  };
});

const MOCK_MONTHLY_PACING: MonthlyPacing = {
  spent: 2340000,
  total: 3000000,
  daysRemaining: 8,
  projectedSpend: 3150000,
  projectedOverage: 5,
  status: 'caution',
};

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

function AllocationDiffTable({ allocations }: { allocations: PlatformAllocation[] }): React.ReactElement {
  return (
    <div className="space-y-3">
      {allocations.map((a) => {
        const diff = a.recommended - a.current;
        const pctChange = ((diff / a.current) * 100).toFixed(1);
        const isPositive = diff >= 0;
        return (
          <div key={a.platform} className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: a.color }} />
            <span className="w-16 text-sm font-medium text-foreground">{a.platform}</span>
            <span className="w-16 text-right text-sm text-muted-foreground">
              {(a.current / 1000).toFixed(0)}K
            </span>
            <ArrowRight size={14} className="text-muted-foreground" />
            <span className="w-16 text-right text-sm font-medium text-foreground">
              {(a.recommended / 1000).toFixed(0)}K
            </span>
            <span
              className={cn(
                'ml-auto text-xs font-medium',
                isPositive ? 'text-green-600' : 'text-red-600',
              )}
            >
              {isPositive ? '+' : ''}{pctChange}%
            </span>
          </div>
        );
      })}
    </div>
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
        aria-label={`${label}の予算`}
      />
    </div>
  );
}

// -- Main Page --

export default function BudgetsPage(): React.ReactElement {
  const { t } = useI18n();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);

  // What-If simulator state
  const [simBudgets, setSimBudgets] = useState<Record<string, number>>({
    Google: 180000,
    Meta: 150000,
    TikTok: 80000,
    LINE: 60000,
    X: 25000,
    'Yahoo!': 15000,
  });

  // tRPC hooks (with graceful fallback)
  const budgetQuery = trpc.budgets.current.useQuery(undefined, { retry: false });

  const allocations = budgetQuery.error
    ? MOCK_ALLOCATIONS
    : (budgetQuery.data as PlatformAllocation[] | undefined) ?? MOCK_ALLOCATIONS;
  const forecasts = MOCK_FORECASTS;
  const history = MOCK_HISTORY;
  const isLoading = budgetQuery.isLoading && !budgetQuery.error;

  function handleOptimize(): void {
    setIsOptimizing(true);
    // Simulate optimization delay
    setTimeout(() => {
      setIsOptimizing(false);
      setShowRecommendation(true);
    }, 2000);
  }

  function updateSimBudget(platform: string, value: number): void {
    setSimBudgets((prev) => ({ ...prev, [platform]: value }));
  }

  const totalSimBudget = Object.values(simBudgets).reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('budgets.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('budgets.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {isOptimizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {t('budgets.runOptimization')}
        </button>
      </div>

      {/* Monthly pacing */}
      <MonthlyPacingSection pacing={MOCK_MONTHLY_PACING} />

      {/* Current allocation + AI recommendation */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Current allocation donut */}
        <div className="rounded-lg border border-border bg-card p-6">
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

        {/* AI recommendation panel */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t('budgets.aiRecommendation')}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('budgets.performanceBasedOptimal')}
          </p>
          {!showRecommendation ? (
            <div className="mt-6 flex h-64 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Gauge size={48} className="text-muted-foreground/30" />
                <p className="text-sm">{t('budgets.runToSeeRecommendation')}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <AllocationDiffTable allocations={allocations} />
              <div className="mt-4 rounded-md bg-primary/5 p-3">
                <p className="text-sm font-medium text-primary">{t('budgets.aiAnalysisResult')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('budgets.aiAnalysisDetail')}
                </p>
              </div>
            </div>
          )}
        </div>
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
              <BarChart
                data={Object.entries(simBudgets).map(([platform, value]) => ({
                  platform,
                  budget: value,
                  predictedRoas: forecasts.find((f) => f.platform === platform)?.predictedRoas ?? 0,
                }))}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="platform" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: number, name: string) =>
                    name === 'budget' ? `${(value / 1000).toFixed(0)}K` : `${value.toFixed(1)}x`
                  }
                />
                <Legend />
                <Bar dataKey="budget" name={t('budgets.budgetJpy')} fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
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
