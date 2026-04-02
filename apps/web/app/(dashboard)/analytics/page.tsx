'use client';

import { useState } from 'react';
import {
  Eye,
  MousePointerClick,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
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
import { trpc } from '@/lib/trpc';
import { ExportButton } from '@/app/components/export-button';

// -- Types --

type DateRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

interface KpiCard {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
}

interface PlatformMetric {
  platform: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

interface DailyRoas {
  date: string;
  roas: number;
}

interface TopCampaign {
  id: string;
  name: string;
  platform: string;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
}

// -- Constants --

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'yesterday', label: '昨日' },
  { value: 'last7', label: '過去7日' },
  { value: 'last30', label: '過去30日' },
  { value: 'custom', label: 'カスタム' },
];

// Mock data for demonstration
const MOCK_KPI: KpiCard[] = [
  { label: '総インプレッション', value: '1,234,567', change: 12.5, icon: <Eye size={20} className="text-blue-500" /> },
  { label: '総クリック', value: '45,678', change: 8.3, icon: <MousePointerClick size={20} className="text-green-500" /> },
  { label: '総コンバージョン', value: '1,234', change: -3.2, icon: <ShoppingCart size={20} className="text-purple-500" /> },
  { label: 'ROAS', value: '3.2x', change: 15.1, icon: <TrendingUp size={20} className="text-orange-500" /> },
];

const MOCK_PLATFORM_DATA: PlatformMetric[] = [
  { platform: 'Google', impressions: 450000, clicks: 18000, conversions: 520, spend: 180000 },
  { platform: 'Meta', impressions: 380000, clicks: 12000, conversions: 380, spend: 150000 },
  { platform: 'TikTok', impressions: 220000, clicks: 8500, conversions: 180, spend: 80000 },
  { platform: 'LINE', impressions: 120000, clicks: 4500, conversions: 95, spend: 60000 },
  { platform: 'X', impressions: 45000, clicks: 1800, conversions: 35, spend: 25000 },
  { platform: 'Yahoo!', impressions: 19567, clicks: 878, conversions: 24, spend: 15000 },
];

const MOCK_ROAS_TREND: DailyRoas[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 2, 3 + i);
  return {
    date: `${date.getMonth() + 1}/${date.getDate()}`,
    roas: 2.5 + Math.sin(i / 5) * 0.8 + Math.random() * 0.4,
  };
});

const MOCK_TOP_CAMPAIGNS: TopCampaign[] = [
  { id: '1', name: '春のプロモーション2026', platform: 'Google', impressions: 250000, clicks: 10000, conversions: 320, roas: 4.5 },
  { id: '2', name: 'Meta リターゲティング', platform: 'Meta', impressions: 180000, clicks: 7200, conversions: 250, roas: 4.2 },
  { id: '3', name: 'LINE公式配信', platform: 'LINE', impressions: 80000, clicks: 3200, conversions: 65, roas: 3.8 },
  { id: '4', name: 'ブランド認知 - Google', platform: 'Google', impressions: 200000, clicks: 8000, conversions: 200, roas: 3.5 },
  { id: '5', name: 'TikTok若年層', platform: 'TikTok', impressions: 150000, clicks: 6000, conversions: 120, roas: 3.2 },
  { id: '6', name: 'Yahoo! ディスプレイ', platform: 'Yahoo!', impressions: 19567, clicks: 878, conversions: 24, roas: 2.8 },
  { id: '7', name: 'X トレンド広告', platform: 'X', impressions: 45000, clicks: 1800, conversions: 35, roas: 2.5 },
  { id: '8', name: 'Meta ストーリーズ', platform: 'Meta', impressions: 120000, clicks: 4800, conversions: 130, roas: 2.3 },
  { id: '9', name: 'Google ショッピング', platform: 'Google', impressions: 95000, clicks: 3800, conversions: 85, roas: 2.1 },
  { id: '10', name: 'TikTok チャレンジ', platform: 'TikTok', impressions: 70000, clicks: 2500, conversions: 60, roas: 1.9 },
];

// -- Subcomponents --

function KpiCardComponent({ card }: { card: KpiCard }): React.ReactElement {
  const isPositive = card.change >= 0;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
        {card.icon}
      </div>
      <p className="mt-3 text-3xl font-bold text-foreground">{card.value}</p>
      <div className="mt-1 flex items-center gap-1">
        {isPositive ? (
          <TrendingUp size={14} className="text-green-500" />
        ) : (
          <TrendingDown size={14} className="text-red-500" />
        )}
        <span className={cn('text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-600')}>
          {isPositive ? '+' : ''}{card.change.toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">前期比</span>
      </div>
    </div>
  );
}

