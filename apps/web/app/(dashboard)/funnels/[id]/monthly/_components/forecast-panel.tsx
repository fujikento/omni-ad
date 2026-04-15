'use client';

import { memo, useMemo } from 'react';
import { AlertCircle, Inbox, LineChart as LineChartIcon } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@omni-ad/ui';
import { trpc } from '@/lib/trpc';
import type { MonthlyRow, PivotMeta } from '../_types';

export interface ForecastPanelProps {
  funnelId: string;
  endMonth: string;
  months: MonthlyRow[];
  meta?: PivotMeta;
}

type StageKey = 'cv1' | 'cv2' | 'cv3';

interface ChartPoint {
  month: string;
  actual: number | null;
  forecast: number | null;
  band: [number, number] | null;
}

interface ForecastServerPoint {
  month: string;
  cv1: number;
  cv2: number;
  cv3: number;
}

interface ForecastResponse {
  forecast: ForecastServerPoint[];
}

// Service doesn't surface stderr — approximate a confidence band at 15% of
// the forecast value. Band is illustrative, tooltip labels it as 信頼帯.
const BAND_SPREAD = 0.15;

function buildSeries(
  history: MonthlyRow[],
  forecast: ForecastServerPoint[],
  stage: StageKey,
): ChartPoint[] {
  const out: ChartPoint[] = history.map((r) => ({
    month: r.month,
    actual: Number(r[stage] ?? 0),
    forecast: null,
    band: null,
  }));
  if (forecast.length === 0) return out;
  // Seam the last actual to the first forecast so the line is continuous.
  const last = out[out.length - 1];
  if (last) last.forecast = last.actual;
  for (const f of forecast) {
    const value = Number(f[stage] ?? 0);
    const spread = Math.abs(value) * BAND_SPREAD;
    out.push({
      month: f.month,
      actual: null,
      forecast: value,
      band: [Math.max(0, value - spread), value + spread],
    });
  }
  return out;
}

function fmtTooltipValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toLocaleString('ja-JP') : '—';
}

interface StageChartProps {
  stageLabel: string;
  stageKey: StageKey;
  data: ChartPoint[];
}

function StageChartImpl({
  stageLabel,
  stageKey,
  data,
}: StageChartProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
        {`${stageLabel} (${stageKey})`}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="month"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--foreground))',
              fontSize: 12,
            }}
            formatter={fmtTooltipValue}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="band"
            name="信頼帯"
            stroke="none"
            fill="hsl(var(--primary))"
            fillOpacity={0.12}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="実績"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="予測"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const StageChart = memo(StageChartImpl);
StageChart.displayName = 'StageChart';

function ForecastPanelImpl({
  funnelId,
  endMonth,
  months,
  meta,
}: ForecastPanelProps): React.ReactElement {
  const query = trpc.monthlyFunnel.getForecast.useQuery(
    { funnelId, endMonth, monthCount: 12, horizon: 3 },
    { enabled: funnelId.length > 0 && endMonth.length > 0, staleTime: 60_000 },
  );

  const forecast = useMemo<ForecastServerPoint[]>(
    () => (query.data ? ((query.data as ForecastResponse).forecast ?? []) : []),
    [query.data],
  );

  const seriesByStage = useMemo(() => {
    const s = meta?.stages ?? [];
    const stages: Array<{ key: StageKey; label: string }> = [
      { key: 'cv1', label: s[0]?.name ?? 'CV①' },
      { key: 'cv2', label: s[1]?.name ?? 'CV②' },
      { key: 'cv3', label: s[2]?.name ?? 'CV③' },
    ];
    return stages.map((def) => ({
      ...def,
      data: buildSeries(months, forecast, def.key),
    }));
  }, [meta, months, forecast]);

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">フォーキャスト</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        icon={<AlertCircle size={18} />}
        title="フォーキャストを取得できませんでした"
        description={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (months.length === 0) {
    return (
      <EmptyState
        icon={<LineChartIcon size={18} />}
        title="フォーキャストの基礎となる履歴がありません"
        description="予測には最低 6 ヶ月の実績が必要です。"
      />
    );
  }
  if (forecast.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={18} />}
        title="予測データが生成できませんでした"
        description="履歴が十分でない可能性があります。"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">フォーキャスト</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          直近 12 ヶ月の実績と 3 ヶ月先までの予測を、ステージ別に表示します。
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {seriesByStage.map((s) => (
            <StageChart
              key={s.key}
              stageKey={s.key}
              stageLabel={s.label}
              data={s.data}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export const ForecastPanel = memo(ForecastPanelImpl);
ForecastPanel.displayName = 'ForecastPanel';
