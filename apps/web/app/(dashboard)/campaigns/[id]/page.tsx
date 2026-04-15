'use client';

import { useI18n } from '@/lib/i18n';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Copy,
  Edit3,
  Eye,
  Image,
  Inbox,
  Monitor,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  ShoppingCart,
  Smartphone,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, Button, PageHeader, Tabs } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

// ============================================================
// Types
// ============================================================

type TabId = 'overview' | 'creatives' | 'targeting' | 'history';
type MetricToggle = 'impressions' | 'clicks' | 'conversions' | 'spend';
type DateRange = 'last7' | 'last14' | 'last30';
type CampaignStatus = 'active' | 'paused' | 'draft' | 'completed';
type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';
type HistoryFilter = 'all' | 'manual' | 'automated';

interface PlatformSummary {
  platform: Platform;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cpa: number;
  spend: number;
  roas: number;
}

interface Creative {
  id: string;
  headline: string;
  performanceScore: number;
  platforms: Platform[];
}

interface TargetingConfig {
  age: string;
  gender: string[];
  regions: string[];
  interests: string[];
  devices: string[];
}

interface HistoryEntry {
  id: string;
  user: string;
  action: string;
  detail: string;
  timestamp: string;
  type: 'manual' | 'automated';
}

interface KpiCardData {
  label: string;
  value: string;
  subLabel?: string;
  subValue?: string;
  trend: number;
  icon: React.ReactNode;
  colorClass?: string;
}

interface TabDef {
  id: TabId;
  label: string;
}

// ============================================================
// Constants
// ============================================================

function getTabs(t: (key: string, params?: Record<string, string | number>) => string): TabDef[] {
  return [
  { id: 'overview', label: t('campaigns.id.h7f1b21') },
  { id: 'creatives', label: t('campaigns.id.hbd0154') },
  { id: 'targeting', label: t('campaigns.id.h40fee8') },
  { id: 'history', label: t('campaigns.id.h880de1') },
];
}

function getMetricToggles(t: (key: string, params?: Record<string, string | number>) => string): { key: MetricToggle; label: string; color: string }[] {
  return [
  { key: 'impressions', label: t('campaigns.id.h5b3de2'), color: 'hsl(221, 83%, 53%)' },
  { key: 'clicks', label: t('campaigns.id.h7c2317'), color: 'hsl(142, 71%, 45%)' },
  { key: 'conversions', label: t('campaigns.id.hf4533b'), color: 'hsl(262, 83%, 58%)' },
  { key: 'spend', label: t('campaigns.id.hb627b2'), color: 'hsl(25, 95%, 53%)' },
];
}

function getDateRangeOptions(t: (key: string, params?: Record<string, string | number>) => string): { value: DateRange; label: string }[] {
  return [
  { value: 'last7', label: t('campaigns.id.hcfd5b8') },
  { value: 'last14', label: t('campaigns.id.haea817') },
  { value: 'last30', label: t('campaigns.id.h9fc12b') },
];
}

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string }> = {
  meta: { label: 'Meta', color: 'bg-indigo-500' },
  google: { label: 'Google', color: 'bg-blue-500' },
  x: { label: 'X', color: 'bg-gray-700' },
  tiktok: { label: 'TikTok', color: 'bg-pink-500' },
  line_yahoo: { label: 'LINE/Yahoo', color: 'bg-green-500' },
  amazon: { label: 'Amazon', color: 'bg-orange-500' },
  microsoft: { label: 'Microsoft', color: 'bg-teal-500' },
};

type StatusVariant = 'success' | 'warning' | 'neutral' | 'info';

function getStatusConfig(t: (key: string, params?: Record<string, string | number>) => string): Record<CampaignStatus, { label: string; variant: StatusVariant }> {
  return {
    active: { label: t('campaigns.id.h3e1111'), variant: 'success' },
    paused: { label: t('campaigns.id.hb57e4b'), variant: 'warning' },
    draft: { label: t('campaigns.id.h228b8f'), variant: 'neutral' },
    completed: { label: t('campaigns.id.h6b2dfe'), variant: 'info' },
  };
}

function getObjectiveLabels(t: (key: string, params?: Record<string, string | number>) => string): Record<string, string> {
  return {
  conversion: t('campaigns.id.hf4533b'),
  awareness: t('campaigns.id.h685423'),
  traffic: t('campaigns.id.he11f0b'),
  leads: t('campaigns.id.h7079a7'),
};
}

function getHistoryFilterOptions(t: (key: string, params?: Record<string, string | number>) => string): { value: HistoryFilter; label: string }[] {
  return [
  { value: 'all', label: t('campaigns.id.hd97a88') },
  { value: 'manual', label: t('campaigns.id.h896b9c') },
  { value: 'automated', label: t('campaigns.id.hc9fdb3') },
];
}

