'use client';

import { useState } from 'react';
import {
  ArrowUpDown,
  Building2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type ClientStatus = 'good' | 'warning' | 'critical';
type SortField = 'name' | 'plan' | 'budget' | 'spendRate' | 'roas' | 'activeCampaigns' | 'status';
type SortDirection = 'asc' | 'desc';
type HeatmapMetric = 'roas' | 'ctr' | 'cpa' | 'spendRate';

interface PortfolioKpi {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
  trendValue: string;
}

interface ClientRow {
  id: string;
  name: string;
  plan: string;
  monthlyBudget: number;
  spendRate: number;
  roas: number;
  activeCampaigns: number;
  status: ClientStatus;
  metrics: {
    ctr: number;
    cpa: number;
  };
}

// ============================================================
// Constants
// ============================================================

const STATUS_CONFIG: Record<ClientStatus, { labelKey: string; className: string }> = {
  good: { labelKey: 'clients.statusGood', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  warning: { labelKey: 'clients.statusWarning', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  critical: { labelKey: 'clients.statusCritical', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

function getMockPortfolioKpi(t: (key: string) => string): PortfolioKpi[] {
  return [
    { label: t('clients.totalClients'), value: '12', trend: 'up', trendValue: '+2' },
    { label: t('clients.totalAdSpend'), value: '¥28,500,000', trend: 'up', trendValue: '+12%' },
    { label: t('clients.avgRoas'), value: '3.2x', trend: 'up', trendValue: '+0.3' },
    { label: t('clients.budgetSpendRate'), value: '72%', trend: 'flat', trendValue: t('clients.normal') },
  ];
}

const MOCK_CLIENTS: ClientRow[] = [
  { id: 'c1', name: '株式会社テックフォワード', plan: 'エンタープライズ', monthlyBudget: 5000000, spendRate: 78, roas: 4.2, activeCampaigns: 8, status: 'good', metrics: { ctr: 3.8, cpa: 2800 } },
  { id: 'c2', name: '合同会社ブライトコマース', plan: 'プロフェッショナル', monthlyBudget: 3500000, spendRate: 85, roas: 3.8, activeCampaigns: 5, status: 'good', metrics: { ctr: 3.2, cpa: 3200 } },
  { id: 'c3', name: '株式会社グリーンライフ', plan: 'プロフェッショナル', monthlyBudget: 2800000, spendRate: 62, roas: 2.9, activeCampaigns: 4, status: 'warning', metrics: { ctr: 2.5, cpa: 4100 } },
  { id: 'c4', name: '有限会社ファッションモール', plan: 'エンタープライズ', monthlyBudget: 4200000, spendRate: 91, roas: 3.5, activeCampaigns: 7, status: 'good', metrics: { ctr: 4.1, cpa: 2600 } },
  { id: 'c5', name: '株式会社ヘルシーフード', plan: 'スタンダード', monthlyBudget: 1500000, spendRate: 45, roas: 1.8, activeCampaigns: 3, status: 'critical', metrics: { ctr: 1.9, cpa: 5800 } },
  { id: 'c6', name: '株式会社デジタルメディア', plan: 'プロフェッショナル', monthlyBudget: 3000000, spendRate: 72, roas: 3.1, activeCampaigns: 5, status: 'good', metrics: { ctr: 3.0, cpa: 3500 } },
  { id: 'c7', name: '合同会社スマートホーム', plan: 'スタンダード', monthlyBudget: 2000000, spendRate: 58, roas: 2.4, activeCampaigns: 3, status: 'warning', metrics: { ctr: 2.2, cpa: 4500 } },
  { id: 'c8', name: '株式会社トラベルジャパン', plan: 'エンタープライズ', monthlyBudget: 6500000, spendRate: 68, roas: 3.9, activeCampaigns: 10, status: 'good', metrics: { ctr: 3.5, cpa: 3000 } },
];

const HEATMAP_METRICS: { key: HeatmapMetric; labelKey: string }[] = [
  { key: 'roas', labelKey: 'metrics.roas' },
  { key: 'ctr', labelKey: 'metrics.ctr' },
  { key: 'cpa', labelKey: 'metrics.cpa' },
  { key: 'spendRate', labelKey: 'clients.budgetSpendRate' },
];

// ============================================================
// Helpers
// ============================================================

function formatYen(value: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value);
}

function getHeatmapIntensity(metric: HeatmapMetric, client: ClientRow): { bg: string; text: string } {
  let score: number;

  switch (metric) {
    case 'roas':
      score = client.roas >= 3.5 ? 3 : client.roas >= 2.5 ? 2 : client.roas >= 1.5 ? 1 : 0;
      break;
    case 'ctr':
      score = client.metrics.ctr >= 3.5 ? 3 : client.metrics.ctr >= 2.5 ? 2 : client.metrics.ctr >= 1.5 ? 1 : 0;
      break;
    case 'cpa':
      // Lower CPA is better
      score = client.metrics.cpa <= 3000 ? 3 : client.metrics.cpa <= 4000 ? 2 : client.metrics.cpa <= 5000 ? 1 : 0;
      break;
    case 'spendRate':
      score = client.spendRate >= 70 && client.spendRate <= 90 ? 3 : client.spendRate >= 50 ? 2 : client.spendRate >= 30 ? 1 : 0;
      break;
  }

  const intensityMap: Record<number, { bg: string; text: string }> = {
    0: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    1: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
    2: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    3: { bg: 'bg-green-200 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-300' },
  };

  return intensityMap[score] as { bg: string; text: string };
}

function getHeatmapValue(metric: HeatmapMetric, client: ClientRow): string {
  switch (metric) {
    case 'roas':
      return `${client.roas.toFixed(1)}x`;
    case 'ctr':
      return `${client.metrics.ctr.toFixed(1)}%`;
    case 'cpa':
      return `¥${client.metrics.cpa.toLocaleString('ja-JP')}`;
    case 'spendRate':
      return `${client.spendRate}%`;
  }
}

function compareSortValues(a: string | number, b: string | number, direction: SortDirection): number {
  const multiplier = direction === 'asc' ? 1 : -1;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, 'ja') * multiplier;
  }
  return ((a as number) - (b as number)) * multiplier;
}

function getSortValue(client: ClientRow, field: SortField): string | number {
  switch (field) {
    case 'name': return client.name;
    case 'plan': return client.plan;
    case 'budget': return client.monthlyBudget;
    case 'spendRate': return client.spendRate;
    case 'roas': return client.roas;
    case 'activeCampaigns': return client.activeCampaigns;
    case 'status': return client.status;
  }
}

// ============================================================
// Subcomponents
// ============================================================

function PortfolioCard({ kpi }: { kpi: PortfolioKpi }): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
      <p className="mt-3 text-3xl font-bold text-foreground">{kpi.value}</p>
      <div className="mt-1 flex items-center gap-1">
        {kpi.trend === 'up' && <TrendingUp size={14} className="text-green-500" />}
        {kpi.trend === 'down' && <TrendingDown size={14} className="text-red-500" />}
        <span className={cn(
          'text-xs font-medium',
          kpi.trend === 'up' ? 'text-green-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-muted-foreground',
        )}>
          {kpi.trendValue}
        </span>
        {kpi.trend !== 'flat' && <span className="text-xs text-muted-foreground">{t('clients.vsLastMonth')}</span>}
      </div>
    </div>
  );
}

