'use client';

import { memo, useMemo } from 'react';
import { AlertCircle, Inbox, LayoutGrid } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

export interface CohortHeatmapProps {
  funnelId: string;
  monthCount?: number;
}

interface HeatmapCell {
  pct: number | null;
  matched: number;
}

interface HeatmapRow {
  cohortMonth: string;
  cells: HeatmapCell[];
  totalPct: number;
}

interface HeatmapModel {
  fromStage: string;
  toStage: string;
  rows: HeatmapRow[];
}

interface CohortServerRow {
  cohortMonth: string;
  stageTransitions: Array<{
    fromStage: string;
    toStage: string;
    lagMonths: number[];
    pct: number;
  }>;
}

const LAG_COUNT = 6;
const LAGS = Array.from({ length: LAG_COUNT }, (_, i) => i);

// Colour ramp mirrors the retention helper in ltv/page.tsx — tokens only.
function rampClass(pct: number | null): string {
  if (pct === null || pct === 0) return 'bg-muted/40 text-muted-foreground';
  if (pct >= 0.6) return 'bg-success/20 text-success dark:bg-success/30';
  if (pct >= 0.3) return 'bg-warning/20 text-warning dark:bg-warning/30';
  return 'bg-destructive/15 text-destructive dark:bg-destructive/25';
}

const fmtPct = (pct: number | null): string =>
  pct === null ? '—' : `${(pct * 100).toFixed(1)}%`;

function toHeatmapRow(r: CohortServerRow): HeatmapRow {
  const t = r.stageTransitions[0];
  const cells: HeatmapCell[] = LAGS.map(() => ({ pct: null, matched: 0 }));
  if (!t) return { cohortMonth: r.cohortMonth, cells, totalPct: 0 };
  const perLag = new Map<number, number>();
  for (const lag of t.lagMonths) {
    if (lag >= 0 && lag < LAG_COUNT) perLag.set(lag, (perLag.get(lag) ?? 0) + 1);
  }
  const total = t.lagMonths.length;
  LAGS.forEach((i) => {
    const matched = perLag.get(i) ?? 0;
    cells[i] = { pct: total > 0 ? matched / total : null, matched };
  });
  return { cohortMonth: r.cohortMonth, cells, totalPct: t.pct };
}

function buildModel(rows: CohortServerRow[]): HeatmapModel | null {
  const first = rows[0]?.stageTransitions[0];
  if (!first) return null;
  return {
    fromStage: first.fromStage,
    toStage: first.toStage,
    rows: rows.map(toHeatmapRow),
  };
}

function HeatmapTable({ rows }: { rows: HeatmapRow[] }): React.ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-semibold text-muted-foreground">
              コホート月
            </th>
            {LAGS.map((i) => (
              <th
                key={i}
                className="px-3 py-2 text-center font-semibold text-muted-foreground"
              >{`+${i}ヶ月`}</th>
            ))}
            <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cohortMonth} className="border-t border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-foreground">
                {row.cohortMonth}
              </th>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className="px-1 py-1 text-center"
                  title={`+${i}ヶ月: ${fmtPct(cell.pct)} (matched=${cell.matched})`}
                >
                  <span
                    className={cn(
                      'inline-flex h-8 min-w-[3.5rem] items-center justify-center rounded-md tabular-nums',
                      rampClass(cell.pct),
                    )}
                  >
                    {fmtPct(cell.pct)}
                  </span>
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums text-foreground">
                {`${(row.totalPct * 100).toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CohortHeatmapImpl({
  funnelId,
  monthCount = 6,
}: CohortHeatmapProps): React.ReactElement {
  const query = trpc.monthlyFunnel.getCohortMatrix.useQuery(
    { funnelId, monthCount },
    { enabled: funnelId.length > 0, staleTime: 60_000 },
  );

  const model = useMemo<HeatmapModel | null>(
    () => (query.data ? buildModel(query.data as CohortServerRow[]) : null),
    [query.data],
  );

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">コホート分析</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {LAGS.map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        icon={<AlertCircle size={18} />}
        title="コホート行列を取得できませんでした"
        description={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!model || model.rows.length === 0) {
    return (
      <EmptyState
        icon={<LayoutGrid size={18} />}
        title="コホートデータがありません"
        description="最初の 2 ステージ間の遷移を確認できる月次実績がまだありません。"
      />
    );
  }
  const allEmpty = model.rows.every((r) => r.totalPct === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">コホート分析</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {`${model.fromStage} → ${model.toStage} の遷移率を、コホート月 × 経過月で可視化します。`}
        </p>
      </CardHeader>
      <CardContent>
        {allEmpty ? (
          <EmptyState
            icon={<Inbox size={18} />}
            title="遷移が記録されていません"
            description="対象期間の CV① → CV② 遷移データがまだ存在しません。"
          />
        ) : (
          <HeatmapTable rows={model.rows} />
        )}
      </CardContent>
    </Card>
  );
}

export const CohortHeatmap = memo(CohortHeatmapImpl);
CohortHeatmap.displayName = 'CohortHeatmap';
