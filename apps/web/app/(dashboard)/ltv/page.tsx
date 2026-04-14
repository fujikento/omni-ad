'use client';

import { useState } from 'react';
import { ArrowUpDown, RefreshCw, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader, StatCard } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type TrendDirection = 'up' | 'down' | 'flat';
type SortField = 'cohort' | 'acquired' | 'cac' | 'avgLtv' | 'ltvCacRatio' | 'retention1m';
type SortDirection = 'asc' | 'desc';

interface KpiCardData {
  label: string;
  value: string;
  trend: TrendDirection;
  trendValue: string;
  colorClass: string;
}

interface CohortRow {
  cohort: string;
  acquired: number;
  totalCost: number;
  cac: number;
  avgLtv: number;
  ltvCacRatio: number;
  retention1m: number;
  retention3m: number;
  retention6m: number;
}

interface LtvDistributionEntry {
  range: string;
  count: number;
}

interface PlatformLtvRow {
  platform: string;
  avgLtv: number;
  avgCac: number;
  ltvCacRatio: number;
  bestCampaign: string;
}

interface TopCustomerRow {
  hashedId: string;
  totalRevenue: number;
  conversions: number;
  firstAcquisition: string;
  platform: string;
}

// ============================================================
// Mock Data
// ============================================================

function getMockKpi(t: (key: string) => string): KpiCardData[] {
  return [
    { label: t('ltv.avgLtv'), value: '¥42,800', trend: 'up', trendValue: '+8.2%', colorClass: 'text-blue-500' },
    { label: t('ltv.avgCac'), value: '¥12,500', trend: 'down', trendValue: '-3.1%', colorClass: 'text-orange-500' },
    { label: t('ltv.ltvCacRatio'), value: '3.4x', trend: 'up', trendValue: '+0.4', colorClass: 'text-green-500' },
    { label: t('ltv.repeatRate'), value: '38%', trend: 'up', trendValue: '+2.3%', colorClass: 'text-purple-500' },
  ];
}

const MOCK_COHORTS: CohortRow[] = [
  { cohort: '2026-01', acquired: 342, totalCost: 4104000, cac: 12000, avgLtv: 38500, ltvCacRatio: 3.2, retention1m: 72, retention3m: 45, retention6m: 28 },
  { cohort: '2026-02', acquired: 415, totalCost: 5187500, cac: 12500, avgLtv: 41200, ltvCacRatio: 3.3, retention1m: 74, retention3m: 48, retention6m: 0 },
  { cohort: '2026-03', acquired: 389, totalCost: 5057000, cac: 13000, avgLtv: 44800, ltvCacRatio: 3.4, retention1m: 76, retention3m: 0, retention6m: 0 },
  { cohort: '2026-04', acquired: 128, totalCost: 1536000, cac: 12000, avgLtv: 42800, ltvCacRatio: 3.6, retention1m: 0, retention3m: 0, retention6m: 0 },
];

const MOCK_LTV_DISTRIBUTION: LtvDistributionEntry[] = [
  { range: '¥0-10K', count: 245 },
  { range: '¥10K-30K', count: 412 },
  { range: '¥30K-50K', count: 328 },
  { range: '¥50K-100K', count: 186 },
  { range: '¥100K+', count: 103 },
];

function getMockPlatformLtv(t: (key: string, params?: Record<string, string | number>) => string): PlatformLtvRow[] {
  return [
  { platform: 'Google', avgLtv: 48200, avgCac: 11800, ltvCacRatio: 4.1, bestCampaign: t('ltv.hc6f094') },
  { platform: 'Meta', avgLtv: 42500, avgCac: 12200, ltvCacRatio: 3.5, bestCampaign: t('ltv.h5ec7c4') },
  { platform: 'LINE', avgLtv: 39800, avgCac: 10500, ltvCacRatio: 3.8, bestCampaign: t('ltv.hbd9acd') },
  { platform: 'TikTok', avgLtv: 35400, avgCac: 14200, ltvCacRatio: 2.5, bestCampaign: t('ltv.hfc027b') },
  { platform: 'Yahoo!', avgLtv: 31200, avgCac: 15800, ltvCacRatio: 2.0, bestCampaign: t('ltv.hd4d8ab') },
  { platform: 'X', avgLtv: 28600, avgCac: 18500, ltvCacRatio: 1.5, bestCampaign: t('ltv.hfb7a86') },
];
}

const MOCK_TOP_CUSTOMERS: TopCustomerRow[] = [
  { hashedId: 'c8a2f1...d3e4', totalRevenue: 285000, conversions: 12, firstAcquisition: '2026-01-15', platform: 'Google' },
  { hashedId: 'b7e3a0...f1c2', totalRevenue: 218000, conversions: 9, firstAcquisition: '2026-01-22', platform: 'Meta' },
  { hashedId: 'a1d4c9...e2b5', totalRevenue: 195000, conversions: 8, firstAcquisition: '2026-02-03', platform: 'Google' },
  { hashedId: 'f5b8e2...a3d1', totalRevenue: 172000, conversions: 7, firstAcquisition: '2026-02-18', platform: 'LINE' },
  { hashedId: 'e9c1d7...b4f6', totalRevenue: 156000, conversions: 6, firstAcquisition: '2026-01-08', platform: 'Meta' },
];

// ============================================================
// Helpers
// ============================================================

function formatYen(value: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value);
}

