'use client';

import { useState } from 'react';
import { ArrowUpDown, Inbox, RefreshCw, Users } from 'lucide-react';
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
import { trpc } from '@/lib/trpc';
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

interface LtvOverview {
  kpi?: KpiCardData[];
  distribution?: LtvDistributionEntry[];
  platformComparison?: PlatformLtvRow[];
}

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

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }): React.ReactElement {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </td>
    </tr>
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

  const overviewQuery = trpc.ltvTracking.overview.useQuery(undefined, { retry: false });
  const cohortTrendQuery = trpc.ltvTracking.cohortTrend.useQuery(
    { months: 12 },
    { retry: false },
  );
  const topCustomersQuery = trpc.ltvTracking.topCustomers.useQuery(
    { limit: 20 },
    { retry: false },
  );

  function handleSort(field: SortField): void {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  const overview = (overviewQuery.data as LtvOverview | undefined) ?? {};
  const kpiCards = overview.kpi ?? [];
  const distribution = overview.distribution ?? [];
  const platformComparison = overview.platformComparison ?? [];
  const cohorts = (cohortTrendQuery.data as CohortRow[] | undefined) ?? [];
  const topCustomers = (topCustomersQuery.data as TopCustomerRow[] | undefined) ?? [];

  const sortedCohorts = [...cohorts].sort((a, b) => {
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
      {kpiCards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <KpiCard key={card.label} card={card} />
          ))}
        </div>
      )}

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
              {sortedCohorts.length === 0 ? (
                <EmptyRow colSpan={9} message={t('common.noData')} />
              ) : (
                sortedCohorts.map((row) => (
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
                ))
              )}
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
            {distribution.length === 0 ? (
              <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
                <Inbox size={28} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
            )}
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
                {platformComparison.length === 0 ? (
                  <EmptyRow colSpan={5} message={t('common.noData')} />
                ) : (
                  platformComparison.map((row) => (
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
                  ))
                )}
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
              void topCustomersQuery.refetch().finally(() => {
                setRefreshing(false);
                showToast(t('ltv.dataRefreshed'));
              });
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
              {topCustomers.length === 0 ? (
                <EmptyRow colSpan={6} message={t('common.noData')} />
              ) : (
                topCustomers.map((customer, idx) => (
                  <tr key={customer.hashedId} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm text-foreground">{customer.hashedId}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{formatYen(customer.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{customer.conversions}</td>
                    <td className="px-4 py-3 text-muted-foreground">{customer.firstAcquisition}</td>
                    <td className="px-4 py-3 text-muted-foreground">{customer.platform}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
