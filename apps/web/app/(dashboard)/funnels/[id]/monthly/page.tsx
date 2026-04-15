'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, Inbox } from 'lucide-react';
import { EmptyState, ErrorState, Skeleton } from '@omni-ad/ui';
import { trpc } from '@/lib/trpc';
import { MonthlyFunnelHeader } from './_components/monthly-funnel-header';
import { MonthlyPivotTable } from './_components/monthly-pivot-table';
import { KpiSummaryRow } from './_components/kpi-summary-row';
import { currentMonthKey } from './_utils';
import type { MonthRange, MonthlyPivotResult } from './_types';

function TableSkeleton(): React.ReactElement {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-6 w-48" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export default function MonthlyFunnelPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const funnelId = params?.id ?? '';

  const [range, setRange] = useState<MonthRange>(12);
  const [savingMonth, setSavingMonth] = useState<string | null>(null);
  const endMonth = useMemo(() => currentMonthKey(), []);

  const pivotQuery = trpc.monthlyFunnel.getPivot.useQuery(
    { funnelId, endMonth, monthCount: range },
    { enabled: funnelId.length > 0, staleTime: 60_000 },
  );

  const months = useMemo(
    () => (pivotQuery.data?.months ?? []) as MonthlyPivotResult['months'],
    [pivotQuery.data],
  );

  const visibleMonthKeys = useMemo(() => months.map((m) => m.month), [months]);

  const notesQuery = trpc.monthlyFunnel.listNotes.useQuery(
    { funnelId, months: visibleMonthKeys },
    { enabled: funnelId.length > 0 && visibleMonthKeys.length > 0 },
  );

  const utils = trpc.useUtils();
  const upsertNote = trpc.monthlyFunnel.upsertNote.useMutation({
    onMutate: ({ month }: { month: string }) => {
      setSavingMonth(month);
    },
    onSettled: async () => {
      setSavingMonth(null);
      await utils.monthlyFunnel.listNotes.invalidate({
        funnelId,
        months: visibleMonthKeys,
      });
    },
  });

  const handleNoteSave = useCallback(
    (month: string, text: string) => {
      upsertNote.mutate({ funnelId, month, text });
    },
    [funnelId, upsertNote],
  );

  const notes = useMemo(() => notesQuery.data ?? {}, [notesQuery.data]);
  const meta = pivotQuery.data?.meta;

  const isAllEmpty = months.length > 0 && months.every((m) => m.impressions === 0);

  return (
    <div className="space-y-6">
      <MonthlyFunnelHeader
        range={range}
        onRangeChange={setRange}
        months={months}
        meta={meta}
      />

      {pivotQuery.isLoading ? (
        <TableSkeleton />
      ) : pivotQuery.isError ? (
        <ErrorState
          icon={<AlertCircle size={18} />}
          title="月次ピボットを取得できませんでした"
          description={pivotQuery.error.message}
          onRetry={() => void pivotQuery.refetch()}
        />
      ) : !meta || months.length === 0 || isAllEmpty ? (
        <EmptyState
          icon={<Inbox size={18} />}
          title="表示可能な月次データがありません"
          description="選択中のファネルにはまだ集計された月次実績がありません。"
        />
      ) : (
        <>
          <KpiSummaryRow months={months} />
          <MonthlyPivotTable
            months={months}
            meta={meta}
            notes={notes}
            savingMonth={savingMonth}
            onNoteSave={handleNoteSave}
          />
        </>
      )}
    </div>
  );
}
