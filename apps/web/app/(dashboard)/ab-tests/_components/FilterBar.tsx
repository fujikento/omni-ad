import { memo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  METRIC_CONFIG,
  TEST_TYPE_CONFIG,
  type MetricType,
  type SortKey,
  type TestStatus,
  type TestType,
} from '../_types';

interface FilterBarProps {
  statusFilter: TestStatus | 'all';
  typeFilter: TestType | 'all';
  metricFilter: MetricType | 'all';
  searchQuery: string;
  sortKey: SortKey;
  onStatusChange: (value: TestStatus | 'all') => void;
  onTypeChange: (value: TestType | 'all') => void;
  onMetricChange: (value: MetricType | 'all') => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
}

function FilterBarInner({
  statusFilter,
  typeFilter,
  metricFilter,
  searchQuery,
  sortKey,
  onStatusChange,
  onTypeChange,
  onMetricChange,
  onSearchChange,
  onSortChange,
}: FilterBarProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="relative">
        <select
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onStatusChange(e.target.value as TestStatus | 'all')}
          className="appearance-none rounded-md border border-input bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t('abTests.filterStatusLabel')}
        >
          <option value="all">{t('abTests.filterAll')}</option>
          <option value="running">{t('abTests.running')}</option>
          <option value="completed">{t('abTests.completed')}</option>
          <option value="paused">{t('abTests.paused')}</option>
          <option value="draft">{t('abTests.draft')}</option>
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      <div className="relative">
        <select
          value={typeFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onTypeChange(e.target.value as TestType | 'all')}
          className="appearance-none rounded-md border border-input bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t('abTests.filterTypeLabel')}
        >
          <option value="all">{t('abTests.filterAllTypes')}</option>
          {Object.entries(TEST_TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{t(config.labelKey)}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      <div className="relative">
        <select
          value={metricFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onMetricChange(e.target.value as MetricType | 'all')}
          className="appearance-none rounded-md border border-input bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t('abTests.filterMetricLabel')}
        >
          <option value="all">{t('abTests.filterAllMetrics')}</option>
          {Object.entries(METRIC_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t('abTests.searchPlaceholder')}
        />
      </div>

      <div className="relative">
        <select
          value={sortKey}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onSortChange(e.target.value as SortKey)}
          className="appearance-none rounded-md border border-input bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t('abTests.sortLabel')}
        >
          <option value="created">{t('abTests.sortCreated')}</option>
          <option value="significance">{t('abTests.sortSignificance')}</option>
          <option value="lift">{t('abTests.sortLift')}</option>
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

export const FilterBar = memo(FilterBarInner);