// ============================================================
// Derived Types
// ============================================================

interface DailyTotal {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

// ============================================================
// Helpers
// ============================================================

function formatYen(value: number): string {

  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value);
}

function formatNumber(value: number): string {
  return value.toLocaleString('ja-JP');
}

function computeKpis(
  t: (key: string, params?: Record<string, string | number>) => string,
  summaries: PlatformSummary[],
): KpiCardData[] {
  const totals = summaries.reduce(
    (acc, s) => ({
      impressions: acc.impressions + s.impressions,
      clicks: acc.clicks + s.clicks,
      conversions: acc.conversions + s.conversions,
      spend: acc.spend + s.spend,
      // revenue is recovered from roas * spend
      revenue: acc.revenue + s.spend * s.roas,
    }),
    { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 },
  );

  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const cvr = totals.clicks > 0 ? totals.conversions / totals.clicks : 0;
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  return [
    {
      label: t('campaigns.id.h5b3de2'),
      value: formatNumber(totals.impressions),
      trend: 0,
      icon: <Eye size={20} className="text-blue-500" />,
    },
    {
      label: t('campaigns.id.h7c2317'),
      value: formatNumber(totals.clicks),
      subLabel: 'CTR',
      subValue: `${(ctr * 100).toFixed(2)}%`,
      trend: 0,
      icon: <MousePointerClick size={20} className="text-green-500" />,
    },
    {
      label: t('campaigns.id.hf4533b'),
      value: formatNumber(totals.conversions),
      subLabel: 'CVR',
      subValue: `${(cvr * 100).toFixed(2)}%`,
      trend: 0,
      icon: <ShoppingCart size={20} className="text-purple-500" />,
    },
    {
      label: t('campaigns.id.hb627b2'),
      value: formatYen(totals.spend),
      trend: 0,
      icon: <Wallet size={20} className="text-orange-500" />,
    },
    {
      label: t('campaigns.id.h718987'),
      value: formatYen(Math.round(totals.revenue)),
      trend: 0,
      icon: <TrendingUp size={20} className="text-emerald-500" />,
    },
    {
      label: 'ROAS',
      value: `${roas.toFixed(2)}x`,
      trend: 0,
      icon: <Target size={20} className="text-rose-500" />,
      colorClass: roas >= 3 ? 'text-green-600' : roas >= 1 ? 'text-yellow-600' : 'text-red-600',
    },
  ];
}

// ============================================================
// Sparkline
// ============================================================

function Sparkline({ data, color }: { data: number[]; color: string }): React.ReactElement {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="ml-2 inline-block" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function KpiCard({ card, dailyTotals }: { card: KpiCardData; dailyTotals: DailyTotal[] }): React.ReactElement {
  const { t } = useI18n();

  const isPositive = card.trend >= 0;
  const sparkData = dailyTotals.map((d) => {
    switch (card.label) {
      case t('campaigns.id.h5b3de2'): return d.impressions;
      case t('campaigns.id.h7c2317'): return d.clicks;
      case t('campaigns.id.hf4533b'): return d.conversions;
      case t('campaigns.id.hb627b2'): return d.spend;
      default: return d.impressions;
    }
  });

  const hasSparkData = sparkData.length > 1;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
        {card.icon}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <p className={cn('text-2xl font-bold text-foreground', card.colorClass)}>
          {card.value}
        </p>
        {hasSparkData && card.label !== 'ROAS' && card.label !== t('campaigns.id.h718987') && (
          <Sparkline data={sparkData} color={isPositive ? '#22c55e' : '#ef4444'} />
        )}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {card.trend !== 0 && (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp size={12} className="text-green-500" />
            ) : (
              <TrendingDown size={12} className="text-red-500" />
            )}
            <span className={cn('text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-600')}>
              {isPositive ? '+' : ''}{card.trend.toFixed(1)}%
            </span>
          </div>
        )}
        {card.subLabel && (
          <span className="text-xs text-muted-foreground">
            {card.subLabel}: {card.subValue}
          </span>
        )}
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: Platform }): React.ReactElement {
  const config = PLATFORM_CONFIG[platform];
  return (
    <span className={cn('inline-flex h-6 items-center rounded px-1.5 text-[10px] font-medium text-white', config.color)}>
      {config.label}
    </span>
  );
}

function PerformanceScoreBadge({ score }: { score: number }): React.ReactElement {
  const { t } = useI18n();
  const colorClass = score >= 85
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : score >= 60
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}>
      {t('campaignDetail.scorePoints', { score: String(score) })}
    </span>
  );
}

// ============================================================
// Tab Content Components
// ============================================================