function getRatioColorClass(ratio: number): string {
  if (ratio >= 3) return 'text-green-600 dark:text-green-400';
  if (ratio >= 2) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getRatioBgClass(ratio: number): string {
  if (ratio >= 3) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (ratio >= 2) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
}

function getRetentionColorClass(rate: number): string {
  if (rate === 0) return 'text-muted-foreground';
  if (rate >= 60) return 'text-green-600 dark:text-green-400';
  if (rate >= 30) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

// ============================================================
// Subcomponents
// ============================================================

function KpiCard({ card }: { card: KpiCardData }): React.ReactElement {
  const { t } = useI18n();
  return (
    <StatCard
      label={card.label}
      value={card.value}
      deltaLabel={t('ltv.vsLastMonth')}
    >
      <span className="text-xs font-medium tabular-nums text-success">{card.trendValue}</span>
    </StatCard>
  );
}

function SortableHeader({
  label,
  field,
  currentSort,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  onSort: (field: SortField) => void;
}): React.ReactElement {
  const isActive = currentSort === field;
  return (
    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <ArrowUpDown
          size={12}
          className={cn(
            isActive ? 'text-primary' : 'text-muted-foreground/50',
          )}
        />
      </button>
    </th>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function LtvPage(): React.ReactElement {
  const { t } = useI18n();
  const [sortField, setSortField] = useState<SortField>('cohort');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [refreshing, setRefreshing] = useState(false);

  function handleSort(field: SortField): void {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  const sortedCohorts = [...MOCK_COHORTS].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier;
    }
    return ((aVal as number) - (bVal as number)) * multiplier;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analysis & Optimization"
        title={t('ltv.title')}
        description={t('ltv.description')}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {getMockKpi(t).map((card) => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>

      {/* Cohort Analysis Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t('ltv.cohortAnalysis')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('ltv.cohortDescription')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <SortableHeader label={t('ltv.cohort')} field="cohort" currentSort={sortField} onSort={handleSort} />
                <SortableHeader label={t('ltv.acquired')} field="acquired" currentSort={sortField} onSort={handleSort} />
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('ltv.acquisitionCost')}</th>
                <SortableHeader label="CAC" field="cac" currentSort={sortField} onSort={handleSort} />
                <SortableHeader label={t('ltv.avgLtv')} field="avgLtv" currentSort={sortField} onSort={handleSort} />
                <SortableHeader label="LTV/CAC" field="ltvCacRatio" currentSort={sortField} onSort={handleSort} />
                <SortableHeader label="1M" field="retention1m" currentSort={sortField} onSort={handleSort} />
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">3M</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">6M</th>
              </tr>
            </thead>
            <tbody>
              {sortedCohorts.map((row) => (
                <tr key={row.cohort} className="border-b border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 text-right font-medium text-foreground">{row.cohort}</td>
                  <td className="px-4 py-3 text-right text-foreground">{row.acquired.toLocaleString('ja-JP')}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatYen(row.totalCost)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatYen(row.cac)}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{formatYen(row.avgLtv)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', getRatioBgClass(row.ltvCacRatio))}>
                      {row.ltvCacRatio.toFixed(1)}x
                    </span>
                  </td>
                  <td className={cn('px-4 py-3 text-right font-medium', getRetentionColorClass(row.retention1m))}>
                    {row.retention1m > 0 ? `${row.retention1m}%` : '-'}
                  </td>
                  <td className={cn('px-4 py-3 text-right font-medium', getRetentionColorClass(row.retention3m))}>
                    {row.retention3m > 0 ? `${row.retention3m}%` : '-'}
                  </td>
                  <td className={cn('px-4 py-3 text-right font-medium', getRetentionColorClass(row.retention6m))}>
                    {row.retention6m > 0 ? `${row.retention6m}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LTV Distribution Chart + Platform Comparison side by side */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* LTV Distribution Chart */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{t('ltv.ltvDistribution')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('ltv.ltvDistributionDescription')}</p>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={MOCK_LTV_DISTRIBUTION} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: number) => [`${value}`, t('ltv.customerCount')]}
                />
                <Bar dataKey="count" name={t('ltv.customerCount')} fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Comparison */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{t('ltv.platformComparison')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('ltv.platformComparisonDescription')}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('ltv.platformColumn')}</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('ltv.avgLtvColumn')}</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('ltv.avgCacColumn')}</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">{t('ltv.ltvCacColumn')}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('ltv.bestCampaign')}</th>
                </tr>
              </thead>
              <tbody>
                {getMockPlatformLtv(t).map((row) => (
                  <tr key={row.platform} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium text-foreground">{row.platform}</td>
                    <td className="px-3 py-2 text-right text-foreground">{formatYen(row.avgLtv)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{formatYen(row.avgCac)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn('font-semibold', getRatioColorClass(row.ltvCacRatio))}>
                        {row.ltvCacRatio.toFixed(1)}x
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.bestCampaign}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Customers (anonymized) */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{t('ltv.topCustomers')}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t('ltv.topCustomersDescription')}</p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              setTimeout(() => {
                setRefreshing(false);
                showToast(t('ltv.dataRefreshed'));
              }, 1500);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            {t('ltv.refresh')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('ltv.customerId')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('ltv.totalRevenue')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('ltv.cvCount')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('ltv.firstAcquisition')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('ltv.acquisitionChannel')}</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TOP_CUSTOMERS.map((customer, idx) => (
                <tr key={customer.hashedId} className="border-b border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono text-sm text-foreground">{customer.hashedId}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{formatYen(customer.totalRevenue)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{customer.conversions}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.firstAcquisition}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.platform}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
