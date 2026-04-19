'use client';

import { memo } from 'react';
import { Award, BarChart4, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

type Band =
  | 'top_quartile'
  | 'above_median'
  | 'below_median'
  | 'bottom_quartile'
  | 'unknown';

type Comparison = {
  platform: string;
  orgRoas: number;
  industryRoasP50: number | null;
  industryRoasP25: number | null;
  industryRoasP75: number | null;
  roasDeltaPercent: number | null;
  band: Band;
  sampleSize: number;
};

const BAND_STYLES: Record<Band, { label: string; className: string; icon: React.ReactNode }> = {
  top_quartile: {
    label: '上位 25%',
    className: 'bg-success/15 text-success',
    icon: <Award size={12} />,
  },
  above_median: {
    label: '中央値以上',
    className: 'bg-info/15 text-info',
    icon: <TrendingUp size={12} />,
  },
  below_median: {
    label: '中央値以下',
    className: 'bg-warning/15 text-warning',
    icon: <TrendingDown size={12} />,
  },
  bottom_quartile: {
    label: '下位 25%',
    className: 'bg-destructive/15 text-destructive',
    icon: <TrendingDown size={12} />,
  },
  unknown: {
    label: 'ベンチマーク無',
    className: 'bg-muted text-muted-foreground',
    icon: <Minus size={12} />,
  },
};

function formatROAS(n: number): string {
  return `${n.toFixed(2)}x`;
}

function formatPct(n: number | null): string {
  if (n === null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export const BenchmarkPanel = memo(function BenchmarkPanel(): React.ReactElement | null {
  const query = trpc.industryBenchmarks.compareToIndustry.useQuery(
    { windowDays: 7 },
    { retry: false, refetchOnWindowFocus: false },
  );

  if (query.isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <BarChart4 size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">業界ベンチマーク</h2>
        </div>
        <div className="mt-4 flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" />
          <span className="text-sm">計算中...</span>
        </div>
      </div>
    );
  }

  // Null result = org has no industry tag set. Render a compact
  // call-to-action rather than hiding entirely.
  if (query.data === null) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart4 size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              業界タグを設定すると、同業他社との ROAS 比較が表示されます
            </span>
          </div>
          <a
            href="/settings"
            className="text-xs font-medium text-primary hover:underline"
          >
            設定する →
          </a>
        </div>
      </div>
    );
  }

  const comparisons = (query.data as Comparison[] | undefined) ?? [];
  const withBench = comparisons.filter((c) => c.industryRoasP50 !== null);

  if (withBench.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart4 size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">業界ベンチマーク</h2>
        </div>
        <span className="text-xs text-muted-foreground">過去 7 日 / 同業他社比較</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Platform</th>
              <th className="px-3 py-2 text-right">あなた</th>
              <th className="px-3 py-2 text-right">業界中央値</th>
              <th className="px-3 py-2 text-right">差分</th>
              <th className="px-3 py-2 text-left">位置</th>
              <th className="px-3 py-2 text-right">サンプル</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {comparisons.map((c) => {
              const bandCfg = BAND_STYLES[c.band];
              return (
                <tr key={c.platform}>
                  <td className="px-3 py-2 font-mono text-xs">{c.platform}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                    {formatROAS(c.orgRoas)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {c.industryRoasP50 !== null
                      ? formatROAS(c.industryRoasP50)
                      : '—'}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-mono',
                      c.roasDeltaPercent === null
                        ? 'text-muted-foreground'
                        : c.roasDeltaPercent >= 0
                          ? 'text-success'
                          : 'text-destructive',
                    )}
                  >
                    {formatPct(c.roasDeltaPercent)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        bandCfg.className,
                      )}
                    >
                      {bandCfg.icon}
                      {bandCfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    n={c.sampleSize}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        サンプルサイズ 5 社未満のバケットは匿名性保護のため非表示。
      </p>
    </div>
  );
});