function OverviewTab({
  selectedMetrics,
  onToggleMetric,
  dateRange,
  onDateRangeChange,
  platformSummaries,
  dailyTotals,
}: {
  selectedMetrics: Set<MetricToggle>;
  onToggleMetric: (metric: MetricToggle) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  platformSummaries: PlatformSummary[];
  dailyTotals: DailyTotal[];
}): React.ReactElement {
  const { t } = useI18n();
  const platformSpendData = platformSummaries.map((p) => ({
    platform: PLATFORM_CONFIG[p.platform].label,
    spend: p.spend,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {computeKpis(t, platformSummaries).map((kpi) => (
          <KpiCard key={kpi.label} card={kpi} dailyTotals={dailyTotals} />
        ))}
      </div>

      {/* Performance Chart */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-foreground">{t('campaignDetail.performanceTrend')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {getMetricToggles(t).map((mt) => (
              <button
                key={mt.key}
                type="button"
                onClick={() => onToggleMetric(mt.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedMetrics.has(mt.key)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {mt.label}
              </button>
            ))}
            <div className="flex gap-1 rounded-md border border-border p-0.5">
              {getDateRangeOptions(t).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onDateRangeChange(opt.value)}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium transition-colors',
                    dateRange === opt.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {dailyTotals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Inbox size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={dailyTotals} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
              formatter={(value: number) => value.toLocaleString('ja-JP')}
            />
            <Legend />
            {getMetricToggles(t).filter((mt) => selectedMetrics.has(mt.key)).map((mt) => (
              <Line
                key={mt.key}
                type="monotone"
                dataKey={mt.key}
                name={mt.label}
                stroke={mt.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Platform Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{t('campaignDetail.platformBreakdown')}</h3>

        {platformSummaries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12 text-center">
            <Inbox size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </div>
        ) : (
          <>
        {/* Horizontal bar chart */}
        <div className="rounded-lg border border-border bg-card p-6">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={platformSpendData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis
                type="number"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
              />
              <YAxis
                dataKey="platform"
                type="category"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number) => formatYen(value)}
              />
              <Bar dataKey="spend" name={t('campaigns.id.hb627b2')} fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Platform table */}
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('campaignDetail.thPlatform')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('campaignDetail.thImpressions')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('campaignDetail.thClicks')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">CTR</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">CV</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">CPA</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {platformSummaries.map((row) => (
                <tr key={row.platform} className="border-b border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <PlatformBadge platform={row.platform} />
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.impressions)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.clicks)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{(row.ctr * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatNumber(row.conversions)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatYen(Math.round(row.cpa))}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'font-semibold',
                      row.roas >= 3 ? 'text-green-600' : row.roas >= 1 ? 'text-yellow-600' : 'text-red-600',
                    )}>
                      {row.roas.toFixed(2)}x
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

function CreativesTab({ creatives }: { creatives: Creative[] }): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {t('campaignDetail.creativesCount', { count: String(creatives.length) })}
        </h3>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={16} />
          {t('campaigns.id.ha22bdb')}
        </button>
      </div>
      {creatives.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {creatives.map((creative) => (
          <div key={creative.id} className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md">
            {/* Thumbnail placeholder */}
            <div className="mb-3 flex h-36 items-center justify-center rounded-md bg-muted/50">
              <Image size={32} className="text-muted-foreground/40" />
            </div>
            <h4 className="text-sm font-medium text-foreground">{creative.headline}</h4>
            <div className="mt-2 flex items-center justify-between">
              <PerformanceScoreBadge score={creative.performanceScore} />
              <div className="flex gap-1">
                {creative.platforms.map((p) => (
                  <PlatformBadge key={p} platform={p} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function TargetingTab({ targeting }: { targeting: TargetingConfig | null }): React.ReactElement {
  const { t } = useI18n();

  if (!targeting) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{t('campaignDetail.targetingSettings')}</h3>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Edit3 size={16} />
            {t('campaigns.id.h5a18d1')}
          </button>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      </div>
    );
  }

  const sections: { label: string; values: string[]; icon: React.ReactNode }[] = [
    { label: t('campaigns.id.h26de11'), values: [targeting.age], icon: <Target size={16} /> },
    { label: t('campaigns.id.h428895'), values: targeting.gender, icon: <Target size={16} /> },
    { label: t('campaigns.id.h4d7d44'), values: targeting.regions, icon: <Target size={16} /> },
    { label: t('campaigns.id.ha96ae1'), values: targeting.interests, icon: <Zap size={16} /> },
    { label: t('campaigns.id.h169d8b'), values: targeting.devices, icon: targeting.devices.includes(t('campaigns.id.h74cc8d')) ? <Smartphone size={16} /> : <Monitor size={16} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{t('campaignDetail.targetingSettings')}</h3>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Edit3 size={16} />
          {t('campaigns.id.h5a18d1')}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <div key={section.label} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {section.icon}
              {section.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {section.values.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ history }: { history: HistoryEntry[] }): React.ReactElement {
  const { t } = useI18n();
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const filteredHistory = filter === 'all'
    ? history
    : history.filter((h) => h.type === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{t('campaignDetail.changeHistoryTitle')}</h3>
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {getHistoryFilterOptions(t).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                filter === opt.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{history.length === 0 ? t('common.noData') : t('campaignDetail.noMatchingHistory')}</p>
        </div>
      ) : (
        <div className="space-y-0">
          {filteredHistory.map((entry, index) => (
            <div
              key={entry.id}
              className="relative flex gap-4 pb-6"
            >
              {/* Timeline line */}
              {index < filteredHistory.length - 1 && (
                <div className="absolute left-[11px] top-6 h-full w-px bg-border" />
              )}
              {/* Dot */}
              <div className={cn(
                'mt-1 h-6 w-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center',
                entry.type === 'automated'
                  ? 'border-purple-400 bg-purple-100 dark:border-purple-500 dark:bg-purple-900/30'
                  : 'border-blue-400 bg-blue-100 dark:border-blue-500 dark:bg-blue-900/30',
              )}>
                {entry.type === 'automated' ? (
                  <Zap size={10} className="text-purple-600 dark:text-purple-400" />
                ) : (
                  <Edit3 size={10} className="text-blue-600 dark:text-blue-400" />
                )}
              </div>
              {/* Content */}
              <div className="flex-1 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{entry.user}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {entry.action}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{entry.timestamp}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function CampaignDetailPage(): React.ReactElement {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricToggle>>(
    new Set(['impressions', 'clicks']),
  );
  const [dateRange, setDateRange] = useState<DateRange>('last14');

  const campaignId = params.id ?? '';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidId = uuidRegex.test(campaignId);

  const campaignQuery = trpc.campaigns.get.useQuery(
    { id: campaignId },
    { enabled: isValidId, retry: false },
  );

  interface CampaignData {
    id: string;
    name: string;
    status: CampaignStatus;
    objective: string;
    budget?: number;
    dailyLimit?: number;
  }

  const campaignData = campaignQuery.data as CampaignData | undefined;
  const campaign: CampaignData = campaignData ?? {
    id: campaignId,
    name: t('common.noData'),
    status: 'draft',
    objective: 'conversion',
  };

  // Placeholders for data not yet wired to API. When wired, swap to actual
  // tRPC queries (e.g. trpc.analytics.byCampaign) and pass results below.
  const platformSummaries: PlatformSummary[] = [];
  const dailyTotals: DailyTotal[] = [];
  const creatives: Creative[] = [];
  const targeting: TargetingConfig | null = null;
  const history: HistoryEntry[] = [];

  const status = getStatusConfig(t)[campaign.status];
  const objectiveLabel = getObjectiveLabels(t)[campaign.objective] ?? campaign.objective;

  function handleToggleMetric(metric: MetricToggle): void {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metric)) {
        if (next.size > 1) next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <a
            href="/campaigns"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} />
            {t('campaigns.id.h36486b')}
          </a>
        }
        title={
          <span className="inline-flex items-center gap-3">
            {campaign.name}
            <Badge variant={status.variant} size="md" dot={campaign.status === 'active'}>
              {status.label}
            </Badge>
            <Badge variant="primary" size="md">
              {objectiveLabel}
            </Badge>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" leadingIcon={<Edit3 size={14} />}>
              {t('campaigns.id.h757886')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={campaign.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
              className={campaign.status === 'active' ? 'text-warning hover:bg-warning/10' : 'text-success hover:bg-success/10'}
            >
              {campaign.status === 'active' ? t('campaigns.id.hb57e4b') : t('campaigns.id.h3fade1')}
            </Button>
            <Button variant="secondary" size="sm" leadingIcon={<Copy size={14} />}>
              {t('campaigns.id.h1fde1c')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Trash2 size={14} />}
              className="text-destructive hover:bg-destructive/10"
            >
              {t('campaigns.id.hc6577c')}
            </Button>
          </>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(k) => setActiveTab(k as typeof activeTab)}
        items={getTabs(t).map((tab) => ({
          key: tab.id,
          label: tab.label,
        }))}
      />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          selectedMetrics={selectedMetrics}
          onToggleMetric={handleToggleMetric}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          platformSummaries={platformSummaries}
          dailyTotals={dailyTotals}
        />
      )}
      {activeTab === 'creatives' && <CreativesTab creatives={creatives} />}
      {activeTab === 'targeting' && <TargetingTab targeting={targeting} />}
      {activeTab === 'history' && <HistoryTab history={history} />}
    </div>
  );
}
