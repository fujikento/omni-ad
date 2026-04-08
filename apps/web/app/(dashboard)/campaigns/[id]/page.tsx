'use client';

import { useI18n } from '@/lib/i18n';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  Image,
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
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type TabId = 'overview' | 'creatives' | 'targeting' | 'history';
type MetricToggle = 'impressions' | 'clicks' | 'conversions' | 'spend';
type DateRange = 'last7' | 'last14' | 'last30';
type CampaignStatus = 'active' | 'paused' | 'draft' | 'completed';
type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';
type HistoryFilter = 'all' | 'manual' | 'automated';

interface DailyMetric {
  date: string;
  platform: Platform;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
}

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

function getStatusConfig(t: (key: string, params?: Record<string, string | number>) => string): Record<CampaignStatus, { label: string; className: string }> {
  return {
  active: { label: t('campaigns.id.h3e1111'), className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  paused: { label: t('campaigns.id.hb57e4b'), className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  draft: { label: t('campaigns.id.h228b8f'), className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  completed: { label: t('campaigns.id.h6b2dfe'), className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
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
// Mock Data
// ============================================================

function getCampaignData(t: (key: string, params?: Record<string, string | number>) => string) {
  return {
  id: '1',
  name: t('campaigns.id.hc6f094'),
  status: 'active' as CampaignStatus,
  objective: 'conversion',
  budget: 500000,
  dailyLimit: 50000,
};
}

function generateDailyMetrics(): DailyMetric[] {
  const platforms: Platform[] = ['meta', 'google', 'tiktok'];
  const metrics: DailyMetric[] = [];
  const baseDate = new Date(2026, 2, 20);

  for (let day = 0; day < 14; day++) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + day);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

    for (const platform of platforms) {
      const multiplier = platform === 'google' ? 1.2 : platform === 'meta' ? 1.0 : 0.7;
      const dayVariance = 0.8 + Math.sin(day / 3) * 0.3 + (day % 3) * 0.05;

      metrics.push({
        date: dateStr,
        platform,
        impressions: Math.round(8000 * multiplier * dayVariance),
        clicks: Math.round(320 * multiplier * dayVariance),
        conversions: Math.round(12 * multiplier * dayVariance),
        spend: Math.round(3500 * multiplier * dayVariance),
        revenue: Math.round(12000 * multiplier * dayVariance),
      });
    }
  }
  return metrics;
}

const MOCK_DAILY_METRICS = generateDailyMetrics();

function aggregateDailyTotals(): { date: string; impressions: number; clicks: number; conversions: number; spend: number }[] {
  const byDate = new Map<string, { impressions: number; clicks: number; conversions: number; spend: number }>();

  for (const m of MOCK_DAILY_METRICS) {
    const existing = byDate.get(m.date) ?? { impressions: 0, clicks: 0, conversions: 0, spend: 0 };
    existing.impressions += m.impressions;
    existing.clicks += m.clicks;
    existing.conversions += m.conversions;
    existing.spend += m.spend;
    byDate.set(m.date, existing);
  }

  return Array.from(byDate.entries()).map(([date, vals]) => ({ date, ...vals }));
}

const MOCK_DAILY_TOTALS = aggregateDailyTotals();

function computePlatformSummaries(): PlatformSummary[] {
  const platforms: Platform[] = ['meta', 'google', 'tiktok'];
  return platforms.map((platform) => {
    const rows = MOCK_DAILY_METRICS.filter((m) => m.platform === platform);
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const conversions = rows.reduce((s, r) => s + r.conversions, 0);
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    return {
      platform,
      impressions,
      clicks,
      ctr: clicks / impressions,
      conversions,
      cpa: conversions > 0 ? spend / conversions : 0,
      spend,
      roas: spend > 0 ? revenue / spend : 0,
    };
  });
}

function getMockPlatformSummaries(): PlatformSummary[] {
  return computePlatformSummaries();
}

function getMockCreatives(t: (key: string, params?: Record<string, string | number>) => string): Creative[] {
  return [
  { id: 'c1', headline: t('campaigns.id.h4b9984'), performanceScore: 92, platforms: ['meta', 'google'] },
  { id: 'c2', headline: t('campaigns.id.h0b3741'), performanceScore: 78, platforms: ['tiktok', 'meta'] },
  { id: 'c3', headline: t('campaigns.id.hfb3ecd'), performanceScore: 85, platforms: ['google'] },
];
}

function getMockTargeting(t: (key: string, params?: Record<string, string | number>) => string): TargetingConfig {
  return {
  age: '25-55',
  gender: [t('campaigns.id.hcd9fc0'), t('campaigns.id.h188e06')],
  regions: [t('campaigns.id.h707ba1'), t('campaigns.id.hd94e2b'), t('campaigns.id.h20b7eb')],
  interests: [t('campaigns.id.h081747'), t('campaigns.id.hb93315')],
  devices: [t('campaigns.id.h74cc8d'), t('campaigns.id.h042cd2')],
};
}

function getMockHistory(t: (key: string, params?: Record<string, string | number>) => string): HistoryEntry[] {
  return [
  { id: 'h1', user: t('campaigns.id.ha2aa03'), action: t('campaigns.id.h922ccc'), detail: t('campaigns.id.h8c7a0e'), timestamp: '2026/04/01 15:30', type: 'manual' },
  { id: 'h2', user: t('campaigns.id.he8c8ca'), action: t('campaigns.id.h5b6d21'), detail: t('campaigns.id.h84a1fe'), timestamp: '2026/04/01 12:00', type: 'automated' },
  { id: 'h3', user: t('campaigns.id.hcef95e'), action: t('campaigns.id.hd937aa'), detail: t('campaigns.id.he6540b'), timestamp: '2026/03/31 16:45', type: 'manual' },
  { id: 'h4', user: t('campaigns.id.he8c8ca'), action: t('campaigns.id.ha8d176'), detail: t('campaigns.id.hf3a4a2'), timestamp: '2026/03/31 09:00', type: 'automated' },
  { id: 'h5', user: t('campaigns.id.ha2aa03'), action: t('campaigns.id.h2b2764'), detail: t('campaigns.id.h42a300'), timestamp: '2026/03/30 10:00', type: 'manual' },
  { id: 'h6', user: t('campaigns.id.he8c8ca'), action: t('campaigns.id.h02b47e'), detail: t('campaigns.id.heb890c'), timestamp: '2026/03/29 18:00', type: 'automated' },
  { id: 'h7', user: t('campaigns.id.hcef95e'), action: t('campaigns.id.h36d8aa'), detail: t('campaigns.id.h750f4a'), timestamp: '2026/03/29 14:30', type: 'manual' },
  { id: 'h8', user: t('campaigns.id.he8c8ca'), action: t('campaigns.id.h00caa9'), detail: 'Meta: 40% → 35%, Google: 35% → 40%, TikTok: 25% → 25%', timestamp: '2026/03/28 12:00', type: 'automated' },
  { id: 'h9', user: t('campaigns.id.ha2aa03'), action: t('campaigns.id.h216423'), detail: t('campaigns.id.h51f5cc'), timestamp: '2026/03/27 11:00', type: 'manual' },
  { id: 'h10', user: t('campaigns.id.ha2aa03'), action: t('campaigns.id.h08f9fa'), detail: t('campaigns.id.h89dab2'), timestamp: '2026/03/25 09:00', type: 'manual' },
];
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

function computeKpis(t: (key: string, params?: Record<string, string | number>) => string): KpiCardData[] {
  const totals = MOCK_DAILY_METRICS.reduce(
    (acc, m) => ({
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      spend: acc.spend + m.spend,
      revenue: acc.revenue + m.revenue,
    }),
    { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 },
  );

  const ctr = totals.clicks / totals.impressions;
  const cvr = totals.conversions / totals.clicks;
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  return [
    {
      label: t('campaigns.id.h5b3de2'),
      value: formatNumber(totals.impressions),
      trend: 12.5,
      icon: <Eye size={20} className="text-blue-500" />,
    },
    {
      label: t('campaigns.id.h7c2317'),
      value: formatNumber(totals.clicks),
      subLabel: 'CTR',
      subValue: `${(ctr * 100).toFixed(2)}%`,
      trend: 8.3,
      icon: <MousePointerClick size={20} className="text-green-500" />,
    },
    {
      label: t('campaigns.id.hf4533b'),
      value: formatNumber(totals.conversions),
      subLabel: 'CVR',
      subValue: `${(cvr * 100).toFixed(2)}%`,
      trend: -3.2,
      icon: <ShoppingCart size={20} className="text-purple-500" />,
    },
    {
      label: t('campaigns.id.hb627b2'),
      value: formatYen(totals.spend),
      trend: 5.1,
      icon: <Wallet size={20} className="text-orange-500" />,
    },
    {
      label: t('campaigns.id.h718987'),
      value: formatYen(totals.revenue),
      trend: 15.4,
      icon: <TrendingUp size={20} className="text-emerald-500" />,
    },
    {
      label: 'ROAS',
      value: `${roas.toFixed(2)}x`,
      trend: 10.2,
      icon: <Target size={20} className="text-rose-500" />,
      colorClass: roas >= 3 ? 'text-green-600' : roas >= 1 ? 'text-yellow-600' : 'text-red-600',
    },
  ];
}

// KPIs computed inside component via t()

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

function KpiCard({ card }: { card: KpiCardData }): React.ReactElement {
  const { t } = useI18n();

  const isPositive = card.trend >= 0;
  const sparkData = MOCK_DAILY_TOTALS.map((d) => {
    switch (card.label) {
      case t('campaigns.id.h5b3de2'): return d.impressions;
      case t('campaigns.id.h7c2317'): return d.clicks;
      case t('campaigns.id.hf4533b'): return d.conversions;
      case t('campaigns.id.hb627b2'): return d.spend;
      default: return d.impressions;
    }
  });

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
        {card.label !== 'ROAS' && card.label !== t('campaigns.id.h718987') && (
          <Sparkline data={sparkData} color={isPositive ? '#22c55e' : '#ef4444'} />
        )}
      </div>
      <div className="mt-1 flex items-center gap-2">
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
}: {
  selectedMetrics: Set<MetricToggle>;
  onToggleMetric: (metric: MetricToggle) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const platformSpendData = getMockPlatformSummaries().map((p) => ({
    platform: PLATFORM_CONFIG[p.platform].label,
    spend: p.spend,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {computeKpis(t).map((kpi) => (
          <KpiCard key={kpi.label} card={kpi} />
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
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={MOCK_DAILY_TOTALS} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
      </div>

      {/* Platform Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{t('campaignDetail.platformBreakdown')}</h3>

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
              {getMockPlatformSummaries().map((row) => (
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
      </div>
    </div>
  );
}

function CreativesTab(): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {t('campaignDetail.creativesCount', { count: String(getMockCreatives(t).length) })}
        </h3>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={16} />
          {t('campaigns.id.ha22bdb')}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {getMockCreatives(t).map((creative) => (
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
    </div>
  );
}

function TargetingTab(): React.ReactElement {
  const { t } = useI18n();
  const sections: { label: string; values: string[]; icon: React.ReactNode }[] = [
    { label: t('campaigns.id.h26de11'), values: [getMockTargeting(t).age], icon: <Target size={16} /> },
    { label: t('campaigns.id.h428895'), values: getMockTargeting(t).gender, icon: <Target size={16} /> },
    { label: t('campaigns.id.h4d7d44'), values: getMockTargeting(t).regions, icon: <Target size={16} /> },
    { label: t('campaigns.id.ha96ae1'), values: getMockTargeting(t).interests, icon: <Zap size={16} /> },
    { label: t('campaigns.id.h169d8b'), values: getMockTargeting(t).devices, icon: getMockTargeting(t).devices.includes(t('campaigns.id.h74cc8d')) ? <Smartphone size={16} /> : <Monitor size={16} /> },
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

function HistoryTab(): React.ReactElement {
  const { t } = useI18n();
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const filteredHistory = filter === 'all'
    ? getMockHistory(t)
    : getMockHistory(t).filter((h) => h.type === filter);

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
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">{t('campaignDetail.noMatchingHistory')}</p>
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

  // In production this would fetch by params.id via tRPC
  const campaignId = params.id;
  const campaign = { ...getCampaignData(t), id: campaignId ?? getCampaignData(t).id };
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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label={t('campaigns.id.h983134')}>
        <a href="/campaigns" className="flex items-center gap-1 transition-colors hover:text-foreground">
          <ArrowLeft size={14} />
          {t('campaigns.id.h36486b')}
        </a>
        <ChevronRight size={14} />
        <span className="font-medium text-foreground">{campaign.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {campaign.name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', status.className)}>
              {status.label}
            </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {objectiveLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Edit3 size={14} />
            {t('campaigns.id.h757886')}
          </button>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
              campaign.status === 'active'
                ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-400 dark:hover:bg-yellow-900/20'
                : 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20',
            )}
          >
            {campaign.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
            {campaign.status === 'active' ? t('campaigns.id.hb57e4b') : t('campaigns.id.h3fade1')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Copy size={14} />
            {t('campaigns.id.h1fde1c')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 size={14} />
            {t('campaigns.id.hc6577c')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6" aria-label={t('campaigns.id.h77725b')}>
          {getTabs(t).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 pb-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          selectedMetrics={selectedMetrics}
          onToggleMetric={handleToggleMetric}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      )}
      {activeTab === 'creatives' && <CreativesTab />}
      {activeTab === 'targeting' && <TargetingTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}
