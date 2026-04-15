'use client';

import { useCallback, useMemo, useState } from 'react';
import { BarChart3, Clock, FlaskConical, Plus, Trophy, Zap } from 'lucide-react';
import { Button, PageHeader } from '@omni-ad/ui';
import { useI18n } from '@/lib/i18n';
import {
  type ABTest,
  type MetricType,
  type SortKey,
  type TestStatus,
  type TestType,
} from './_types';
import { KPICard } from './_components/Badges';
import { FilterBar } from './_components/FilterBar';
import { BulkActionsBar } from './_components/BulkActionsBar';
import { TestTable } from './_components/TestTable';
import { Pagination } from './_components/Pagination';
import { TestDetailModal } from './_components/TestDetailModal';
import { CreateTestModal } from './_components/CreateTestModal';

export default function ABTestsPage(): React.ReactElement {
  const { t } = useI18n();
  const [tests, setTests] = useState<ABTest[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailTest, setDetailTest] = useState<ABTest | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [statusFilter, setStatusFilter] = useState<TestStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TestType | 'all'>('all');
  const [metricFilter, setMetricFilter] = useState<MetricType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created');

  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const runningCount = useMemo(() => tests.filter((t) => t.status === 'running').length, [tests]);
  const completedCount = useMemo(() => tests.filter((t) => t.status === 'completed').length, [tests]);
  const winnersToday = 0;
  const avgSignificanceDays = 0;

  const filteredTests = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tests.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (typeFilter !== 'all' && t.testType !== typeFilter) return false;
      if (metricFilter !== 'all' && t.metric !== metricFilter) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tests, statusFilter, typeFilter, metricFilter, searchQuery]);

  const sortedTests = useMemo(() => {
    return [...filteredTests].sort((a, b) => {
      if (sortKey === 'significance') return b.significance - a.significance;
      if (sortKey === 'lift') return b.lift - a.lift;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [filteredTests, sortKey]);

  const totalPages = Math.ceil(sortedTests.length / perPage);
  const paginatedTests = useMemo(
    () => sortedTests.slice((currentPage - 1) * perPage, currentPage * perPage),
    [sortedTests, currentPage, perPage],
  );

  const toggleSelect = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((): void => {
    const allIds = paginatedTests.map((t) => t.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [paginatedTests, selectedIds]);

  const handleDeclareWinner = useCallback((testId: string): void => {
    setTests((prev) =>
      prev.map((t) => (t.id === testId ? { ...t, status: 'completed' as const, significance: 97 } : t)),
    );
    setDetailTest(null);
  }, []);

  const handlePauseOne = useCallback((id: string): void => {
    setTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'paused' as const } : t)),
    );
  }, []);

  const handleResumeOne = useCallback((id: string): void => {
    setTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'running' as const } : t)),
    );
  }, []);

  const handleBulkPause = useCallback((): void => {
    setTests((prev) =>
      prev.map((t) => (selectedIds.has(t.id) && t.status === 'running' ? { ...t, status: 'paused' as const } : t)),
    );
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleBulkResume = useCallback((): void => {
    setTests((prev) =>
      prev.map((t) => (selectedIds.has(t.id) && t.status === 'paused' ? { ...t, status: 'running' as const } : t)),
    );
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleBulkDelete = useCallback((): void => {
    setTests((prev) => prev.filter((t) => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleBulkDeclareWinners = useCallback((): void => {
    setTests((prev) =>
      prev.map((t) =>
        selectedIds.has(t.id) && t.significance >= 95
          ? { ...t, status: 'completed' as const }
          : t,
      ),
    );
    setSelectedIds(new Set());
  }, [selectedIds]);

  const clearSelection = useCallback((): void => setSelectedIds(new Set()), []);
  const closeCreate = useCallback((): void => setModalOpen(false), []);
  const closeDetail = useCallback((): void => setDetailTest(null), []);

  const hasSignificantInSelection = useMemo(
    () => tests.some((t) => selectedIds.has(t.id) && t.significance >= 95 && t.status === 'running'),
    [tests, selectedIds],
  );

  const handleStatusChange = useCallback((value: TestStatus | 'all'): void => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);
  const handleTypeChange = useCallback((value: TestType | 'all'): void => {
    setTypeFilter(value);
    setCurrentPage(1);
  }, []);
  const handleMetricChange = useCallback((value: MetricType | 'all'): void => {
    setMetricFilter(value);
    setCurrentPage(1);
  }, []);
  const handleSearchChange = useCallback((value: string): void => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);
  const handlePerPageChange = useCallback((value: number): void => {
    setPerPage(value);
    setCurrentPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analysis & Optimization"
        title={t('abTests.title')}
        description={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span>
              {t('abTests.running')}: <span className="font-semibold text-success tabular-nums">{runningCount}{t('abTests.totalRunning')}</span>
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span>
              {t('abTests.completed')}: <span className="font-semibold text-info tabular-nums">{completedCount}{t('abTests.totalCompleted')}</span>
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span>
              {t('abTests.winRate')}: <span className="font-semibold tabular-nums text-foreground">78%</span>
            </span>
          </span>
        }
        actions={
          <>
            <a
              href="/creatives/mass-production"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
            >
              <Zap size={14} />
              {t('abTests.batchCreate')}
            </a>
            <Button size="sm" leadingIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
              {t('abTests.create')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label={t('abTests.kpiRunningTests')}
          value={String(runningCount)}
          icon={<FlaskConical size={20} />}
          trend={t('abTests.trendWeekly', { count: '12' })}
        />
        <KPICard
          label={t('abTests.kpiTodayWinners')}
          value={String(winnersToday)}
          icon={<Trophy size={20} />}
          trend={t('abTests.trendAvg7d', { count: '18' })}
        />
        <KPICard
          label={t('abTests.kpiAvgDays')}
          value={`${avgSignificanceDays}${t('abTests.daysUnit')}`}
          icon={<Clock size={20} />}
          trend={t('abTests.trendMonthly', { days: '0.8' })}
        />
        <KPICard
          label={t('abTests.kpiTotalSamples')}
          value="12.4M"
          icon={<BarChart3 size={20} />}
          trend={t('abTests.trendImpressions30d')}
        />
      </div>

      <FilterBar
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        metricFilter={metricFilter}
        searchQuery={searchQuery}
        sortKey={sortKey}
        onStatusChange={handleStatusChange}
        onTypeChange={handleTypeChange}
        onMetricChange={handleMetricChange}
        onSearchChange={handleSearchChange}
        onSortChange={setSortKey}
      />

      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          hasSignificantTests={hasSignificantInSelection}
          onPause={handleBulkPause}
          onResume={handleBulkResume}
          onDelete={handleBulkDelete}
          onDeclareWinners={handleBulkDeclareWinners}
          onClearSelection={clearSelection}
        />
      )}

      {paginatedTests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-16">
          <FlaskConical size={48} className="text-muted-foreground/30" />
          <p className="text-muted-foreground">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || metricFilter !== 'all'
              ? t('abTests.emptyNoMatch')
              : t('abTests.emptyNoTests')}
          </p>
          <p className="text-sm text-muted-foreground/70">
            {t('abTests.emptyHint')}
          </p>
        </div>
      ) : (
        <TestTable
          tests={paginatedTests}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onOpenDetail={setDetailTest}
          onPause={handlePauseOne}
          onResume={handleResumeOne}
          onDeclareWinner={handleDeclareWinner}
        />
      )}

      {sortedTests.length > 0 && (
        <Pagination
          total={sortedTests.length}
          currentPage={currentPage}
          perPage={perPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPerPageChange={handlePerPageChange}
        />
      )}

      <CreateTestModal open={modalOpen} onClose={closeCreate} />
      {detailTest && (
        <TestDetailModal
          test={detailTest}
          onClose={closeDetail}
          onDeclareWinner={handleDeclareWinner}
        />
      )}
    </div>
  );
}