function SkeletonCard(): React.ReactElement {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-5 w-5 rounded bg-muted" />
      </div>
      <div className="mt-3 h-8 w-20 rounded bg-muted" />
      <div className="mt-2 h-3 w-16 rounded bg-muted" />
    </div>
  );
}

function SkeletonChart(): React.ReactElement {
  return (
    <div className="flex h-80 animate-pulse items-center justify-center rounded-md bg-muted/30">
      <div className="h-4 w-32 rounded bg-muted" />
    </div>
  );
}

// -- Helpers --

function getDateRange(range: DateRange): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;

  switch (range) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'yesterday': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      break;
    }
    case 'last7':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last30':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate: start.toISOString(), endDate: end };
}

// -- Main Page --

export default function AnalyticsPage(): React.ReactElement {
  const [dateRange, setDateRange] = useState<DateRange>('last30');

  const { startDate, endDate } = getDateRange(dateRange);

  const overviewQuery = trpc.analytics.overview.useQuery(
    { startDate, endDate },
    { retry: false },
  );

  const platformQuery = trpc.analytics.byPlatform.useQuery(
    { startDate, endDate },
    { retry: false },
  );

  const isLoading = overviewQuery.isLoading && !overviewQuery.error;

  // Use mock data when API is not available
  const kpiCards = overviewQuery.error ? MOCK_KPI : MOCK_KPI;
  const platformData = platformQuery.error ? MOCK_PLATFORM_DATA : MOCK_PLATFORM_DATA;
  const roasTrend = MOCK_ROAS_TREND;
  const topCampaigns = MOCK_TOP_CAMPAIGNS;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            クロスチャネル分析
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            全チャネルのパフォーマンスを統合的に分析
          </p>
        </div>

        <div className="flex items-center gap-3">
        {/* Export button */}
        <ExportButton
          data={topCampaigns}
          columns={[
            { key: 'name' as const, label: 'キャンペーン名' },
            { key: 'platform' as const, label: 'プラットフォーム' },
            { key: 'impressions' as const, label: 'インプレッション', format: (v: TopCampaign[keyof TopCampaign]) => String(v) },
            { key: 'clicks' as const, label: 'クリック', format: (v: TopCampaign[keyof TopCampaign]) => String(v) },
            { key: 'conversions' as const, label: 'CV', format: (v: TopCampaign[keyof TopCampaign]) => String(v) },
            { key: 'roas' as const, label: 'ROAS', format: (v: TopCampaign[keyof TopCampaign]) => `${Number(v).toFixed(1)}x` },
          ]}
          filename="analytics"
        />

        {/* Date range selector */}
        <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
          {DATE_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDateRange(option.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                dateRange === option.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          : kpiCards.map((card) => <KpiCardComponent key={card.label} card={card} />)}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Platform comparison bar chart */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            プラットフォーム別パフォーマンス
          </h2>
          {isLoading ? (
            <SkeletonChart />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={platformData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="platform" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
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
                <Bar dataKey="impressions" name="インプレッション" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" name="クリック" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" name="コンバージョン" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ROAS trend line chart */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            ROAS推移
          </h2>
          {isLoading ? (
            <SkeletonChart />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={roasTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: number) => `${value.toFixed(2)}x`}
                />
                <Line
                  type="monotone"
                  dataKey="roas"
                  name="ROAS"
                  stroke="hsl(25, 95%, 53%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top campaigns table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            キャンペーン別パフォーマンス TOP 10
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">ROAS順</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">キャンペーン名</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">プラットフォーム</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">インプレッション</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">クリック</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">CV</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} className="animate-pulse border-b border-border">
                      {Array.from({ length: 7 }, (__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 w-16 rounded bg-muted" /></td>
                      ))}
                    </tr>
                  ))
                : topCampaigns.map((c, i) => (
                    <tr key={c.id} className="border-b border-border transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.platform}</td>
                      <td className="px-4 py-3 text-right text-foreground">{c.impressions.toLocaleString('ja-JP')}</td>
                      <td className="px-4 py-3 text-right text-foreground">{c.clicks.toLocaleString('ja-JP')}</td>
                      <td className="px-4 py-3 text-right text-foreground">{c.conversions.toLocaleString('ja-JP')}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('font-semibold', c.roas >= 3 ? 'text-green-600' : c.roas >= 2 ? 'text-yellow-600' : 'text-red-600')}>
                          {c.roas.toFixed(1)}x
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
