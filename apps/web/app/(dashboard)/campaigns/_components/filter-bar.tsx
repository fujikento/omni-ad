'use client';

import { memo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import {
  KbdHint,
  PlatformIcon,
  SegmentedControl,
  type SegmentedOption,
} from '@omni-ad/ui';
import { dbPlatformToEnum } from '@omni-ad/shared';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  ALL_PLATFORMS,
  OBJECTIVE_KEYS,
  PLATFORM_CONFIG,
  STATUS_CONFIG,
  type CampaignStatus,
  type Objective,
  type Platform,
} from '../_types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: CampaignStatus | 'all';
  onStatusChange: (value: CampaignStatus | 'all') => void;
  platformFilter: Set<Platform>;
  onPlatformToggle: (platform: Platform) => void;
  objectiveFilter: Objective | 'all';
  onObjectiveChange: (value: Objective | 'all') => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  statusCounts: Record<CampaignStatus | 'all', number>;
}

function FilterBarImpl({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  platformFilter,
  onPlatformToggle,
  objectiveFilter,
  onObjectiveChange,
  hasActiveFilters,
  onClearFilters,
  statusCounts,
}: FilterBarProps): React.ReactElement {
  const { t } = useI18n();

  const statusOptions: ReadonlyArray<SegmentedOption<CampaignStatus | 'all'>> = [
    { value: 'all', label: t('campaigns.allStatuses'), count: statusCounts.all },
    { value: 'active', label: t(STATUS_CONFIG.active.labelKey), count: statusCounts.active },
    { value: 'paused', label: t(STATUS_CONFIG.paused.labelKey), count: statusCounts.paused },
    { value: 'draft', label: t(STATUS_CONFIG.draft.labelKey), count: statusCounts.draft },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      {/* Search with keyboard hint */}
      <div className="relative min-w-48 flex-1 sm:flex-none sm:w-64">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-12 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder={t('campaigns.searchPlaceholder')}
          aria-label={t('campaigns.searchLabel')}
        />
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          <KbdHint>⌘</KbdHint>
          <KbdHint>K</KbdHint>
        </div>
      </div>

      {/* Status segmented control */}
      <SegmentedControl
        options={statusOptions}
        value={statusFilter}
        onValueChange={onStatusChange}
        ariaLabel={t('campaigns.statusFilterLabel')}
        size="sm"
      />

      {/* Objective filter (kept as select for density) */}
      <div className="relative">
        <select
          value={objectiveFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onObjectiveChange(e.target.value as Objective | 'all')
          }
          className="h-7 appearance-none rounded-md border border-input bg-background px-2.5 pr-7 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          aria-label={t('campaigns.objectiveFilterLabel')}
        >
          <option value="all">{t('campaigns.allObjectives')}</option>
          {OBJECTIVE_KEYS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      </div>

      {/* Platform chip row */}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {ALL_PLATFORMS.map((p) => {
          const active = platformFilter.has(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPlatformToggle(p)}
              aria-pressed={active}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              <PlatformIcon platform={dbPlatformToEnum(p)} size={12} />
              {PLATFORM_CONFIG[p].label}
            </button>
          );
        })}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 pl-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={12} />
            {t('campaigns.clearFilters')}
          </button>
        )}
      </div>
    </div>
  );
}

export const FilterBar = memo(FilterBarImpl);
