'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface KpiSummaryProps {
  activeCount: number;
  totalCount: number;
  totalSpend: number;
  avgRoas: number;
  needsAttentionCount: number;
  formatCurrency: (amount: number) => string;
}

function KpiSummaryImpl({
  activeCount,
  totalCount,
  totalSpend,
  avgRoas,
  needsAttentionCount,
  formatCurrency,
}: KpiSummaryProps): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-xs lg:grid-cols-4">
      <div className="flex flex-col gap-1 bg-card px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          アクティブ
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tabular-nums text-foreground">
            {activeCount}
          </span>
          <span className="text-xs text-muted-foreground">
            / {totalCount}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 bg-card px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          広告費 (今月)
        </span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {formatCurrency(totalSpend)}
        </span>
      </div>
      <div className="flex flex-col gap-1 bg-card px-4 py-3 shadow-[inset_2px_0_0_0_hsl(var(--primary))]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          平均 ROAS
        </span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {avgRoas > 0 ? `${avgRoas.toFixed(2)}x` : '—'}
        </span>
      </div>
      <div className="flex flex-col gap-1 bg-card px-4 py-3">
        <span
          className={cn(
            'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider',
            needsAttentionCount > 0 ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {needsAttentionCount > 0 && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
          )}
          要対応
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tabular-nums text-foreground">
            {needsAttentionCount}
          </span>
          <span className="text-xs text-muted-foreground">件</span>
        </div>
      </div>
    </div>
  );
}

export const KpiSummary = memo(KpiSummaryImpl);
