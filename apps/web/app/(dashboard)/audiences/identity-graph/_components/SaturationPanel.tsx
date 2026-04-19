'use client';

import { memo } from 'react';
import { AlertTriangle, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

function riskClass(percent: number): { label: string; className: string } {
  if (percent >= 25) {
    return {
      label: '高リスク',
      className: 'text-destructive bg-destructive/15',
    };
  }
  if (percent >= 10) {
    return {
      label: '中リスク',
      className: 'text-warning bg-warning/15',
    };
  }
  return {
    label: '健全',
    className: 'text-success bg-success/15',
  };
}

export const SaturationPanel = memo(function SaturationPanel(): React.ReactElement {
  const query = trpc.identityGraph.saturation.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (query.isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            オーディエンス飽和度
          </h2>
        </div>
        <div className="mt-6 flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" />
          <span className="text-sm">計算中...</span>
        </div>
      </div>
    );
  }

  const data = query.data;
  if (!data || data.totalIdentities === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            オーディエンス飽和度
          </h2>
        </div>
        <div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            identity-graph にデータがないため飽和度を計算できません
          </p>
        </div>
      </div>
    );
  }

  const risk = riskClass(data.overServedPercent);
  const maxCount = Math.max(...Object.values(data.distribution));
  const bins = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            オーディエンス飽和度
          </h2>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            risk.className,
          )}
        >
          {risk.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        3 つ以上のプラットフォームで同じユーザーに課金していると重複広告費が発生します。
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">総ユニーク ID</div>
          <div className="mt-1 font-mono text-lg font-semibold text-foreground">
            {data.totalIdentities.toLocaleString('ja-JP')}
          </div>
        </div>
        <div className="rounded-md bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">3+ 媒体ユーザー</div>
          <div className="mt-1 font-mono text-lg font-semibold text-foreground">
            {data.overServedCount.toLocaleString('ja-JP')}
          </div>
        </div>
        <div className="rounded-md bg-muted/40 p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertTriangle size={10} />
            重複課金リスク
          </div>
          <div
            className={cn(
              'mt-1 font-mono text-lg font-semibold',
              data.overServedPercent >= 25
                ? 'text-destructive'
                : data.overServedPercent >= 10
                  ? 'text-warning'
                  : 'text-success',
            )}
          >
            {data.overServedPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          プラットフォーム数別 ユーザー分布
        </h3>
        <div className="space-y-1.5">
          {bins.map((n) => {
            const count = data.distribution[n] ?? 0;
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const isOverServed = n >= 3;
            return (
              <div key={n} className="flex items-center gap-3 text-xs">
                <span className="w-16 font-mono text-muted-foreground">
                  {n} 媒体
                </span>
                <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted/40">
                  <div
                    className={cn(
                      'h-full rounded transition-all',
                      isOverServed ? 'bg-warning/60' : 'bg-info/60',
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="w-16 text-right font-mono text-foreground">
                  {count.toLocaleString('ja-JP')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
