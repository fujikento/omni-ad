'use client';

import { useState } from 'react';
import {
  Eye,
  MousePointerClick,
  ShoppingCart,
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
import { Card, PageHeader, StatCard, Tabs } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { ExportButton } from '@/app/components/export-button';
import { useI18n } from '@/lib/i18n';

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

const DATE_RANGE_KEYS: { value: DateRange; key: string }[] = [
  { value: 'today', key: 'analytics.today' },
  { value: 'yesterday', key: 'analytics.yesterday' },
  { value: 'last7', key: 'analytics.last7days' },
  { value: 'last30', key: 'analytics.last30days' },
  { value: 'custom', key: 'analytics.custom' },
];

// Mock data for demonstration — labels use i18n keys resolved at render time
interface MockKpiDef {
  labelKey: string;
  value: string;
  change: number;
  icon: React.ReactNode;
}

const MOCK_KPI_DEFS: MockKpiDef[] = [
  { labelKey: 'analytics.totalImpressions', value: '1,234,567', change: 12.5, icon: <Eye size={20} className="text-blue-500" /> },
  { labelKey: 'analytics.totalClicks', value: '45,678', change: 8.3, icon: <MousePointerClick size={20} className="text-green-500" /> },
  { labelKey: 'analytics.totalConversions', value: '1,234', change: -3.2, icon: <ShoppingCart size={20} className="text-purple-500" /> },
  { labelKey: 'metrics.roas', value: '3.2x', change: 15.1, icon: <TrendingUp size={20} className="text-orange-500" /> },
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

function getMockTopCampaigns(t: (key: string, params?: Record<string, string | number>) => string): TopCampaign[] {
  return [
  { id: '1', name: t('analytics.hc6f094'), platform: 'Google', impressions: 250000, clicks: 10000, conversions: 320, roas: 4.5 },
  { id: '2', name: t('analytics.h890fdc'), platform: 'Meta', impressions: 180000, clicks: 7200, conversions: 250, roas: 4.2 },
  { id: '3', name: t('analytics.h34e78e'), platform: 'LINE', impressions: 80000, clicks: 3200, conversions: 65, roas: 3.8 },
  { id: '4', name: t('analytics.h03d928'), platform: 'Google', impressions: 200000, clicks: 8000, conversions: 200, roas: 3.5 },
  { id: '5', name: t('analytics.h3a1cca'), platform: 'TikTok', impressions: 150000, clicks: 6000, conversions: 120, roas: 3.2 },
  { id: '6', name: t('analytics.hb217be'), platform: 'Yahoo!', impressions: 19567, clicks: 878, conversions: 24, roas: 2.8 },
  { id: '7', name: t('analytics.h1729c5'), platform: 'X', impressions: 45000, clicks: 1800, conversions: 35, roas: 2.5 },
  { id: '8', name: t('analytics.haaff51'), platform: 'Meta', impressions: 120000, clicks: 4800, conversions: 130, roas: 2.3 },
  { id: '9', name: t('analytics.ha36b4e'), platform: 'Google', impressions: 95000, clicks: 3800, conversions: 85, roas: 2.1 },
  { id: '10', name: t('analytics.h334526'), platform: 'TikTok', impressions: 70000, clicks: 2500, conversions: 60, roas: 1.9 },
];
}

// -- Subcomponents --

function KpiCardComponent({ card }: { card: KpiCard }): React.ReactElement {
  const { t } = useI18n();
  return (
    <StatCard
      label={card.label}
      value={card.value}
      delta={card.change}
      deltaLabel={t('analytics.comparedToPrevious')}
      icon={card.icon}
    />
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
  const { t } = useI18n();
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

  // Resolve mock KPI labels with i18n
  const resolvedMockKpi: KpiCard[] = MOCK_KPI_DEFS.map((def) => ({
    label: t(def.labelKey),
    value: def.value,
    change: def.change,
    icon: def.icon,
  }));

  // Use mock data when API is not available
  const kpiCards = overviewQuery.error
    ? resolvedMockKpi
    : (overviewQuery.data as KpiCard[] | undefined) ?? resolvedMockKpi;
  const platformData = platformQuery.error
    ? MOCK_PLATFORM_DATA
    : (platformQuery.data as PlatformMetric[] | undefined) ?? MOCK_PLATFORM_DATA;
  const roasTrend = MOCK_ROAS_TREND;
  const topCampaigns = getMockTopCampaigns(t);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analysis & Optimization"
        title={t('analytics.title')}
        description={t('analytics.description')}
        actions={
          <>
            <ExportButton
              data={topCampaigns}
              columns={[
                { key: 'name' as const, label: t('analytics.campaignName') },
                { key: 'platform' as const, label: t('analytics.platformLabel') },
                { key: 'impressions' as const, label: t('metrics.impressions'), format: (v: TopCampaign[keyof TopCampaign]) => String(v) },
                { key: 'clicks' as const, label: t('metrics.clicks'), format: (v: TopCampaign[keyof TopCampaign]) => String(v) },
                { key: 'conversions' as const, label: t('analytics.cv'), format: (v: TopCampaign[keyof TopCampaign]) => String(v) },
                { key: 'roas' as const, label: t('metrics.roas'), format: (v: TopCampaign[keyof TopCampaign]) => `${Number(v).toFixed(1)}x` },
              ]}
              filename="analytics"
            />
            <Tabs
              variant="pill"
              value={dateRange}
              onValueChange={(k) => setDateRange(k as DateRange)}
              items={DATE_RANGE_KEYS.map((o) => ({ key: o.value, label: t(o.key) }))}
            />
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          : kpiCards.map((card) => <KpiCardComponent key={card.label} card={card} />)}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Platform comparison bar chart */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {t('analytics.platformPerformance')}
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
                <Bar dataKey="impressions" name={t('metrics.impressions')} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" name={t('metrics.clicks')} fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" name={t('metrics.conversions')} fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ROAS trend line chart */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {t('analytics.roasTrend')}
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
                  stroke="hsl(var(--warning))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Top campaigns table */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {t('analytics.topCampaigns')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('analytics.sortedByRoas')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('analytics.campaignName')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('analytics.platformLabel')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('metrics.impressions')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('metrics.clicks')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('analytics.cv')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('metrics.roas')}</th>
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
                        <span className={cn('font-semibold tabular-nums', c.roas >= 3 ? 'text-success' : c.roas >= 2 ? 'text-warning' : 'text-destructive')}>
                          {c.roas.toFixed(1)}x
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
