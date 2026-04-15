'use client';

import { useCallback, useMemo, useState } from 'react';
import { Plus, RefreshCw, Shield } from 'lucide-react';
import { Badge, Button, PageHeader } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/show-toast';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';
import type {
  Competitor,
  CompetitorAlert,
  CounterAction,
  ImpressionShareDataPoint,
  KpiCardInput,
  WeakWindowCell,
} from './_types';
import { AddCompetitorModal } from './_components/add-competitor-modal';
import { AlertBanner } from './_components/alert-banner';
import { CompetitorMapCard } from './_components/competitor-map-card';
import { CounterActionTimeline } from './_components/counter-action-timeline';
import { ImpressionShareChart } from './_components/impression-share-chart';
import { KpiCardRow } from './_components/kpi-card-row';
import { WeakWindowsHeatmap } from './_components/weak-windows-heatmap';

// ============================================================
// Main Page
// ============================================================

export default function CompetitorsPage(): React.ReactElement {
  const { t } = useI18n();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [counterLogExpanded, setCounterLogExpanded] = useState(true);
  const [alertOverrides, setAlertOverrides] = useState<Record<string, true>>({});
  const [scanning, setScanning] = useState(false);

  const competitorsQuery = trpc.competitiveIntel.competitors.list.useQuery(
    undefined,
    { retry: false },
  );
  const alertsQuery = trpc.competitiveIntel.alerts.list.useQuery(
    {},
    { retry: false },
  );
  const trendQuery = trpc.competitiveIntel.auctionInsights.trend.useQuery(
    {},
    { retry: false },
  );
  const counterActionsQuery = trpc.competitiveIntel.counterActions.list.useQuery(
    {},
    { retry: false },
  );

  const competitors: Competitor[] = useMemo(
    () => (competitorsQuery.data as Competitor[] | undefined) ?? [],
    [competitorsQuery.data],
  );
  const alertsData: CompetitorAlert[] = useMemo(
    () => (alertsQuery.data as CompetitorAlert[] | undefined) ?? [],
    [alertsQuery.data],
  );
  const trendData: ImpressionShareDataPoint[] = useMemo(
    () => (trendQuery.data as ImpressionShareDataPoint[] | undefined) ?? [],
    [trendQuery.data],
  );
  const counterActions: CounterAction[] = useMemo(
    () =>
      (counterActionsQuery.data as CounterAction[] | undefined) ?? [],
    [counterActionsQuery.data],
  );

  // Apply local acknowledgement overrides on top of API data.
  const alerts: CompetitorAlert[] = useMemo(
    () =>
      alertsData.map((a) =>
        alertOverrides[a.id] ? { ...a, acknowledged: true } : a,
      ),
    [alertsData, alertOverrides],
  );

  // KPI cards: empty until backend provides aggregated stats.
  const kpiCards: KpiCardInput[] = useMemo(() => [], []);
  // Weak window heatmap: empty until backend provides data.
  const weakWindows: WeakWindowCell[] = useMemo(() => [], []);

  const monitoringEnabled = true;

  const handleAcknowledgeAlert = useCallback((id: string): void => {
    setAlertOverrides((prev) => ({ ...prev, [id]: true }));
  }, []);

  const handleScan = useCallback((): void => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      showToast(t('competitors.scanComplete'));
    }, 3000);
  }, [t]);

  const handleOpenAddModal = useCallback((): void => {
    setAddModalOpen(true);
  }, []);

  const handleCloseAddModal = useCallback((): void => {
    setAddModalOpen(false);
  }, []);

  const handleToggleCounterLog = useCallback((): void => {
    setCounterLogExpanded((prev) => !prev);
  }, []);

  const handleCompetitorSettings = useCallback(
    (id: string): void => {
      const competitor = competitors.find((c) => c.id === id);
      if (!competitor) return;
      showToast(t('competitors.settingsToast', { name: competitor.name }));
    },
    [competitors, t],
  );

  const handleCompetitorDelete = useCallback(
    (id: string): void => {
      const competitor = competitors.find((c) => c.id === id);
      if (!competitor) return;
      if (
        window.confirm(
          t('competitors.deleteConfirm', { name: competitor.name }),
        )
      ) {
        showToast(t('competitors.deleteToast', { name: competitor.name }));
      }
    },
    [competitors, t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Ops"
        title={t('competitors.title')}
        description={t('competitors.description')}
        actions={
          <>
            <Badge
              variant={monitoringEnabled ? 'success' : 'neutral'}
              size="md"
              dot={monitoringEnabled}
              dotClassName={monitoringEnabled ? 'animate-pulse' : undefined}
            >
              {t('competitors.autoMonitoring')}:{' '}
              {monitoringEnabled
                ? t('competitors.monitoringOn')
                : t('competitors.monitoringOff')}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleScan}
              disabled={scanning}
              leadingIcon={
                <RefreshCw
                  size={14}
                  className={cn(scanning && 'animate-spin')}
                />
              }
            >
              {t('competitors.scan')}
            </Button>
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={handleOpenAddModal}
            >
              {t('competitors.addCompetitor')}
            </Button>
          </>
        }
      />

      {/* Alert banner */}
      <AlertBanner alerts={alerts} onAcknowledge={handleAcknowledgeAlert} />

      {/* KPI cards */}
      <KpiCardRow cards={kpiCards} />

      {/* Impression share chart */}
      <ImpressionShareChart data={trendData} />

      {/* Competitor map */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('competitors.competitorMap')}
        </h2>
        {competitors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-12 text-center">
            <Shield size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {t('common.noData')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {competitors.map((competitor) => (
              <CompetitorMapCard
                key={competitor.id}
                competitor={competitor}
                onSettings={handleCompetitorSettings}
                onDelete={handleCompetitorDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Weak windows heatmap */}
      <WeakWindowsHeatmap data={weakWindows} />

      {/* Counter-action timeline */}
      <CounterActionTimeline
        actions={counterActions}
        expanded={counterLogExpanded}
        onToggle={handleToggleCounterLog}
      />

      {/* Add competitor modal */}
      <AddCompetitorModal
        open={addModalOpen}
        onClose={handleCloseAddModal}
      />
    </div>
  );
}
