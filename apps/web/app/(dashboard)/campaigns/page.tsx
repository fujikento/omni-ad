'use client';

import { useCallback, useMemo, useState } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import { Button, PageHeader } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { ExportButton } from '@/app/components/export-button';
import { useI18n } from '@/lib/i18n';
import {
  EXPORT_COLUMN_DEFS,
  TABLE_COLUMNS,
  type Campaign,
  type CampaignStatus,
  type Objective,
  type Platform,
  type SortDirection,
  type SortField,
} from './_types';
import { BulkActionBar } from './_components/bulk-action-bar';
import { CampaignDetailModal } from './_components/campaign-detail-modal';
import { CampaignRow } from './_components/campaign-row';
import { CreateCampaignModal } from './_components/create-campaign-modal';
import { FilterBar } from './_components/filter-bar';
import { KpiSummary } from './_components/kpi-summary';
import { SkeletonRow } from './_components/skeleton-row';
import { SortHeader } from './_components/sort-header';

// ============================================================
// Main Page
// ============================================================

export default function CampaignsPage(): React.ReactElement {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<Set<Platform>>(new Set());
  const [objectiveFilter, setObjectiveFilter] = useState<Objective | 'all'>('all');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const campaignsQuery = trpc.campaigns.list.useQuery(undefined, { retry: false });
  const pauseMutation = trpc.campaigns.pause.useMutation();
  const resumeMutation = trpc.campaigns.resume.useMutation();

  const campaigns: Campaign[] = useMemo(
    () => (campaignsQuery.data as Campaign[] | undefined) ?? [],
    [campaignsQuery.data],
  );
  const isLoading = campaignsQuery.isLoading;

  // Apply filters
  const filteredCampaigns = useMemo(() => campaigns.filter((c) => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (platformFilter.size > 0 && !c.platforms.some((p) => platformFilter.has(p))) return false;
    if (objectiveFilter !== 'all' && c.objective !== objectiveFilter) return false;
    return true;
  }), [campaigns, searchQuery, statusFilter, platformFilter, objectiveFilter]);

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || platformFilter.size > 0 || objectiveFilter !== 'all';

  // KPI summary derived from full (unfiltered) campaign list
  const kpi = useMemo(() => {
    const active = campaigns.filter((c) => c.status === 'active');
    const spend = active.reduce((sum, c) => sum + c.budget.total, 0);
    const roasAvg = active.length > 0
      ? active.reduce((sum, c) => sum + c.roas, 0) / active.length
      : 0;
    const attention = campaigns.filter(
      (c) => c.status === 'active' && c.roas > 0 && c.roas < 1.5,
    ).length;
    return { active, spend, roasAvg, attention };
  }, [campaigns]);

  // Status counts for segmented control
  const statusCounts: Record<CampaignStatus | 'all', number> = useMemo(() => ({
    all: campaigns.length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    active: kpi.active.length,
    paused: campaigns.filter((c) => c.status === 'paused').length,
    completed: campaigns.filter((c) => c.status === 'completed').length,
    archived: campaigns.filter((c) => c.status === 'archived').length,
  }), [campaigns, kpi.active.length]);

  const handleSort = useCallback((field: SortField): void => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return prevField;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  const sortedCampaigns = useMemo(() => [...filteredCampaigns].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'name':
        return a.name.localeCompare(b.name) * modifier;
      case 'status':
        return a.status.localeCompare(b.status) * modifier;
      case 'budget':
        return (a.budget.total - b.budget.total) * modifier;
      case 'roas':
        return (a.roas - b.roas) * modifier;
      case 'updatedAt':
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * modifier;
      default:
        return 0;
    }
  }), [filteredCampaigns, sortField, sortDirection]);

  // Selection helpers
  const allVisibleSelected = sortedCampaigns.length > 0 && sortedCampaigns.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = useCallback((): void => {
    setSelectedIds((prev) => {
      const allSelected = sortedCampaigns.length > 0 && sortedCampaigns.every((c) => prev.has(c.id));
      if (allSelected) {
        return new Set();
      }
      return new Set(sortedCampaigns.map((c) => c.id));
    });
  }, [sortedCampaigns]);

  const toggleSelect = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handlePlatformToggle = useCallback((platform: Platform): void => {
    setPlatformFilter((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback((): void => {
    setSearchQuery('');
    setStatusFilter('all');
    setPlatformFilter(new Set());
    setObjectiveFilter('all');
  }, []);

  const formatCurrency = useCallback((amount: number): string =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount),
  []);

  const formatDate = useCallback((dateStr: string): string =>
    new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateStr)),
  []);

  // Stable handlers for row-level memoisation
  const handleOpenDetail = useCallback((campaign: Campaign): void => {
    setDetailCampaign(campaign);
  }, []);

  const handlePauseRow = useCallback((id: string): void => {
    pauseMutation.mutate({ id });
  }, [pauseMutation]);

  const handleResumeRow = useCallback((id: string): void => {
    resumeMutation.mutate({ id });
  }, [resumeMutation]);

  const handleBulkPause = useCallback((): void => {
    selectedIds.forEach((id) => pauseMutation.mutate({ id }));
    setSelectedIds(new Set());
  }, [selectedIds, pauseMutation]);

  const handleBulkResume = useCallback((): void => {
    selectedIds.forEach((id) => resumeMutation.mutate({ id }));
    setSelectedIds(new Set());
  }, [selectedIds, resumeMutation]);

  const handleBulkDelete = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDeselect = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  const handleCloseCreateModal = useCallback((): void => setModalOpen(false), []);
  const handleOpenCreateModal = useCallback((): void => setModalOpen(true), []);
  const handleCloseDetailModal = useCallback((): void => setDetailCampaign(null), []);

  const exportColumns = useMemo(
    () => EXPORT_COLUMN_DEFS.map((col) => ({ ...col, label: t(col.labelKey) })),
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ad Management"
        title={t('campaigns.title')}
        description={`${sortedCampaigns.length} 件 / 全 ${campaigns.length} 件`}
        actions={
          <>
            <ExportButton
              data={sortedCampaigns}
              columns={exportColumns}
              filename="campaigns"
            />
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={handleOpenCreateModal}
            >
              {t('campaigns.create')}
            </Button>
          </>
        }
      />

      {/* KPI summary strip */}
      <KpiSummary
        activeCount={kpi.active.length}
        totalCount={campaigns.length}
        totalSpend={kpi.spend}
        avgRoas={kpi.roasAvg}
        needsAttentionCount={kpi.attention}
        formatCurrency={formatCurrency}
      />

      {/* Filter bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        platformFilter={platformFilter}
        onPlatformToggle={handlePlatformToggle}
        objectiveFilter={objectiveFilter}
        onObjectiveChange={setObjectiveFilter}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        statusCounts={statusCounts}
      />

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {/* Checkbox column */}
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input text-primary accent-primary"
                    aria-label={t('campaigns.selectAll')}
                  />
                </th>
                {TABLE_COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {column.sortable ? (
                      <SortHeader
                        label={t(column.labelKey)}
                        field={column.key as SortField}
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    ) : (
                      t(column.labelKey)
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : sortedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length + 1} className="px-4 py-16 text-center">
                    <div className={cn('flex flex-col items-center gap-3')}>
                      <FolderKanban size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">
                        {t('campaigns.empty')}
                      </p>
                      {!hasActiveFilters && (
                        <p className="text-sm text-muted-foreground/70">
                          {t('campaigns.create')}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedCampaigns.map((campaign) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    selected={selectedIds.has(campaign.id)}
                    onToggleSelect={toggleSelect}
                    onOpenDetail={handleOpenDetail}
                    onPause={handlePauseRow}
                    onResume={handleResumeRow}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onPause={handleBulkPause}
          onResume={handleBulkResume}
          onDelete={handleBulkDelete}
          onDeselect={handleBulkDeselect}
        />
      )}

      {/* Create campaign modal */}
      <CreateCampaignModal open={modalOpen} onClose={handleCloseCreateModal} />

      {/* Campaign detail modal */}
      {detailCampaign && (
        <CampaignDetailModal
          campaign={detailCampaign}
          onClose={handleCloseDetailModal}
        />
      )}
    </div>
  );
}