function SortableColumnHeader({
  label,
  field,
  currentSort,
  onSort,
  align = 'left',
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
}): React.ReactElement {
  const isActive = currentSort === field;
  return (
    <th className={cn('px-4 py-3 font-medium text-muted-foreground', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <ArrowUpDown
          size={12}
          className={cn(isActive ? 'text-primary' : 'text-muted-foreground/50')}
        />
      </button>
    </th>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function ClientsPage(): React.ReactElement {
  const { t } = useI18n();
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  function handleSort(field: SortField): void {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedClients = [...MOCK_CLIENTS].sort((a, b) =>
    compareSortValues(getSortValue(a, sortField), getSortValue(b, sortField), sortDirection),
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('clients.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('clients.description')}
        </p>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {getMockPortfolioKpi(t).map((kpi) => (
          <PortfolioCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {/* Client Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          <Building2 size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('clients.clientList')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <SortableColumnHeader label={t('clients.clientName')} field="name" currentSort={sortField} onSort={handleSort} />
                <SortableColumnHeader label={t('clients.plan')} field="plan" currentSort={sortField} onSort={handleSort} />
                <SortableColumnHeader label={t('clients.monthlyBudget')} field="budget" currentSort={sortField} onSort={handleSort} align="right" />
                <SortableColumnHeader label={t('clients.spendRate')} field="spendRate" currentSort={sortField} onSort={handleSort} align="right" />
                <SortableColumnHeader label="ROAS" field="roas" currentSort={sortField} onSort={handleSort} align="right" />
                <SortableColumnHeader label={t('clients.activeCampaigns')} field="activeCampaigns" currentSort={sortField} onSort={handleSort} align="right" />
                <SortableColumnHeader label={t('common.status')} field="status" currentSort={sortField} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-border transition-colors hover:bg-muted/30 cursor-pointer"
                  onClick={() => {
                    // Navigate to client dashboard (mock)
                    window.location.href = `/home?client=${client.id}`;
                  }}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent<HTMLTableRowElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      window.location.href = `/home?client=${client.id}`;
                    }
                  }}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{client.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client.plan}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatYen(client.monthlyBudget)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            client.spendRate >= 80 ? 'bg-green-500' : client.spendRate >= 50 ? 'bg-yellow-500' : 'bg-red-500',
                          )}
                          style={{ width: `${Math.min(100, client.spendRate)}%` }}
                        />
                      </div>
                      <span className="text-foreground">{client.spendRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'font-semibold',
                      client.roas >= 3 ? 'text-green-600' : client.roas >= 2 ? 'text-yellow-600' : 'text-red-600',
                    )}>
                      {client.roas.toFixed(1)}x
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">{client.activeCampaigns}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_CONFIG[client.status].className)}>
                      {t(STATUS_CONFIG[client.status].labelKey)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Heatmap */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t('clients.performanceHeatmap')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('clients.heatmapDescription')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('clients.client')}</th>
                {HEATMAP_METRICS.map((metric) => (
                  <th key={metric.key} className="px-4 py-3 text-center font-medium text-muted-foreground">
                    {t(metric.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_CLIENTS.map((client) => (
                <tr key={client.id} className="border-b border-border">
                  <td className="px-4 py-3 font-medium text-foreground">{client.name}</td>
                  {HEATMAP_METRICS.map((metric) => {
                    const intensity = getHeatmapIntensity(metric.key, client);
                    return (
                      <td key={metric.key} className="px-2 py-2 text-center">
                        <span className={cn(
                          'inline-flex min-w-[60px] items-center justify-center rounded-md px-2 py-1.5 text-xs font-semibold',
                          intensity.bg,
                          intensity.text,
                        )}>
                          {getHeatmapValue(metric.key, client)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
